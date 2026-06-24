'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { useOrderStore } from '@/store/orderStore';
import {
  Button, Card, Col, Divider, Form, Input, Modal,
  Row, Select, Space, Switch, Table, Tag, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined, BarcodeOutlined, CheckCircleFilled, CheckOutlined, CloseCircleFilled, CloseOutlined,
  EditFilled, PlusOutlined, RollbackOutlined, SendOutlined,
} from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import { PageHeader } from '@/components/PageHeader';
import type { Order, OrderPart } from '@/data/orders';
import type { QualityEvent } from '@/data/types';
const { Text } = Typography;

type Status = 'Open' | 'Closed';

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
  { value: 'sarah.chen@allegion.com',     label: 'Sarah Chen — sarah.chen@allegion.com' },
  { value: 'james.kowalski@allegion.com', label: 'James Kowalski — james.kowalski@allegion.com' },
  { value: 'lisa.okafor@allegion.com',    label: 'Lisa Okafor — lisa.okafor@allegion.com' },
  { value: 'derek.pham@allegion.com',     label: 'Derek Pham — derek.pham@allegion.com' },
  { value: 'procurement@allegion.com',    label: 'Procurement Team — procurement@allegion.com' },
];

const nowTs = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

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

const STATUS_COLOR: Record<Status, string> = {
  Open: 'blue', Closed: 'default',
};

type Props = { order: Order; event: QualityEvent };

export function OrderDetailClient({ order, event }: Props) {
  const { token } = theme.useToken();
  const { mutations: orderMutations, patchOrder, pushOrderLog } = useOrderStore();
  const ordStored = orderMutations[order.id] ?? {};

  const [status, setStatus]             = useState<Status>(ordStored.status ?? (order.orderStatus as Status));
  const [approved, setApproved]         = useState(ordStored.approved ?? (order.orderStatus === 'Closed'));
  const [parts, setParts]               = useState<OrderPart[]>([...order.parts]);
  const [activeTab, setActiveTab]       = useState('details');
  const [assignedToProcurement, setAssignedToProcurement] = useState(ordStored.assignedToProcurement ?? false);
  const [replacementOrderNo, setReplacementOrderNo]       = useState(ordStored.replacementOrderNo ?? '');

  // Log
  const seedLogs = SEED_LOGS[order.id] ?? [
    { id: 'l1', timestamp: order.lastUpdated, role: 'System', employee: 'System', orderStatus: order.orderStatus as Status, submittedStatus: event.status, content: `Order created from event ${order.eventId}.`, auto: true },
  ];
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    ...seedLogs,
    ...(ordStored.logAdditions ?? []) as LogEntry[],
  ]);
  const [logDraft, setLogDraft] = useState('');
  const [addingLog, setAddingLog] = useState(false);

  // Modals
  const [approveOpen, setApproveOpen]                             = useState(false);
  const [approveAssign, setApproveAssign]                         = useState(false);
  const [approveProcurementEmail, setApproveProcurementEmail]     = useState('');
  const [approveReplacementOrderNo, setApproveReplacementOrderNo] = useState('');
  const [closeOpen, setCloseOpen]                       = useState(false);
  const [declineOpen, setDeclineOpen]                   = useState(false);
  const [declineReason, setDeclineReason]               = useState('');
  const [reopenOpen, setReopenOpen]                     = useState(false);
  const [reopenReason, setReopenReason]                 = useState('');
  const [procurementOpen, setProcurementOpen]           = useState(false);
  const [procurementEmail, setProcurementEmail]         = useState('');
  const [procurementOrderNo, setProcurementOrderNo]     = useState('');

  const [expandedScan,       setExpandedScan]       = useState<number | null>(null);
  const [approveSuccess,     setApproveSuccess]     = useState(false);
  const [declineSuccess,     setDeclineSuccess]     = useState(false);
  const [closeSuccess,       setCloseSuccess]       = useState(false);
  const [reopenSuccess,      setReopenSuccess]      = useState(false);
  const [procurementSuccess, setProcurementSuccess] = useState(false);

  // Part modal
  const [partForm]          = Form.useForm();
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [editingSeqNo, setEditingSeqNo]   = useState<number | null>(null);

  const addLog = (content: string, auto = true, atStatus?: Status) => {
    const entry: LogEntry = {
      id: String(Date.now()),
      timestamp: nowTs(),
      role: auto ? 'System' : 'Customer Service',
      employee: auto ? 'System' : 'Rob Jones',
      orderStatus: atStatus ?? status,
      submittedStatus: event.status,
      content,
      auto,
    };
    setLogs(prev => [...prev, entry]);
    pushOrderLog(order.id, entry);
  };

  // Status actions
  const handleApprove = () => setApproveOpen(true);

  const handleConfirmApprove = () => {
    setApproved(true);
    patchOrder(order.id, { approved: true });
    if (approveReplacementOrderNo.trim()) {
      setReplacementOrderNo(approveReplacementOrderNo);
      patchOrder(order.id, { replacementOrderNo: approveReplacementOrderNo });
    }
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
    if (procurementOrderNo.trim()) {
      setReplacementOrderNo(procurementOrderNo);
      patchOrder(order.id, { replacementOrderNo: procurementOrderNo });
    }
    addLog(`Assigned to Procurement. Notified: ${procurementEmail}`, false);
    setProcurementSuccess(true);
  };

  const handleClose = () => {
    setStatus('Closed');
    patchOrder(order.id, { status: 'Closed' });
    addLog('Order closed by CS.', false, 'Closed');
    setCloseSuccess(true);
  };

  // Part actions
  const openAddPart = () => {
    setEditingSeqNo(null);
    partForm.resetFields();
    setPartModalOpen(true);
  };

  const openEditPart = (part: OrderPart) => {
    setEditingSeqNo(part.seqNo);
    partForm.setFieldsValue({
      configId:       part.configId,
      dfoLineItem:    part.dfoLineItem,
      door:           part.door,
      partNumber:     part.partNumber,
      partDescription: part.partDescription,
      quantityType:   part.quantityType,
      quantity:       part.quantity,
      hardwareKitInfo: part.hardwareKitInfo ?? '',
      serialNumber:   part.serialNumber ?? '',
    });
    setPartModalOpen(true);
  };

  const handleSavePart = () => {
    partForm.validateFields().then(values => {
      if (editingSeqNo === null) {
        const newSeqNo = Math.max(...parts.map(p => p.seqNo), 0) + 1;
        const newPart: OrderPart = {
          seqNo:           newSeqNo,
          configId:        values.configId,
          dfoLineItem:     Number(values.dfoLineItem),
          door:            values.door,
          partNumber:      values.partNumber,
          partDescription: values.partDescription,
          quantityType:    values.quantityType,
          quantity:        Number(values.quantity),
          hardwareKitInfo: values.hardwareKitInfo || undefined,
          serialNumber:    values.serialNumber || undefined,
        };
        setParts(prev => [...prev, newPart]);
        addLog(`Part added: ${values.partNumber} — ${values.partDescription} (×${values.quantity} ${values.quantityType})`);
      } else {
        setParts(prev => prev.map(p => p.seqNo === editingSeqNo ? {
          ...p,
          configId:        values.configId,
          dfoLineItem:     Number(values.dfoLineItem),
          door:            values.door,
          partNumber:      values.partNumber,
          partDescription: values.partDescription,
          quantityType:    values.quantityType,
          quantity:        Number(values.quantity),
          hardwareKitInfo: values.hardwareKitInfo || undefined,
          serialNumber:    values.serialNumber || undefined,
        } : p));
        addLog(`Part ${values.partNumber} updated.`);
      }
      setPartModalOpen(false);
    });
  };

  const canEdit = status !== 'Closed';

  const logColumns: ColumnsType<LogEntry> = [
    { title: 'Date & Time',      dataIndex: 'timestamp',      key: 'timestamp',      width: 148, render: (t: string) => <Text style={{ fontSize: token.fontSizeSM }}>{t}</Text> },
    { title: 'Role',             dataIndex: 'role',           key: 'role',           width: 136, render: (r: string, entry: LogEntry) => <Text style={{ fontSize: token.fontSizeSM, color: entry.auto ? token.colorTextTertiary : token.colorText }}>{r}</Text> },
    { title: 'Employee',         dataIndex: 'employee',       key: 'employee',       width: 160, render: (e: string, entry: LogEntry) => <Text style={{ fontSize: token.fontSizeSM, color: entry.auto ? token.colorTextTertiary : token.colorText }}>{e}</Text> },
    { title: 'Order Status',     dataIndex: 'orderStatus',    key: 'orderStatus',    width: 104, render: (s: Status) => <Tag color={STATUS_COLOR[s]} style={{ fontSize: token.fontSizeSM, margin: 0 }}>{s}</Tag> },
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

  const stepIdx = status === 'Closed' ? 1 : 0;
  const stageColors = [token.colorInfo, token.colorSuccess];
  const stageLabels = ['Open', 'Closed'];
  const stages = stageLabels.map((label, i) => ({
    label,
    color: stageColors[i],
    reached: stepIdx >= i,
    isCurrent: stepIdx === i,
  }));

  const actionButtons = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {status === 'Open' && !approved && (
        <>
          <Button icon={<CloseOutlined />} onClick={() => setDeclineOpen(true)}>
            Decline
          </Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove}>
            Approve
          </Button>
        </>
      )}
      {status === 'Open' && approved && (
        <>
          {!assignedToProcurement && (
            <Button icon={<SendOutlined />} onClick={() => setProcurementOpen(true)}>
              Assign to Procurement
            </Button>
          )}
          <Button type="primary" icon={<CheckOutlined />} onClick={() => setCloseOpen(true)}>
            Close Order
          </Button>
        </>
      )}
      {status === 'Closed' && (
        <Button icon={<RollbackOutlined />} onClick={() => setReopenOpen(true)}>
          Reopen
        </Button>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, color: token.colorTextTertiary, textDecoration: 'none' }}>
              <ArrowLeftOutlined style={{ fontSize: token.fontSize }} />
              <span style={{ fontSize: token.fontSize }}>Orders</span>
            </Link>
            <span style={{ color: token.colorBorderSecondary, fontSize: token.fontSizeLG, lineHeight: 1 }}>|</span>
            <span style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>{order.id}</span>
            <Tag color={STATUS_COLOR[status]} style={{ margin: 0 }}>{status}</Tag>
            {approved && status === 'Open' && (
              <Tag color="green" style={{ margin: 0 }}>Approved</Tag>
            )}
            {assignedToProcurement && (
              <Tag color="purple" style={{ margin: 0 }}>Assigned to Procurement</Tag>
            )}
            {replacementOrderNo && (
              <Tag color="cyan" style={{ margin: 0 }}>Replacement: {replacementOrderNo}</Tag>
            )}
          </div>
        }
        right={actionButtons}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 20px 16px', minHeight: 0 }}>

        {/* Status strip */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0 12px', maxWidth: 480, flexShrink: 0 }}>
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
                    background: stepIdx > i
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

        {/* Main content row: tabbed card + scan card */}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0, marginTop: 16 }}>

          <Card
            size="small"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { flex: 1, overflow: 'auto', padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
            tabList={[
              { key: 'details', label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Order Details</span> },
              { key: 'log',     label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Activity Log</span> },
            ]}
            activeTabKey={activeTab}
            onTabChange={key => setActiveTab(key as 'details' | 'log')}
            tabBarExtraContent={
              activeTab === 'log' && !addingLog ? (
                <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setAddingLog(true)}>
                  Add Log
                </Button>
              ) : activeTab === 'details' && canEdit ? (
                <Button type="text" size="small" icon={<PlusOutlined />} onClick={openAddPart}>
                  Add Part
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
                  {([
                    { label: 'Job No',       node: <CopyableValue value={order.jobNo} /> },
                    ...(!order.jobNo.startsWith('WO') ? [
                      { label: 'DFO LIN',    node: <CopyableValue value={String(event.dfo)} /> },
                      ...(event.elLine != null ? [{ label: 'EL LIN', node: <CopyableValue value={String(event.elLine)} /> }] : []),
                    ] : []),
                    { label: 'Event',        node: <Link href={`/events/${event.id}`} style={{ fontSize: token.fontSizeSM }}>{event.id}</Link> },
                    { label: 'Discrepancy',  node: <Text style={{ fontSize: token.fontSizeSM }}>{event.discrepancy}</Text> },
                    { label: 'Last Updated', node: <Text style={{ fontSize: token.fontSizeSM }}>{order.lastUpdated}</Text> },
                  ] as { label: string; node: React.ReactNode }[]).map(({ label, node }, i, arr) => (
                    <Fragment key={label}>
                      <div>
                        <Text style={{ display: 'block', fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, marginBottom: 2 }}>
                          {label}
                        </Text>
                        {node}
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch' }} />
                      )}
                    </Fragment>
                  ))}
                </div>

                {/* Parts header */}
                <div style={{ marginBottom: 10 }}>
                  {sectionLabel('Parts / Ship to Branch')}
                </div>

                {/* Parts list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {parts.map(part => (
                    <div key={part.seqNo} style={{
                      padding: '14px 16px',
                      background: token.colorFillQuaternary,
                      borderRadius: token.borderRadiusSM,
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: 0,
                    }}>
                      {/* Section 1: Part identity */}
                      <div style={{ flex: 3, paddingRight: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12 }}>
                        {displayField('Part #', part.partNumber, true)}
                        {displayField('Part Description', part.partDescription)}
                      </div>
                      <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch', margin: '0 4px' }} />
                      {/* Section 2: Location */}
                      <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12 }}>
                        {displayField('Door Type', part.door)}
                      </div>
                      <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch', margin: '0 4px' }} />
                      {/* Section 3: Fulfillment */}
                      <div style={{ flex: 2.5, paddingLeft: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12 }}>
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
            )}

            {/* LOG TAB */}
            {activeTab === 'log' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {addingLog && (
                  <div style={{
                    marginBottom: 16, padding: 12,
                    background: token.colorFillTertiary,
                    borderRadius: token.borderRadiusSM,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}>
                    <Text style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'block', marginBottom: 8 }}>New Note</Text>
                    <Input.TextArea
                      placeholder="Add a note to the activity log..."
                      value={logDraft}
                      onChange={e => setLogDraft(e.target.value)}
                      rows={3}
                      autoFocus
                      style={{ marginBottom: 8 }}
                    />
                    <Space>
                      <Button
                        size="small" type="primary"
                        disabled={!logDraft.trim()}
                        onClick={() => { addLog(logDraft.trim(), false); setLogDraft(''); setAddingLog(false); }}
                      >
                        Save Note
                      </Button>
                      <Button size="small" onClick={() => { setAddingLog(false); setLogDraft(''); }}>Cancel</Button>
                    </Space>
                  </div>
                )}
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
              </div>
            )}

          </Card>

          {/* Scan card */}
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Label Scans</span>}
            style={{ width: 512, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{ body: { flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 } }}
          >
            <div style={{
              flex: 1,
              background: token.colorFillTertiary,
              border: `1px dashed ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusSM,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 6, minHeight: 120, cursor: 'pointer',
            }} onClick={() => setExpandedScan(0)}>
              <BarcodeOutlined style={{ fontSize: token.fontSizeHeading2, color: token.colorTextQuaternary }} />
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No label scans attached</Text>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Click to expand</Text>
            </div>

            <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.5 }}>
              Label scans are auto-captured when a tech submits the event. Verify part numbers and Config IDs against the label before approving.
            </Text>
          </Card>

        </div>
      </div>

      {/* APPROVE MODAL */}
      <Modal
        title={approveSuccess ? null : 'Approve Order'}
        open={approveOpen}
        onCancel={() => { setApproveOpen(false); setApproveAssign(false); setApproveProcurementEmail(''); setApproveReplacementOrderNo(''); setApproveSuccess(false); }}
        onOk={handleConfirmApprove}
        okText={approveAssign && approveProcurementEmail ? 'Approve & Notify Procurement' : 'Approve'}
        okButtonProps={{ type: 'primary', disabled: !approveReplacementOrderNo.trim() }}
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
              {order.id} has been approved.{' '}
              {approveAssign && approveProcurementEmail
                ? `Email notifications sent to ${event.branch} branch and ${approveProcurementEmail}.`
                : `Email notification sent to ${event.branch} branch.`}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setApproveOpen(false); setApproveAssign(false); setApproveProcurementEmail(''); setApproveReplacementOrderNo(''); setApproveSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This marks the order as approved. You can assign it to procurement now or as a separate step after.
            </Text>
            <Form layout="vertical" size="small">
              <Form.Item label="Replacement Part #" required style={{ marginBottom: 12 }}>
                <Input
                  placeholder="e.g. RO-2026-00123"
                  value={approveReplacementOrderNo}
                  onChange={e => setApproveReplacementOrderNo(e.target.value)}
                />
              </Form.Item>
            </Form>
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
              {order.id} has been declined and closed. Email notification sent to {event.branch} branch.
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
              {order.id} has been returned to Open status and is ready for review.
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
        onCancel={() => { setProcurementOpen(false); setProcurementEmail(''); setProcurementOrderNo(''); setProcurementSuccess(false); }}
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
              {order.id} has been assigned to procurement. Email notifications sent to {event.branch} branch and {procurementEmail}.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setProcurementOpen(false); setProcurementEmail(''); setProcurementOrderNo(''); setProcurementSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              Notify a procurement contact and optionally log the replacement order number.
            </Text>
            <Form layout="vertical" size="small">
              <Form.Item label="Notify" style={{ marginBottom: 12 }}>
                <Select
                  placeholder="Select procurement contact..."
                  value={procurementEmail || undefined}
                  onChange={v => setProcurementEmail(v)}
                  options={PROCUREMENT_CONTACTS}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item label="Replacement Order # (optional)" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="e.g. RO-2026-00123"
                  value={procurementOrderNo}
                  onChange={e => setProcurementOrderNo(e.target.value)}
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
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Order Closed</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {order.id} has been closed. It can be reopened if needed.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setCloseOpen(false); setCloseSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
            This will mark the order as Closed. It can be reopened if needed.
          </Text>
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
          <Row gutter={8}>
            <Col flex={1}>
              <Form.Item label="Config ID" name="configId" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                <Input placeholder="e.g. SO109823809.1" />
              </Form.Item>
            </Col>
            <Col style={{ width: 72 }}>
              <Form.Item label="DFO" name="dfoLineItem" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Door Type" name="door" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
            <Input placeholder="e.g. Dura_Glide Greenstar 3000" />
          </Form.Item>
          <Row gutter={8}>
            <Col flex={1}>
              <Form.Item label="Part #" name="partNumber" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
                <Input placeholder="e.g. 413856-1" />
              </Form.Item>
            </Col>
            <Col flex={1}>
              <Form.Item label="Hardware Kit Information" name="hardwareKitInfo" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="None"
                  options={['Entire Hardware Kit', 'Components within Hardware Kit'].map(v => ({ value: v, label: v }))}
                />
              </Form.Item>
            </Col>
            <Col flex={1}>
              <Form.Item label="Serial #" name="serialNumber" style={{ marginBottom: 10 }}>
                <Input placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Part Description" name="partDescription" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
            <Input.TextArea rows={2} placeholder="Full part description" />
          </Form.Item>
          <Row gutter={8}>
            <Col flex={1}>
              <Form.Item label="Quantity Type" name="quantityType" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                <Select options={['Piece', 'Length'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col style={{ width: 88 }}>
              <Form.Item label="Quantity" name="quantity" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

    </div>
  );
}
