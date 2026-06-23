'use client';

import { useMemo } from 'react';
import { Card, Col, Row, Table, Tag, Typography, theme } from 'antd';
import { Bar } from '@ant-design/plots';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import type { QualityEvent } from '@/data/types';
import { orders } from '@/data/orders';
import { events as allEvents } from '@/data/events';

const { Text } = Typography;

const CHART_PALETTE = [
  '#4096ff', '#9254de', '#36cfc9', '#73d13d', '#ffc53d',
  '#ffa940', '#ff7a45', '#f759ab', '#597ef7', '#bae637',
];

// Static lookup — built once from the full dataset
const EVENT_MAP = new Map(allEvents.map(e => [e.id, e]));

function parseOrderDate(lastUpdated: string): dayjs.Dayjs {
  const [mm, dd, yyyy] = lastUpdated.slice(0, 10).split('-');
  return dayjs(`${yyyy}-${mm}-${dd}`);
}

type HandoffRow = {
  key: string;
  id: string;
  date: string;
  product: string;
  branch: string;
  partsCount: number;
};

export function OrderFulfillment({ events }: { events: QualityEvent[] }) {
  const { token } = theme.useToken();

  const HANDOFF_COLUMNS: ColumnsType<HandoffRow> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 80,
      render: (d: string) => dayjs(d).format('MMM D'),
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Event ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: string) => <Link href={`/events/${id}`}>{id}</Link>,
    },
    {
      title: 'Product',
      dataIndex: 'product',
      key: 'product',
      ellipsis: true,
    },
    {
      title: 'Branch',
      dataIndex: 'branch',
      key: 'branch',
      ellipsis: true,
      width: 110,
    },
    {
      title: 'Parts',
      dataIndex: 'partsCount',
      key: 'partsCount',
      width: 52,
      render: (n: number) => (
        <Tag color="geekblue" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px', textAlign: 'center', minWidth: 24 }}>
          {n}
        </Tag>
      ),
    },
  ];
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

  // CS handoff: validated events with parts requests from the filtered (date-range) set
  const handoffQueue = useMemo(
    () => events
      .filter(e => e.status === 'Validated' && e.partsRequest?.length)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map(e => ({
        key: e.id,
        id: e.id,
        date: e.date,
        product: e.product,
        branch: e.branch,
        partsCount: e.partsRequest!.length,
      })),
    [events],
  );

  // Order status counts (static — orders not yet date-filtered)
  const orderCounts = useMemo(() => ({
    open:     orders.filter(o => o.orderStatus === 'Open').length,
    approved: orders.filter(o => o.orderStatus === 'Approved').length,
    closed:   orders.filter(o => o.orderStatus === 'Closed').length,
  }), []);

  // Avg days from event date to order resolution (Approved or Closed only)
  const avgDaysToClose = useMemo(() => {
    const diffs = orders
      .filter(o => o.orderStatus === 'Approved' || o.orderStatus === 'Closed')
      .map(o => {
        const ev = EVENT_MAP.get(o.eventId);
        if (!ev) return null;
        return parseOrderDate(o.lastUpdated).diff(dayjs(ev.date), 'day');
      })
      .filter((d): d is number => d !== null && d >= 0);
    if (!diffs.length) return null;
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }, []);

  // Orders by branch — join orders → events for branch label
  const branchData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) {
      const ev = EVENT_MAP.get(order.eventId);
      if (!ev) continue;
      counts[ev.branch] = (counts[ev.branch] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => a.count - b.count);
  }, []);

  const statusRows = [
    { label: 'Open',     count: orderCounts.open,     color: token.colorPrimary   },
    { label: 'Approved', count: orderCounts.approved, color: token.colorWarning   },
    { label: 'Closed',   count: orderCounts.closed,   color: token.colorSuccess   },
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

        {/* CS Handoff Queue */}
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>CS Handoff Queue</span>}
            extra={
              handoffQueue.length > 0
                ? <Tag color="geekblue" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px' }}>{handoffQueue.length} pending</Tag>
                : <Tag color="green" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px' }}>All clear</Tag>
            }
            style={{ marginBottom: token.marginSM }}
          >
            <Table
              dataSource={handoffQueue}
              columns={HANDOFF_COLUMNS}
              rowKey="key"
              size="small"
              pagination={false}
              locale={{
                emptyText: (
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    No validated events with parts requests in this range
                  </Text>
                ),
              }}
            />
          </Card>
        </Col>

        {/* Order Status */}
        <Col xs={24} lg={6}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Order Status</span>}
            extra={<span style={{ fontSize: token.fontSizeSM, color: token.colorTextQuaternary }}>{orders.length} total</span>}
            style={{ marginBottom: token.marginSM }}
          >
            <div style={{ paddingTop: 4 }}>
              {statusRows.map(row => (
                <div
                  key={row.label}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 3, height: 14, borderRadius: 2, background: row.color, flexShrink: 0, display: 'inline-block' }} />
                    <Text style={{ fontSize: token.fontSizeSM, color: token.colorText }}>{row.label}</Text>
                  </span>
                  <Text style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorText }}>{row.count}</Text>
                </div>
              ))}
              {avgDaysToClose !== null && (
                <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>Avg days to close</Text>
                  <Text style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorText }}>{avgDaysToClose}d</Text>
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Orders by Branch */}
        <Col xs={24} lg={6}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Orders by Branch</span>}
            style={{ marginBottom: token.marginSM }}
          >
            {branchData.length === 0 ? (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No order data</Text>
              </div>
            ) : (
              <Bar
                key={plotTheme}
                data={branchData}
                xField="count"
                yField="branch"
                colorField="branch"
                height={240}
                theme={plotTheme}
                scale={{ color: { range: CHART_PALETTE } }}
                label={false}
                animate={{ enter: { type: 'growInX', duration: 600 } }}
                interaction={{ elementHighlight: true }}
                state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
                axis={{
                  x: { ...axisStyle, tickCount: 4 },
                  y: { ...axisStyle },
                }}
                legend={false}
                tooltip={{
                  title: (d: { branch: string }) => d.branch,
                  items: [{ field: 'count', name: 'Orders' }],
                }}
              />
            )}
          </Card>
        </Col>

      </Row>
    </div>
  );
}
