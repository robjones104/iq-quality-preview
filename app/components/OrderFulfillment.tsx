'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Col, Row, Tag, Tooltip, Typography, theme } from 'antd';
import { Column } from '@ant-design/plots';
import { ExportOutlined, InfoCircleOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
import type { Order } from '@/data/orders';
import type { QualityEvent } from '@/data/types';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';
import { Dot } from './CardControls';

const { Text, Paragraph } = Typography;
const CARD_H = 320;
const STALE_DAYS = 3;
const QUEUE_PREVIEW = 9;
const DECLINED_PREVIEW = 4;


function parseOrderDate(lastUpdated: string): dayjs.Dayjs {
  const [mm, dd, yyyy] = lastUpdated.slice(0, 10).split('-');
  return dayjs(`${yyyy}-${mm}-${dd}`);
}

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

export function OrderFulfillment({
  orders,
  fulfillmentHref = '/orders?orderStatus=Open',
  declinedHref = '/orders?decision=Declined',
}: {
  orders: Order[];
  fulfillmentHref?: string;
  declinedHref?: string;
}) {
  const router = useRouter();
  const eventMap = useEffectiveEventMap();
  const { token } = theme.useToken();

  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';
  const axisStyle = {
    labelFill:      token.colorText,
    labelFontSize:  token.fontSizeSM,
    gridStroke:     token.colorBorderSecondary,
    gridLineWidth:  1,
    lineStroke:     token.colorBorderSecondary,
    lineLineWidth:  1,
    tickStroke:     token.colorBorderSecondary,
    tickLineWidth:  1,
  };

  // Pending Information — ALL open orders with info requests attached to them
  // (the event's message thread), regardless of decision state. Mirrors the
  // Events view's Pending Information card on the order side.
  const pendingItems = useMemo((): PendingItem[] =>
    orders
      .filter(o => o.orderStatus === 'Open')
      .map(o => {
        const ev = eventMap.get(o.eventId);
        const thread = ev?.additionalInfoRequests ?? [];
        const last = thread[thread.length - 1];
        return {
          id: o.id,
          eventId: o.eventId,
          jobNo: o.jobNo,
          branch: ev?.branch ?? '—',
          component: ev?.component ?? '—',
          partsCount: o.parts.length,
          ageDays: TODAY.diff(parseOrderDate(o.lastUpdated), 'day'),
          commentCount: thread.length,
          latestComment: last?.text ?? null,
          techReplied: last?.sentBy === 'Tech',
        };
      })
      .filter(item => item.commentCount > 0 && !item.techReplied)
      .sort((a, b) => b.ageDays - a.ageDays),
    [orders, eventMap],
  );

  const visiblePending = pendingItems.slice(0, QUEUE_PREVIEW);

  const declinedItems = useMemo(() => buildDeclinedItems(orders, eventMap), [orders, eventMap]);
  const visibleDeclined = declinedItems.slice(0, DECLINED_PREVIEW);

  const handleExportDeclined = () => {
    exportToCsv(
      `declined-orders-export-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order ID', 'Job No.', 'Branch', 'Reason for Decline', 'Date Declined', 'Age (days)'],
      declinedItems.map(d => [d.id, d.jobNo, d.branch, d.reason, d.dateDeclined, d.ageDays]),
    );
  };

  // Approval Trend — weekly approved / declined counts
  const trendData = useMemo(() => {
    const weekMap: Record<string, { approved: number; declined: number; sortKey: number }> = {};
    for (const order of orders) {
      if (!order.approved && !order.declined) continue;
      const d = parseOrderDate(order.lastUpdated);
      const dow = d.day();
      const weekStart = d.subtract(dow === 0 ? 6 : dow - 1, 'day');
      const key = weekStart.format('MMM D');
      if (!weekMap[key]) weekMap[key] = { approved: 0, declined: 0, sortKey: weekStart.valueOf() };
      if (order.approved) weekMap[key].approved++;
      else weekMap[key].declined++;
    }
    return Object.entries(weekMap)
      .sort(([, a], [, b]) => a.sortKey - b.sortKey)
      .flatMap(([week, { approved, declined, sortKey }]) => {
        const ws = dayjs(sortKey);
        const weekStart = ws.format('YYYY-MM-DD');
        const weekEnd   = ws.add(6, 'day').format('YYYY-MM-DD');
        return [
          { week, weekStart, weekEnd, decision: 'Approved', count: approved },
          { week, weekStart, weekEnd, decision: 'Declined', count: declined },
        ];
      });
  }, [orders]);

  return (
    <div>
      {/* Decision Trend — full width */}
      <Row style={{ marginBottom: token.marginSM }}>
        <Col span={24}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                Decision Trend
                <MetricInfoIcon tooltip="Orders approved vs. declined, grouped by calendar week (Mon–Sun)." token={token} />
              </span>
            }
            style={{ marginBottom: 0 }}
            styles={{ body: { minHeight: CARD_H } }}
          >
            {trendData.length === 0 ? (
              <div style={{ height: CARD_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No decision data</Text>
              </div>
            ) : (
              <div style={{ cursor: 'pointer' }}>
                <Column
                  key={plotTheme}
                  data={trendData}
                  xField="week"
                  yField="count"
                  colorField="decision"
                  group={true}
                  height={276}
                  theme={plotTheme}
                  scale={{ color: { domain: ['Approved', 'Declined'], range: [token.colorSuccess, token.colorError] } }}
                  label={false}
                  animate={{ enter: { type: 'growInY', duration: 400 } }}
                  interaction={{ elementHighlight: true }}
                  state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
                  axis={{
                    x: { ...axisStyle },
                    y: { ...axisStyle, tickCount: 4 },
                  }}
                  legend={{ color: { position: 'bottom', itemLabelFill: token.colorText, itemLabelFontSize: token.fontSizeSM } }}
                  tooltip={{
                    title: (d: { week: string }) => d.week,
                    items: [{ field: 'count', name: (d: { decision: string }) => d.decision }],
                  }}
                  onEvent={(_chart, event) => {
                    if (event.type !== 'element:click') return;
                    const datum = event.data?.data as { decision?: string; weekStart?: string; weekEnd?: string } | undefined;
                    if (!datum?.decision) return;
                    const params = new URLSearchParams({ decision: datum.decision });
                    if (datum.weekStart && datum.weekEnd) {
                      params.set('from', datum.weekStart);
                      params.set('to', datum.weekEnd);
                    }
                    router.push('/orders?' + params.toString());
                  }}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Pending Review + Declined Orders — split evenly */}
      <Row gutter={token.marginSM} style={{ alignItems: 'stretch' }}>

        <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                Awaiting Response
                <MetricInfoIcon tooltip="Requests for more information on open orders that the technician has not yet answered. The request may come from Field Quality or Customer Service." token={token} />
              </span>
            }
            extra={
              pendingItems.length === 0
                ? <Tag color="green" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px' }}>All clear</Tag>
                : <Link href={fulfillmentHref} style={{ fontSize: token.fontSizeSM }}>View in Table ({pendingItems.length})</Link>
            }
            style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: {
              flex: 1,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'auto',
            } }}
          >
            {pendingItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
                <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No open orders awaiting a technician response</Text>
              </div>
            ) : (
              visiblePending.map(item => (
                <PendingRow key={item.id} item={item} token={token} />
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                Declined Orders
                <MetricInfoIcon tooltip="Orders declined for fulfillment in this period, with the reason given." token={token} />
              </span>
            }
            extra={
              declinedItems.length === 0
                ? undefined
                : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link href={declinedHref} style={{ fontSize: token.fontSizeSM }}>View in Table ({declinedItems.length})</Link>
                    <Dot />
                    <Tooltip title="Export to CSV">
                      <Button size="small" icon={<ExportOutlined />} onClick={handleExportDeclined} />
                    </Tooltip>
                  </div>
            }
            style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: {
              flex: 1,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'auto',
            } }}
          >
            {declinedItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
                <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No declined orders in this period</Text>
              </div>
            ) : (
              visibleDeclined.map(item => (
                <DeclinedRow key={item.id} item={item} token={token} />
              ))
            )}
          </Card>
        </Col>

      </Row>
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
        return { id: o.id, eventId: o.eventId, jobNo: o.jobNo, branch: ev?.branch ?? '—', component: ev?.component ?? '—', partsCount: o.parts.length, ageDays: TODAY.diff(parseOrderDate(o.lastUpdated), 'day'), commentCount: thread.length, latestComment: last?.text ?? null, techReplied: last?.sentBy === 'Tech' };
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

export function DecisionTrendChart({
  orders,
  height = 240,
}: {
  orders: Order[];
  height?: number;
}) {
  const { token } = theme.useToken();
  const router = useRouter();
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';
  const axisStyle = {
    labelFill:     token.colorText,
    labelFontSize: token.fontSizeSM,
    gridStroke:    token.colorBorderSecondary,
    gridLineWidth: 1,
    lineStroke:    token.colorBorderSecondary,
    lineLineWidth: 1,
    tickStroke:    token.colorBorderSecondary,
    tickLineWidth: 1,
  };
  const trendData = useMemo(() => {
    const weekMap: Record<string, { approved: number; declined: number; sortKey: number }> = {};
    for (const order of orders) {
      if (!order.approved && !order.declined) continue;
      const d = parseOrderDate(order.lastUpdated);
      const dow = d.day();
      const weekStart = d.subtract(dow === 0 ? 6 : dow - 1, 'day');
      const key = weekStart.format('MMM D');
      if (!weekMap[key]) weekMap[key] = { approved: 0, declined: 0, sortKey: weekStart.valueOf() };
      if (order.approved) weekMap[key].approved++;
      else weekMap[key].declined++;
    }
    return Object.entries(weekMap)
      .sort(([, a], [, b]) => a.sortKey - b.sortKey)
      .flatMap(([week, { approved, declined, sortKey }]) => {
        const ws = dayjs(sortKey);
        const weekStart = ws.format('YYYY-MM-DD');
        const weekEnd   = ws.add(6, 'day').format('YYYY-MM-DD');
        return [
          { week, weekStart, weekEnd, decision: 'Approved', count: approved },
          { week, weekStart, weekEnd, decision: 'Declined', count: declined },
        ];
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
    <>
      <Column
        key={plotTheme}
        data={trendData}
        xField="week"
        yField="count"
        colorField="decision"
        group={true}
        height={height}
        theme={plotTheme}
        scale={{ color: { domain: ['Approved', 'Declined'], range: [token.colorSuccess, token.colorError] } }}
        label={false}
        animate={{ enter: { type: 'growInY', duration: 400 } }}
        interaction={{ elementHighlight: true }}
        state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
        axis={{ x: { ...axisStyle }, y: { ...axisStyle, tickCount: 4 } }}
        legend={{ color: { position: 'bottom', itemLabelFill: token.colorText, itemLabelFontSize: token.fontSizeSM } }}
        tooltip={{
          title: (d: { week: string }) => d.week,
          items: [{ field: 'count', name: (d: { decision: string }) => d.decision }],
        }}
        onEvent={(_chart, event) => {
          if (event.type !== 'element:click') return;
          const datum = event.data?.data as { decision?: string; weekStart?: string; weekEnd?: string } | undefined;
          if (!datum?.decision) return;
          const params = new URLSearchParams({ decision: datum.decision });
          if (datum.weekStart && datum.weekEnd) { params.set('from', datum.weekStart); params.set('to', datum.weekEnd); }
          router.push('/orders?' + params.toString());
        }}
      />
    </>
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

function DeclinedRow({ item, token }: { item: DeclinedItem; token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <div style={{
      background: token.colorFillQuaternary,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusSM,
      padding: '8px 10px',
      display: 'flex',
      gap: 10,
    }}>
      {/* Left: ID + branch */}
      <div style={{ flexShrink: 0 }}>
        <Link href={`/orders/${item.id}`} style={{ display: 'block', fontSize: token.fontSizeSM, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginBottom: 3 }}>
          {item.eventId}
        </Link>
        <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap' }}>
          {item.branch}
        </Text>
      </div>

      {/* Right: decline reason + date + age, top-aligned */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
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
          {item.reason}
        </Paragraph>
        <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
            {item.dateDeclined}
          </Text>
          <Text style={{ fontSize: token.fontSizeXS, fontWeight: 600, color: token.colorTextTertiary, lineHeight: '16px' }}>
            {item.ageDays}d
          </Text>
        </div>
      </div>
    </div>
  );
}

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

export function DeclinedByBranchChart({ orders, height = 220 }: { orders: Order[]; height?: number }) {
  const { token } = theme.useToken();
  const eventMap = useEffectiveEventMap();
  const router = useRouter();
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';
  const axisStyle = {
    labelFill:     token.colorText,
    labelFontSize: token.fontSizeSM,
    gridStroke:    token.colorBorderSecondary,
    gridLineWidth: 1,
    lineStroke:    token.colorBorderSecondary,
    lineLineWidth: 1,
    tickStroke:    token.colorBorderSecondary,
    tickLineWidth: 1,
  };

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      if (!o.declined) continue;
      const branch = eventMap.get(o.eventId)?.branch ?? 'Unknown';
      counts[branch] = (counts[branch] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([branch, count]) => ({ branch, count }));
  }, [orders, eventMap]);

  if (chartData.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No decline data</Text>
      </div>
    );
  }

  return (
    <Column
      key={plotTheme}
      data={chartData}
      xField="branch"
      yField="count"
      color={token.colorError}
      height={height}
      theme={plotTheme}
      label={false}
      interaction={{ elementHighlight: true }}
      state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
      axis={{
        x: {
          ...axisStyle,
          labelFormatter: (v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v,
          labelTransform: chartData.length > 6 ? 'rotate(-40)' : undefined,
        },
        y: { ...axisStyle, tickCount: 4 },
      }}
      tooltip={{ title: (d: { branch: string }) => d.branch, items: [{ field: 'count', name: 'Declined' }] }}
      onEvent={(_chart, event) => {
        if (event.type !== 'element:click') return;
        router.push('/orders?decision=Declined');
      }}
    />
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
