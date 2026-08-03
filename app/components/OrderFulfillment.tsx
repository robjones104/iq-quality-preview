'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Tag, Typography, theme } from 'antd';

import { Chart as G2Chart } from '@antv/g2';
import { ExportOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
import type { Order } from '@/data/orders';
import type { QualityEvent } from '@/data/types';
import { isReporterSide } from '@/components/TechReplyWarning';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';

const { Text, Paragraph } = Typography;
const STALE_DAYS = 3;


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

type PendingItem = {
  id: string;
  eventId: string;
  jobNo: string;
  branch: string;
  component: string;
  partsCount: number;
  ageDays: number;
  commentCount: number;
  latestComment: string | null;
  techReplied: boolean;
};

function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


function PendingRow({ item, token }: { item: PendingItem; token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <div style={{
      position: 'relative',
      background: token.colorFillQuaternary,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusSM,
      padding: '8px 10px',
      display: 'flex',
      gap: 10,
    }}>
      {/* Left: ID + parts tag, then branch · component */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <Link href={`/orders/${item.id}`} style={{ fontSize: token.fontSizeSM, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {item.eventId}
          </Link>
          <Tag color="geekblue" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px', margin: 0 }}>
            {item.partsCount} part{item.partsCount !== 1 ? 's' : ''}
          </Tag>
        </div>
        <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap' }}>
          {item.branch} · {item.component}
        </Text>
      </div>

      {/* Right: latest comment + age, top-aligned */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {item.latestComment && (
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
            {item.latestComment}
          </Paragraph>
        )}
        <Text style={{
          flexShrink: 0,
          marginLeft: 'auto',
          fontSize: token.fontSizeXS,
          fontWeight: 600,
          color: item.ageDays >= STALE_DAYS ? token.colorWarning : token.colorTextTertiary,
          lineHeight: '16px',
        }}>
          {item.ageDays}d
        </Text>
      </div>
    </div>
  );
}

export function PendingCSReviewChart({ orders }: { orders: Order[] }) {
  const { token } = theme.useToken();
  const eventMap = useEffectiveEventMap();
  const pendingItems = useMemo((): PendingItem[] =>
    orders
      .filter(o => o.orderStatus === 'Open')
      .map(o => {
        const ev = eventMap.get(o.eventId);
        const thread = ev?.additionalInfoRequests ?? [];
        const last = thread[thread.length - 1];
        return { id: o.id, eventId: o.eventId, jobNo: o.jobNo, branch: ev?.branch ?? '—', component: ev?.component ?? '—', partsCount: o.parts.length, ageDays: TODAY.diff(parseOrderDate(o.lastUpdated), 'day'), commentCount: thread.length, latestComment: last?.text ?? null, techReplied: isReporterSide(last?.sentBy) };
      })
      .filter(item => item.commentCount > 0 && !item.techReplied)
      .sort((a, b) => b.ageDays - a.ageDays),
    [orders, eventMap]
  );
  const preview = pendingItems.slice(0, 5);

  if (pendingItems.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8, color: token.colorTextTertiary }}>
        <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No open orders awaiting a technician response</Text>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginBottom: 2 }}>
        {pendingItems.length} pending
      </div>
      {preview.map(item => <PendingRow key={item.id} item={item} token={token} />)}
    </div>
  );
}


// Raw G2 grouped-stacked columns: per week, an Open bar (Pending Decision +
// Approved) beside a Closed bar (Fulfilled + Declined). The
// @ant-design/plots wrapper cannot express stack-within-dodge in this
// version, so this chart uses the G2 engine directly.
function GroupedStackTrend({ data, stages, colors, plotTheme, onSegmentClick }: {
  data: Record<string, string | number>[];
  stages: readonly string[];
  colors: string[];
  plotTheme: string;
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
      scale: { color: { domain: [...stages], range: colors } },
      theme: plotTheme,
      animate: false,
      axis: {
        x: { labelFill: token.colorText, labelFontSize: token.fontSizeSM, line: false, tickStroke: token.colorBorderSecondary },
        y: { labelFill: token.colorText, labelFontSize: token.fontSizeSM, gridStroke: token.colorBorderSecondary, gridLineWidth: 1, tickCount: 4 },
      },
      legend: { color: { position: 'bottom', itemLabelFill: token.colorText, itemLabelFontSize: token.fontSizeSM } },
      tooltip: {
        title: (d: Record<string, string>) => `${d.week} \u00b7 ${d.status}`,
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
  }, [data, plotTheme, token.colorText, token.colorBorderSecondary]);

  return <div ref={container} style={{ width: '100%', height: '100%', cursor: 'pointer' }} />;
}

export function DecisionTrendChart({
  orders,
  height = 240,
  fill = false,
}: {
  orders: Order[];
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
      if (o.consolidated) return null;
      if (o.declined) return 'Declined';
      if (o.approved) return o.orderStatus === 'Closed' ? 'Fulfilled' : 'Approved';
      return o.orderStatus === 'Open' ? 'Pending Decision' : null;
    };
    const weekMap: Record<string, { counts: Record<string, number>; sortKey: number }> = {};
    for (const order of orders) {
      const stage = stageOf(order);
      if (!stage) continue;
      const d = parseOrderDate(order.lastUpdated);
      const dow = d.day();
      const weekStart = d.subtract(dow === 0 ? 6 : dow - 1, 'day');
      const key = weekStart.format('MMM D');
      if (!weekMap[key]) weekMap[key] = { counts: {}, sortKey: weekStart.valueOf() };
      weekMap[key].counts[stage] = (weekMap[key].counts[stage] ?? 0) + 1;
    }
    return Object.entries(weekMap)
      .sort(([, a], [, b]) => a.sortKey - b.sortKey)
      .flatMap(([week, { counts, sortKey }]) => {
        const ws = dayjs(sortKey);
        const weekStart = ws.format('YYYY-MM-DD');
        const weekEnd   = ws.add(6, 'day').format('YYYY-MM-DD');
        return STAGES.map(stage => ({
          week, weekStart, weekEnd, stage,
          status: stage === 'Pending Decision' || stage === 'Approved' ? 'Open' : 'Closed',
          count: counts[stage] ?? 0,
        }));
      });
  }, [orders]);

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
        colors={['#1677ff', '#95de64', '#389e0d', '#cf1322']}
        plotTheme={plotTheme}
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
      <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginBottom: 2 }}>
        {declinedItems.length} declined
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
