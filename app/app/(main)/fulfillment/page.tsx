'use client';

import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Card, Segmented, Table, Tag, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { JobNoValue } from '@/components/JobNoValue';
import Link from 'next/link';
import { orders } from '@/data/orders';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { useOrderStore } from '@/store/orderStore';
import type { Order, OrderStatus } from '@/data/orders';
import type { QualityEvent } from '@/data/types';

type OrderRow = Order & Pick<QualityEvent, 'issue' | 'component' | 'door' | 'branch' | 'plant' | 'reportedBy' | 'status' | 'jobNoManualEntry'>;

const buildOrderRow = (o: Order, eventMap: Map<string, QualityEvent>): OrderRow => {
  const event = eventMap.get(o.eventId)!;
  return {
    ...o,
    issue:       event.issue,
    component:   event.component,
    door:        event.door,
    branch:      event.branch,
    plant:       event.plant,
    reportedBy:  event.reportedBy,
    status:      event.status,
    jobNoManualEntry: event.jobNoManualEntry,
  };
};

export default function FulfillmentPage() {
  const { token } = theme.useToken();

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const { mutations: orderMutations, createdOrders } = useOrderStore();
  const eventMap = useEffectiveEventMap();

  const orderRows = useMemo(() => [
    ...Object.values(createdOrders).filter(o => eventMap.has(o.eventId)).map(o => buildOrderRow(o, eventMap)),
    ...orders.map(o => buildOrderRow(o, eventMap)),
  ], [createdOrders, eventMap]);

  const effectiveStatus = (row: OrderRow): OrderStatus =>
    orderMutations[row.id]?.status ?? (row.orderStatus as OrderStatus);

  const queue = useMemo(() => orderRows.filter(o => {
    const assigned = orderMutations[o.id]?.assignedToFulfillment ?? o.assignedToFulfillment ?? false;
    if (!assigned) return false;
    if (!showClosed && (orderMutations[o.id]?.status ?? o.orderStatus) !== 'Open') return false;
    if (dateRange) {
      const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    return true;
  }), [orderRows, orderMutations, showClosed, dateRange]);

  const columns: ColumnsType<OrderRow> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (id: string, record) => (
        <Link href={`/orders/${id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
          {record.eventId}
        </Link>
      ),
      width: 130,
    },
    {
      title: 'Branch',
      dataIndex: 'branch',
      key: 'branch',
      sorter: (a, b) => a.branch.localeCompare(b.branch),
      ellipsis: { showTitle: true },
      width: 138,
    },
    {
      title: 'Job No.',
      dataIndex: 'jobNo',
      key: 'jobNo',
      sorter: (a, b) => a.jobNo.localeCompare(b.jobNo),
      width: 148,
      render: (jobNo: string, record) => <JobNoValue jobNo={jobNo} manualEntry={record.jobNoManualEntry} />,
    },
    {
      title: 'Issue',
      dataIndex: 'issue',
      key: 'issue',
      sorter: (a, b) => a.issue.localeCompare(b.issue),
      ellipsis: { showTitle: true },
      width: 176,
    },
    {
      title: 'Component',
      dataIndex: 'component',
      key: 'component',
      sorter: (a, b) => a.component.localeCompare(b.component),
      ellipsis: { showTitle: true },
      width: 140,
    },
    {
      title: 'Reported By',
      dataIndex: 'reportedBy',
      key: 'reportedBy',
      sorter: (a, b) => a.reportedBy.localeCompare(b.reportedBy),
      ellipsis: { showTitle: true },
      width: 182,
    },
    {
      title: 'Last Updated',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      sorter: (a, b) => a.lastUpdated.localeCompare(b.lastUpdated),
      defaultSortOrder: 'descend',
      width: 148,
    },
    {
      title: 'Status',
      key: 'orderStatus',
      sorter: (a, b) => effectiveStatus(a).localeCompare(effectiveStatus(b)),
      width: 120,
      // Neutral chip; the event lifecycle has its own labeled column.
      render: (_, record) => <Tag>{effectiveStatus(record)}</Tag>,
    },
    {
      title: 'Event Status',
      key: 'eventStatus',
      sorter: (a, b) => a.status.localeCompare(b.status),
      width: 170,
      render: (_, record) => <Tag style={{ margin: 0 }}>{record.status}</Tag>,
    },
  ];

  return (
    <>
      <PageHeader
        left={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
        right={
          <Segmented
            options={[
              { label: 'Open Only', value: 'open' },
              { label: 'All', value: 'all' },
            ]}
            value={showClosed ? 'all' : 'open'}
            onChange={v => setShowClosed(v === 'all')}
          />
        }
      />

      <div style={{ padding: '16px 20px' }}>
        <Card size="small" style={{ marginBottom: 12 }}>
          <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
            Orders assigned to Fulfillment by Customer Service. Close an order once the replacement has been placed in the ERP, or return it to Customer Service if it can&apos;t be fulfilled.
          </Typography.Text>
        </Card>
        <Table
          dataSource={queue}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
          }}
        />
      </div>
    </>
  );
}
