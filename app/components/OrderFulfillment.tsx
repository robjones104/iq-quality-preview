'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Col, Row, Tag, Typography, theme } from 'antd';
import { Column } from '@ant-design/plots';
import { ShoppingCartOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';
import { events as allEvents } from '@/data/events';

const { Text } = Typography;
const CARD_H = 320;
const STALE_DAYS = 3;
const QUEUE_MAX = 5;


const EVENT_MAP = new Map(allEvents.map(e => [e.id, e]));

function parseOrderDate(lastUpdated: string): dayjs.Dayjs {
  const [mm, dd, yyyy] = lastUpdated.slice(0, 10).split('-');
  return dayjs(`${yyyy}-${mm}-${dd}`);
}

const TODAY = dayjs();

type PendingItem = {
  id: string;
  branch: string;
  product: string;
  partsCount: number;
  ageDays: number;
};

function PendingRow({ item, token }: { item: PendingItem; token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <div style={{
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
            {item.id}
          </Link>
          <Tag color="geekblue" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px', margin: 0 }}>
            {item.partsCount} part{item.partsCount !== 1 ? 's' : ''}
          </Tag>
        </div>
        <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {item.branch} · {item.product}
        </Text>
      </div>
      <Text style={{
        flexShrink: 0,
        fontSize: token.fontSizeXS,
        fontWeight: 600,
        color: item.ageDays >= STALE_DAYS ? token.colorWarning : token.colorTextTertiary,
        lineHeight: '16px',
      }}>
        {item.ageDays}d
      </Text>
    </div>
  );
}

export function OrderFulfillment({ events, orders }: { events: QualityEvent[]; orders: Order[] }) {
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
        return {
          id: o.id,
          branch: ev?.branch ?? '—',
          product: ev?.product ?? '—',
          partsCount: o.parts.length,
          ageDays: TODAY.diff(parseOrderDate(o.lastUpdated), 'day'),
        };
      })
      .sort((a, b) => b.ageDays - a.ageDays),
    [orders],
  );

  const visibleItems = showAll ? pendingItems : pendingItems.slice(0, QUEUE_MAX);

  // Order Status — 4-lane breakdown across all orders
  const statusCounts = useMemo(() => ({
    pending:       orders.filter(o => o.orderStatus === 'Open' && !o.approved && !o.declined).length,
    approved:      orders.filter(o => o.orderStatus === 'Open' && o.approved && !o.assignedToProcurement).length,
    procurement:   orders.filter(o => o.orderStatus === 'Open' && o.approved && o.assignedToProcurement).length,
    closed:        orders.filter(o => o.orderStatus === 'Closed').length,
  }), [orders]);

  const avgDaysToClose = useMemo(() => {
    const diffs = orders
      .filter(o => o.orderStatus === 'Closed')
      .map(o => {
        const ev = EVENT_MAP.get(o.eventId);
        if (!ev) return null;
        return parseOrderDate(o.lastUpdated).diff(dayjs(ev.date), 'day');
      })
      .filter((d): d is number => d !== null && d >= 0);
    if (!diffs.length) return null;
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }, [orders]);

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

  const statusLanes = [
    { label: 'Pending Review',   count: statusCounts.pending,     color: token.colorWarning, href: '/orders?orderStatus=Open'                           },
    { label: 'Approved',         count: statusCounts.approved,    color: token.colorPrimary, href: '/orders?orderStatus=Open&decision=Approved'         },
    { label: 'With Procurement', count: statusCounts.procurement, color: token.colorInfo,    href: '/orders?orderStatus=Open&decision=Approved'         },
    { label: 'Closed',           count: statusCounts.closed,      color: token.colorSuccess, href: '/orders?orderStatus=Closed'                         },
  ];

  return (
    <div>
      <Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}
      >
        Order Fulfillment
      </Text>

      <Row gutter={token.marginSM}>

        {/* CS Pending Review */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Pending CS Review</span>}
            extra={
              pendingItems.length === 0
                ? <Tag color="green" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px' }}>All clear</Tag>
                : <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                    {pendingItems.length} pending
                    {pendingItems.length > QUEUE_MAX && (
                      <>
                        {' · '}
                        <Typography.Link style={{ fontSize: token.fontSizeSM }} onClick={() => setShowAll(v => !v)}>
                          {showAll ? 'Show less' : 'View all'}
                        </Typography.Link>
                      </>
                    )}
                  </span>
            }
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: CARD_H, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 } }}
          >
            {pendingItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
                <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No orders pending CS review</Text>
              </div>
            ) : (
              visibleItems.map(item => (
                <PendingRow key={item.id} item={item} token={token} />
              ))
            )}
          </Card>
        </Col>

        {/* Order Pipeline */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Order Pipeline</span>}
            extra={<span style={{ fontSize: token.fontSizeSM, color: token.colorTextQuaternary }}>{orders.length} total</span>}
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: CARD_H, paddingTop: 8 } }}
          >
            {statusLanes.map((lane, i) => (
              <div key={lane.label}>
                <div
                  onClick={() => router.push(lane.href)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', cursor: 'pointer', borderRadius: token.borderRadiusSM }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 4, height: 20, borderRadius: 2, background: lane.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>{lane.label}</Text>
                  </span>
                  <Text style={{ fontSize: token.fontSizeHeading4, fontWeight: 700, lineHeight: 1, color: lane.count > 0 ? token.colorText : token.colorTextQuaternary }}>
                    {lane.count}
                  </Text>
                </div>
                {i < statusLanes.length - 1 && (
                  <div style={{ paddingLeft: 7, fontSize: 10, color: token.colorBorderSecondary, lineHeight: '14px' }}>↓</div>
                )}
              </div>
            ))}
            {avgDaysToClose !== null && (
              <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>Avg days to close</Text>
                <Text style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorText }}>{avgDaysToClose}d</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Approval Trend */}
        <Col xs={24} lg={8}>
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
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  {[{ label: 'Approved', color: token.colorSuccess }, { label: 'Declined', color: token.colorError }].map(s => (
                    <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextSecondary }}>{s.label}</Text>
                    </span>
                  ))}
                </div>
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
                    legend={false}
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
