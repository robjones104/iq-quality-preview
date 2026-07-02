'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Col, Row, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Bar, Column } from '@ant-design/plots';
import { ExportOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';
import { events as allEvents } from '@/data/events';
import { CopyableValue } from '@/components/CopyableValue';

const { Text } = Typography;
const CARD_H = 320;
const STALE_DAYS = 3;
const QUEUE_MAX = 7;


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

      <Row gutter={token.marginSM}>

        {/* CS Pending Review */}
        <Col xs={24} lg={16}>
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

export function PendingCSReviewChart({ orders }: { orders: Order[] }) {
  const { token } = theme.useToken();
  const pendingItems = useMemo((): PendingItem[] =>
    orders
      .filter(o => o.orderStatus === 'Open' && !o.approved && !o.declined)
      .map(o => {
        const ev = EVENT_MAP.get(o.eventId);
        return { id: o.id, branch: ev?.branch ?? '—', product: ev?.product ?? '—', partsCount: o.parts.length, ageDays: TODAY.diff(parseOrderDate(o.lastUpdated), 'day') };
      })
      .sort((a, b) => b.ageDays - a.ageDays),
    [orders]
  );
  const preview = pendingItems.slice(0, 5);

  if (pendingItems.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8, color: token.colorTextTertiary }}>
        <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No orders pending CS review</Text>
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
        {[{ label: 'Approved', color: token.colorSuccess }, { label: 'Declined', color: token.colorError }].map(s => (
          <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextSecondary }}>{s.label}</Text>
          </span>
        ))}
      </div>
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
          if (datum.weekStart && datum.weekEnd) { params.set('from', datum.weekStart); params.set('to', datum.weekEnd); }
          router.push('/orders?' + params.toString());
        }}
      />
    </>
  );
}

type DeclinedItem = {
  id: string;
  jobNo: string;
  branch: string;
  reason: string;
  dateDeclined: string;
  ageDays: number;
  sortTs: number;
};

function buildDeclinedItems(orders: Order[]): DeclinedItem[] {
  return orders
    .filter(o => o.declined)
    .map(o => {
      const ev = EVENT_MAP.get(o.eventId);
      const d = parseOrderDate(o.lastUpdated);
      return {
        id: o.id,
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
      .slice(0, 6)
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
    <Bar
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
        x: { ...axisStyle, labelFormatter: (v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v },
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
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const declinedItems = useMemo(() => buildDeclinedItems(orders), [orders]);

  const handleExport = () => {
    const selected = selectedKeys.length
      ? declinedItems.filter(d => selectedKeys.includes(d.id))
      : declinedItems;
    const headers = ['Order ID', 'Job No.', 'Branch', 'Reason for Decline', 'Date Declined', 'Age (days)'];
    const rows = selected.map(d => [d.id, d.jobNo, d.branch, d.reason, d.dateDeclined, d.ageDays]);
    const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `declined-orders-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnsType<DeclinedItem> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (id: string) => (
        <Link href={`/orders/${id}`} style={{ fontWeight: 500, textDecoration: 'none' }}>
          {id}
        </Link>
      ),
    },
    {
      title: 'Job No.',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 140,
      render: (jobNo: string) => <CopyableValue value={jobNo} />,
    },
    { title: 'Branch', dataIndex: 'branch', key: 'branch', width: 140, ellipsis: true },
    {
      title: 'Reason for Decline',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: { showTitle: false },
      render: (reason: string) => <Tooltip title={reason}><span>{reason}</span></Tooltip>,
    },
    { title: 'Date Declined', dataIndex: 'dateDeclined', key: 'dateDeclined', width: 128 },
    { title: 'Age', dataIndex: 'ageDays', key: 'ageDays', width: 70, render: (d: number) => `${d}d` },
  ];

  return (
    <div>
      <Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}
      >
        Declined Orders
      </Text>

      <Row gutter={token.marginSM}>

        {/* Declined Orders table */}
        <Col xs={24} lg={16}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Declined Orders</span>}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Link href={viewAllHref} style={{ fontSize: token.fontSizeSM }}>View all →</Link>
                <Button size="small" icon={<ExportOutlined />} onClick={handleExport} disabled={declinedItems.length === 0}>
                  {selectedKeys.length > 0 ? `Export Selected (${selectedKeys.length})` : `Export All (${declinedItems.length})`}
                </Button>
              </div>
            }
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: CARD_H, padding: '8px 12px' } }}
          >
            {declinedItems.length === 0 ? (
              <div style={{ height: CARD_H - 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
                <ShoppingCartOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No declined orders in this period</Text>
              </div>
            ) : (
              <Table<DeclinedItem>
                size="small"
                rowKey="id"
                dataSource={declinedItems}
                columns={columns}
                pagination={{ pageSize: 5, size: 'small' }}
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedKeys,
                  onChange: keys => setSelectedKeys(keys as string[]),
                }}
              />
            )}
          </Card>
        </Col>

        {/* Declined by Branch */}
        <Col xs={24} lg={8}>
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
                {item.id}
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
