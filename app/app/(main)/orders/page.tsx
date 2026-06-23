'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import {
  Dropdown, Form, Input, Modal, notification, Select, Space,
  Switch, Table, Tabs, Button, Tag, Tooltip, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  CheckOutlined, CloseOutlined, MoreOutlined, RollbackOutlined,
  SearchOutlined, SendOutlined,
} from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import Link from 'next/link';
import { orders } from '@/data/orders';
import { events } from '@/data/events';
import { FilterPanel } from '@/components/FilterPanel';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { EVENT_FILTER_CATEGORIES } from '@/data/filterOptions';
import { useFilterStore } from '@/store/filterStore';
import type { Order } from '@/data/orders';
import type { QualityEvent } from '@/data/types';
type OrderRow = Order & Pick<QualityEvent, 'discrepancy' | 'product' | 'door' | 'branch' | 'plant' | 'reportedBy' | 'status'>;
type OrderStatus = 'Open' | 'Closed';

const ORDER_STATUS_COLOR: Record<string, string> = {
  Open:   'blue',
  Closed: 'default',
};

const ORDER_STATUS_FILTER = [
  { key: 'orderStatus', label: 'Order Status', options: ['Open', 'Closed'] },
  { key: 'decision',    label: 'Decision',     options: ['Approved', 'Declined'] },
  ...EVENT_FILTER_CATEGORIES.map(cat =>
    cat.key === 'status' ? { ...cat, label: 'Event Status' } : cat
  ),
];

const ORDERS_SMART_SEARCH_OPTIONS = ORDER_STATUS_FILTER.map(cat => ({
  label: cat.label,
  options: cat.options.map(opt => ({ value: `${cat.key}::${opt}`, label: opt })),
}));

const PROCUREMENT_CONTACTS = [
  { value: 'sarah.chen@allegion.com',     label: 'Sarah Chen — sarah.chen@allegion.com' },
  { value: 'james.kowalski@allegion.com', label: 'James Kowalski — james.kowalski@allegion.com' },
  { value: 'lisa.okafor@allegion.com',    label: 'Lisa Okafor — lisa.okafor@allegion.com' },
  { value: 'derek.pham@allegion.com',     label: 'Derek Pham — derek.pham@allegion.com' },
  { value: 'procurement@allegion.com',    label: 'Procurement Team — procurement@allegion.com' },
];

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

export default function OrdersPage() {
  const { ordersDateRange, setOrdersDateRange, ordersFilters, setOrdersFilters } = useFilterStore();

  const [dateRange, setDateRangeLocal] = useState<DateRange | null>(ordersDateRange);
  const [appliedFiltersLocal, setAppliedFiltersLocal] = useState<Record<string, string[]>>(ordersFilters);

  const setDateRange = (r: DateRange | null) => { setDateRangeLocal(r); setOrdersDateRange(r); };
  const setAppliedFilters = (f: Record<string, string[]>) => { setAppliedFiltersLocal(f); setOrdersFilters(f); };

  const { token } = theme.useToken();

  const ordersSelectValue = ORDER_STATUS_FILTER.flatMap(cat =>
    (appliedFiltersLocal[cat.key] ?? []).map(v => `${cat.key}::${v}`)
  );

  const handleOrdersSmartSearch = (values: string[]) => {
    const next: Record<string, string[]> = {};
    for (const v of values) {
      const sep = v.indexOf('::');
      const key = v.slice(0, sep);
      const val = v.slice(sep + 2);
      if (!next[key]) next[key] = [];
      next[key].push(val);
    }
    setAppliedFilters(next);
  };

  const chips = ORDER_STATUS_FILTER.flatMap((cat) =>
    (appliedFiltersLocal[cat.key] ?? []).map((val) => `${cat.label}: ${val}`)
  );

  const removeChip = (chip: string) => {
    const [catLabel, val] = chip.split(': ');
    const cat = ORDER_STATUS_FILTER.find((c) => c.label === catLabel);
    if (!cat) return;
    const next = { ...appliedFiltersLocal };
    next[cat.key] = (next[cat.key] ?? []).filter((v) => v !== val);
    setAppliedFilters(next);
  };

  // Row-level status overrides (tracks in-session changes)
  const [rowStatuses, setRowStatuses]       = useState<Record<string, OrderStatus>>({});
  const [rowApproved, setRowApproved]       = useState<Record<string, boolean>>({});
  const [rowDeclined, setRowDeclined]       = useState<Record<string, boolean>>({});
  const [rowProcurement, setRowProcurement] = useState<Record<string, boolean>>({});

  const effectiveStatus = (row: OrderRow): OrderStatus =>
    rowStatuses[row.id] ?? (row.orderStatus as OrderStatus);
  const isApproved = (row: OrderRow): boolean =>
    rowApproved[row.id] ?? row.approved ?? false;
  const isDeclined = (row: OrderRow): boolean =>
    rowDeclined[row.id] ?? row.declined ?? false;
  const isProcurement = (row: OrderRow): boolean =>
    rowProcurement[row.id] ?? row.assignedToProcurement ?? false;

  // Procurement queue toggle
  const [procurementQueue, setProcurementQueue] = useState(false);

  // Batch selection
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<string[]>([]);
  const [batchCloseOpen, setBatchCloseOpen]       = useState(false);

  // Row action target
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Approve modal
  const [approveOpen, setApproveOpen]         = useState(false);
  const [approveAssign, setApproveAssign]     = useState(false);
  const [approveEmail, setApproveEmail]       = useState('');
  const [approveReplacement, setApproveReplacement] = useState('');

  // Decline modal
  const [declineOpen, setDeclineOpen]   = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Close single modal
  const [closeOpen, setCloseOpen] = useState(false);

  // Reopen modal
  const [reopenOpen, setReopenOpen]     = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const [notifApi, notifContextHolder] = notification.useNotification();

  const resetApprove = () => {
    setApproveAssign(false);
    setApproveEmail('');
    setApproveReplacement('');
  };

  const handleConfirmApprove = () => {
    if (!activeOrderId) return;
    setRowApproved(prev => ({ ...prev, [activeOrderId]: true }));
    if (approveAssign && approveEmail) {
      setRowProcurement(prev => ({ ...prev, [activeOrderId]: true }));
      notifApi.success({
        message: `Order ${activeOrderId} approved`,
        description: `Procurement notified: ${approveEmail}`,
        placement: 'bottomRight', duration: 4,
      });
    } else {
      notifApi.success({ message: `Order ${activeOrderId} approved`, placement: 'bottomRight', duration: 4 });
    }
    setApproveOpen(false);
    resetApprove();
  };

  const handleDecline = () => {
    if (!activeOrderId || !declineReason.trim()) return;
    setRowStatuses(prev => ({ ...prev, [activeOrderId]: 'Closed' }));
    setRowDeclined(prev => ({ ...prev, [activeOrderId]: true }));
    setRowApproved(prev => ({ ...prev, [activeOrderId]: false }));
    notifApi.success({ message: `Order ${activeOrderId} declined`, placement: 'bottomRight', duration: 4 });
    setDeclineOpen(false);
    setDeclineReason('');
  };

  const handleClose = () => {
    if (!activeOrderId) return;
    setRowStatuses(prev => ({ ...prev, [activeOrderId]: 'Closed' }));
    notifApi.success({ message: `Order ${activeOrderId} closed`, placement: 'bottomRight', duration: 4 });
    setCloseOpen(false);
  };

  const handleReopen = () => {
    if (!activeOrderId || !reopenReason.trim()) return;
    setRowStatuses(prev => ({ ...prev, [activeOrderId]: 'Open' }));
    setRowApproved(prev => { const n = { ...prev }; delete n[activeOrderId!]; return n; });
    setRowDeclined(prev => { const n = { ...prev }; delete n[activeOrderId!]; return n; });
    setRowProcurement(prev => { const n = { ...prev }; delete n[activeOrderId!]; return n; });
    notifApi.success({ message: `Order ${activeOrderId} reopened`, placement: 'bottomRight', duration: 4 });
    setReopenOpen(false);
    setReopenReason('');
  };

  const handleBatchClose = () => {
    const toClose = selectedOrderKeys.filter(id => {
      const row = orderRows.find(r => r.id === id);
      return row && effectiveStatus(row) === 'Open';
    });
    if (toClose.length === 0) return;
    setRowStatuses(prev => {
      const next = { ...prev };
      toClose.forEach(id => { next[id] = 'Closed'; });
      return next;
    });
    notifApi.success({
      message: `${toClose.length} order${toClose.length > 1 ? 's' : ''} closed`,
      placement: 'bottomRight', duration: 4,
    });
    setBatchCloseOpen(false);
    setSelectedOrderKeys([]);
  };

  const openRowAction = (key: string, row: OrderRow) => {
    setActiveOrderId(row.id);
    if (key === 'approve') setApproveOpen(true);
    if (key === 'decline') setDeclineOpen(true);
    if (key === 'close')   setCloseOpen(true);
    if (key === 'reopen')  setReopenOpen(true);
  };

  const getMenuItems = (row: OrderRow): MenuProps['items'] => {
    const st = effectiveStatus(row);
    const approved = isApproved(row);
    const items: MenuProps['items'] = [];
    if (st === 'Open' && !approved) {
      items.push({ key: 'approve', label: 'Approve',  icon: <CheckOutlined /> });
      items.push({ key: 'decline', label: 'Decline',  icon: <CloseOutlined /> });
    }
    if (st === 'Open' && approved) {
      items.push({ key: 'close', label: 'Close Order', icon: <CheckOutlined /> });
    }
    if (st === 'Closed') {
      items.push({ key: 'reopen', label: 'Reopen', icon: <RollbackOutlined /> });
    }
    return items;
  };

  const filtered = orderRows.filter(o => {
    if (dateRange) {
      const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    const matchOrderStatus   = !appliedFiltersLocal.orderStatus?.length   || appliedFiltersLocal.orderStatus.includes(effectiveStatus(o));
    const matchDecision      = !appliedFiltersLocal.decision?.length      || appliedFiltersLocal.decision.some(d =>
      (d === 'Approved' && isApproved(o)) || (d === 'Declined' && isDeclined(o))
    );
    const matchProcurement   = !procurementQueue || isProcurement(o);
    const matchEventStatus   = !appliedFiltersLocal.status?.length        || appliedFiltersLocal.status.includes(o.status);
    const matchDiscrepancy   = !appliedFiltersLocal.discrepancy?.length   || appliedFiltersLocal.discrepancy.includes(o.discrepancy);
    const matchDoor          = !appliedFiltersLocal.door?.length          || appliedFiltersLocal.door.includes(o.door);
    const matchProduct       = !appliedFiltersLocal.product?.length       || appliedFiltersLocal.product.includes(o.product);
    const matchBranch        = !appliedFiltersLocal.branch?.length        || appliedFiltersLocal.branch.includes(o.branch);
    const matchPlant         = !appliedFiltersLocal.plant?.length         || appliedFiltersLocal.plant.includes(o.plant);
    const matchReportedBy    = !appliedFiltersLocal.reportedBy?.length    || appliedFiltersLocal.reportedBy.includes(o.reportedBy);
    return matchOrderStatus && matchDecision && matchProcurement && matchEventStatus &&
      matchDiscrepancy && matchDoor && matchProduct && matchBranch && matchPlant && matchReportedBy;
  });

  const openCount = selectedOrderKeys.filter(id => {
    const row = orderRows.find(r => r.id === id);
    return row && effectiveStatus(row) === 'Open';
  }).length;

  const columns: ColumnsType<OrderRow> = [
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
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (id: string) => (
        <Link href={`/orders/${id}`} style={{ fontWeight: 500, textDecoration: 'none' }}>
          {id}
        </Link>
      ),
      width: 160,
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
      title: 'Door Type',
      dataIndex: 'door',
      key: 'door',
      sorter: (a, b) => a.door.localeCompare(b.door),
      ellipsis: { showTitle: true },
      width: 176,
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
      title: 'Reported By',
      dataIndex: 'reportedBy',
      key: 'reportedBy',
      sorter: (a, b) => a.reportedBy.localeCompare(b.reportedBy),
      ellipsis: { showTitle: true },
      width: 182,
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
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      sorter: (a, b) => a.plant.localeCompare(b.plant),
      render: (plant: string) => plant.split(' ')[0],
      width: 64,
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
      {notifContextHolder}

      {/* APPROVE MODAL */}
      <Modal
        title="Approve Order"
        open={approveOpen}
        onCancel={() => { setApproveOpen(false); resetApprove(); }}
        onOk={handleConfirmApprove}
        okText={approveAssign && approveEmail ? 'Approve & Notify Procurement' : 'Approve'}
        okButtonProps={{ type: 'primary' }}
        width={480}
      >
        <Typography.Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
          This marks the order as approved. You can assign it to procurement now or as a separate step after.
        </Typography.Text>
        <Form layout="vertical" size="small">
          <Form.Item label="Replacement Order # (optional)" style={{ marginBottom: 12 }}>
            <Input
              placeholder="e.g. RO-2026-00123"
              value={approveReplacement}
              onChange={e => setApproveReplacement(e.target.value)}
            />
          </Form.Item>
        </Form>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: token.colorFillTertiary,
          borderRadius: token.borderRadiusSM, marginBottom: approveAssign ? 12 : 0,
        }}>
          <Typography.Text style={{ fontSize: token.fontSize }}>Assign to Procurement</Typography.Text>
          <Switch
            checked={approveAssign}
            onChange={v => { setApproveAssign(v); if (!v) setApproveEmail(''); }}
          />
        </div>
        {approveAssign && (
          <Form layout="vertical" size="small" style={{ marginTop: 12 }}>
            <Form.Item label="Notify" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Select procurement contact..."
                value={approveEmail || undefined}
                onChange={v => setApproveEmail(v)}
                options={PROCUREMENT_CONTACTS}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* DECLINE MODAL */}
      <Modal
        title="Decline Order"
        open={declineOpen}
        onCancel={() => { setDeclineOpen(false); setDeclineReason(''); }}
        onOk={handleDecline}
        okText="Decline & Close"
        okButtonProps={{ danger: true, disabled: !declineReason.trim() }}
      >
        <Typography.Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
          This will close the order. Please provide a reason for the record.
        </Typography.Text>
        <Input.TextArea
          placeholder="Reason for declining..."
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          rows={4}
          autoFocus
        />
      </Modal>

      {/* CLOSE SINGLE MODAL */}
      <Modal
        title="Close Order"
        open={closeOpen}
        onCancel={() => setCloseOpen(false)}
        onOk={handleClose}
        okText="Close Order"
        okButtonProps={{ type: 'primary' }}
      >
        <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
          This will mark the order as Closed. It can be reopened if needed.
        </Typography.Text>
      </Modal>

      {/* REOPEN MODAL */}
      <Modal
        title="Reopen Order"
        open={reopenOpen}
        onCancel={() => { setReopenOpen(false); setReopenReason(''); }}
        onOk={handleReopen}
        okText="Reopen"
        okButtonProps={{ disabled: !reopenReason.trim() }}
      >
        <Typography.Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
          This will reopen the order to Open status. Please provide a reason.
        </Typography.Text>
        <Input.TextArea
          placeholder="Reason for reopening..."
          value={reopenReason}
          onChange={e => setReopenReason(e.target.value)}
          rows={4}
          autoFocus
        />
      </Modal>

      {/* BATCH CLOSE CONFIRM */}
      <Modal
        title="Close Orders"
        open={batchCloseOpen}
        onCancel={() => setBatchCloseOpen(false)}
        onOk={handleBatchClose}
        okText={`Close ${openCount} Order${openCount !== 1 ? 's' : ''}`}
        okButtonProps={{ type: 'primary', disabled: openCount === 0 }}
      >
        <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
          {openCount > 0
            ? `This will close ${openCount} open order${openCount !== 1 ? 's' : ''}. They can be reopened individually if needed.`
            : 'No open orders are selected.'}
        </Typography.Text>
      </Modal>

      <PageHeader
        left={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
        right={
          <Space>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Search order status, branch, product..."
              options={ORDERS_SMART_SEARCH_OPTIONS}
              value={ordersSelectValue}
              onChange={handleOrdersSmartSearch}
              maxTagCount="responsive"
              style={{ width: 280 }}
              suffixIcon={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              allowClear
            />
            <FilterPanel
              categories={ORDER_STATUS_FILTER}
              applied={appliedFiltersLocal}
              onApply={setAppliedFilters}
            />
          </Space>
        }
      />

      <div style={{ padding: token.paddingMD }}>
        {chips.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: token.marginXS, marginBottom: token.margin }}>
            {chips.map((chip) => (
              <Tag key={chip} closable onClose={() => removeChip(chip)} closeIcon={<CloseOutlined />} style={{ margin: 0 }}>
                {chip}
              </Tag>
            ))}
            <Button type="link" size="small" onClick={() => setAppliedFilters({})} style={{ padding: '0 4px' }}>
              Clear all
            </Button>
          </div>
        )}

        <Tabs
          activeKey={procurementQueue ? 'procurement' : 'all'}
          onChange={key => setProcurementQueue(key === 'procurement')}
          style={{ marginBottom: 8 }}
          items={[
            { key: 'all', label: 'All Orders' },
            { key: 'procurement', label: 'Assigned to Procurement' },
          ]}
        />

        {selectedOrderKeys.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8, padding: '6px 10px',
            background: token.colorFillSecondary,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
                {selectedOrderKeys.length} selected
              </Typography.Text>
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setSelectedOrderKeys([])}>
                Clear
              </Button>
            </div>
            <Button
              size="small"
              icon={<CheckOutlined />}
              disabled={openCount === 0}
              onClick={() => setBatchCloseOpen(true)}
            >
              Close Orders{openCount > 0 ? ` (${openCount})` : ''}
            </Button>
          </div>
        )}

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="small"
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedOrderKeys,
            onChange: keys => setSelectedOrderKeys(keys as string[]),
          }}
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
