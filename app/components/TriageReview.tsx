'use client';

import { useMemo, useState } from 'react';
import { Card, Tooltip, Typography, theme } from 'antd';
import { ArrowRightOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { QualityEvent } from '@/data/types';
import { ExpandToggle } from './CardControls';
import { BRAND } from '@/lib/theme';

const { Text } = Typography;
function MetricInfoIcon({ tooltip, token }: { tooltip: string; token: ReturnType<typeof theme.useToken>['token'] }) {
  // A raw 12px icon fails the 24px target floor (WCAG 2.5.8); the button hits
  // it while the negative margin keeps the visual footprint unchanged.
  return (
    <Tooltip title={tooltip}>
      <button
        type="button"
        aria-label={tooltip}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{
          width: 24, height: 24, margin: '-6px 0 -6px 0', marginLeft: 0, padding: 0,
          border: 'none', background: 'transparent', cursor: 'help',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: token.colorTextTertiary, fontSize: token.fontSizeSM,
        }}
      >
        <InfoCircleOutlined />
      </button>
    </Tooltip>
  );
}

// Clickable bar row with an explicit hover affordance: background tint and a
// trailing arrow, matching the app's "this navigates" language.
function ClickableBarRow({ onNavigate, ariaLabel, children }: {
  onNavigate: () => void; ariaLabel: string; children: React.ReactNode;
}) {
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={ariaLabel}
      style={{
        cursor: 'pointer',
        position: 'relative',
        padding: '4px 6px',
        margin: '-4px -6px',
        borderRadius: token.borderRadiusSM,
        background: hovered ? token.colorFillTertiary : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {children}
      <ArrowRightOutlined style={{
        position: 'absolute',
        right: 6,
        bottom: 3,
        fontSize: token.fontSizeXS,
        color: token.colorLink,
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.15s',
      }} />
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

// Root Cause is set as part of normal resolution, not a correction to a poor submission —
// exclude it so this card reflects only edits to what the tech originally reported.
const isPoorSubmissionEdit = (entry: { field: string }) => entry.field !== 'Root Cause';

// Standalone card: post-submission edits by Field Quality, broken down by
// branch. Lives in the dashboard's bottom analysis row.
export function EventsUpdatedByFqCard({ events }: { events: QualityEvent[] }) {
  const { token } = theme.useToken();
  const router    = useRouter();

  const allEdits = useMemo(() =>
    events.flatMap(e => (e.editHistory ?? []).filter(isPoorSubmissionEdit)),
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
  const BRANCH_PREVIEW  = 10;
  const visibleBranches = showAllBranches ? editsByBranch : editsByBranch.slice(0, BRANCH_PREVIEW);

  return (
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                Events Updated by Field Quality
                <MetricInfoIcon tooltip="Events whose details were edited by Field Quality after submission, broken down by branch. Frequent edits can point to unclear submissions from the field. Click a branch to open its edited events in the table." token={token} />
              </span>
            }
            style={{ height: '100%' }}
            extra={
              editsByBranch.length > BRANCH_PREVIEW
                ? <ExpandToggle expanded={showAllBranches} onToggle={() => setShowAllBranches(v => !v)} />
                : undefined
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
                          <ClickableBarRow
                            onNavigate={() => router.push(`/events?flag=edited&branch=${encodeURIComponent(branch)}`)}
                            ariaLabel={label}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                              <Text style={{ fontSize: token.fontSizeSM }}>{branch}</Text>
                              <span>
                                <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginRight: 6 }}>{editedCount} of {totalCount}</Text>
                                <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600, color: pct >= 20 ? token.colorWarning : token.colorText }}>{pct}%</Text>
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: token.colorFillSecondary, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: BRAND.colorGold, borderRadius: 2, transition: 'width 0.4s' }} />
                            </div>
                          </ClickableBarRow>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* By Field */}
                <div>
                  <Text style={{ fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
                    What&apos;s Being Changed
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
            <ClickableBarRow key={branch} onNavigate={() => router.push(`/events?flag=edited&branch=${encodeURIComponent(branch)}`)} ariaLabel={`Filter events by branch: ${branch}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: token.fontSizeSM }}>{branch}</Text>
                <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{count}</Text>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: token.colorFillSecondary, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((count / maxBranchCount) * 100)}%`, background: BRAND.colorGold, borderRadius: 2, transition: 'width 0.4s' }} />
              </div>
            </ClickableBarRow>
          ))}
        </div>
      </div>
      <div>
        <Text style={{ fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
          What&apos;s Being Changed
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

