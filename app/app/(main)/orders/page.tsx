'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import dayjs from 'dayjs';
import {
  AutoComplete, Form, Input, Modal, Pagination, Select,
  Switch, Table, Button, Tag, Typography, theme, Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  CheckCircleFilled, CheckOutlined, CloseCircleFilled, CloseOutlined, ExportOutlined, RollbackOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { JobNoValue } from '@/components/JobNoValue';
import { TechReplyWarning, awaitingTechReply, partyAwaiting, partyResponded, replyReviewParty } from '@/components/TechReplyWarning';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { orders } from '@/data/orders';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';
import { useCapabilities } from '@/store/roleStore';
import { capabilitiesFor } from '@/lib/roles';
import { FilterPanel } from '@/components/FilterPanel';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { EVENT_FILTER_CATEGORIES, ORDER_FILTER_CATEGORIES } from '@/data/filterOptions';
import { useFilterStore } from '@/store/filterStore';
import { useOrderStore } from '@/store/orderStore';
import { OrderCard } from '@/components/OrderCard';
import { ThreadStateIcons, OrderStageTag, type OrderStage } from '@/components/StatusTag';
import type { Order, OrderStatus } from '@/data/orders';
import type { QualityEvent } from '@/data/types';
type OrderRow = Order & Pick<QualityEvent, 'issue' | 'component' | 'door' | 'branch' | 'plant' | 'reportedBy' | 'status' | 'jobNoManualEntry'>;

const ORDER_STATUS_FILTER = [
  ...ORDER_FILTER_CATEGORIES,
  ...EVENT_FILTER_CATEGORIES.map(cat =>
    cat.key === 'status' ? { ...cat, label: 'Event Status' } : cat
  ),
];


const PROCUREMENT_CONTACTS = [
  { value: 'sophronia.aldwick@allegion.com', label: 'Sophronia T. Aldwick — sophronia.aldwick@allegion.com' },
  { value: 'ptolemy.dunholm@allegion.com',   label: 'Ptolemy R. Dunholm — ptolemy.dunholm@allegion.com' },
  { value: 'leontine.foxmere@allegion.com',  label: 'Leontine M. Foxmere — leontine.foxmere@allegion.com' },
  { value: 'aldhelm.blackhill@allegion.com', label: 'Aldhelm V. Blackhill — aldhelm.blackhill@allegion.com' },
  { value: 'fulfillment@allegion.com',       label: 'Fulfillment Team — fulfillment@allegion.com' },
];

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

const CARD_PAGE_SIZE = 12;

function OrdersPageContent() {
  const searchParams = useSearchParams();
  // Branch (View-Only) roles see only their branch's orders (scoped via the
  // linked event's branch, which orderRows already carries).
  const caps = useCapabilities();
  const createdOrders = useOrderStore((s) => s.createdOrders);
  const eventMap = useEffectiveEventMap();
  const orderRows = useMemo(() => {
    // Runtime-created orders (parts request on an orderless event) merge in
    // ahead of the static set so the newest work appears.
    const created = Object.values(createdOrders)
      .filter(o => eventMap.has(o.eventId))
      .map(o => buildOrderRow(o, eventMap));
    const all = [...created, ...orders.map(o => buildOrderRow(o, eventMap))];
    return caps.branchScoped && caps.assignedBranch
      ? all.filter(r => r.branch === caps.assignedBranch)
      : all;
  }, [createdOrders, caps.branchScoped, caps.assignedBranch, eventMap]);
  const stageParam       = searchParams.get('stage');
  const assignmentParam  = searchParams.get('assignment');
  const activityParam    = searchParams.get('activity');
  const flagParam        = searchParams.get('flag');
  const fromParam        = searchParams.get('from');
  const toParam          = searchParams.get('to');

  const { ordersDateRange, setOrdersDateRange, ordersFilters, setOrdersFilters } = useFilterStore();

  const [dateRange, setDateRangeLocal] = useState<DateRange | null>(() => {
    if (fromParam && toParam) return [dayjs(fromParam), dayjs(toParam)] as DateRange;
    return ordersDateRange;
  });
  const [appliedFiltersLocal, setAppliedFiltersLocal] = useState<Record<string, string[]>>(() => {
    const fromUrl: Record<string, string[]> = {};
    if (stageParam)      fromUrl.stage      = stageParam.split(',');
    if (assignmentParam) fromUrl.assignment = assignmentParam.split(',');
    if (activityParam)   fromUrl.activity   = activityParam.split(',');
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
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.eventId}</span>
            <span style={{ fontSize: 11, color: token.colorTextTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.jobNo} · {o.issue}</span>
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
  }, [searchText, orderRows, token.colorTextTertiary]);

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
  const isWithFulfillment = (row: OrderRow): boolean =>
    orderMutations[row.id]?.assignedToFulfillment ?? row.assignedToFulfillment ?? false;
  const effectiveReplacementOrderNo = (row: OrderRow): string =>
    orderMutations[row.id]?.replacementOrderNo ?? row.replacementOrderNo ?? '';

  // Batch selection
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<string[]>([]);

  // Row action target
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Approve modal
  const [approveOpen, setApproveOpen]         = useState(false);
  const [approveAssign, setApproveAssign]     = useState(false);
  const [approveEmail, setApproveEmail]       = useState('');

  // Decline modal
  const [declineOpen, setDeclineOpen]   = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Close single modal
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReplacementOrderNo, setCloseReplacementOrderNo] = useState('');

  // Reopen modal
  const [reopenOpen, setReopenOpen]     = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const [approveSuccess,    setApproveSuccess]    = useState(false);
  const [declineSuccess,    setDeclineSuccess]    = useState(false);
  const [closeSuccess,      setCloseSuccess]      = useState(false);
  const [reopenSuccess,     setReopenSuccess]     = useState(false);
  const [cardPage, setCardPage] = useState(1);
  // Reset mobile card pagination when the result set changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCardPage(1); }, [appliedFiltersLocal]);

  const handleExportOrders = () => {
    const toExport = selectedOrderKeys.length > 0 ? filtered.filter(o => selectedOrderKeys.includes(o.id)) : filtered;
    const headers = ['Order ID', 'Job No.', 'Branch', 'Issue', 'Component', 'Door', 'Reported By', 'Plant', 'Last Updated', 'Order Status'];
    const csvStage = (r: OrderRow): string =>
      isDeclined(r) ? 'Declined' : isApproved(r) ? (effectiveStatus(r) === 'Open' ? 'Approved' : 'Fulfilled') : 'Pending Decision';
    const rows = toExport.map(o => [o.id, o.jobNo, o.branch, o.issue, o.component, o.door, o.reportedBy, o.plant, o.lastUpdated, csvStage(o)]);
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
  };

  const handleConfirmApprove = () => {
    if (!activeOrderId) return;
    patchOrder(activeOrderId, { approved: true });
    if (approveAssign && approveEmail) {
      patchOrder(activeOrderId, { assignedToFulfillment: true });
    }
    setApproveSuccess(true);
  };

  const handleDecline = () => {
    if (!activeOrderId || !declineReason.trim()) return;
    patchOrder(activeOrderId, { status: 'Closed', declined: true, approved: false, declineReason: declineReason.trim() });
    setDeclineSuccess(true);
  };

  const handleClose = () => {
    if (!activeOrderId || !closeReplacementOrderNo.trim()) return;
    patchOrder(activeOrderId, {
      status: 'Closed',
      replacementOrderNo: closeReplacementOrderNo.trim(),
    });
    setCloseSuccess(true);
  };

  const handleReopen = () => {
    if (!activeOrderId || !reopenReason.trim()) return;
    patchOrder(activeOrderId, { status: 'Open', approved: false, declined: false, assignedToFulfillment: false });
    setReopenSuccess(true);
  };

  const openRowAction = (key: string, row: OrderRow) => {
    setActiveOrderId(row.id);
    if (key === 'approve') setApproveOpen(true);
    if (key === 'decline') setDeclineOpen(true);
    if (key === 'close')   { setCloseReplacementOrderNo(effectiveReplacementOrderNo(row)); setCloseOpen(true); }
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
    if (flagParam === 'fulfillment' && !(isApproved(o) && isWithFulfillment(o))) return false;
    if (flagParam === 'info' && !(effectiveStatus(o) === 'Open' && awaitingTechReply(eventMap.get(o.eventId)?.additionalInfoRequests))) return false;
    if (flagParam === 'responded' && !(effectiveStatus(o) === 'Open' && replyReviewParty(eventMap.get(o.eventId)?.additionalInfoRequests) !== null)) return false;
    if (flagParam === 'withCS' && !(effectiveStatus(o) === 'Open' && isApproved(o) && !isWithFulfillment(o))) return false;
    const stageOfRow = (r: OrderRow): string =>
      isDeclined(r) ? 'Declined' : isApproved(r) ? (effectiveStatus(r) === 'Open' ? 'Approved' : 'Fulfilled') : 'Pending Decision';
    const matchStage      = !appliedFiltersLocal.stage?.length      || appliedFiltersLocal.stage.includes(stageOfRow(o));
    const matchAssignment = !appliedFiltersLocal.assignment?.length || appliedFiltersLocal.assignment.some(a =>
      effectiveStatus(o) === 'Open' && isApproved(o) &&
      (a === 'With Fulfillment' ? isWithFulfillment(o) : !isWithFulfillment(o))
    );
    const matchActivity   = !appliedFiltersLocal.activity?.length   || appliedFiltersLocal.activity.some(a => {
      if (effectiveStatus(o) !== 'Open') return false;
      const thread = eventMap.get(o.eventId)?.additionalInfoRequests;
      return a === 'Request Pending'
        ? partyAwaiting(thread, 'Customer Service')
        : partyResponded(thread, 'Customer Service');
    });
    const matchEventStatus   = !appliedFiltersLocal.status?.length        || appliedFiltersLocal.status.includes(o.status);
    const matchIssue         = !appliedFiltersLocal.issue?.length         || appliedFiltersLocal.issue.includes(o.issue);
    const matchDoor          = !appliedFiltersLocal.door?.length          || appliedFiltersLocal.door.includes(o.door);
    const matchComponent     = !appliedFiltersLocal.component?.length     || appliedFiltersLocal.component.includes(o.component);
    const matchBranch        = !appliedFiltersLocal.branch?.length        || appliedFiltersLocal.branch.includes(o.branch);
    const matchPlant         = !appliedFiltersLocal.plant?.length         || appliedFiltersLocal.plant.includes(o.plant);
    const matchReportedBy    = !appliedFiltersLocal.reportedBy?.length    || appliedFiltersLocal.reportedBy.includes(o.reportedBy);
    return matchStage && matchAssignment && matchActivity && matchEventStatus &&
      matchIssue && matchDoor && matchComponent && matchBranch && matchPlant && matchReportedBy;
  });


  const evtColFilters = (key: string) =>
    (EVENT_FILTER_CATEGORIES.find(c => c.key === key)?.options ?? []).map(o => ({ text: o, value: o }));

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
      title: 'Job No.',
      dataIndex: 'jobNo',
      key: 'jobNo',
      sorter: (a, b) => a.jobNo.localeCompare(b.jobNo),
      width: 148,
      render: (jobNo: string, record) => <JobNoValue jobNo={jobNo} manualEntry={record.jobNoManualEntry} />,
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
      title: 'Issue',
      dataIndex: 'issue',
      key: 'issue',
      sorter: (a, b) => a.issue.localeCompare(b.issue),
      filters: evtColFilters('issue'),
      filteredValue: appliedFiltersLocal.issue ?? null,
      ellipsis: { showTitle: true },
      width: 176,
    },
    {
      title: 'Component',
      dataIndex: 'component',
      key: 'component',
      sorter: (a, b) => a.component.localeCompare(b.component),
      filters: evtColFilters('component'),
      filteredValue: appliedFiltersLocal.component ?? null,
      ellipsis: { showTitle: true },
      width: 140,
    },
    {
      title: 'Door',
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
      title: 'Event Status',
      key: 'eventStatus',
      sorter: (a, b) => a.status.localeCompare(b.status),
      width: 170,
      render: (_, record) => {
        // Event lifecycle is context here, not the working object: neutral
        // chip, colors stay unique to the order pipeline (Rob 2026-08-05).
        const active = record.status === 'Reported' || record.status === 'Under Investigation';
        const thread = eventMap.get(record.eventId)?.additionalInfoRequests;
        const fq = capabilitiesFor('Field Quality').displayName;
        return (
          <Tag style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {record.status}
            <ThreadStateIcons
              awaiting={active && partyAwaiting(thread, 'Field Quality')}
              responded={active && partyResponded(thread, 'Field Quality')}
              awaitingTooltip={`${fq} asked. Response pending.`}
              respondedTooltip={`${record.reportedBy} replied. Review the answer.`}
            />
          </Tag>
        );
      },
    },
    {
      title: 'Order Status',
      key: 'orderStatus',
      sorter: (a, b) => effectiveStatus(a).localeCompare(effectiveStatus(b)),
      filters: ['Pending Decision', 'Approved', 'Fulfilled', 'Declined'].map(v => ({ text: v, value: v })),
      filteredValue: appliedFiltersLocal.stage ?? null,
      width: 120,
      render: (_, record) => {
        // Pipeline-first (Rob, 2026-08-05): on order surfaces the ORDER wears
        // the color, showing its stage directly (Open/Closed is derivable:
        // Fulfilled and Declined are closed). CS-owned conversation state
        // stays on this chip; FQ-owned state on the neutral event chip.
        const open = effectiveStatus(record) === 'Open';
        const stage: OrderStage = isDeclined(record)
          ? 'Declined'
          : isApproved(record) ? (open ? 'Approved' : 'Fulfilled') : 'Pending Decision';
        const thread = eventMap.get(record.eventId)?.additionalInfoRequests;
        const cs = capabilitiesFor('Customer Service').displayName;
        return (
          <OrderStageTag
            stage={stage}
            assigned={open && isApproved(record) && isWithFulfillment(record)}
            additionalInfoRequested={open && partyAwaiting(thread, 'Customer Service')}
            responseReceived={open && partyResponded(thread, 'Customer Service')}
            awaitingTooltip={`${cs} asked. Response pending.`}
            respondedTooltip={`The technician replied to ${cs}'s question.`}
          />
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
        okText={approveAssign && approveEmail ? 'Approve & Notify Fulfillment' : 'Approve'}
        okButtonProps={{ type: 'primary' }}
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
            <TechReplyWarning
              thread={eventMap.get(orderRows.find(r => r.id === activeOrderId)?.eventId ?? '')?.additionalInfoRequests}
              style={{ marginBottom: 12 }}
            />
            <Typography.Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This marks the order as approved. You can assign it to fulfillment now or as a separate step after.
            </Typography.Text>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', background: token.colorFillTertiary,
              borderRadius: token.borderRadiusSM, marginBottom: approveAssign ? 12 : 0,
            }}>
              <Typography.Text style={{ fontSize: token.fontSize }}>Assign to Fulfillment</Typography.Text>
              <Switch
                checked={approveAssign}
                onChange={v => { setApproveAssign(v); if (!v) setApproveEmail(''); }}
              />
            </div>
            {approveAssign && (
              <Form layout="vertical" size="small" style={{ marginTop: 12 }}>
                <Form.Item label="Notify" style={{ marginBottom: 0 }}>
                  <Select
                    placeholder="Select fulfillment contact..."
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
              {activeOrderId} has been closed. It can be reopened if needed.
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setCloseOpen(false); setCloseSuccess(false); setCloseReplacementOrderNo(''); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Typography.Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This will mark the order as Closed. It can be reopened if needed.
            </Typography.Text>
            <Form layout="vertical" size="small">
              <Form.Item label="Replacement Order #" required style={{ marginBottom: 10 }}>
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
            <Input aria-label="Search orders" suffix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />} />
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

      <div style={{ padding: '16px 20px' }}>
        {screens.md !== false && chips.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: token.marginXS, marginBottom: token.margin }}>
            {chips.map((chip) => (
              <Tag
                key={chip}
                closable
                onClose={() => removeChip(chip)}
                closeIcon={
                  // Padding grows the close target to 24x24; the negative margin cancels it visually.
                  <span
                    role="img"
                    aria-label={`Remove filter ${chip}`}
                    style={{ display: 'inline-flex', padding: 7, margin: -7 }}
                  >
                    <CloseOutlined />
                  </span>
                }
                style={{ margin: 0 }}
              >
                {chip}
              </Tag>
            ))}
            <Button type="link" size="small" onClick={() => setAppliedFilters({})} style={{ padding: '0 4px' }}>
              Clear all
            </Button>
          </div>
        )}

        {(() => {
          const cardItems = filtered.slice((cardPage - 1) * CARD_PAGE_SIZE, cardPage * CARD_PAGE_SIZE);
          return screens.xl === false ? (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: screens.md !== false ? 'repeat(2, 1fr)' : '1fr',
                gap: 12,
              }}>
                {cardItems.map(row => {
                  const open = effectiveStatus(row) === 'Open';
                  const active = row.status === 'Reported' || row.status === 'Under Investigation';
                  const thread = eventMap.get(row.eventId)?.additionalInfoRequests;
                  return (
                    <OrderCard
                      key={row.id}
                      row={row}
                      stage={isDeclined(row) ? 'Declined' : isApproved(row) ? (open ? 'Approved' : 'Fulfilled') : 'Pending Decision'}
                      assigned={open && isApproved(row) && isWithFulfillment(row)}
                      eventStatus={row.status}
                      awaitingResponse={open && partyAwaiting(thread, 'Customer Service')}
                      responseReceived={open && partyResponded(thread, 'Customer Service')}
                      eventAwaiting={active && partyAwaiting(thread, 'Field Quality')}
                      eventResponded={active && partyResponded(thread, 'Field Quality')}
                      menuItems={getMenuItems(row)}
                      onAction={key => openRowAction(key, row)}
                    />
                  );
                })}
              </div>
              {filtered.length > CARD_PAGE_SIZE && (
                <Pagination
                  current={cardPage}
                  pageSize={CARD_PAGE_SIZE}
                  total={filtered.length}
                  onChange={setCardPage}
                  size="small"
                  hideOnSinglePage
                  showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
                  style={{ textAlign: 'right', marginTop: 12 }}
                />
              )}
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8, padding: '6px 10px',
                background: token.colorFillSecondary,
                borderRadius: token.borderRadius,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedOrderKeys.length > 0 ? (
                    <>
                      <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
                        {selectedOrderKeys.length} selected
                      </Typography.Text>
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setSelectedOrderKeys([])}>
                        Clear
                      </Button>
                    </>
                  ) : (
                    <Typography.Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
                      {filtered.length} order{filtered.length !== 1 ? 's' : ''}
                    </Typography.Text>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button size="small" icon={<ExportOutlined />} onClick={handleExportOrders}>
                    Export
                  </Button>
                </div>
              </div>
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
          );
        })()}
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
