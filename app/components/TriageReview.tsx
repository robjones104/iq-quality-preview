'use client';

import { useMemo, useState } from 'react';
import { Card, Col, Row, Tooltip, Typography, theme } from 'antd';
import { HourglassFilled, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
import type { QualityEvent } from '@/data/types';
import { StatusTag } from '@/components/StatusTag';
import { ExpandToggle, Dot } from './CardControls';

const { Text, Paragraph } = Typography;
const TODAY = now();

const STALE_MIN = 7;

function ageDays(date: string): number {
  return TODAY.diff(dayjs(date), 'day');
}

function MetricInfoIcon({ tooltip, token }: { tooltip: string; token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <Tooltip title={tooltip}>
      <InfoCircleOutlined
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ marginLeft: 6, color: token.colorTextTertiary, fontSize: token.fontSizeSM, cursor: 'help' }}
      />
    </Tooltip>
  );
}

function WaitingCard({ event }: { event: QualityEvent }) {
  const { token } = theme.useToken();
  const days = ageDays(event.date);
  return (
    <div style={{
      background: token.colorFillQuaternary,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusSM,
      padding: '8px 10px',
      display: 'flex',
      gap: 10,
    }}>
      {/* Left: ID + status tag, then name · branch */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <Link href={`/events/${event.id}`} style={{ fontSize: token.fontSizeSM, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {event.id}
          </Link>
          <StatusTag status={event.status} additionalInfoRequested={!!event.additionalInfoRequested} />
        </div>
        <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap' }}>
          {event.reportedBy} · {event.branch}
        </Text>
      </div>

      {/* Right: comment + days side by side, both top-aligned */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {event.additionalInfoNote && (
          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{
              flex: 1,
              minWidth: 0,
              marginBottom: 0,
              fontSize: token.fontSizeSM,
              color: token.colorTextSecondary,
              overflowWrap: 'anywhere',
            }}
          >
            {event.additionalInfoNote}
          </Paragraph>
        )}
        <Text style={{
          flexShrink: 0,
          fontSize: token.fontSizeXS,
          fontWeight: 600,
          color: days >= STALE_MIN ? token.colorWarning : token.colorTextTertiary,
          lineHeight: '16px',
        }}>
          {days}d
        </Text>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  const { token } = theme.useToken();
  return (
    <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
      <span style={{ fontSize: token.fontSizeHeading3 }}>{icon}</span>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{message}</Text>
    </div>
  );
}

export function TriageReview({ events, waitingViewAllHref, dataQualityViewAllHref }: { events: QualityEvent[]; waitingViewAllHref?: string; dataQualityViewAllHref?: string }) {
  const { token } = theme.useToken();
  const router    = useRouter();

  const waitingEvents = useMemo(() =>
    events
      .filter(e => !!e.additionalInfoRequested)
      .sort((a, b) => ageDays(b.date) - ageDays(a.date)),
    [events]
  );

  // Root Cause is set as part of normal resolution, not a correction to a poor submission —
  // exclude it so this card reflects only edits to what the tech originally reported.
  const isPoorSubmissionEdit = (entry: { field: string }) => entry.field !== 'Root Cause';

  const allEdits = useMemo(() =>
    events.flatMap(e => (e.editHistory ?? []).filter(isPoorSubmissionEdit)),
    [events]
  );

  const eventsEdited = useMemo(() =>
    events.filter(e => e.editHistory?.some(isPoorSubmissionEdit)).length,
    [events]
  );

  const editsByBranch = useMemo(() => {
    const totalByBranch: Record<string, number> = {};
    const editedByBranch: Record<string, number> = {};
    for (const e of events) {
      totalByBranch[e.branch] = (totalByBranch[e.branch] ?? 0) + 1;
      if (e.editHistory?.some(isPoorSubmissionEdit)) editedByBranch[e.branch] = (editedByBranch[e.branch] ?? 0) + 1;
    }
    return Object.entries(editedByBranch)
      .map(([branch, editedCount]) => {
        const totalCount = totalByBranch[branch] ?? editedCount;
        return { branch, editedCount, totalCount, pct: totalCount > 0 ? Math.round((editedCount / totalCount) * 100) : 0 };
      })
      .sort((a, b) => b.pct - a.pct || b.editedCount - a.editedCount);
  }, [events]);

  const editsByField = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of allEdits) {
      counts[entry.field] = (counts[entry.field] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count);
  }, [allEdits]);

  const [showAllBranches, setShowAllBranches]   = useState(false);
  const WAITING_PREVIEW = 10;
  const BRANCH_PREVIEW  = 10;
  const visibleWaiting  = waitingEvents.slice(0, WAITING_PREVIEW);
  const visibleBranches = showAllBranches ? editsByBranch : editsByBranch.slice(0, BRANCH_PREVIEW);


  return (
    <div>
      <Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}
      >
        Review
      </Text>

      <Row gutter={token.marginSM} style={{ alignItems: 'flex-start' }}>

        {/* Pending Information */}
        <Col xs={24} lg={16}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                Pending Information
                <MetricInfoIcon tooltip="Events waiting on info from the field." token={token} />
              </span>
            }
            extra={
              waitingEvents.length === 0
                ? <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>All clear</Text>
                : waitingViewAllHref
                    ? <Link href={waitingViewAllHref} style={{ fontSize: token.fontSizeSM }}>View in Table ({waitingEvents.length})</Link>
                    : <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>View in Table ({waitingEvents.length})</Text>
            }
            styles={{ body: { minHeight: 320, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 } }}
          >
            {waitingEvents.length === 0 ? (
              <EmptyState
                icon={<HourglassFilled />}
                message="No events waiting on tech info"
              />
            ) : (
              visibleWaiting.map(e => (
                <WaitingCard key={e.id} event={e} />
              ))
            )}
          </Card>
        </Col>

        {/* Poor Submissions by Branch */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                Events Updated by Branch
                <MetricInfoIcon tooltip="Events cleaned up or edited after submission, by branch." token={token} />
              </span>
            }
            extra={
              allEdits.length === 0
                ? undefined
                : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dataQualityViewAllHref
                      ? <Link href={dataQualityViewAllHref} style={{ fontSize: token.fontSizeSM }}>View in Table ({eventsEdited})</Link>
                      : <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>View in Table ({eventsEdited})</Text>}
                    {editsByBranch.length > BRANCH_PREVIEW && (
                      <>
                        <Dot />
                        <ExpandToggle expanded={showAllBranches} onToggle={() => setShowAllBranches(v => !v)} />
                      </>
                    )}
                  </div>
            }
            styles={{ body: { minHeight: 320, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 } }}
          >
            {allEdits.length === 0 ? (
              <EmptyState icon={<EditOutlined />} message="No data edits in this period" />
            ) : (
              <>
                {/* By Branch */}
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visibleBranches.map(({ branch, editedCount, totalCount, pct }) => {
                      const label = `${branch}: ${editedCount} of ${totalCount} events edited (${pct}%)`;
                      return (
                        <Tooltip key={branch} title={label}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/events?branch=${encodeURIComponent(branch)}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/events?branch=${encodeURIComponent(branch)}`); } }}
                            aria-label={label}
                            style={{ cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                              <Text style={{ fontSize: token.fontSizeSM }}>{branch}</Text>
                              <span>
                                <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginRight: 6 }}>{editedCount} of {totalCount}</Text>
                                <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600, color: pct >= 20 ? token.colorWarning : token.colorText }}>{pct}%</Text>
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: token.colorFillSecondary, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: token.colorWarning, borderRadius: 2, transition: 'width 0.4s' }} />
                            </div>
                          </div>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* By Field */}
                <div>
                  <Text style={{ fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
                    What's Being Changed
                  </Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {editsByField.map(({ field, count }) => (
                      <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: token.colorFillSecondary, borderRadius: token.borderRadiusSM }}>
                        <Text style={{ fontSize: token.fontSizeSM }}>{field}</Text>
                        <Text style={{ fontSize: token.fontSizeXS, fontWeight: 700, color: token.colorTextTertiary }}>{count}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>
        </Col>

      </Row>
    </div>
  );
}

export function WaitingOnTechChart({ events }: { events: QualityEvent[] }) {
  const { token } = theme.useToken();
  const waitingEvents = useMemo(() =>
    events.filter(e => !!e.additionalInfoRequested).sort((a, b) => ageDays(b.date) - ageDays(a.date)),
    [events]
  );
  const preview = waitingEvents.slice(0, 3);

  if (waitingEvents.length === 0) {
    return (
      <EmptyState icon={<HourglassFilled />} message="No events waiting on tech info" />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginBottom: 2 }}>
        {waitingEvents.length} pending
      </div>
      {preview.map(e => <WaitingCard key={e.id} event={e} />)}
    </div>
  );
}

export function DataQualityChart({ events }: { events: QualityEvent[] }) {
  const { token } = theme.useToken();
  const router = useRouter();

  const allEdits = useMemo(() => events.flatMap(e => e.editHistory ?? []), [events]);
  const eventsEdited = useMemo(() => events.filter(e => e.editHistory && e.editHistory.length > 0).length, [events]);
  const reclassRate = events.length > 0 ? Math.round((eventsEdited / events.length) * 100) : 0;

  const editsByBranch = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      if (!e.editHistory?.length) continue;
      counts[e.branch] = (counts[e.branch] ?? 0) + e.editHistory.length;
    }
    return Object.entries(counts).map(([branch, count]) => ({ branch, count })).sort((a, b) => b.count - a.count);
  }, [events]);

  const editsByField = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of allEdits) { counts[entry.field] = (counts[entry.field] ?? 0) + 1; }
    return Object.entries(counts).map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count);
  }, [allEdits]);

  const maxBranchCount = editsByBranch[0]?.count ?? 1;
  const visibleBranches = editsByBranch.slice(0, 4);

  if (allEdits.length === 0) {
    return <EmptyState icon={<EditOutlined />} message="No data edits in this period" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontSize: token.fontSizeHeading2, fontWeight: 700, lineHeight: 1, color: reclassRate >= 20 ? token.colorWarning : token.colorText }}>
          {reclassRate}%
        </Text>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>of events recategorized</Text>
      </div>
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleBranches.map(({ branch, count }) => (
            <div key={branch} role="button" tabIndex={0} onClick={() => router.push(`/events?branch=${encodeURIComponent(branch)}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/events?branch=${encodeURIComponent(branch)}`); } }} aria-label={`Filter events by branch: ${branch}`} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: token.fontSizeSM }}>{branch}</Text>
                <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{count}</Text>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: token.colorFillSecondary, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((count / maxBranchCount) * 100)}%`, background: token.colorWarning, borderRadius: 2, transition: 'width 0.4s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Text style={{ fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
          What's Being Changed
        </Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {editsByField.map(({ field, count }) => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: token.colorFillSecondary, borderRadius: token.borderRadiusSM }}>
              <Text style={{ fontSize: token.fontSizeSM }}>{field}</Text>
              <Text style={{ fontSize: token.fontSizeXS, fontWeight: 700, color: token.colorTextTertiary }}>{count}</Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

