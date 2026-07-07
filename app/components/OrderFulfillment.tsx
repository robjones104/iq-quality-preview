'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Col, Row, Tag, Tooltip, Typography, theme } from 'antd';
import { Column } from '@ant-design/plots';
import { CommentOutlined, ExportOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';
import { events as allEvents } from '@/data/events';
import { logs as allLogs } from '@/data/logs';
import { ExpandToggle, Dot } from './CardControls';

const { Text } = Typography;
const CARD_H = 320;
const STALE_DAYS = 3;
const QUEUE_PREVIEW = 4;
const DECLINED_PREVIEW = 4;


const EVENT_MAP = new Map(allEvents.map(e => [e.id, e]));

const LOGS_BY_EVENT = new Map<string, typeof allLogs>();
for (const log of allLogs) {
  const arr = LOGS_BY_EVENT.get(log.eventId) ?? [];
  arr.push(log);
  LOGS_BY_EVENT.set(log.eventId, arr);
}

function commentsFor(eventId: string): { count: number; latest: string | null } {
  const eventLogs = LOGS_BY_EVENT.get(eventId) ?? [];
  if (eventLogs.length === 0) return { count: 0, latest: null };
  const sorted = [...eventLogs].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
  return { count: sorted.length, latest: sorted[0].comment };
}

function parseOrderDate(lastUpdated: string): dayjs.Dayjs {
  const [mm, dd, yyyy] = lastUpdated.slice(0, 10).split('-');
  return dayjs(`${yyyy}-${mm}-${dd}`);
}

const TODAY = dayjs();

type PendingItem = {
  id: string;
  eventId: string;
  jobNo: string;
  branch: string;
  product: string;
  partsCount: number;
  ageDays: number;
  commentCount: number;
  latestComment: string | null;
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
      background: token.colorFillQuaternary,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusSM,
      padding: '8px 10px',
      display: 'flex',
      gap: 10,
    }}>
      {/* Left: ID + parts tag, then branch · product */}
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
          {item.branch} · {item.product}
        </Text>
      </div>

      {/* Right: latest comment + comment count + age, top-aligned */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {item.latestComment && (
          <Text style={{
            flex: 1,
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {item.latestComment}
          </Text>
        )}
        {item.commentCount > 0 && (
          <Tooltip title={`${item.commentCount} comment${item.commentCount !== 1 ? 's' : ''}`}>
            <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: token.fontSizeXS, color: token.colorTextTertiary, lineHeight: '16px' }}>
              <CommentOutlined /> {item.commentCount}
            </span>
          </Tooltip>
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

export function OrderFulfillment({ events, orders, viewAllHref = '/orders?orderStatus=Open&decision=Pending' }: { events: QualityEvent[]; orders: Order[]; viewAllHref?: string }) {
  const router = useRouter();
  const { token } = theme.useToken();
  const [showAll, setShowAll] = useState(false);

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

  // CS Pending Review — open orders awaiting CS decision (not approved, not declined)
  const pendingItems = useMemo((): PendingItem[] =>
    orders
      .filter(o => o.orderStatus === 'Open' && !o.approved && !o.declined)
      .map(o => {
        const ev = EVENT_MAP.get(o.eventId);
        const { count, latest } = commentsFor(o.eventId);
        return {
          id: o.id,
          eventId: o.eventId,
          jobNo: o.jobNo,
          branch: ev?.branch ?? '—',
          product: ev?.product ?? '—',
          partsCount: o.parts.length,
          ageDays: TODAY.diff(parseOrderDate(o.lastUpdated), 'day'),
          commentCount: count,
          latestComment: latest,
        };
      })
      .sort((a, b) => b.ageDays - a.ageDays),
    [orders],
  );

  const visibleItems = showAll ? pendingItems : pendingItems.slice(0, QUEUE_PREVIEW);

  const handleExportPending = () => {
    exportToCsv(
      `pending-review-export-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order ID', 'Job No.', 'Branch', 'Product', 'Parts', 'Age (days)'],
      pendingItems.map(i => [i.eventId, i.jobNo, i.branch, i.product, i.partsCount, i.ageDays]),
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
      <Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}
      >
        Order Fulfillment
      </Text>

      <Row gutter={token.marginSM} style={{ alignItems: 'flex-start' }}>

        {/* Pending Review */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Pending Review</span>}
            extra={
              pendingItems.length === 0
                ? <Tag color="green" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px' }}>All clear</Tag>
                : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link href={viewAllHref} style={{ fontSize: token.fontSizeSM }}>View in Table ({pendingItems.length})</Link>
                    {pendingItems.length > QUEUE_PREVIEW && (
                      <>
                        <Dot />
                        <ExpandToggle expanded={showAll} onToggle={() => setShowAll(v => !v)} />
                      </>
                    )}
                    <Dot />
                    <Tooltip title="Export to CSV">
                      <Button size="small" icon={<ExportOutlined />} onClick={handleExportPending} />
                    </Tooltip>
                  </div>
            }
            style={{ marginBottom: token.marginSM }}
            styles={{ body: {
              minHeight: CARD_H,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            } }}
          >
            {pendingItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
                <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No orders pending review</Text>
              </div>
            ) : (
              visibleItems.map(item => (
                <PendingRow key={item.id} item={item} token={token} />
              ))
            )}
          </Card>
        </Col>

        {/* Approval Trend */}
        <Col xs={24} lg={16}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Decision Trend</span>}
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: CARD_H } }}
          >
            {trendData.length === 0 ? (
              <div style={{ height: CARD_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No decision data</Text>
              </div>
            ) : (
              <>
                <div style={{ cursor: 'pointer' }}>
                  <Column
                    key={plotTheme}
                    data={trendData}
                    xField="week"
                    yField="count"
                    colorField="decision"
                    group={true}
                    height={256}
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
              </>
            )}
          </Card>
        </Col>

      </Row>
    </div>
  );
}

export function PendingCSReviewChart({ orders }: { orders: Order[] }) {
  const { token } = theme.useToken();
  const pendingItems = useMemo((): PendingItem[] =>
    orders
      .filter(o => o.orderStatus === 'Open' && !o.approved && !o.declined)
      .map(o => {
        const ev = EVENT_MAP.get(o.eventId);
        const { count, latest } = commentsFor(o.eventId);
        return { id: o.id, eventId: o.eventId, jobNo: o.jobNo, branch: ev?.branch ?? '—', product: ev?.product ?? '—', partsCount: o.parts.length, ageDays: TODAY.diff(parseOrderDate(o.lastUpdated), 'day'), commentCount: count, latestComment: latest };
      })
      .sort((a, b) => b.ageDays - a.ageDays),
    [orders]
  );
  const preview = pendingItems.slice(0, 5);

  if (pendingItems.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8, color: token.colorTextTertiary }}>
        <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No orders pending review</Text>
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
        <Text style={{
          flex: 1,
          fontSize: token.fontSizeSM,
          color: token.colorTextSecondary,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {item.reason}
        </Text>
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

function buildDeclinedItems(orders: Order[]): DeclinedItem[] {
  return orders
    .filter(o => o.declined)
    .map(o => {
      const ev = EVENT_MAP.get(o.eventId);
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
      const branch = EVENT_MAP.get(o.eventId)?.branch ?? 'Unknown';
      counts[branch] = (counts[branch] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([branch, count]) => ({ branch, count }));
  }, [orders]);

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

export function DeclinedOrders({ orders, viewAllHref = '/orders?decision=Declined' }: { orders: Order[]; viewAllHref?: string }) {
  const { token } = theme.useToken();
  const [showAll, setShowAll] = useState(false);

  const declinedItems = useMemo(() => buildDeclinedItems(orders), [orders]);
  const visibleItems = showAll ? declinedItems : declinedItems.slice(0, DECLINED_PREVIEW);

  const handleExport = () => {
    exportToCsv(
      `declined-orders-export-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order ID', 'Job No.', 'Branch', 'Reason for Decline', 'Date Declined', 'Age (days)'],
      declinedItems.map(d => [d.id, d.jobNo, d.branch, d.reason, d.dateDeclined, d.ageDays]),
    );
  };

  return (
    <div>
      <Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}
      >
        Declined Orders
      </Text>

      <Row gutter={token.marginSM} style={{ alignItems: 'flex-start' }}>

        {/* Declined Orders list */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Declined Orders</span>}
            extra={
              declinedItems.length === 0
                ? undefined
                : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link href={viewAllHref} style={{ fontSize: token.fontSizeSM }}>View in Table ({declinedItems.length})</Link>
                    {declinedItems.length > DECLINED_PREVIEW && (
                      <>
                        <Dot />
                        <ExpandToggle expanded={showAll} onToggle={() => setShowAll(v => !v)} />
                      </>
                    )}
                    <Dot />
                    <Tooltip title="Export to CSV">
                      <Button size="small" icon={<ExportOutlined />} onClick={handleExport} />
                    </Tooltip>
                  </div>
            }
            style={{ marginBottom: token.marginSM }}
            styles={{ body: {
              minHeight: CARD_H,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            } }}
          >
            {declinedItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
                <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No declined orders in this period</Text>
              </div>
            ) : (
              visibleItems.map(item => (
                <DeclinedRow key={item.id} item={item} token={token} />
              ))
            )}
          </Card>
        </Col>

        {/* Declined by Branch */}
        <Col xs={24} lg={16}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Declined by Branch</span>}
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: CARD_H } }}
          >
            <DeclinedByBranchChart orders={orders} height={276} />
          </Card>
        </Col>

      </Row>
    </div>
  );
}

export function DeclinedOrdersPreview({ orders }: { orders: Order[] }) {
  const { token } = theme.useToken();
  const declinedItems = useMemo(() => buildDeclinedItems(orders), [orders]);
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
