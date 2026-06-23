'use client';

import { useMemo, useState } from 'react';
import { Card, Col, Row, Typography, theme } from 'antd';
import { HourglassFilled } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import type { QualityEvent } from '@/data/types';
import { useFilterStore } from '@/store/filterStore';
import { STATUS_COLORS, StatusTag } from '@/components/StatusTag';

const { Text } = Typography;
const TODAY = dayjs();

const FRESH_MAX = 3;
const STALE_MIN = 7;
const LIST_MAX  = 8;

function ageDays(date: string): number {
  return TODAY.diff(dayjs(date), 'day');
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
          <StatusTag status={event.status} />
        </div>
        <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap' }}>
          {event.reportedBy} · {event.branch}
        </Text>
      </div>

      {/* Right: comment + days side by side, both top-aligned */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {event.additionalInfoNote && (
          <Text style={{
            flex: 1,
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {event.additionalInfoNote}
          </Text>
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

export function TriageReview({ events }: { events: QualityEvent[] }) {
  const { token } = theme.useToken();
  const router    = useRouter();
  const { dateRange } = useFilterStore();

  const matrix = useMemo(() => {
    const cells = {
      fresh: { reported: 0, underInv: 0 },
      aging: { reported: 0, underInv: 0 },
      stale: { reported: 0, underInv: 0 },
    };
    for (const e of events) {
      if (e.status !== 'Reported' && e.status !== 'Under Investigation') continue;
      const age = ageDays(e.date);
      const bucket = age < FRESH_MAX ? 'fresh' : age < STALE_MIN ? 'aging' : 'stale';
      if (e.status === 'Reported') cells[bucket].reported++;
      else cells[bucket].underInv++;
    }
    return cells;
  }, [events]);

  const openTotal = Object.values(matrix).reduce((sum, b) => sum + b.reported + b.underInv, 0);

  const resolved = events.filter(e => e.status === 'Validated' || e.status === 'Invalidated').length;
  const resolutionRate = events.length > 0 ? Math.round((resolved / events.length) * 100) : 0;

  const waitingEvents = useMemo(() =>
    events
      .filter(e => !!e.additionalInfoRequested)
      .sort((a, b) => ageDays(b.date) - ageDays(a.date)),
    [events]
  );

  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const WAITING_PREVIEW = 3;
  const visibleWaiting = showAllWaiting ? waitingEvents : waitingEvents.slice(0, WAITING_PREVIEW);

  const matrixRows = [
    { key: 'fresh' as const, label: 'Fresh', sub: `0–${FRESH_MAX - 1}d`, dr: (): [ReturnType<typeof dayjs>, ReturnType<typeof dayjs>] => [TODAY.subtract(FRESH_MAX - 1, 'day'), TODAY] },
    { key: 'aging' as const, label: 'Aging', sub: `${FRESH_MAX}–${STALE_MIN - 1}d`, dr: (): [ReturnType<typeof dayjs>, ReturnType<typeof dayjs>] => [TODAY.subtract(STALE_MIN - 1, 'day'), TODAY.subtract(FRESH_MAX, 'day')] },
    { key: 'stale' as const, label: 'Stale', sub: `${STALE_MIN}+d`, dr: (): [ReturnType<typeof dayjs>, ReturnType<typeof dayjs>] => [dateRange ? dateRange[0] : TODAY.subtract(2, 'year'), TODAY.subtract(STALE_MIN, 'day')] },
  ];

  const matrixCols = [
    { key: 'reported' as const, label: 'Reported',   status: 'Reported',           color: STATUS_COLORS['Reported'] },
    { key: 'underInv' as const, label: 'Under Inv.', status: 'Under Investigation', color: STATUS_COLORS['Under Investigation'] },
  ];

  const navigate = (dr: [ReturnType<typeof dayjs>, ReturnType<typeof dayjs>], status: string) => {
    const from = dr[0].format('YYYY-MM-DD');
    const to   = dr[1].format('YYYY-MM-DD');
    router.push(`/events?status=${encodeURIComponent(status)}&from=${from}&to=${to}`);
  };

  return (
    <div>
      <Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}
      >
        Triage / Review
      </Text>

      <Row gutter={token.marginSM} style={{ alignItems: 'flex-start' }}>

        {/* Queue Health — Risk Matrix */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Queue Health</span>}
            extra={<span style={{ fontSize: token.fontSizeSM, color: token.colorTextQuaternary }}>{openTotal} open · {resolutionRate}% resolved</span>}
            style={{ display: 'flex', flexDirection: 'column' }}
            styles={{ body: { display: 'flex', flexDirection: 'column', minHeight: 320 } }}
          >
            {(() => {
              const rowHeat: Record<string, string> = {
                fresh: token.colorBgContainer,
                aging: token.colorWarningBg,
                stale: token.colorWarningBgHover,
              };
              return (
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gridTemplateRows: 'auto 1fr 1fr 1fr', gap: 1, background: token.colorBorderSecondary, borderRadius: token.borderRadiusSM, overflow: 'hidden' }}>
                  <div style={{ background: token.colorFillTertiary }} />
                  {matrixCols.map(col => (
                    <div key={col.key} style={{ background: token.colorFillTertiary, padding: '8px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 1, background: col.color, display: 'inline-block', flexShrink: 0 }} />
                      <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{col.label}</Text>
                    </div>
                  ))}
                  {matrixRows.map(row => ([
                    <div key={`${row.key}-label`} style={{ background: rowHeat[row.key], padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{row.label}</Text>
                      <Text type="secondary" style={{ fontSize: token.fontSizeXS }}>{row.sub}</Text>
                    </div>,
                    ...matrixCols.map(col => {
                      const count = matrix[row.key][col.key];
                      const bg = rowHeat[row.key];
                      return (
                        <div
                          key={`${row.key}-${col.key}`}
                          onClick={() => navigate(row.dr(), col.status)}
                          style={{ background: bg, padding: '16px 8px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.background = token.colorFillSecondary)}
                          onMouseLeave={e => (e.currentTarget.style.background = bg)}
                        >
                          <Text style={{ fontSize: token.fontSizeHeading3, fontWeight: 700, lineHeight: 1 }}>{count}</Text>
                        </div>
                      );
                    }),
                  ]))}
                </div>
              );
            })()}
          </Card>
        </Col>

        {/* Waiting on Tech */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Waiting on Tech</span>}
            extra={
              waitingEvents.length === 0
                ? <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>All clear</Text>
                : <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                    {waitingEvents.length} pending
                    {waitingEvents.length > WAITING_PREVIEW && (
                      <>
                        {' · '}
                        <Typography.Link
                          style={{ fontSize: token.fontSizeSM }}
                          onClick={() => setShowAllWaiting(v => !v)}
                        >
                          {showAllWaiting ? 'Show less' : 'View all'}
                        </Typography.Link>
                      </>
                    )}
                  </span>
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

        {/* TBD — third triage card */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Coming Soon</span>}
            styles={{ body: { minHeight: 320 } }}
          >
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Third triage card — TBD</Text>
            </div>
          </Card>
        </Col>

      </Row>
    </div>
  );
}
