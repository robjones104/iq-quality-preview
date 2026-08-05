'use client';

import { useState, Fragment, useMemo } from 'react';
import Link from 'next/link';
import { useEventStore } from '@/store/eventStore';
import { mergeEvent } from '@/lib/effectiveEvents';
import { useOrderStore } from '@/store/orderStore';
import { useCapabilities } from '@/store/roleStore';
import {
  Button, Card, Col, Divider, Dropdown, Form, Grid, Input, InputNumber, Modal,
  Popover, Radio, Row, Segmented, Select, Slider, Switch, Table, Tag, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined, ArrowRightOutlined, BarcodeOutlined, CheckCircleFilled, CheckOutlined, CloseCircleFilled, CloseOutlined,
  EditFilled, MoreOutlined, PictureFilled, PlusOutlined, RollbackOutlined, SendOutlined,
} from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import { JobNoValue } from '@/components/JobNoValue';
import { TechReplyWarning } from '@/components/TechReplyWarning';
import { ShipToLine } from '@/components/ShipToLine';
import { PageHeader } from '@/components/PageHeader';
import { useInfoRequestThread, InfoRequestThreadPanel } from '@/components/InfoRequestThread';
import type { Order, OrderPart, OrderStatus } from '@/data/orders';
import { orders as allOrders } from '@/data/orders';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';
import type { QualityEvent } from '@/data/types';
import { DOOR_OPTIONS, PART_CATALOG } from '@/data/filterOptions';
import { nowStampUs } from '@/lib/appTime';
import { capabilitiesFor } from '@/lib/roles';
const { Text } = Typography;

type Status = OrderStatus;

interface LogEntry {
  id: string;
  timestamp: string;
  role: string;
  employee: string;
  orderStatus: Status;
  submittedStatus: string;
  content: string;
  auto: boolean;
}

const PROCUREMENT_CONTACTS = [
  { value: 'sophronia.aldwick@allegion.com', label: 'Sophronia T. Aldwick — sophronia.aldwick@allegion.com' },
  { value: 'ptolemy.dunholm@allegion.com',   label: 'Ptolemy R. Dunholm — ptolemy.dunholm@allegion.com' },
  { value: 'leontine.foxmere@allegion.com',  label: 'Leontine M. Foxmere — leontine.foxmere@allegion.com' },
  { value: 'aldhelm.blackhill@allegion.com', label: 'Aldhelm V. Blackhill — aldhelm.blackhill@allegion.com' },
  { value: 'procurement@allegion.com',       label: 'Procurement Team — procurement@allegion.com' },
];

const nowTs = (): string => nowStampUs();

const SEED_LOGS: Record<string, LogEntry[]> = {
  QE_2392_Order: [
    { id: 'l1', timestamp: '06-05-2026 15:38', role: 'System', employee: 'System', orderStatus: 'Open', submittedStatus: 'Reported', content: 'Order created from event QE_2392.', auto: true },
    { id: 'l2', timestamp: '06-05-2026 15:38', role: 'System', employee: 'System', orderStatus: 'Open', submittedStatus: 'Reported', content: 'Parts added: 413856-1 (×5 Piece), 413856-2 (×1 Set).', auto: true },
  ],
  QE_2391_Order: [
    { id: 'l1', timestamp: '06-04-2026 11:22', role: 'System', employee: 'System', orderStatus: 'Open', submittedStatus: 'Reported', content: 'Order created from event QE_2391.', auto: true },
  ],
  QE_2388_Order: [
    { id: 'l1', timestamp: '06-03-2026 09:14', role: 'System', employee: 'System', orderStatus: 'Open', submittedStatus: 'Reported', content: 'Order created from event QE_2388.', auto: true },
    { id: 'l2', timestamp: '06-03-2026 14:01', role: 'Customer Service', employee: 'Ava J. Elizabeth Thompson', orderStatus: 'Open', submittedStatus: 'Validated', content: 'Order approved.', auto: false },
    { id: 'l3', timestamp: '06-03-2026 14:22', role: 'Customer Service', employee: 'Ava J. Elizabeth Thompson', orderStatus: 'Closed', submittedStatus: 'Validated', content: 'Order closed by CS.', auto: false },
  ],
  QE_2385_Order: [
    { id: 'l1', timestamp: '06-03-2026 14:55', role: 'System', employee: 'System', orderStatus: 'Open', submittedStatus: 'Reported', content: 'Order created from event QE_2385.', auto: true },
    { id: 'l2', timestamp: '06-03-2026 16:30', role: 'Customer Service', employee: 'Ava J. Elizabeth Thompson', orderStatus: 'Open', submittedStatus: 'Validated', content: 'Order approved.', auto: false },
    { id: 'l3', timestamp: '06-03-2026 16:45', role: 'Customer Service', employee: 'Ava J. Elizabeth Thompson', orderStatus: 'Closed', submittedStatus: 'Validated', content: 'Order closed by CS.', auto: false },
  ],
};

type Props = { order: Order; event: QualityEvent };

export function OrderDetailClient({ order, event: eventProp }: Props) {
  const evtMutations = useEventStore(s => s.mutations);
  const event = useMemo(() => mergeEvent(eventProp, evtMutations[eventProp.id]), [eventProp, evtMutations]);
  const { token } = theme.useToken();
  const isDark = token.colorBgContainer !== '#ffffff';
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { mutations: orderMutations, createdOrders, patchOrder, pushOrderLog } = useOrderStore();
  const pushActivityLog = useEventStore(s => s.pushActivityLog);
  const patchEvent = useEventStore(s => s.patchEvent);
  const effEventMap = useEffectiveEventMap();
  const ordStored = orderMutations[order.id] ?? {};

  // Role capabilities. Customer Service decides (approve/decline); CS + Procurement
  // close/assign/enter replacement #. Other roles get a read-only order view.
  const caps = useCapabilities();
  const canDecide = caps.decideOrders;
  const canClose = caps.closeOrders;
  const canActOnOrder = canDecide || canClose;

  const [status, setStatus]             = useState<Status>(ordStored.status ?? (order.orderStatus as Status));
  const [approved, setApproved]         = useState(ordStored.approved ?? order.approved ?? (order.orderStatus === 'Closed'));
  // Declined is store/seed-derived (the decline action writes the store, so
  // this stays reactive); checked first in the stepper, so the legacy
  // "closed implies approved" default above cannot mislabel a declined order.
  const declined = (ordStored.declined ?? order.declined) === true;
  const [parts, setParts]               = useState<OrderPart[]>([...order.parts]);
  const [activeTab, setActiveTab]       = useState('details');
  const [assignedToProcurement, setAssignedToProcurement] = useState(ordStored.assignedToProcurement ?? order.assignedToProcurement ?? false);
  const [replacementOrderNo, setReplacementOrderNo]       = useState(ordStored.replacementOrderNo ?? '');
  const [editingReplacement, setEditingReplacement]       = useState(false);
  const [replacementDraft, setReplacementDraft]           = useState('');
  const [shipToEditOpen, setShipToEditOpen]               = useState(false);
  const [shipToDraft, setShipToDraft]                     = useState<'branch' | 'address'>('branch');
  const [shipToStreetDraft, setShipToStreetDraft]         = useState('');
  const [shipToCityDraft, setShipToCityDraft]             = useState('');

  // Log
  const seedLogs = SEED_LOGS[order.id] ?? [
    { id: 'l1', timestamp: order.lastUpdated, role: 'System', employee: 'System', orderStatus: order.orderStatus as Status, submittedStatus: event.status, content: `Order created from event ${order.eventId}.`, auto: true },
  ];
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    ...seedLogs,
    ...(ordStored.logAdditions ?? []) as LogEntry[],
  ]);
  // Modals
  const [approveOpen, setApproveOpen]                             = useState(false);
  const [approveAssign, setApproveAssign]                         = useState(false);
  const [approveProcurementEmail, setApproveProcurementEmail]     = useState('');
  const [closeOpen, setCloseOpen]                       = useState(false);
  const [closeReplacementOrderNo, setCloseReplacementOrderNo] = useState('');
  const [declineOpen, setDeclineOpen]                   = useState(false);
  const [declineReason, setDeclineReason]               = useState('');
  const [reopenOpen, setReopenOpen]                     = useState(false);
  const [reopenReason, setReopenReason]                 = useState('');
  const [procurementOpen, setProcurementOpen]           = useState(false);
  const [procurementEmail, setProcurementEmail]         = useState('');
  const [returnOpen, setReturnOpen]                     = useState(false);
  const [returnComment, setReturnComment]               = useState('');

  const [expandedScan,       setExpandedScan]       = useState<number | null>(null);
  const [expandedPhoto,      setExpandedPhoto]      = useState<number | null>(null);
  const [scanTab,            setScanTab]            = useState<'eventDetails' | 'messages'>('messages');
  const [approveSuccess,     setApproveSuccess]     = useState(false);
  const [declineSuccess,     setDeclineSuccess]     = useState(false);
  const [closeSuccess,       setCloseSuccess]       = useState(false);
  const [reopenSuccess,      setReopenSuccess]      = useState(false);
  const [procurementSuccess, setProcurementSuccess] = useState(false);
  const [returnSuccess,      setReturnSuccess]      = useState(false);

  const isMissingHardware = event.issue === 'Missing Hardware';
  const isSO = !order.jobNo.startsWith('WO');

  // Part modal
  const [partForm]          = Form.useForm();
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [editingSeqNo, setEditingSeqNo]   = useState<number | null>(null);
  const watchedKitInfo  = Form.useWatch('hardwareKitInfo', partForm);
  const watchedQuantity = (Form.useWatch('quantity', partForm) as number | undefined) ?? 1;

  const addLog = (content: string, auto = true, atStatus?: Status, role?: string) => {
    const entry: LogEntry = {
      id: String(Date.now()),
      timestamp: nowTs(),
      role: role ?? (auto ? 'System' : 'Customer Service'),
      employee: auto ? 'System' : capabilitiesFor(role === 'Procurement' ? 'Procurement' : 'Customer Service').displayName,
      orderStatus: atStatus ?? status,
      submittedStatus: event.status,
      content,
      auto,
    };
    setLogs(prev => [...prev, entry]);
    pushOrderLog(order.id, entry);
  };

  const thread = useInfoRequestThread(event, 'Customer Service', { onActivity: (s) => addLog(s, false) });

  // Status actions
  const handleApprove = () => setApproveOpen(true);

  const handleConfirmApprove = () => {
    setApproved(true);
    patchOrder(order.id, { approved: true });
    if (approveAssign && approveProcurementEmail) {
      setAssignedToProcurement(true);
      patchOrder(order.id, { assignedToProcurement: true });
      addLog(`Order approved. Assigned to Procurement. Notified: ${approveProcurementEmail}`, false);
    } else {
      addLog('Order approved.', false);
    }
    setApproveSuccess(true);
  };

  const handleDecline = () => {
    if (!declineReason.trim()) return;
    setStatus('Closed');
    patchOrder(order.id, { status: 'Closed', declined: true, approved: false });
    addLog(`Order declined and closed. Reason: ${declineReason}`, true, 'Closed');
    setDeclineSuccess(true);
  };

  const handleReopen = () => {
    if (!reopenReason.trim()) return;
    setStatus('Open');
    setApproved(false);
    setAssignedToProcurement(false);
    setReplacementOrderNo('');
    patchOrder(order.id, { status: 'Open', approved: false, declined: false, assignedToProcurement: false, replacementOrderNo: '' });
    addLog(`Order reopened. Reason: ${reopenReason}`, false, 'Open');
    setReopenSuccess(true);
  };

  const handleAssignProcurement = () => {
    if (!procurementEmail) return;
    setAssignedToProcurement(true);
    patchOrder(order.id, { assignedToProcurement: true });
    addLog(`Assigned to Procurement. Notified: ${procurementEmail}`, false);
    setProcurementSuccess(true);
  };


  const handleClose = () => {
    if (!closeReplacementOrderNo.trim()) return;
    setStatus('Closed');
    setReplacementOrderNo(closeReplacementOrderNo.trim());
    patchOrder(order.id, {
      status: 'Closed',
      replacementOrderNo: closeReplacementOrderNo.trim(),
    });
    addLog(`Order closed. Replacement Order #: ${closeReplacementOrderNo.trim()}`, false, 'Closed');
    setCloseSuccess(true);
  };


  const openShipToEdit = () => {
    setShipToDraft(event.shipTo === 'address' ? 'address' : 'branch');
    setShipToStreetDraft(event.shipToAddress?.street ?? '');
    setShipToCityDraft(event.shipToAddress?.cityStateZip ?? '');
    setShipToEditOpen(true);
  };

  // Ship-to lives on the event (single source of truth), so a correction here
  // updates every surface. Logged on both sides; the tech is not re-notified
  // for a destination correction.
  const handleSaveShipTo = () => {
    if (shipToDraft === 'address' && (!shipToStreetDraft.trim() || !shipToCityDraft.trim())) return;
    const summary = shipToDraft === 'address'
      ? `${shipToStreetDraft.trim()}, ${shipToCityDraft.trim()}`
      : `${event.branch} branch`;
    patchEvent(event.id, {
      shipTo: shipToDraft,
      ...(shipToDraft === 'address'
        ? { shipToAddress: { street: shipToStreetDraft.trim(), cityStateZip: shipToCityDraft.trim() } }
        : {}),
    });
    addLog(`Ship-to updated: ${summary}`, false, undefined, assignedToProcurement ? 'Procurement' : undefined);
    pushActivityLog(event.id, {
      id: `shipto_${Date.now()}`,
      eventId: event.id,
      date: nowStampUs(),
      role: 'System',
      employee: 'System',
      status: event.status,
      comment: `Ship-to updated from order ${order.id}: ${summary}.`,
    });
    setShipToEditOpen(false);
  };

  // ── Same-SO siblings ──────────────────────────────────────────────────────
  // Several events on one install (one SO) each auto-create an order. The
  // sibling list keeps CS aware of related open demand on the same job.
  const sameSoOpenSiblings = useMemo(() =>
    [...allOrders, ...Object.values(createdOrders)]
      .filter(o => o.id !== order.id && o.jobNo === order.jobNo)
      .filter(o => (orderMutations[o.id]?.status ?? o.orderStatus) === 'Open'),
    [createdOrders, orderMutations, order.id, order.jobNo]);

  const handleReturnToCS = () => {
    if (!returnComment.trim()) return;
    setAssignedToProcurement(false);
    patchOrder(order.id, { assignedToProcurement: false });
    addLog(`Returned to Customer Service. Reason: ${returnComment.trim()}`, false, undefined, 'Procurement');
    setReturnSuccess(true);
  };

  const handleSaveReplacement = () => {
    const val = replacementDraft.trim();
    if (!val) return;
    setReplacementOrderNo(val);
    patchOrder(order.id, { replacementOrderNo: val });
    addLog(`Replacement Order #: ${val}`, false, undefined, assignedToProcurement ? 'Procurement' : undefined);
    setEditingReplacement(false);
  };

  // Part actions
  const openAddPart = () => {
    setEditingSeqNo(null);
    partForm.resetFields();
    partForm.setFieldsValue({
      jobNo:       order.jobNo,
      elLineItem:  isSO ? (event.elLine ?? undefined) : undefined,
      quantity:    1,
    });
    setPartModalOpen(true);
  };

  const openEditPart = (part: OrderPart) => {
    setEditingSeqNo(part.seqNo);
    partForm.setFieldsValue({
      jobNo:           part.jobNo ?? order.jobNo,
      elLineItem:      part.elLineItem ?? (isSO ? (event.elLine ?? undefined) : undefined),
      dfoLineItem:     part.dfoLineItem,
      door:            part.door,
      partNumber:      part.partNumber,
      partDescription: part.partDescription,
      quantityType:    part.quantityType,
      quantity:        part.quantity,
      hardwareKitInfo: part.hardwareKitInfo ?? '',
      serialNumber:    part.serialNumber ?? '',
    });
    setPartModalOpen(true);
  };

  const handleSavePart = () => {
    partForm.validateFields().then(values => {
      const showSerial = isMissingHardware && watchedKitInfo === 'Entire Hardware Kit';
      if (editingSeqNo === null) {
        const newSeqNo = Math.max(...parts.map(p => p.seqNo), 0) + 1;
        const newPart: OrderPart = {
          seqNo:           newSeqNo,
          jobNo:           values.jobNo || undefined,
          configId:        `${values.jobNo || order.jobNo}.${newSeqNo}`,
          elLineItem:      isSO ? (Number(values.elLineItem) || undefined) : undefined,
          dfoLineItem:     Number(values.dfoLineItem),
          door:            values.door,
          partNumber:      values.partNumber,
          partDescription: values.partDescription,
          quantityType:    values.quantityType,
          quantity:        Number(values.quantity),
          hardwareKitInfo: isMissingHardware ? (values.hardwareKitInfo || undefined) : undefined,
          serialNumber:    showSerial ? (values.serialNumber || undefined) : undefined,
        };
        setParts(prev => [...prev, newPart]);
        addLog(`Part added: ${values.partNumber} — ${values.partDescription} (×${values.quantity} ${values.quantityType})`);
      } else {
        setParts(prev => prev.map(p => p.seqNo === editingSeqNo ? {
          ...p,
          jobNo:           values.jobNo || undefined,
          elLineItem:      isSO ? (Number(values.elLineItem) || undefined) : undefined,
          dfoLineItem:     Number(values.dfoLineItem),
          door:            values.door,
          partNumber:      values.partNumber,
          partDescription: values.partDescription,
          quantityType:    values.quantityType,
          quantity:        Number(values.quantity),
          hardwareKitInfo: isMissingHardware ? (values.hardwareKitInfo || undefined) : undefined,
          serialNumber:    showSerial ? (values.serialNumber || undefined) : undefined,
        } : p));
        addLog(`Part ${values.partNumber} updated.`);
      }
      setPartModalOpen(false);
    });
  };

  const canEdit = canActOnOrder && status !== 'Closed';

  const logColumns: ColumnsType<LogEntry> = [
    { title: 'Date & Time',      dataIndex: 'timestamp',      key: 'timestamp',      width: 148, render: (t: string) => <Text style={{ fontSize: token.fontSizeSM }}>{t}</Text> },
    { title: 'Role',             dataIndex: 'role',           key: 'role',           width: 136, render: (r: string, entry: LogEntry) => <Text style={{ fontSize: token.fontSizeSM, color: entry.auto ? token.colorTextTertiary : token.colorText }}>{r}</Text> },
    { title: 'Employee',         dataIndex: 'employee',       key: 'employee',       width: 160, render: (e: string, entry: LogEntry) => <Text style={{ fontSize: token.fontSizeSM, color: entry.auto ? token.colorTextTertiary : token.colorText }}>{e}</Text> },
    { title: 'Order Status',     dataIndex: 'orderStatus',    key: 'orderStatus',    width: 104, render: (s: Status) => <Tag style={{ fontSize: token.fontSizeSM, margin: 0 }}>{s}</Tag> },
    { title: 'Submitted Status', dataIndex: 'submittedStatus', key: 'submittedStatus', width: 140, render: (s: string) => <Text style={{ fontSize: token.fontSizeSM }}>{s}</Text> },
    { title: 'Comment',          dataIndex: 'content',        key: 'content',                    render: (c: string) => <Text style={{ fontSize: token.fontSizeSM }}>{c}</Text> },
  ];

  // Helpers
  const sectionLabel = (text: string) => (
    <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600, color: token.colorText }}>
      {text}
    </Text>
  );

  const displayField = (label: string, value?: string | number | null, copyable?: boolean) => {
    const display = value != null && String(value).trim() ? value : null;
    return (
      <div>
        <Text style={{
          display: 'block', fontSize: token.fontSizeXS, fontWeight: 600, letterSpacing: '0.5px',
          textTransform: 'uppercase', marginBottom: 2, color: token.colorTextTertiary,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </Text>
        {copyable && display != null
          ? <CopyableValue value={String(display)} />
          : <Text style={{ fontSize: token.fontSizeSM, color: display != null ? token.colorText : token.colorTextQuaternary }}>
              {display != null ? display : '—'}
            </Text>
        }
      </div>
    );
  };

  // Three-beat decision journey (Rob, 2026-08-04), mirroring the event
  // stepper's anatomy: two fixed stages plus a resolution step with two
  // outcomes. A declined order skips Approved, exactly as an invalidated
  // event can skip Under Investigation. Vocabulary matches the KPI lanes
  // and Decision Trend: Pending Decision / Approved / Fulfilled / Declined.
  const decisionStage = declined
    ? 'Declined'
    : approved
      ? (status === 'Closed' ? 'Fulfilled' : 'Approved')
      : 'Pending Decision';
  const stepIdx = decisionStage === 'Pending Decision' ? 0 : decisionStage === 'Approved' ? 1 : 2;
  const stages = [
    {
      label: 'Pending Decision',
      color: '#1677ff',
      reached: true,
      isCurrent: stepIdx === 0,
    },
    {
      label: 'Approved',
      color: '#95de64',
      // Declined orders never passed Approved: the step renders unreached.
      reached: stepIdx >= 1 && !declined,
      isCurrent: stepIdx === 1,
    },
    {
      label: decisionStage === 'Fulfilled' ? 'Fulfilled' : decisionStage === 'Declined' ? 'Declined' : 'Pending Closure',
      color: decisionStage === 'Declined' ? '#cf1322' : '#389e0d',
      reached: stepIdx === 2,
      isCurrent: stepIdx === 2,
    },
  ];

  const actionButtons = !canActOnOrder ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: token.colorTextTertiary }}>
      <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>View only</Text>
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {status === 'Open' && !approved && canDecide && (
        <>
          <Button icon={<CloseOutlined />} onClick={() => setDeclineOpen(true)}>
            Decline
          </Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove}>
            Approve
          </Button>
        </>
      )}
      {status === 'Open' && approved && canClose && (
        <>
          {!assignedToProcurement && (
            <Button icon={<SendOutlined />} onClick={() => setProcurementOpen(true)}>
              Assign to Procurement
            </Button>
          )}
          {assignedToProcurement && (
            <Button icon={<RollbackOutlined />} onClick={() => setReturnOpen(true)}>
              Return to Customer Service
            </Button>
          )}
          <Button type="primary" icon={<CheckOutlined />} onClick={() => { setCloseReplacementOrderNo(replacementOrderNo); setCloseOpen(true); }}>
            Close Order
          </Button>
        </>
      )}
      {status === 'Closed' && canDecide && (
        <Button icon={<RollbackOutlined />} onClick={() => setReopenOpen(true)}>
          Reopen
        </Button>
      )}
    </div>
  );

  const mobileActionItems = !canActOnOrder ? [] : [
    ...(status === 'Open' && !approved && canDecide ? [
      { key: 'approve',  icon: <CheckOutlined />,  label: 'Approve',  onClick: handleApprove },
      { key: 'decline',  icon: <CloseOutlined />,  label: 'Decline',  onClick: () => setDeclineOpen(true) },
    ] : []),
    ...(status === 'Open' && approved && !assignedToProcurement && canClose ? [
      { key: 'procurement', icon: <SendOutlined />, label: 'Assign to Procurement', onClick: () => setProcurementOpen(true) },
    ] : []),
    ...(status === 'Open' && approved && assignedToProcurement && canClose ? [
      { key: 'return', icon: <RollbackOutlined />, label: 'Return to Customer Service', onClick: () => setReturnOpen(true) },
    ] : []),
    ...(status === 'Open' && approved && canClose ? [
      { key: 'close', icon: <CheckOutlined />, label: 'Close Order', onClick: () => { setCloseReplacementOrderNo(replacementOrderNo); setCloseOpen(true); } },
    ] : []),
    ...(status === 'Closed' && canDecide ? [
      { key: 'reopen', icon: <RollbackOutlined />, label: 'Reopen', onClick: () => setReopenOpen(true) },
    ] : []),
  ];

  const labelScanContent = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
      <div style={{
        flex: 1,
        background: token.colorFillTertiary,
        border: `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 6, minHeight: 160, cursor: 'pointer',
      }} onClick={() => setExpandedScan(0)}>
        <BarcodeOutlined style={{ fontSize: token.fontSizeHeading2, color: token.colorTextQuaternary }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No label scans attached</Text>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Click to expand</Text>
      </div>
      <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.5 }}>
        Label scans are auto-captured when a tech submits the event. Verify part numbers and Config IDs against the label before approving.
      </Text>
    </div>
  );

  const eventDetailsContent = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 16 }}>

      {/* The defect facts live with the defect prose and photos; the job and
          logistics facts (branch, plant, tech) live in the left strip. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Issue',     value: event.issue },
          { label: 'Component', value: event.component },
          { label: 'Door',      value: event.door },
        ].map(({ label, value }) => (
          <div key={label}>
            <Text style={{ fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 2 }}>
              {label}
            </Text>
            <Text style={{ fontSize: token.fontSizeSM }}>{value}</Text>
          </div>
        ))}
      </div>

      <div style={{
        padding: '8px 12px',
        background: token.colorFillTertiary,
        borderRadius: token.borderRadiusSM,
      }}>
        <Text style={{ fontSize: token.fontSizeSM, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
          Issue Description
        </Text>
        <Text style={{ fontSize: token.fontSizeSM, lineHeight: 1.6 }}>{event.issueDescription}</Text>
      </div>

      <Divider style={{ margin: 0 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Text style={{ fontSize: token.fontSizeSM, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
          Photos
        </Text>
        <div style={{
          flex: 1,
          minHeight: 140,
          background: token.colorFillTertiary,
          border: `1px dashed ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusSM,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 6, cursor: 'pointer', marginBottom: 8,
        }} onClick={() => setExpandedPhoto(0)}>
          <PictureFilled style={{ fontSize: token.fontSizeHeading3, color: token.colorTextQuaternary }} />
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No photos attached</Text>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Click to expand</Text>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} onClick={() => setExpandedPhoto(i)} style={{
              flex: 1, aspectRatio: '1',
              background: token.colorFillTertiary,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusSM,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <PictureFilled style={{ fontSize: token.fontSize, color: token.colorTextQuaternary }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );

  const messagesContent = (
    <InfoRequestThreadPanel {...thread} reportedBy={event.reportedBy} canSend={canEdit} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, color: token.colorTextTertiary, textDecoration: 'none' }}>
              <ArrowLeftOutlined style={{ fontSize: token.fontSize }} />
              {!isMobile && <span style={{ fontSize: token.fontSize }}>Orders</span>}
            </Link>
            <span style={{ color: token.colorBorderSecondary, fontSize: token.fontSizeLG, lineHeight: 1 }}>|</span>
            <span style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>{order.eventId}</span>
            <Tag style={{ margin: 0 }}>{status}</Tag>
            {!isMobile && approved && status === 'Open' && (
              // Gold/Teal laws leave substates chromatic-with-text; the pastel
              // green preset failed AA in light (3.37:1), so light mode uses
              // the solid Validated-green fill (white text, 5.59:1).
              <Tag color={isDark ? 'green' : undefined} style={{ margin: 0, ...(isDark ? {} : { background: '#237804', color: '#FFFFFF', borderColor: 'transparent' }) }}>Approved</Tag>
            )}
            {!isMobile && assignedToProcurement && (
              <Tag color="purple" style={{ margin: 0 }}>Assigned to Procurement</Tag>
            )}
            {!isMobile && replacementOrderNo && (
              <Tag color="cyan" style={{ margin: 0 }}>Replacement: {replacementOrderNo}</Tag>
            )}
            {/* Cross-link lives in the header beside the status chip so it is
                consistently findable on both detail pages (Rob, 2026-08-04).
                Roles without Events access (Procurement) get event context
                from the Event Details tab instead. */}
            {!isMobile && caps.events && (
              <Link href={`/events/${event.id}`} style={{ fontSize: token.fontSizeSM, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                View Event <ArrowRightOutlined style={{ fontSize: token.fontSizeXS }} />
              </Link>
            )}
          </div>
        }
        right={
          isMobile ? (
            canActOnOrder ? (
              <Dropdown menu={{ items: mobileActionItems }} trigger={['click']}>
                <Button icon={<MoreOutlined />} />
              </Dropdown>
            ) : actionButtons
          ) : actionButtons
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: isMobile ? '0 12px 16px' : '0 20px 16px', minHeight: 0 }}>

        {/* Status strip + same-SO sibling awareness */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0 12px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 320px', maxWidth: 480 }}>
          {stages.map((stage, i) => (
            <Fragment key={stage.label}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: stage.reached ? stage.color : token.colorFillSecondary,
                  border: `2px solid ${stage.reached ? stage.color : token.colorBorderSecondary}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: stage.isCurrent
                    ? `0 0 0 3px ${token.colorBgContainer}, 0 0 0 5px ${stage.color}60, 0 0 14px ${stage.color}50`
                    : stage.reached ? `0 0 8px ${stage.color}40` : 'none',
                  transition: 'all 0.3s',
                }}>
                  {stage.isCurrent && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                  )}
                  {stage.reached && !stage.isCurrent && (
                    <CheckOutlined style={{ fontSize: token.fontSizeXS, color: '#fff' }} />
                  )}
                </div>
                <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600, whiteSpace: 'nowrap', color: stage.reached ? stage.color : token.colorTextQuaternary }}>
                  {stage.label}
                </Text>
              </div>
              {i < stages.length - 1 && (
                <div style={{ flex: 1, paddingBottom: 18, margin: '0 8px' }}>
                  <div style={{
                    height: 2,
                    background: stages[i].reached && stages[i + 1].reached
                      ? `linear-gradient(to right, ${stages[i].color}, ${stages[i + 1].color})`
                      : token.colorBorderSecondary,
                    borderRadius: 1,
                    transition: 'background 0.4s',
                  }} />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* Order context, top right: where it ships (the CTA lives here so it
            reads on first scan), plus the quiet same-SO sibling fact. Sibling
            open orders may or may not be one larger issue; the list is a
            click away. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {sameSoOpenSiblings.length > 0 && (
            <Popover
              trigger="click"
              placement="bottomRight"
              content={
                <div style={{ maxWidth: 320 }}>
                  {sameSoOpenSiblings.map(o => {
                    const ev = effEventMap.get(o.eventId);
                    return (
                      <div key={o.id} style={{ padding: '4px 0', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <Link href={`/orders/${o.id}`} style={{ fontSize: token.fontSizeSM, fontWeight: 600, whiteSpace: 'nowrap' }}>{o.id}</Link>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
                          {ev?.issue ?? '—'} · {o.parts.length} part{o.parts.length === 1 ? '' : 's'}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              }
            >
              <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', whiteSpace: 'nowrap' }}>
                {sameSoOpenSiblings.length} more open order{sameSoOpenSiblings.length === 1 ? '' : 's'} on this SO
              </Text>
            </Popover>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 12px',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadiusSM,
            background: token.colorBgContainer,
          }}>
            <ShipToLine shipTo={event.shipTo} address={event.shipToAddress} branch={event.branch} />
            {canActOnOrder && (
              <Button size="small" onClick={openShipToEdit}>Change</Button>
            )}
          </div>
        </div>
        </div>

        {/* Main content row: tabbed card + scan card */}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>

          <Card
            size="small"
            style={{ flex: isMobile ? 1 : 3, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { flex: 1, overflow: 'auto', padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
            tabList={[
              { key: 'details', label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{isMobile ? 'Details' : 'Order Details'}</span> },
              { key: 'log',     label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{isMobile ? 'Log' : 'Activity Log'}</span> },
              ...(isMobile ? [{ key: 'scans', label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Scans</span> }] : []),
            ]}
            activeTabKey={activeTab}
            onTabChange={key => setActiveTab(key as 'details' | 'log' | 'scans')}
            tabBarExtraContent={
              activeTab === 'details' && canEdit ? (
                <Button type="text" size="small" icon={<PlusOutlined />} onClick={openAddPart}>
                  {!isMobile && 'Add Part'}
                </Button>
              ) : null
            }
          >

            {/* DETAILS TAB */}
            {activeTab === 'details' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

                {/* Metadata strip */}
                <div style={{
                  display: 'flex', gap: 24, marginBottom: 14,
                  padding: '8px 12px',
                  background: token.colorFillTertiary,
                  borderRadius: token.borderRadiusSM,
                  flexWrap: 'wrap',
                }}>
                  {/* Job No · EL LIN | DFO LIN */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <div>
                      <Text style={{ display: 'block', fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, marginBottom: 2 }}>Job No</Text>
                      <JobNoValue jobNo={order.jobNo} manualEntry={event.jobNoManualEntry} />
                    </div>
                    {!order.jobNo.startsWith('WO') && event.elLine != null && (
                      <>
                        <Text style={{ color: token.colorTextTertiary, paddingBottom: 3 }}>·</Text>
                        <div>
                          <Text style={{ display: 'block', fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, marginBottom: 2 }}>EL LIN</Text>
                          <CopyableValue value={String(event.elLine)} />
                        </div>
                      </>
                    )}
                    {!order.jobNo.startsWith('WO') && (
                      <>
                        <Text style={{ color: token.colorTextTertiary, paddingBottom: 3 }}>|</Text>
                        <div>
                          <Text style={{ display: 'block', fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, marginBottom: 2 }}>DFO LIN</Text>
                          <CopyableValue value={String(event.dfo)} />
                        </div>
                      </>
                    )}
                  </div>
                  {!isMobile && <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch' }} />}
                  {([
                    { label: 'Branch',       node: <Text style={{ fontSize: token.fontSizeSM }}>{event.branch}</Text> },
                    { label: 'Plant',        node: <Text style={{ fontSize: token.fontSizeSM }}>{event.plant.split(' ')[0]}</Text> },
                    { label: 'Reported By',  node: <Text style={{ fontSize: token.fontSizeSM }}>{event.reportedBy}</Text> },
                    { label: 'Last Updated', node: <Text style={{ fontSize: token.fontSizeSM }}>{order.lastUpdated}</Text> },
                    ...(approved ? [{
                      label: 'Replacement Order #',
                      node: status === 'Open' && editingReplacement ? (
                        <Input
                          size="small"
                          placeholder="e.g. SO110029876"
                          value={replacementDraft}
                          onChange={e => setReplacementDraft(e.target.value)}
                          onPressEnter={handleSaveReplacement}
                          onKeyDown={e => { if (e.key === 'Escape') setEditingReplacement(false); }}
                          onBlur={() => { if (replacementDraft.trim()) handleSaveReplacement(); else setEditingReplacement(false); }}
                          autoFocus
                          style={{ width: 140 }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Text style={{ fontSize: token.fontSizeSM, color: replacementOrderNo ? token.colorText : token.colorTextQuaternary }}>
                            {replacementOrderNo || (status === 'Open' ? 'Not yet entered' : '—')}
                          </Text>
                          {status === 'Open' && (
                            <Button
                              type="text"
                              size="small"
                              icon={<EditFilled />}
                              onClick={() => { setReplacementDraft(replacementOrderNo); setEditingReplacement(true); }}
                              style={{ color: token.colorTextTertiary }}
                            />
                          )}
                        </div>
                      ),
                    }] : []),
                  ] as { label: string; node: React.ReactNode }[]).map(({ label, node }, i, arr) => (
                    <Fragment key={label}>
                      <div>
                        <Text style={{ display: 'block', fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, marginBottom: 2 }}>
                          {label}
                        </Text>
                        {node}
                      </div>
                      {!isMobile && i < arr.length - 1 && (
                        <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch' }} />
                      )}
                    </Fragment>
                  ))}
                </div>

                {/* Parts + Label Scans */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, flex: 1, minHeight: isMobile ? undefined : 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>

                {/* Parts header */}
                <div style={{ marginBottom: 10 }}>
                  {sectionLabel('Parts')}
                </div>

                {/* Parts list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {parts.map(part => isMobile ? (
                    <div key={part.seqNo} style={{
                      padding: '14px 16px',
                      background: token.colorFillQuaternary,
                      borderRadius: token.borderRadiusSM,
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {displayField('Part #', part.partNumber, true)}
                        {canEdit && (
                          <Button type="text" size="small" icon={<EditFilled />}
                            onClick={() => openEditPart(part)}
                            style={{ color: token.colorTextTertiary }}
                          />
                        )}
                      </div>
                      {displayField('Part Description', part.partDescription)}
                      <div style={{ display: 'flex', gap: 16 }}>
                        {displayField('Job No.', part.jobNo ?? order.jobNo, true)}
                        {isSO && displayField('EL LIN', part.elLineItem ?? event.elLine, true)}
                        {isSO && displayField('DFO LIN', part.dfoLineItem, true)}
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        {displayField('Door Type', part.door)}
                        {displayField('Quantity', part.quantityType === 'Length' ? `${part.quantity} in.` : `${part.quantity} ${part.quantityType}`)}
                      </div>
                      {(part.hardwareKitInfo || part.serialNumber) && (
                        <div style={{ display: 'flex', gap: 16 }}>
                          {part.hardwareKitInfo && displayField('Hardware Kit', part.hardwareKitInfo)}
                          {part.serialNumber && displayField('Serial #', part.serialNumber, true)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div key={part.seqNo} style={{
                      padding: '14px 16px',
                      background: token.colorFillQuaternary,
                      borderRadius: token.borderRadiusSM,
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: 0,
                    }}>
                      {/* Section 1: Part identity */}
                      <div style={{ flex: 3, paddingRight: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12 }}>
                        {displayField('Part #', part.partNumber, true)}
                        {displayField('Part Description', part.partDescription)}
                      </div>
                      <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch' }} />
                      {/* Section 2: Location */}
                      <div style={{ flex: 2, padding: '0 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12 }}>
                        {displayField('Door Type', part.door)}
                        <div style={{ display: 'flex', gap: 12 }}>
                          {displayField('Job No.', part.jobNo ?? order.jobNo, true)}
                          {isSO && displayField('EL LIN', part.elLineItem ?? event.elLine, true)}
                          {isSO && displayField('DFO LIN', part.dfoLineItem, true)}
                        </div>
                      </div>
                      <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch' }} />
                      {/* Section 3: Fulfillment */}
                      <div style={{ flex: 2.5, paddingLeft: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 20 }}>
                          {displayField('Quantity Type', part.quantityType)}
                          {displayField('Quantity', part.quantityType === 'Length' ? `${part.quantity} in.` : String(part.quantity))}
                        </div>
                        {(part.hardwareKitInfo || part.serialNumber) && (
                          <div style={{ display: 'flex', gap: 20 }}>
                            {part.hardwareKitInfo && displayField('Hardware Kit Information', part.hardwareKitInfo)}
                            {part.serialNumber && displayField('Serial #', part.serialNumber, true)}
                          </div>
                        )}
                      </div>
                      {/* Edit button */}
                      {canEdit && (
                        <div style={{ paddingLeft: 10, display: 'flex', alignItems: 'flex-start' }}>
                          <Button type="text" size="small" icon={<EditFilled />}
                            onClick={() => openEditPart(part)}
                            style={{ color: token.colorTextTertiary }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {parts.length === 0 && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 8, padding: '20px 12px',
                      background: token.colorFillQuaternary, borderRadius: token.borderRadius,
                      textAlign: 'center', minHeight: 88,
                    }}>
                      <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>No parts on this order.</Text>
                      {canEdit && (
                        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={openAddPart}>
                          Add Part
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                </div>
                <div style={{ width: isMobile ? '100%' : 360, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: isMobile ? 220 : 0 }}>
                  {labelScanContent}
                </div>
                </div>
              </div>
            )}

            {/* LOG TAB */}
            {activeTab === 'log' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {isMobile ? (
                  <div>
                    {logs.length === 0 && (
                      <Text type="secondary" style={{ display: 'block', padding: '16px 0', textAlign: 'center', fontSize: token.fontSizeSM }}>
                        No activity logged for this order yet.
                      </Text>
                    )}
                    {[...logs].reverse().map((entry: LogEntry) => (
                      <div key={entry.id} style={{ padding: '10px 0', borderBlockEnd: `1px solid ${token.colorBorderSecondary}` }}>
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: token.fontSizeSM, fontWeight: 500, color: entry.auto ? token.colorTextTertiary : token.colorText }}>
                              {entry.employee}
                            </Text>
                            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>·</Text>
                            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>{entry.role}</Text>
                            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>·</Text>
                            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>{entry.timestamp}</Text>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Tag style={{ fontSize: token.fontSizeXS, margin: 0 }}>{entry.orderStatus}</Tag>
                            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>{entry.submittedStatus}</Text>
                          </div>
                          <Text style={{ fontSize: token.fontSizeSM, color: entry.auto ? token.colorTextTertiary : token.colorText }}>
                            {entry.content}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table
                    dataSource={[...logs].reverse()}
                    columns={logColumns}
                    rowKey="id"
                    size="small"
                    locale={{ emptyText: 'No activity logged for this order yet.' }}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '25', '50'],
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                    }}
                  />
                )}
              </div>
            )}

            {/* SCANS TAB — mobile only */}
            {activeTab === 'scans' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                <Segmented
                  block
                  size="small"
                  value={scanTab}
                  onChange={v => setScanTab(v as 'eventDetails' | 'messages')}
                  options={[
                    { label: 'Messages', value: 'messages' },
                    { label: 'Event Details', value: 'eventDetails' },
                  ]}
                />
                {scanTab === 'eventDetails' ? eventDetailsContent : messagesContent}
              </div>
            )}

          </Card>

          {/* Scan card — desktop only */}
          {!isMobile && <Card
            size="small"
            tabList={[
              { key: 'messages',     label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Messages</span> },
              { key: 'eventDetails', label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Event Details</span> },
            ]}
            activeTabKey={scanTab}
            onTabChange={key => setScanTab(key as 'eventDetails' | 'messages')}
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', minHeight: 0 } }}
          >
            {scanTab === 'eventDetails' ? eventDetailsContent : messagesContent}
          </Card>}

        </div>
      </div>

      {/* APPROVE MODAL */}
      <Modal
        title={approveSuccess ? null : 'Approve Order'}
        open={approveOpen}
        onCancel={() => { setApproveOpen(false); setApproveAssign(false); setApproveProcurementEmail(''); setApproveSuccess(false); }}
        onOk={handleConfirmApprove}
        okText={approveAssign && approveProcurementEmail ? 'Approve & Notify Procurement' : 'Approve'}
        okButtonProps={{ type: 'primary' }}
        footer={approveSuccess ? null : undefined}
        width={480}
      >
        {approveSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Approved</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {order.eventId} has been approved.{' '}
              {approveAssign && approveProcurementEmail
                ? `Email notifications sent to ${event.branch} branch and ${approveProcurementEmail}.`
                : `Email notification sent to ${event.branch} branch.`}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setApproveOpen(false); setApproveAssign(false); setApproveProcurementEmail(''); setApproveSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <TechReplyWarning thread={event.additionalInfoRequests} style={{ marginBottom: 12 }} />
            <Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This marks the order as approved. You can assign it to procurement now or as a separate step after.
            </Text>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px',
              background: token.colorFillTertiary,
              borderRadius: token.borderRadiusSM,
              marginBottom: approveAssign ? 12 : 0,
            }}>
              <Text style={{ fontSize: token.fontSize }}>Assign to Procurement</Text>
              <Switch
                checked={approveAssign}
                onChange={v => { setApproveAssign(v); if (!v) setApproveProcurementEmail(''); }}
              />
            </div>
            {approveAssign && (
              <Form layout="vertical" size="small" style={{ marginTop: 12 }}>
                <Form.Item label="Notify" style={{ marginBottom: 0 }}>
                  <Select
                    placeholder="Select procurement contact..."
                    value={approveProcurementEmail || undefined}
                    onChange={v => setApproveProcurementEmail(v)}
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
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Declined</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {order.eventId} has been declined and closed. Email notification sent to {event.branch} branch.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setDeclineOpen(false); setDeclineReason(''); setDeclineSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This will close the order. Please provide a reason for the record.
            </Text>
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
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Reopened</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {order.eventId} has been returned to Open status and is ready for review.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setReopenOpen(false); setReopenReason(''); setReopenSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This will reopen the order to Open status. Please provide a reason.
            </Text>
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

      {/* ASSIGN TO PROCUREMENT MODAL */}
      <Modal
        title={procurementSuccess ? null : 'Assign to Procurement'}
        open={procurementOpen}
        onCancel={() => { setProcurementOpen(false); setProcurementEmail(''); setProcurementSuccess(false); }}
        onOk={handleAssignProcurement}
        okText="Assign & Notify"
        okButtonProps={{ type: 'primary', disabled: !procurementEmail }}
        footer={procurementSuccess ? null : undefined}
        width={480}
      >
        {procurementSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Assigned to Procurement</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {order.eventId} has been assigned to procurement. Email notifications sent to {event.branch} branch and {procurementEmail}.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setProcurementOpen(false); setProcurementEmail(''); setProcurementSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              Notify a procurement contact for this order.
            </Text>
            <Form layout="vertical" size="small">
              <Form.Item label="Notify" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="Select procurement contact..."
                  value={procurementEmail || undefined}
                  onChange={v => setProcurementEmail(v)}
                  options={PROCUREMENT_CONTACTS}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* CLOSE ORDER MODAL */}
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
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Closed</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {order.eventId} has been closed.
              {' '}It can be reopened if needed.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setCloseOpen(false); setCloseSuccess(false); setCloseReplacementOrderNo(''); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This will mark the order as Closed. It can be reopened if needed.
            </Text>
            <Form layout="vertical" size="small">
              <Form.Item label="Replacement Order #" required style={{ marginBottom: 10 }}>
                <Input
                  placeholder="e.g. SO110029876"
                  value={closeReplacementOrderNo}
                  onChange={e => setCloseReplacementOrderNo(e.target.value)}
                  autoFocus
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* SHIP-TO EDIT MODAL */}
      <Modal
        title="Edit Ship To"
        open={shipToEditOpen}
        onCancel={() => setShipToEditOpen(false)}
        width={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShipToEditOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              disabled={shipToDraft === 'address' && (!shipToStreetDraft.trim() || !shipToCityDraft.trim())}
              onClick={handleSaveShipTo}
            >
              Save
            </Button>
          </div>
        }
      >
        <Form layout="vertical" size="small" style={{ marginTop: 8 }}>
          <Form.Item label="Ship To" style={{ marginBottom: 10 }}>
            <Radio.Group
              buttonStyle="solid"
              size="small"
              value={shipToDraft}
              onChange={e => setShipToDraft(e.target.value)}
            >
              <Radio.Button value="branch">Branch ({event.branch})</Radio.Button>
              <Radio.Button value="address">Direct Address</Radio.Button>
            </Radio.Group>
          </Form.Item>
          {shipToDraft === 'address' && (
            <>
              <Form.Item label="Street Address" required style={{ marginBottom: 10 }}>
                <Input
                  placeholder="e.g. 4821 Commerce Park Dr"
                  value={shipToStreetDraft}
                  onChange={e => setShipToStreetDraft(e.target.value)}
                  autoFocus
                />
              </Form.Item>
              <Form.Item label="City, State ZIP" required style={{ marginBottom: 0 }}>
                <Input
                  placeholder="e.g. Marietta, GA 30060"
                  value={shipToCityDraft}
                  onChange={e => setShipToCityDraft(e.target.value)}
                  onPressEnter={handleSaveShipTo}
                />
              </Form.Item>
            </>
          )}
        </Form>
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
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Returned to Customer Service</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {order.eventId} has been returned to the Customer Service queue.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setReturnOpen(false); setReturnComment(''); setReturnSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This order cannot be fulfilled by Procurement (e.g. discontinued parts). Please provide a comment explaining why it&apos;s being returned.
            </Text>
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

      {/* LABEL SCAN EXPAND MODAL */}
      <Modal
        open={expandedScan !== null}
        onCancel={() => setExpandedScan(null)}
        footer={null}
        width={560}
        title="Label Scan"
        centered
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '78vh', gap: 12,
          background: token.colorFillTertiary,
          borderRadius: token.borderRadiusSM,
        }}>
          <BarcodeOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No scan attached</Text>
        </div>
      </Modal>

      {/* PHOTO EXPAND MODAL */}
      <Modal
        open={expandedPhoto !== null}
        onCancel={() => setExpandedPhoto(null)}
        footer={null}
        width={560}
        title="Photo"
        centered
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '78vh', gap: 12,
          background: token.colorFillTertiary,
          borderRadius: token.borderRadiusSM,
        }}>
          <PictureFilled style={{ fontSize: 48, color: token.colorTextQuaternary }} />
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No photo attached</Text>
        </div>
      </Modal>

      {/* ADD / EDIT PART MODAL */}
      <Modal
        title={editingSeqNo !== null ? 'Edit Part' : 'Add Part'}
        open={partModalOpen}
        onCancel={() => { setPartModalOpen(false); partForm.resetFields(); }}
        onOk={handleSavePart}
        okText={editingSeqNo !== null ? 'Save Changes' : 'Add Part'}
        width={540}
      >
        <Form form={partForm} layout="vertical" size="small" style={{ marginTop: 8 }}>
          {/* Row 1 — Order context */}
          <Row gutter={8}>
            <Col style={{ width: 148 }}>
              <Form.Item label="Job No." name="jobNo" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                <Input />
              </Form.Item>
            </Col>
            {isSO && (
              <Col style={{ width: 76 }}>
                <Form.Item label="EL LIN" name="elLineItem" style={{ marginBottom: 10 }}>
                  <InputNumber min={1} controls={false} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
            {isSO && (
              <Col style={{ width: 80 }}>
                <Form.Item label={<span style={{ whiteSpace: 'nowrap' }}>DFO LIN</span>} name="dfoLineItem" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                  <InputNumber min={1} controls={false} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
          </Row>

          {/* Row 2 — Door Type */}
          <Form.Item label="Door Type" name="door" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
            <Select
              showSearch
              placeholder="Select door type"
              optionFilterProp="label"
              options={DOOR_OPTIONS.map(v => ({ value: v, label: v }))}
            />
          </Form.Item>

          {/* Row 3 — Part # + Part Description */}
          <Row gutter={8}>
            <Col flex={1}>
              <Form.Item label="Part #" name="partNumber" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                <Select
                  showSearch
                  placeholder="Select part number"
                  optionFilterProp="label"
                  options={PART_CATALOG.map(p => ({ value: p.partNumber, label: p.partNumber }))}
                  onChange={(v: string) => {
                    const match = PART_CATALOG.find(p => p.partNumber === v);
                    if (match) partForm.setFieldValue('partDescription', match.partDescription);
                  }}
                />
              </Form.Item>
            </Col>
            <Col flex={1}>
              <Form.Item label="Part Description" name="partDescription" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                <Select
                  showSearch
                  placeholder="Select or auto-filled"
                  optionFilterProp="label"
                  options={PART_CATALOG.map(p => ({ value: p.partDescription, label: p.partDescription }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 4 — Hardware Kit (only for Missing Hardware events) */}
          {isMissingHardware && (
            <Row gutter={8}>
              <Col flex={1}>
                <Form.Item label="Hardware Kit Information" name="hardwareKitInfo" style={{ marginBottom: 10 }}>
                  <Select
                    allowClear
                    placeholder="None"
                    options={['Entire Hardware Kit', 'Components within Hardware Kit'].map(v => ({ value: v, label: v }))}
                  />
                </Form.Item>
              </Col>
              {watchedKitInfo === 'Entire Hardware Kit' && (
                <Col flex={1}>
                  <Form.Item label="Serial #" name="serialNumber" style={{ marginBottom: 10 }}>
                    <Input placeholder="Enter serial number" />
                  </Form.Item>
                </Col>
              )}
            </Row>
          )}

          {/* Row 5 — Quantity Type + Quantity */}
          <Form.Item label="Quantity Type" name="quantityType" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
            <Radio.Group buttonStyle="solid" size="small">
              <Radio.Button value="Piece">Piece</Radio.Button>
              <Radio.Button value="Length">Length</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="Quantity" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Slider
                  min={1}
                  max={100}
                  value={watchedQuantity}
                  onChange={(v) => partForm.setFieldValue('quantity', v)}
                  marks={{ 1: '1', 25: '25', 50: '50', 75: '75', 100: '100' }}
                />
              </div>
              <InputNumber
                min={1}
                max={100}
                value={watchedQuantity}
                onChange={(v) => partForm.setFieldValue('quantity', v ?? 1)}
                style={{ width: 68 }}
              />
            </div>
            <Form.Item name="quantity" noStyle rules={[{ required: true, message: 'Required' }]}>
              <Input type="hidden" />
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
