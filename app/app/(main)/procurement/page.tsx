'use client';

import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Button, Card, Dropdown, Form, Input, Modal, Table, Tag, Tooltip, Typography, theme, Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { CheckCircleFilled, CheckOutlined, MoreOutlined, RollbackOutlined } from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import Link from 'next/link';
import { orders } from '@/data/orders';
import { events } from '@/data/events';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { useOrderStore } from '@/store/orderStore';
import type { OrderLogEntry } from '@/store/orderStore';
import type { Order } from '@/data/orders';
import type { QualityEvent } from '@/data/types';

type OrderRow = Order & Pick<QualityEvent, 'discrepancy' | 'product' | 'door' | 'branch' | 'plant' | 'reportedBy' | 'status'>;
type OrderStatus = 'Open' | 'Closed';

const ORDER_STATUS_COLOR: Record<string, string> = {
  Open:   'blue',
  Closed: 'default',
};

const eventMap = new Map(events.map(e => [e.id, e]));

const orderRows: OrderRow[] = orders.map(o => {
  const event = eventMap.get(o.eventId)!;
  return {
    ...o,
    discrepancy: event.discrepancy,
    product:     event.product,
    door:        event.door,
    branch:      event.branch,
    plant:       event.plant,
    reportedBy:  event.reportedBy,
    status:      event.status,
  };
});

const nowTs = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ProcurementPage() {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const { mutations: orderMutations, patchOrder, pushOrderLog } = useOrderStore();

  const effectiveStatus = (row: OrderRow): OrderStatus =>
    orderMutations[row.id]?.status ?? (row.orderStatus as OrderStatus);
  const isAssignedToProcurement = (row: OrderRow): boolean =>
    orderMutations[row.id]?.assignedToProcurement ?? row.assignedToProcurement ?? false;
  const effectiveReplacementOrderNo = (row: OrderRow): string =>
    orderMutations[row.id]?.replacementOrderNo ?? row.replacementOrderNo ?? '';

  const queue = useMemo(() => orderRows.filter(o => {
    if (!isAssignedToProcurement(o)) return false;
    if (!showClosed && effectiveStatus(o) !== 'Open') return false;
    if (dateRange) {
      const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    return true;
  }), [orderMutations, showClosed, dateRange]);

  const addLog = (orderId: string, content: string) => {
    const entry: OrderLogEntry = {
      id: String(Date.now()),
      timestamp: nowTs(),
      role: 'Procurement',
      employee: 'Ptolemy R. Dunholm',
      orderStatus: effectiveStatus(orderRows.find(o => o.id === orderId)!),
      submittedStatus: orderRows.find(o => o.id === orderId)!.status,
      content,
      auto: false,
    };
    pushOrderLog(orderId, entry);
  };

  // Row action target
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Close modal
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReplacementOrderNo, setCloseReplacementOrderNo] = useState('');
  const [closeSuccess, setCloseSuccess] = useState(false);

  // Return to CS modal
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [returnSuccess, setReturnSuccess] = useState(false);

  const handleClose = () => {
    if (!activeOrderId || !closeReplacementOrderNo.trim()) return;
    patchOrder(activeOrderId, { status: 'Closed', replacementOrderNo: closeReplacementOrderNo.trim() });
    addLog(activeOrderId, `Order closed. Replacement Order #: ${closeReplacementOrderNo.trim()}`);
    setCloseSuccess(true);
  };

  const handleReturnToCS = () => {
    if (!activeOrderId || !returnComment.trim()) return;
    patchOrder(activeOrderId, { assignedToProcurement: false });
    addLog(activeOrderId, `Returned to Customer Service. Reason: ${returnComment.trim()}`);
    setReturnSuccess(true);
  };

  const openRowAction = (key: string, row: OrderRow) => {
    setActiveOrderId(row.id);
    if (key === 'close')  { setCloseReplacementOrderNo(effectiveReplacementOrderNo(row)); setCloseOpen(true); }
    if (key === 'return') setReturnOpen(true);
  };

  const getMenuItems = (row: OrderRow): MenuProps['items'] => {
    if (effectiveStatus(row) !== 'Open') return [];
    return [
      { key: 'close',  label: 'Close Order',               icon: <CheckOutlined /> },
      { key: 'return', label: 'Return to Customer Service', icon: <RollbackOutlined /> },
    ];
  };

  const columns: ColumnsType<OrderRow> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (id: string, record) => (
        <Link href={`/orders/${id}`} style={{ fontWeight: 500, textDecoration: 'none' }}>
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
      render: (jobNo: string) => <CopyableValue value={jobNo} />,
    },
    {
      title: 'Discrepancy',
      dataIndex: 'discrepancy',
      key: 'discrepancy',
      sorter: (a, b) => a.discrepancy.localeCompare(b.discrepancy),
      ellipsis: { showTitle: true },
      width: 176,
    },
    {
      title: 'Product',
      dataIndex: 'product',
      key: 'product',
      sorter: (a, b) => a.product.localeCompare(b.product),
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
      render: (_, record) => (
        <Tag color={ORDER_STATUS_COLOR[effectiveStatus(record)] ?? 'default'}>
          {effectiveStatus(record)}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'options',
      width: 48,
      render: (_, record) => {
        const items = getMenuItems(record);
        if (!items || items.length === 0) return null;
        return (
          <Dropdown
            menu={{ items, onClick: ({ key }) => openRowAction(key, record) }}
            trigger={['click']}
          >
            <Tooltip title="Actions">
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                onClick={e => e.stopPropagation()}
              />
            </Tooltip>
          </Dropdown>
        );
      },
    },
  ];

  return (
    <>
      {/* CLOSE MODAL */}
      <Modal
        title={closeSuccess ? null : 'Close Order'}
        open={closeOpen}
        onCancel={() => { setCloseOpen(false); setCloseSuccess(false); setCloseReplacementOrderNo(''); }}
        onOk={handleClose}
        okText="Close Order"
        okButtonProps={{ type: 'primary', disabled: !closeReplacementOrderNo.trim() }}
        footer={closeSuccess ? null : undefined}
      >
        {closeSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Typography.Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Closed</Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {activeOrderId} has been closed. It can be reopened from the Orders list if needed.
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setCloseOpen(false); setCloseSuccess(false); setCloseReplacementOrderNo(''); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Typography.Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This will mark the order as Closed.
            </Typography.Text>
            <Form layout="vertical" size="small">
              <Form.Item label="Replacement Order #" required style={{ marginBottom: 0 }}>
                <Input
                  placeholder="e.g. RO-2026-00123"
                  value={closeReplacementOrderNo}
                  onChange={e => setCloseReplacementOrderNo(e.target.value)}
                  autoFocus
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* RETURN TO CUSTOMER SERVICE MODAL */}
      <Modal
        title={returnSuccess ? null : 'Return to Customer Service'}
        open={returnOpen}
        onCancel={() => { setReturnOpen(false); setReturnComment(''); setReturnSuccess(false); }}
        onOk={handleReturnToCS}
        okText="Return to CS"
        okButtonProps={{ type: 'primary', disabled: !returnComment.trim() }}
        footer={returnSuccess ? null : undefined}
      >
        {returnSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Typography.Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Returned to Customer Service</Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {activeOrderId} has been returned to the Customer Service queue.
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setReturnOpen(false); setReturnComment(''); setReturnSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Typography.Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This order cannot be fulfilled (e.g. discontinued parts). Please provide a comment explaining why it's being returned.
            </Typography.Text>
            <Input.TextArea
              placeholder="Reason for returning to Customer Service..."
              value={returnComment}
              onChange={e => setReturnComment(e.target.value)}
              rows={4}
              autoFocus
            />
          </>
        )}
      </Modal>

      <PageHeader
        left={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
        right={
          <Button
            type={showClosed ? 'primary' : 'default'}
            onClick={() => setShowClosed(v => !v)}
          >
            {showClosed ? 'Showing All' : 'Showing Open Only'}
          </Button>
        }
      />

      <div style={{ padding: '16px 20px' }}>
        <Card size="small" style={{ marginBottom: 12 }}>
          <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
            Orders assigned to Procurement by Customer Service. Close an order once the replacement has been placed in the ERP, or return it to Customer Service if it can't be fulfilled.
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
