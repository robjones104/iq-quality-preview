'use client';

import { Fragment, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Tag, Typography, theme } from 'antd';

import { Chart as G2Chart } from '@antv/g2';
import { isDailyRange } from './FieldIntake';
import type { DateRange } from './DateRangeFilter';
import { ExportOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
import type { Order } from '@/data/orders';
import type { QualityEvent } from '@/data/types';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';

const { Text } = Typography;


function parseOrderDate(lastUpdated: string): dayjs.Dayjs {
  const [mm, dd, yyyy] = lastUpdated.slice(0, 10).split('-');
  return dayjs(`${yyyy}-${mm}-${dd}`);
}

// The four chart segments in stack order. Fulfilled = approved then closed
// (the backend's order:fulfill action); it shares the Approved green family,
// light while open, solid once fulfilled. Open work sits at the bottom of
// every bar; finished work on top.
const STAGES = ['Pending Decision', 'Approved', 'Fulfilled', 'Declined'] as const;

const TODAY = now();

function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


function GroupedStackTrend({ data, stages, colors, plotTheme, legendGroups, daily = false, ariaLabel, onSegmentClick }: {
  data: Record<string, string | number>[];
  stages: readonly string[];
  colors: string[];
  plotTheme: string;
  // HTML legend grouped by series so Open/Closed membership is explicit.
  legendGroups: { label: string; stages: string[] }[];
  // Daily buckets drop the "Week of" tooltip prefix.
  daily?: boolean;
  ariaLabel: string;
  onSegmentClick: (datum: { stage?: string; weekStart?: string; weekEnd?: string }) => void;
}) {
  const { token } = theme.useToken();
  const container = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onSegmentClick);
  useEffect(() => {
    clickRef.current = onSegmentClick;
  }, [onSegmentClick]);

  useEffect(() => {
    if (!container.current) return;
    const chart = new G2Chart({ container: container.current, autoFit: true });
    chart.options({
      type: 'interval',
      data,
      encode: { x: 'week', y: 'count', color: 'stage', series: 'status' },
      transform: [{ type: 'stackY', groupBy: ['x', 'series'] }, { type: 'dodgeX' }],
      // Consistent air: paddingInner spaces the week groups; the series scale
      // spaces the Open/Closed pair inside each week.
      scale: {
        color: { domain: [...stages], range: colors },
        x: { paddingInner: 0.35, paddingOuter: 0.08 },
        series: { paddingInner: 0.12 },
      },
      theme: plotTheme,
      // Reserve right-edge room so the final week's bars/label are not
      // clipped by the canvas edge (A3).
      paddingRight: 24,
      animate: false,
      axis: {
        x: { title: false, labelFill: token.colorText, labelFontSize: token.fontSizeSM, line: false, tickStroke: token.colorBorderSecondary },
        y: { title: false, labelFill: token.colorText, labelFontSize: token.fontSizeSM, gridStroke: token.colorBorderSecondary, gridLineWidth: 1, tickCount: 4 },
      },
      legend: false,
      tooltip: {
        title: (d: Record<string, string>) => `${daily ? '' : 'Week of '}${d.week} \u00b7 ${d.status} orders`,
        items: [(d: Record<string, string | number>) => ({ name: String(d.stage), value: String(d.count) })],
      },
      state: { active: { opacity: 1 }, inactive: { opacity: 0.15 } },
      interaction: { elementHighlight: true },
    });
    chart.render();
    chart.on('element:click', (ev: { data?: { data?: Record<string, string> } }) => {
      const datum = ev.data?.data;
      if (datum) clickRef.current(datum);
    });
    return () => { chart.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, daily, plotTheme, token.colorText, token.colorBorderSecondary]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div ref={container} role="img" aria-label={ariaLabel} style={{ width: '100%', flex: 1, minHeight: 0, cursor: 'pointer' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 6 }}>
        {legendGroups.map((group, gi) => (
          <Fragment key={group.label}>
            {gi > 0 && (
              <span aria-hidden style={{ width: 1, height: 12, background: token.colorBorder, display: 'inline-block' }} />
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{group.label}</Text>
              {group.stages.map(stage => (
                <span key={stage} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: colors[stages.indexOf(stage)], display: 'inline-block' }} />
                  <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>{stage}</Text>
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}


export function DecisionTrendChart({
  orders,
  dateRange = null,
  height = 240,
  fill = false,
}: {
  orders: Order[];
  // Ranges of two weeks or less bucket per day instead of per week.
  dateRange?: DateRange | null;
  height?: number;
  // Fill the parent container's height (parent must have a concrete height,
  // e.g. a flex-stretched card body) instead of a fixed pixel height.
  fill?: boolean;
}) {
  const { token } = theme.useToken();
  const router = useRouter();
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';
  // Weekly cohorts by current stage: each week renders an Open column
  // (Pending Decision + Approved stacked) beside a Closed column (Fulfilled +
  // Declined stacked). Old cohorts read almost entirely Closed; recent weeks
  // carry tall Open columns — the gap is the backlog aging.
  const trendData = useMemo(() => {
    const stageOf = (o: Order): typeof STAGES[number] | null => {
      if (o.declined) return 'Declined';
      if (o.approved) return o.orderStatus === 'Closed' ? 'Fulfilled' : 'Approved';
      return o.orderStatus === 'Open' ? 'Pending Decision' : null;
    };
    const daily = isDailyRange(dateRange);
    const weekMap: Record<string, { counts: Record<string, number>; sortKey: number }> = {};
    for (const order of orders) {
      const stage = stageOf(order);
      if (!stage) continue;
      const d = parseOrderDate(order.lastUpdated);
      const dow = d.day();
      const periodStart = daily ? d.startOf('day') : d.subtract(dow === 0 ? 6 : dow - 1, 'day');
      const key = periodStart.format('MMM D');
      if (!weekMap[key]) weekMap[key] = { counts: {}, sortKey: periodStart.valueOf() };
      weekMap[key].counts[stage] = (weekMap[key].counts[stage] ?? 0) + 1;
    }
    return Object.entries(weekMap)
      .sort(([, a], [, b]) => a.sortKey - b.sortKey)
      .flatMap(([week, { counts, sortKey }]) => {
        const ws = dayjs(sortKey);
        const weekStart = ws.format('YYYY-MM-DD');
        const weekEnd   = daily ? weekStart : ws.add(6, 'day').format('YYYY-MM-DD');
        return STAGES.map(stage => ({
          week, weekStart, weekEnd, stage,
          status: stage === 'Pending Decision' || stage === 'Approved' ? 'Open' : 'Closed',
          count: counts[stage] ?? 0,
        }));
      });
  }, [orders, dateRange]);

  if (trendData.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No decision data</Text>
      </div>
    );
  }
  return (
    <div style={fill ? { flex: 1, minHeight: 0, height: '100%' } : { height }}>
      <GroupedStackTrend
        data={trendData}
        stages={STAGES}
        colors={['#1677ff', '#95de64', '#389e0d', '#595959']}
        plotTheme={plotTheme}
        legendGroups={[
          { label: 'Open', stages: ['Pending Decision', 'Approved'] },
          { label: 'Closed', stages: ['Fulfilled', 'Declined'] },
        ]}
        daily={isDailyRange(dateRange)}
        ariaLabel="Decision trend: order counts per period, one Open column (pending decision plus approved) beside one Closed column (fulfilled plus declined)"

        onSegmentClick={(datum) => {
          if (!datum?.stage) return;
          const params = new URLSearchParams();
          if (datum.stage === 'Pending Decision') { params.set('orderStatus', 'Open'); params.set('decision', 'Pending'); }
          else if (datum.stage === 'Approved') { params.set('orderStatus', 'Open'); params.set('decision', 'Approved'); }
          else if (datum.stage === 'Fulfilled') { params.set('orderStatus', 'Closed'); params.set('decision', 'Approved'); }
          else { params.set('decision', 'Declined'); }
          if (datum.weekStart && datum.weekEnd) { params.set('from', datum.weekStart); params.set('to', datum.weekEnd); }
          router.push('/orders?' + params.toString());
        }}
      />
    </div>
  );
}

type DeclinedItem = {
  id: string;
  eventId: string;
  jobNo: string;
  branch: string;
  reason: string;
  dateDeclined: string;
  ageDays: number;
  sortTs: number;
};

function buildDeclinedItems(orders: Order[], eventMap: Map<string, QualityEvent>): DeclinedItem[] {
  return orders
    .filter(o => o.declined)
    .map(o => {
      const ev = eventMap.get(o.eventId);
      const d = parseOrderDate(o.lastUpdated);
      return {
        id: o.id,
        eventId: o.eventId,
        jobNo: o.jobNo,
        branch: ev?.branch ?? '—',
        reason: o.declineReason ?? '—',
        dateDeclined: d.format('MMM D, YYYY'),
        ageDays: TODAY.diff(d, 'day'),
        sortTs: d.valueOf(),
      };
    })
    .sort((a, b) => b.sortTs - a.sortTs);
}

export function DeclinedCsvButton({ orders }: { orders: Order[] }) {
  const eventMap = useEffectiveEventMap();
  const declinedItems = useMemo(() => buildDeclinedItems(orders, eventMap), [orders, eventMap]);
  return (
    <Button
      size="small"
      type="text"
      icon={<ExportOutlined />}
      disabled={declinedItems.length === 0}
      onClick={() => exportToCsv(
        `declined-orders-export-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Order ID', 'Job No.', 'Branch', 'Reason for Decline', 'Date Declined', 'Age (days)'],
        declinedItems.map(d => [d.id, d.jobNo, d.branch, d.reason, d.dateDeclined, d.ageDays]),
      )}
    >
      Export
    </Button>
  );
}

export function DeclinedOrdersPreview({ orders }: { orders: Order[] }) {
  const { token } = theme.useToken();
  const eventMap = useEffectiveEventMap();
  const declinedItems = useMemo(() => buildDeclinedItems(orders, eventMap), [orders, eventMap]);
  const preview = declinedItems.slice(0, 5);

  if (declinedItems.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8, color: token.colorTextTertiary }}>
        <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No declined orders</Text>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>
          {declinedItems.length} declined
        </span>
        <Link href="/orders?decision=Declined" style={{ fontSize: token.fontSizeSM }}>
          View in Table ({declinedItems.length})
        </Link>
      </div>
      {preview.map(item => (
        <div key={item.id} style={{
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusSM,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <Link href={`/orders/${item.id}`} style={{ fontSize: token.fontSizeSM, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none' }}>
                {item.eventId}
              </Link>
              <Tag color="default" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px', margin: 0 }}>
                {item.branch}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {item.reason}
            </Text>
          </div>
          <Text style={{ flexShrink: 0, fontSize: token.fontSizeXS, fontWeight: 600, color: token.colorTextTertiary, lineHeight: '16px' }}>
            {item.ageDays}d
          </Text>
        </div>
      ))}
    </div>
  );
}
