'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import dayjs from 'dayjs';
import {
  AutoComplete, Dropdown, Form, Input, List, Modal, Select,
  Switch, Table, Tabs, Button, Tag, Tooltip, Typography, theme, Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  CheckCircleFilled, CheckOutlined, CloseCircleFilled, CloseOutlined, ExportOutlined, MoreOutlined, RollbackOutlined,
  SearchOutlined, SendOutlined,
} from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { orders } from '@/data/orders';
import { events } from '@/data/events';
import { FilterPanel } from '@/components/FilterPanel';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { EVENT_FILTER_CATEGORIES } from '@/data/filterOptions';
import { useFilterStore } from '@/store/filterStore';
import { useOrderStore } from '@/store/orderStore';
import { OrderCard } from '@/components/OrderCard';
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


const PROCUREMENT_CONTACTS = [
  { value: 'sophronia.aldwick@allegion.com', label: 'Sophronia T. Aldwick — sophronia.aldwick@allegion.com' },
  { value: 'ptolemy.dunholm@allegion.com',   label: 'Ptolemy R. Dunholm — ptolemy.dunholm@allegion.com' },
  { value: 'leontine.foxmere@allegion.com',  label: 'Leontine M. Foxmere — leontine.foxmere@allegion.com' },
  { value: 'aldhelm.blackhill@allegion.com', label: 'Aldhelm V. Blackhill — aldhelm.blackhill@allegion.com' },
  { value: 'procurement@allegion.com',       label: 'Procurement Team — procurement@allegion.com' },
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

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const orderStatusParam = searchParams.get('orderStatus');
  const decisionParam    = searchParams.get('decision');
  const fromParam        = searchParams.get('from');
  const toParam          = searchParams.get('to');

  const { ordersDateRange, setOrdersDateRange, ordersFilters, setOrdersFilters } = useFilterStore();

  const [dateRange, setDateRangeLocal] = useState<DateRange | null>(() => {
    if (fromParam && toParam) return [dayjs(fromParam), dayjs(toParam)] as DateRange;
    return ordersDateRange;
  });
  const [appliedFiltersLocal, setAppliedFiltersLocal] = useState<Record<string, string[]>>(() => {
    const fromUrl: Record<string, string[]> = {};
    if (orderStatusParam) fromUrl.orderStatus = orderStatusParam.split(',');
    if (decisionParam)    fromUrl.decision    = decisionParam.split(',');
    return Object.keys(fromUrl).length ? fromUrl : ordersFilters;
  });

  // Same rule as events page: only sync date range, not category filters.
  useEffect(() => {
    if (fromParam && toParam) setOrdersDateRange([dayjs(fromParam), dayjs(toParam)] as DateRange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screens = Grid.useBreakpoint();

  const setDateRange = (r: DateRange | null) => { setDateRangeLocal(r); setOrdersDateRange(r); };
  const setAppliedFilters = (f: Record<string, string[]>) => { setAppliedFiltersLocal(f); setOrdersFilters(f); };

  const { token } = theme.useToken();

  const router = useRouter();
  const [searchText, setSearchText] = useState('');

  const searchOptions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    const matchingOrders = orderRows
      .filter(o => o.id.toLowerCase().includes(q) || o.jobNo.toLowerCase().includes(q) || o.eventId.toLowerCase().includes(q))
      .slice(0, 5)
      .map(o => ({
        value: `nav::order::${o.id}`,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.id}</span>
            <span style={{ fontSize: 11, color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.jobNo} · {o.discrepancy}</span>
          </div>
        ),
      }));
    const filterOpts = ORDER_STATUS_FILTER.flatMap(cat =>
      cat.options
        .filter(opt => opt.toLowerCase().includes(q))
        .map(opt => ({ value: `filter::${cat.key}::${opt}`, label: `${cat.label}: ${opt}` }))
    );
    return [
      ...(matchingOrders.length > 0 ? [{ label: 'Go to Order', options: matchingOrders }] : []),
      ...(filterOpts.length > 0 ? [{ label: 'Filter by', options: filterOpts }] : []),
    ];
  }, [searchText]);

  const handleSearchSelect = (value: string) => {
    setSearchText('');
    if (value.startsWith('nav::order::')) {
      router.push(`/orders/${value.slice('nav::order::'.length)}`);
    } else if (value.startsWith('filter::')) {
      const rest = value.slice('filter::'.length);
      const sep  = rest.indexOf('::');
      const key  = rest.slice(0, sep);
      const val  = rest.slice(sep + 2);
      setAppliedFilters({ ...appliedFiltersLocal, [key]: [...new Set([...(appliedFiltersLocal[key] ?? []), val])] });
    }
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

  const { mutations: orderMutations, patchOrder } = useOrderStore();

  const effectiveStatus = (row: OrderRow): OrderStatus =>
    orderMutations[row.id]?.status ?? (row.orderStatus as OrderStatus);
  const isApproved = (row: OrderRow): boolean =>
    orderMutations[row.id]?.approved ?? row.approved ?? false;
  const isDeclined = (row: OrderRow): boolean =>
    orderMutations[row.id]?.declined ?? row.declined ?? false;
  const isProcurement = (row: OrderRow): boolean =>
    orderMutations[row.id]?.assignedToProcurement ?? row.assignedToProcurement ?? false;

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

  const [approveSuccess,    setApproveSuccess]    = useState(false);
  const [declineSuccess,    setDeclineSuccess]    = useState(false);
  const [closeSuccess,      setCloseSuccess]      = useState(false);
  const [reopenSuccess,     setReopenSuccess]     = useState(false);
  const [batchCloseSuccess, setBatchCloseSuccess] = useState(false);
  const [batchCloseCount,   setBatchCloseCount]   = useState(0);

  const handleExportOrders = () => {
    const selected = filtered.filter(o => selectedOrderKeys.includes(o.id));
    const headers = ['Order ID', 'Job No.', 'Order Status', 'Discrepancy', 'Product', 'Door Type', 'Reported By', 'Branch', 'Plant', 'Last Updated'];
    const rows = selected.map(o => [o.id, o.jobNo, effectiveStatus(o), o.discrepancy, o.product, o.door, o.reportedBy, o.branch, o.plant, o.lastUpdated]);
    const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const resetApprove = () => {
    setApproveAssign(false);
    setApproveEmail('');
    setApproveReplacement('');
  };

  const handleConfirmApprove = () => {
    if (!activeOrderId) return;
    patchOrder(activeOrderId, { approved: true });
    if (approveAssign && approveEmail) {
      patchOrder(activeOrderId, { assignedToProcurement: true });
    }
    setApproveSuccess(true);
  };

  const handleDecline = () => {
    if (!activeOrderId || !declineReason.trim()) return;
    patchOrder(activeOrderId, { status: 'Closed', declined: true, approved: false });
    setDeclineSuccess(true);
  };

  const handleClose = () => {
    if (!activeOrderId) return;
    patchOrder(activeOrderId, { status: 'Closed' });
    setCloseSuccess(true);
  };

  const handleReopen = () => {
    if (!activeOrderId || !reopenReason.trim()) return;
    patchOrder(activeOrderId, { status: 'Open', approved: false, declined: false, assignedToProcurement: false });
    setReopenSuccess(true);
  };

  const handleBatchClose = () => {
    const toClose = selectedOrderKeys.filter(id => {
      const row = orderRows.find(r => r.id === id);
      return row && effectiveStatus(row) === 'Open';
    });
    if (toClose.length === 0) return;
    toClose.forEach(id => patchOrder(id, { status: 'Closed' }));
    setBatchCloseCount(toClose.length);
    setBatchCloseSuccess(true);
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

  const evtColFilters = (key: string) =>
    (EVENT_FILTER_CATEGORIES.find(c => c.key === key)?.options ?? []).map(o => ({ text: o, value: o }));

  const columns: ColumnsType<OrderRow> = [
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
      width: 130,
    },
    {
      title: 'Branch',
      dataIndex: 'branch',
      key: 'branch',
      sorter: (a, b) => a.branch.localeCompare(b.branch),
      filters: evtColFilters('branch'),
      filteredValue: appliedFiltersLocal.branch ?? null,
      filterSearch: true,
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
      filters: evtColFilters('discrepancy'),
      filteredValue: appliedFiltersLocal.discrepancy ?? null,
      ellipsis: { showTitle: true },
      width: 176,
    },
    {
      title: 'Product',
      dataIndex: 'product',
      key: 'product',
      sorter: (a, b) => a.product.localeCompare(b.product),
      filters: evtColFilters('product'),
      filteredValue: appliedFiltersLocal.product ?? null,
      ellipsis: { showTitle: true },
      width: 140,
    },
    {
      title: 'Door Type',
      dataIndex: 'door',
      key: 'door',
      sorter: (a, b) => a.door.localeCompare(b.door),
      filters: evtColFilters('door'),
      filteredValue: appliedFiltersLocal.door ?? null,
      filterSearch: true,
      ellipsis: { showTitle: true },
      width: 176,
    },
    {
      title: 'Reported By',
      dataIndex: 'reportedBy',
      key: 'reportedBy',
      sorter: (a, b) => a.reportedBy.localeCompare(b.reportedBy),
      filters: evtColFilters('reportedBy'),
      filteredValue: appliedFiltersLocal.reportedBy ?? null,
      filterSearch: true,
      ellipsis: { showTitle: true },
      width: 182,
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      sorter: (a, b) => a.plant.localeCompare(b.plant),
      render: (plant: string) => plant.split(' ')[0],
      width: 80,
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
      filters: [{ text: 'Open', value: 'Open' }, { text: 'Closed', value: 'Closed' }],
      filteredValue: appliedFiltersLocal.orderStatus ?? null,
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
      {/* APPROVE MODAL */}
      <Modal
        title={approveSuccess ? null : 'Approve Order'}
        open={approveOpen}
        onCancel={() => { setApproveOpen(false); resetApprove(); setApproveSuccess(false); }}
        onOk={handleConfirmApprove}
        okText={approveAssign && approveEmail ? 'Approve & Notify Procurement' : 'Approve'}
        okButtonProps={{ type: 'primary', disabled: !approveReplacement.trim() }}
        footer={approveSuccess ? null : undefined}
        width={480}
      >
        {approveSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Typography.Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Approved</Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {activeOrderId} has been approved.{' '}
              {approveAssign && approveEmail
                ? `Email notifications sent to ${orderRows.find(r => r.id === activeOrderId)?.branch} branch and ${approveEmail}.`
                : `Email notification sent to ${orderRows.find(r => r.id === activeOrderId)?.branch} branch.`}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setApproveOpen(false); resetApprove(); setApproveSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Typography.Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This marks the order as approved. You can assign it to procurement now or as a separate step after.
            </Typography.Text>
            <Form layout="vertical" size="small">
              <Form.Item label="Replacement Part #" required style={{ marginBottom: 12 }}>
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
          </>
        )}
      </Modal>

      {/* DECLINE MODAL */}
      <Modal
        title={declineSuccess ? null : 'Decline Order'}
        open={declineOpen}
        onCancel={() => { setDeclineOpen(false); setDeclineReason(''); setDeclineSuccess(false); }}
        onOk={handleDecline}
        okText="Decline & Close"
        okButtonProps={{ danger: true, disabled: !declineReason.trim() }}
        footer={declineSuccess ? null : undefined}
      >
        {declineSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CloseCircleFilled style={{ color: token.colorTextSecondary, fontSize: token.fontSize }} />
              <Typography.Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Declined</Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {activeOrderId} has been declined and closed. Email notification sent to {orderRows.find(r => r.id === activeOrderId)?.branch} branch.
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setDeclineOpen(false); setDeclineReason(''); setDeclineSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </Modal>

      {/* CLOSE SINGLE MODAL */}
      <Modal
        title={closeSuccess ? null : 'Close Order'}
        open={closeOpen}
        onCancel={() => { setCloseOpen(false); setCloseSuccess(false); }}
        onOk={handleClose}
        okText="Close Order"
        okButtonProps={{ type: 'primary' }}
        footer={closeSuccess ? null : undefined}
      >
        {closeSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Typography.Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Closed</Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {activeOrderId} has been closed. It can be reopened if needed.
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setCloseOpen(false); setCloseSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
            This will mark the order as Closed. It can be reopened if needed.
          </Typography.Text>
        )}
      </Modal>

      {/* REOPEN MODAL */}
      <Modal
        title={reopenSuccess ? null : 'Reopen Order'}
        open={reopenOpen}
        onCancel={() => { setReopenOpen(false); setReopenReason(''); setReopenSuccess(false); }}
        onOk={handleReopen}
        okText="Reopen"
        okButtonProps={{ disabled: !reopenReason.trim() }}
        footer={reopenSuccess ? null : undefined}
      >
        {reopenSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorInfo, fontSize: token.fontSize }} />
              <Typography.Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Reopened</Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {activeOrderId} has been returned to Open status and is ready for review.
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setReopenOpen(false); setReopenReason(''); setReopenSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </Modal>

      {/* BATCH CLOSE CONFIRM */}
      <Modal
        title={batchCloseSuccess ? null : 'Close Orders'}
        open={batchCloseOpen}
        onCancel={() => { setBatchCloseOpen(false); setBatchCloseSuccess(false); }}
        onOk={handleBatchClose}
        okText={`Close ${openCount} Order${openCount !== 1 ? 's' : ''}`}
        okButtonProps={{ type: 'primary', disabled: openCount === 0 }}
        footer={batchCloseSuccess ? null : undefined}
      >
        {batchCloseSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Typography.Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>
                {batchCloseCount} Order{batchCloseCount !== 1 ? 's' : ''} Closed
              </Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {batchCloseCount} order{batchCloseCount !== 1 ? 's have' : ' has'} been closed successfully.
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setBatchCloseOpen(false); setSelectedOrderKeys([]); setBatchCloseSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
            {openCount > 0
              ? `This will close ${openCount} open order${openCount !== 1 ? 's' : ''}. They can be reopened individually if needed.`
              : 'No open orders are selected.'}
          </Typography.Text>
        )}
      </Modal>

      <PageHeader
        left={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
        center={
          <AutoComplete
            value={searchText}
            onChange={setSearchText}
            onSelect={handleSearchSelect}
            options={searchOptions}
            placeholder="Search order ID, job no., branch, status..."
            style={{ width: '100%' }}
            allowClear
          >
            <Input suffix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />} />
          </AutoComplete>
        }
        right={
          <FilterPanel
            categories={ORDER_STATUS_FILTER}
            applied={appliedFiltersLocal}
            onApply={setAppliedFilters}
          />
        }
      />

      <div style={{ padding: token.paddingMD }}>
        {screens.md !== false && chips.length > 0 && (
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

        {screens.lg === false ? (
          <List
            dataSource={filtered}
            grid={{ gutter: 12, xs: 1, sm: 2 }}
            pagination={{
              pageSize: 12,
              hideOnSinglePage: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
              size: 'small',
              style: { textAlign: 'right', marginTop: 12 },
            }}
            renderItem={(row) => (
              <List.Item style={{ padding: 0 }}>
                <OrderCard
                  row={row}
                  status={effectiveStatus(row)}
                  menuItems={getMenuItems(row)}
                  onAction={key => openRowAction(key, row)}
                />
              </List.Item>
            )}
          />
        ) : (
          <>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    size="small"
                    icon={<CheckOutlined />}
                    disabled={openCount === 0}
                    onClick={() => setBatchCloseOpen(true)}
                  >
                    Close Orders{openCount > 0 ? ` (${openCount})` : ''}
                  </Button>
                  <Button size="small" icon={<ExportOutlined />} onClick={handleExportOrders}>
                    Export
                  </Button>
                </div>
              </div>
            )}

            <Table
              dataSource={filtered}
              columns={columns}
              rowKey="id"
              size="small"
              onChange={(_p, tableFilters) => {
                const next = { ...appliedFiltersLocal };
                Object.entries(tableFilters).forEach(([k, vals]) => {
                  if (vals?.length) next[k] = vals as string[];
                  else delete next[k];
                });
                setAppliedFilters(next);
              }}
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
          </>
        )}
      </div>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  );
}
