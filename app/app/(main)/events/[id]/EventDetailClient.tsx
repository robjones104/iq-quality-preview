'use client';

import { useState, useRef, Fragment, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEventStore } from '@/store/eventStore';
import { useOrderStore } from '@/store/orderStore';
import { useCapabilities } from '@/store/roleStore';
import { orders as allOrders } from '@/data/orders';
import type { Order } from '@/data/orders';
import {
  Button, Card, Col, Divider, Drawer, Dropdown, Form, Grid, Input, InputNumber, message, Modal, Radio, Row,
  Segmented, Select, Slider, Space, Switch, Table, Tooltip, Typography, Upload, theme,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleFilled, CheckOutlined, CloseCircleFilled, CloseOutlined, DeleteOutlined, EditFilled, ExclamationCircleFilled,
  FileAddFilled, FileExcelOutlined, LockFilled, MessageFilled, MoreOutlined, FileOutlined, FilePdfOutlined, FileWordOutlined, InboxOutlined, PaperClipOutlined, PictureFilled, PlusOutlined,
  RollbackOutlined, SaveFilled, SearchOutlined, StarFilled, StopFilled, ToolFilled,
} from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import type { ColumnsType } from 'antd/es/table';
import { StatusTag, STATUS_COLORS } from '@/components/StatusTag';
import { PageHeader } from '@/components/PageHeader';
import { logs } from '@/data/logs';
import { ISSUE_OPTIONS, DOOR_OPTIONS, PART_CATALOG, PLANT_OPTIONS, COMPONENT_OPTIONS } from '@/data/filterOptions';
import { EscalateModal } from '@/components/EscalateModal';
import { useEffectiveEvents } from '@/lib/effectiveEvents';
import { useEffectiveEscalations } from '@/lib/effectiveEscalations';
import { useEscalationStore } from '@/store/escalationStore';
import { useInfoRequestThread, InfoRequestThreadPanel } from '@/components/InfoRequestThread';
import type { QualityEvent, EventStatus, ActivityLog } from '@/data/types';
import { nowDate, nowStampIso, nowStampUs } from '@/lib/appTime';
const { Text, Paragraph } = Typography;

const ROOT_CAUSE_OPTIONS = [
  'Ordering Error', 'Wrong Order From Branch', 'Sales Order Error',
  'Installation Error', 'Factory Issue', 'Configuration Problem',
  'Training Issue', 'Supplier Issue', 'Engineering Issue', 'Short Shipping',
].map(v => ({ value: v, label: v }));


const STATUS_STEP: Record<EventStatus, number> = {
  Reported:              0,
  'Under Investigation': 1,
  Validated:             2,
  Invalidated:           2,
};

function generateInsights(event: QualityEvent, rootCause: string | null): string {
  const age = Math.max(0, Math.round((nowDate().getTime() - new Date(event.date).getTime()) / 86400000));
  const urgency = age >= 7
    ? 'This event is stale and should be prioritized for resolution.'
    : age >= 3 ? 'This event is aging and should be reviewed soon.'
    : 'This is a recent event.';
  const rc = rootCause
    ? `Root cause has been identified as ${rootCause}.`
    : 'Root cause analysis is still pending.';
  const parts = event.partsRequest?.length
    ? `A parts request for ${event.partsRequest.length} line item(s) has been filed.`
    : 'No parts request has been filed.';
  const action =
    event.status === 'Reported'
      ? 'Begin investigation and verify the configuration against the order manifest.'
      : event.status === 'Under Investigation'
      ? 'Complete root cause analysis and determine whether a parts request or escalation is needed.'
      : event.status === 'Validated'
      ? 'Ensure parts requests are filed and Customer Service is notified to proceed with fulfillment.'
      : 'Confirm invalidation rationale is documented and close any open parts requests.';
  return `${event.issue} reported for ${event.component} (${event.door}) at the ${event.branch} branch. ${rc} ${parts} ${urgency} Recommended action: ${action}`;
}

function generateHistoricalInsights(event: QualityEvent, pool: QualityEvent[]): string {
  const similar = pool.filter(e =>
    e.id !== event.id &&
    (e.issue === event.issue || e.component === event.component || e.branch === event.branch)
  );
  const count = similar.length;
  if (count === 0) return 'No similar events found in the current dataset to compare against.';

  const rootCauses: Record<string, number> = {};
  for (const e of similar) if (e.rootCause) rootCauses[e.rootCause] = (rootCauses[e.rootCause] ?? 0) + 1;
  const topRC = Object.entries(rootCauses).sort((a, b) => b[1] - a[1])[0];

  const validated   = similar.filter(e => e.status === 'Validated').length;
  const invalidated = similar.filter(e => e.status === 'Invalidated').length;
  const resolved    = validated + invalidated;
  const rate        = resolved > 0 ? Math.round((validated / resolved) * 100) : null;

  const rcLine   = topRC ? `The most common root cause was ${topRC[0]} (${topRC[1]} of ${count} events). ` : '';
  const rateLine = rate !== null ? `${rate}% of resolved similar events were validated. ` : '';
  const invLine  = invalidated > 0 ? `${invalidated} were invalidated, suggesting this type occasionally has alternate explanations. ` : '';

  return `${count} similar events found matching this issue, component, or branch. ${rcLine}${rateLine}${invLine}Use the similar events table to identify recurring patterns or suppliers.`;
}


export default function EventDetailClient({ event, orderId }: { event: QualityEvent; orderId: string | null }) {
  const { mutations: evtMutations, patchEvent, pushActivityLog } = useEventStore();
  const { mutations: orderMutations, createdOrders, createOrder } = useOrderStore();
  const evtStored = evtMutations[event.id] ?? {};
  const effectiveEvents = useEffectiveEvents();
  const effectiveEscalations = useEffectiveEscalations();
  const { createEscalation, linkEvent: linkEventToEscalation, unlinkEvent: unlinkEventFromEscalation } = useEscalationStore();
  const openEscalations = effectiveEscalations.filter(e => e.status === 'Open');
  // Orders created at runtime for this event (parts request on an orderless
  // event). Server only knows static orders, so resolve the link client-side.
  const [runtimeOrderId, setRuntimeOrderId] = useState<string | null>(null);
  const effectiveOrderId = orderId
    ?? runtimeOrderId
    ?? Object.values(createdOrders).find(o => o.eventId === event.id)?.id
    ?? null;

  const [status, setStatus]                   = useState<EventStatus>(evtStored.status ?? event.status);
  const [plant, setPlant]                     = useState<string>(evtStored.plant ?? event.plant);
  const [editingPlant, setEditingPlant]       = useState(false);
  const [plantDraft, setPlantDraft]           = useState(plant);
  const [editingComponent, setEditingComponent] = useState(false);
  const [selectedPartIdx, setSelectedPartIdx] = useState(0);
  const [rootCauses, setRootCauses]           = useState<string[]>(
    evtStored.rootCauses ??
    (evtStored.rootCause !== undefined
      ? (evtStored.rootCause ? [evtStored.rootCause] : [])
      : (event.rootCause ? [event.rootCause] : []))
  );
  const [rootCauseOptions, setRootCauseOptions] = useState(() => {
    const extras = (evtStored.rootCauseOptions ?? []).filter(
      s => !ROOT_CAUSE_OPTIONS.some(b => b.value === s.value)
    );
    return [...ROOT_CAUSE_OPTIONS, ...extras];
  });
  const [rcSearch, setRcSearch]               = useState('');
  const [escalation, setEscalation]           = useState<string | null>(
    evtStored.escalation !== undefined ? evtStored.escalation : null
  );
  const [createEscOpen, setCreateEscOpen]     = useState(false);
  const [tags, setTags]                       = useState<string[]>(evtStored.tags ?? []);
  const [insights, setInsights]               = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [historical, setHistorical]           = useState<string | null>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [insightsStep, setInsightsStep]       = useState<null | 'summary' | 'historical'>(null);
  const [activeTab, setActiveTab]             = useState<'details' | 'log' | 'photos' | 'attachments'>('details');
  const [validateOpen, setValidateOpen]       = useState(false);
  const [invalidateOpen, setInvalidateOpen]   = useState(false);
  const [startInvOpen,      setStartInvOpen]      = useState(false);
  const [startInvNote,      setStartInvNote]      = useState('');
  const [startInvReqInfo,   setStartInvReqInfo]   = useState(true);
  const [reopenEvtOpen,     setReopenEvtOpen]     = useState(false);
  const [validateNote,      setValidateNote]      = useState('');
  const [validateSuccess,   setValidateSuccess]   = useState(false);
  const [invalidateNote,    setInvalidateNote]    = useState('');
  const [invalidateSuccess, setInvalidateSuccess] = useState(false);
  const [startInvSuccess,   setStartInvSuccess]   = useState(false);
  const [reopenEvtSuccess,  setReopenEvtSuccess]  = useState(false);
  const [pendingEscalation, setPendingEscalation] = useState<string | null>(null);
  const [escConfirmOpen,    setEscConfirmOpen]    = useState(false);
  const [expandedImg,       setExpandedImg]       = useState<number | null>(null);
  const [analysisDrawerOpen, setAnalysisDrawerOpen] = useState(false);
  const [analysisTab, setAnalysisTab]         = useState<'analysis' | 'messages'>('messages');
  const eventSeedLogs = logs.filter(l => l.eventId === event.id);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>(() => [
    ...eventSeedLogs,
    ...(evtStored.activityLogAdditions ?? []),
  ]);
  const [editForm]                            = Form.useForm();
  const [partForm]                            = Form.useForm();
  const [partModalOpen, setPartModalOpen]     = useState(false);
  const partModalKitInfo = Form.useWatch('hardwareKitInfo', partForm);
  const partModalQty     = (Form.useWatch('quantity', partForm) as number | undefined) ?? 1;
  const currentIssue             = evtStored.issue             ?? event.issue;
  const currentComponent         = evtStored.component         ?? event.component;
  const currentDoor             = evtStored.door              ?? event.door;
  const currentJobNo            = evtStored.jobNo             ?? event.jobNo;
  const currentIssueDescription = evtStored.issueDescription  ?? event.issueDescription;
  const currentDfo              = evtStored.dfo               ?? event.dfo;
  const currentElLine           = evtStored.elLine            ?? event.elLine;
  const isMissingHardware = currentIssue === 'Missing Hardware';
  const isSO              = !currentJobNo.startsWith('WO');
  const [partsState, setPartsState] = useState(evtStored.partsRequest ?? event.partsRequest ?? []);
  const lastSavedValues = useRef({
    issue:            currentIssue,
    component:        currentComponent,
    door:             currentDoor,
    jobNo:            currentJobNo,
    issueDescription: currentIssueDescription,
    dfo:              currentDfo,
    elLine:           currentElLine,
  });
  const [attachments, setAttachments] = useState<Array<{ uid: string; name: string; size: number; date: string; blobUrl: string }>>([]);
  const [previewFile, setPreviewFile] = useState<{ name: string; blobUrl: string } | null>(null);
  const dragStartY                             = useRef(0);
  const photoInputRef                          = useRef<HTMLInputElement>(null);

  const handlePhotoFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      message.success(files.length === 1 ? `${files[0].name} added.` : `${files.length} photos added.`);
    }
    e.target.value = '';
  };
  const { token } = theme.useToken();
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const nowTs = () => nowStampIso();

  const addToActivityLog = (comment: string, forStatus?: EventStatus, editFrom?: string | null, editTo?: string | null) => {
    const entry: ActivityLog = {
      id: `al_${Date.now()}`,
      eventId: event.id,
      date: nowTs(),
      role: 'Field Quality',
      employee: 'Current User',
      status: forStatus ?? status,
      comment,
      editFrom,
      editTo,
    };
    setActivityLog(prev => [...prev, entry]);
    pushActivityLog(event.id, entry);
  };

  const logEditEntry = (field: string, from: string | null, to: string | null) => {
    addToActivityLog(`${field} updated`, undefined, from ?? '—', to ?? '—');
  };

  const thread = useInfoRequestThread(event, 'Field Quality', { onActivity: addToActivityLog });

  const handleSaveEdits = () => {
    const values = editForm.getFieldsValue();
    const prev = lastSavedValues.current;
    const nextDfo    = isSO && values.dfo !== undefined && values.dfo !== '' ? Number(values.dfo) : prev.dfo;
    const nextElLine = isSO && values.elLine !== undefined && values.elLine !== '' ? Number(values.elLine) : prev.elLine;
    const tracked: Array<[string, string, string]> = [
      ['Issue',             prev.issue,             String(values.issue             ?? prev.issue)],
      ['Component',         prev.component,         String(values.component         ?? prev.component)],
      ['Door',              prev.door,              String(values.door              ?? prev.door)],
      ['Job No.',           prev.jobNo,             String(values.jobNo             ?? prev.jobNo)],
      ['Issue Description', prev.issueDescription,  String(values.issueDescription  ?? prev.issueDescription)],
      ['DFO LIN',           prev.dfo != null ? String(prev.dfo) : '',       nextDfo != null ? String(nextDfo) : ''],
      ['EL LIN',            prev.elLine != null ? String(prev.elLine) : '', nextElLine != null ? String(nextElLine) : ''],
    ];
    for (const [label, from, to] of tracked) {
      if (to !== from) logEditEntry(label, from || '—', to || '—');
    }
    const next = {
      issue:            String(values.issue             ?? prev.issue),
      component:        String(values.component         ?? prev.component),
      door:             String(values.door              ?? prev.door),
      jobNo:            String(values.jobNo             ?? prev.jobNo),
      issueDescription: String(values.issueDescription  ?? prev.issueDescription),
      dfo:              nextDfo,
      elLine:            nextElLine,
    };

    let nextPartsState = partsState;
    if (partsState.length > 0) {
      const selectedPart = partsState[selectedPartIdx];
      const updatedPart = {
        ...selectedPart,
        partNumber:   editPartNumber || selectedPart.partNumber,
        description:  editPartDescription || selectedPart.description,
        quantityType: editPartQuantityType || selectedPart.quantityType,
        quantity:     editPartQuantity !== '' ? Number(editPartQuantity) : selectedPart.quantity,
      };
      nextPartsState = partsState.map((p, i) => (i === selectedPartIdx ? updatedPart : p));
      setPartsState(nextPartsState);
      resetPartDrafts(updatedPart);
    }

    patchEvent(event.id, { ...next, partsRequest: nextPartsState });
    lastSavedValues.current = next;
    setEditingComponent(false);
  };

  const openAddPartRequest = () => {
    partForm.resetFields();
    partForm.setFieldsValue({ jobNo: currentJobNo, door: currentDoor, quantity: 1 });
    setPartModalOpen(true);
  };

  // An event's parts request drives order creation (pipeline rule): if the
  // event has no open order when a parts request is added, one is created for
  // Customer Service review. Existing open orders are left to CS to amend.
  const findOpenOrderId = (): string | null => {
    const all = [...allOrders, ...Object.values(createdOrders)].filter(o => o.eventId === event.id);
    const open = all.find(o => (orderMutations[o.id]?.status ?? o.orderStatus) === 'Open');
    return open ? open.id : null;
  };

  const nextOrderId = (): string => {
    const taken = new Set([...allOrders, ...Object.values(createdOrders)].map(o => o.id));
    const base = `${event.id}_Order`;
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}_${n}`)) n++;
    return `${base}_${n}`;
  };

  const handleSavePartRequest = () => {
    partForm.validateFields().then(values => {
      const newPart = {
        partNumber:   values.partNumber,
        description:  values.partDescription,
        quantityType: values.quantityType,
        quantity:     Number(values.quantity),
      };
      const nextParts = [...partsState, newPart];
      setPartsState(nextParts);
      patchEvent(event.id, { partsRequest: nextParts });

      if (!findOpenOrderId()) {
        const newId = nextOrderId();
        const order: Order = {
          id: newId,
          eventId: event.id,
          orderStatus: 'Open',
          jobNo: currentJobNo,
          lastUpdated: nowStampUs(),
          parts: [{
            seqNo: 1,
            configId: `${currentJobNo}.1`,
            dfoLineItem: currentDfo,
            ...(isSO && currentElLine != null ? { elLineItem: currentElLine } : {}),
            door: currentDoor,
            partNumber: values.partNumber,
            quantityType: values.quantityType,
            quantity: Number(values.quantity),
            partDescription: values.partDescription,
          }],
        };
        createOrder(order);
        setRuntimeOrderId(newId);
        addToActivityLog(`Parts request submitted. Order created for Customer Service review.`);
        message.success('Parts request added. An order was created for Customer Service review.');
      } else {
        addToActivityLog('Parts request added.');
        message.success('Parts request added.');
      }

      setPartModalOpen(false);
      partForm.resetFields();
    });
  };

  const [hkMode, setHkMode] = useState<'entire' | 'components' | null>(() =>
    event.hardwareKit ? (event.hardwareKit.kitInfo === 'Entire Hardware Kit' ? 'entire' : 'components') : null
  );
  const [hkComponents, setHkComponents] = useState<Array<{ partNumber: string; description: string }>>(
    [{ partNumber: '', description: '' }]
  );
  const [editPartNumber, setEditPartNumber] = useState<string>('');
  const [editPartDescription, setEditPartDescription] = useState<string>('');
  const [editPartQuantityType, setEditPartQuantityType] = useState<string>('');
  const [editPartQuantity, setEditPartQuantity] = useState<string>('');

  const resetPartDrafts = (part?: { partNumber: string; description: string; quantityType: string; quantity: number }) => {
    setEditPartNumber(part?.partNumber ?? '');
    setEditPartDescription(part?.description ?? '');
    setEditPartQuantityType(part?.quantityType ?? '');
    setEditPartQuantity(part?.quantity != null ? String(part.quantity) : '');
  };

  const caps = useCapabilities();
  const roleCanEdit = caps.editEvents;
  // Read-only for roles without event-edit rights (CS, Procurement, view-only),
  // and for terminal statuses. `locked` keeps the existing status-lock messaging;
  // `editable` additionally respects the current role and gates every edit
  // affordance below.
  const locked        = status === 'Validated' || status === 'Invalidated';
  const editable      = roleCanEdit && status !== 'Validated' && status !== 'Invalidated';
  // Validated events stay open for enrichment: root cause, tags, photos, and
  // attachments can still be added without reopening. Invalidated stays locked.
  const canAugment    = editable || (roleCanEdit && status === 'Validated');
  const reopenTarget: EventStatus = 'Under Investigation';

  const stepIdx      = STATUS_STEP[status];
  const reportedDate = event.reportedAt.replace('T', ' ').substring(0, 16);

  const thirdLabel   = status === 'Validated' ? 'Validated' : status === 'Invalidated' ? 'Invalidated' : 'Resolution';
  const thirdColor   = status === 'Validated' ? STATUS_COLORS['Validated'] : status === 'Invalidated' ? STATUS_COLORS['Invalidated'] : null;
  const thirdReached = status === 'Validated' || status === 'Invalidated';

  const stages = [
    { label: 'Reported',            color: STATUS_COLORS['Reported'],              reached: true,         isCurrent: stepIdx === 0 },
    { label: 'Under Investigation', color: STATUS_COLORS['Under Investigation'],   reached: stepIdx >= 1, isCurrent: stepIdx === 1 },
    { label: thirdLabel,            color: thirdColor ?? token.colorBorderSecondary, reached: thirdReached, isCurrent: false },
  ];

  const handleGenerateInsights = () => {
    setLoadingInsights(true);
    setTimeout(() => {
      setInsights(generateInsights(event, rootCauses.join(', ') || null));
      setLoadingInsights(false);
      setInsightsStep('summary');
    }, 900);
  };

  const handleGenerateHistorical = () => {
    setLoadingHistorical(true);
    setTimeout(() => {
      setHistorical(generateHistoricalInsights(event, effectiveEvents));
      setLoadingHistorical(false);
      setInsightsStep('historical');
    }, 1100);
  };

  const handleViewSimilarEvents = () => {
    router.push(`/events?issue=${encodeURIComponent(currentIssue)}&backTo=${event.id}`);
  };

  const sectionLabel = (text: string) => (
    <Text style={{
      display: 'block', fontSize: token.fontSizeSM, fontWeight: 600,
      marginBottom: 10, color: token.colorText,
    }}>
      {text}
    </Text>
  );

  const displayField = (label: string, value?: string | number | null, fullWidth?: boolean, copyable?: boolean) => {
    const display = value != null && String(value).trim() ? value : null;
    return (
      <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
        <Text style={{
          display: 'block', fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.5px',
          textTransform: 'uppercase', marginBottom: 3, color: token.colorTextTertiary,
        }}>
          {label}
        </Text>
        {copyable && display != null
          ? <CopyableValue value={String(display)} />
          : <Text style={{ fontSize: token.fontSize, color: display != null ? token.colorText : token.colorTextQuaternary }}>
              {display != null ? display : '—'}
            </Text>
        }
      </div>
    );
  };

  const logColumns: ColumnsType<ActivityLog> = [
    { title: 'Date',     dataIndex: 'date',     key: 'date',     width: 148, render: (d: string)      => <Text style={{ fontSize: token.fontSizeSM }}>{d}</Text> },
    { title: 'Role',     dataIndex: 'role',     key: 'role',     width: 160, render: (r: string)      => <Text style={{ fontSize: token.fontSizeSM }}>{r}</Text> },
    { title: 'Employee', dataIndex: 'employee', key: 'employee', width: 200, render: (e: string)      => <Text style={{ fontSize: token.fontSizeSM }}>{e}</Text> },
    { title: 'Status',   dataIndex: 'status',   key: 'status',   width: 168, render: (s: EventStatus) => <StatusTag status={s} /> },
    { title: 'Comment',  dataIndex: 'comment',  key: 'comment',              render: (c: string, row: ActivityLog) => (
      <div>
        <Text style={{ fontSize: token.fontSizeSM }}>{c}</Text>
        {(row.editFrom != null || row.editTo != null) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, textDecoration: 'line-through' }}>{row.editFrom}</Text>
            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>→</Text>
            <Text style={{ fontSize: token.fontSizeSM }}>{row.editTo}</Text>
          </div>
        )}
      </div>
    ) },
  ];

  const photosContent = (
    <>
      <div style={{
        minHeight: 360,
        background: token.colorFillTertiary,
        border: `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        marginBottom: 8,
      }} onClick={() => setExpandedImg(0)}>
        <PictureFilled style={{ fontSize: token.fontSizeHeading3, color: token.colorTextQuaternary }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No photos attached</Text>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Click to expand</Text>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2].map(i => (
          <div key={i} onClick={() => setExpandedImg(i)} style={{
            flex: 1, aspectRatio: '1',
            background: token.colorFillTertiary,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusSM,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <PictureFilled style={{ fontSize: token.fontSize, color: token.colorTextQuaternary }} />
          </div>
        ))}
      </div>
    </>
  );

  const analysisContent = (
    <>
      {insightsStep !== null ? (
        <>
          <Button type="text" size="small" icon={<ArrowLeftOutlined style={{ fontSize: token.fontSizeSM }} />} onClick={() => setInsightsStep(null)} style={{ marginBottom: 8, paddingInline: 4 }}>
            Back
          </Button>
          <Text style={{ fontSize: token.fontSizeSM, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
            Summary
          </Text>
          <Paragraph style={{ fontSize: token.fontSizeSM, lineHeight: 1.8, margin: 0, marginBottom: 16 }}>{insights}</Paragraph>
          {insightsStep === 'historical' ? (
            <>
              <Divider style={{ margin: '0 0 12px' }} />
              <Text style={{ fontSize: token.fontSizeSM, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, display: 'block', marginBottom: 6 }}>
                Historical Analysis
              </Text>
              <Paragraph style={{ fontSize: token.fontSizeSM, lineHeight: 1.8, margin: 0, marginBottom: 16 }}>{historical}</Paragraph>
              <Button block icon={<ArrowLeftOutlined />} onClick={handleViewSimilarEvents}>
                View Similar Events
              </Button>
            </>
          ) : (
            <Button block icon={<StarFilled />} loading={loadingHistorical} onClick={handleGenerateHistorical}>
              Generate Historical Insights
            </Button>
          )}
        </>
      ) : (
        <>
          <Form layout="vertical" size="small">
            <Form.Item label="Root Cause" style={{ marginBottom: 10 }}>
              <Select
                mode="multiple"
                showSearch
                disabled={!canAugment}
                value={rootCauses}
                placeholder="Select or add root causes..."
                filterOption={false}
                onSearch={setRcSearch}
                onChange={(vals: string[]) => {
                  const added = vals.filter(v => !rootCauses.includes(v));
                  const removed = rootCauses.filter(v => !vals.includes(v));
                  // Custom entries (via the create option) join the options list
                  const newOpts = added.filter(v => !rootCauseOptions.some(o => o.value === v));
                  if (newOpts.length) {
                    const updatedOpts = [...rootCauseOptions, ...newOpts.map(v => ({ value: v, label: v }))];
                    setRootCauseOptions(updatedOpts);
                    patchEvent(event.id, { rootCauseOptions: updatedOpts.filter(o => !ROOT_CAUSE_OPTIONS.some(r => r.value === o.value)) });
                  }
                  if (added.length || removed.length) {
                    logEditEntry('Root Cause', rootCauses.join(', ') || null, vals.join(', ') || null);
                  }
                  setRootCauses(vals);
                  patchEvent(event.id, { rootCauses: vals, rootCause: vals[0] ?? null });
                  setRcSearch('');
                }}
                options={(() => {
                  const q = rcSearch.toLowerCase();
                  const matches = q
                    ? rootCauseOptions.filter(o => o.value.toLowerCase().includes(q))
                    : rootCauseOptions;
                  const hasExact = rootCauseOptions.some(o => o.value.toLowerCase() === q);
                  return q && !hasExact
                    ? [...matches, { value: rcSearch, label: `+ Create "${rcSearch}"` }]
                    : matches;
                })()}
                allowClear
              />
            </Form.Item>
            <Form.Item label="Escalation" style={{ marginBottom: 10 }}>
              {/* Open at any active status (not just Validated): blocking it
                  pre-validation trains FQ to park CAR numbers in free text. */}
              <Tooltip title={status === 'Invalidated' ? 'Invalidated events can’t be linked to an escalation.' : ''}>
                <Select
                  showSearch
                  disabled={status === 'Invalidated' || !roleCanEdit}
                  value={escalation ?? undefined}
                  placeholder="Link to escalation"
                  optionFilterProp="label"
                  onChange={(v: string | undefined) => {
                    if (!v) {
                      if (escalation) {
                        const target = effectiveEscalations.find(e => e.id === escalation);
                        unlinkEventFromEscalation(escalation, event.id, target?.eventIds ?? []);
                        addToActivityLog(`Unlinked from escalation: ${escalation}.`);
                      }
                      setEscalation(null);
                      patchEvent(event.id, { escalation: null });
                      return;
                    }
                    if (v === '__new__') { setCreateEscOpen(true); return; }
                    setPendingEscalation(v);
                    setEscConfirmOpen(true);
                  }}
                  options={[
                    { value: '__new__', label: '+ New Escalation...' },
                    ...openEscalations.map(e => ({ value: e.id, label: `${e.id}: ${e.title}` })),
                  ]}
                  allowClear
                />
              </Tooltip>
            </Form.Item>
            <Form.Item label="Tags" style={{ marginBottom: 0 }}>
              <Select
                mode="tags"
                disabled={!canAugment}
                value={tags}
                onChange={(t: string[]) => { setTags(t); patchEvent(event.id, { tags: t }); }}
                placeholder="Add tags"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>

          <Divider style={{ margin: '12px 0' }} />

          <Space orientation="vertical" style={{ width: '100%' }} size={8}>
            <Button block icon={<StarFilled />} loading={loadingInsights} onClick={handleGenerateInsights}>
              Generate AI Insights
            </Button>
          </Space>
        </>
      )}
    </>
  );

  const messagesContent = (
    <InfoRequestThreadPanel {...thread} reportedBy={event.reportedBy} canSend={editable} />
  );

  const mobileActionItems = !roleCanEdit ? [] : [
    ...(status === 'Reported' ? [{ key: 'start-inv', icon: <SearchOutlined />, label: 'Start Investigation', onClick: () => setStartInvOpen(true) }] : []),
    ...(status === 'Validated' || status === 'Invalidated' ? [{ key: 'reopen', icon: <RollbackOutlined />, label: 'Reopen', onClick: () => setReopenEvtOpen(true) }] : []),
    ...(editable ? [
      { type: 'divider' as const },
      { key: 'invalidate', icon: <StopFilled />, label: 'Invalidate', onClick: () => setInvalidateOpen(true) },
      { key: 'validate', icon: <CheckOutlined />, label: 'Validate', onClick: () => setValidateOpen(true) },
    ] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...(isMobile ? {} : { height: '100vh', overflow: 'hidden' }) }}>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handlePhotoFilesSelected}
      />
      <EscalateModal
        open={createEscOpen}
        onCancel={() => setCreateEscOpen(false)}
        event={{ id: event.id, issue: event.issue, component: event.component, issueDescription: event.issueDescription }}
        openEscalations={openEscalations}
        createdBy={caps.displayName}
        onCreate={({ type, title, reportedIssue }) => {
          const id = `ESC_R${Date.now().toString(36).toUpperCase()}`;
          const ts = nowStampIso();
          createEscalation({
            id, type, title, status: 'Open', reportedIssue,
            rootCause: null, correctionImplemented: null, fieldAction: null,
            eventIds: [event.id], createdBy: caps.displayName, createdAt: ts, updatedAt: ts,
          });
          setEscalation(id);
          patchEvent(event.id, { escalation: id });
          addToActivityLog(`Escalated to ${type}: ${id}.`);
          return id;
        }}
        onLink={(escId) => {
          const target = effectiveEscalations.find(e => e.id === escId);
          linkEventToEscalation(escId, event.id, target?.eventIds ?? []);
          setEscalation(escId);
          patchEvent(event.id, { escalation: escId });
          addToActivityLog(`Linked to escalation: ${escId}.`);
        }}
      />
      <PageHeader
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/events" style={{ display: 'flex', alignItems: 'center', color: token.colorTextTertiary, textDecoration: 'none' }}>
              <ArrowLeftOutlined style={{ fontSize: token.fontSize }} />
              <span style={{ marginLeft: 6, fontSize: token.fontSize }}>Events</span>
            </Link>
            <span style={{ color: token.colorBorderSecondary, fontSize: token.fontSizeLG, lineHeight: 1 }}>|</span>
            <span style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>{event.id}</span>
            <StatusTag status={status} />
          </div>
        }
        right={
          !roleCanEdit ? (
            <Space size={6} style={{ color: token.colorTextTertiary }}>
              <LockFilled style={{ fontSize: token.fontSizeSM }} />
              <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>View only</Text>
            </Space>
          ) : isMobile ? (
            <Dropdown menu={{ items: mobileActionItems }} trigger={['click']}>
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          ) : (
            <Space>
              {status === 'Reported' && (
                <Button icon={<SearchOutlined />} onClick={() => setStartInvOpen(true)}>
                  Start Investigation
                </Button>
              )}
              {(status === 'Validated' || status === 'Invalidated') && (
                <Button type="text" icon={<RollbackOutlined />} onClick={() => setReopenEvtOpen(true)}>
                  Reopen
                </Button>
              )}
              {editable && (
                <>
                  {status === 'Reported' && <Divider type="vertical" style={{ margin: '0 4px' }} />}
                  <Button
                    icon={<StopFilled />}
                    onClick={() => setInvalidateOpen(true)}
                  >
                    Invalidate
                  </Button>
                  <Button
                    icon={<CheckOutlined />}
                    type="primary"
                    onClick={() => setValidateOpen(true)}
                  >
                    Validate
                  </Button>
                </>
              )}
            </Space>
          )
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? undefined : 'hidden', padding: isMobile ? '0 12px 80px' : '0 20px 16px', minHeight: 0 }}>

        {locked && (
          <Space size={6} style={{ marginTop: 12, flexShrink: 0, color: token.colorTextTertiary }}>
            <LockFilled style={{ fontSize: token.fontSizeSM }} />
            <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
              {status === 'Validated'
                ? 'Validated: core fields are locked, but root cause, tags, photos, and attachments can still be added.'
                : `${status}: locked from further edits. Reopen to resume editing.`}
            </Text>
          </Space>
        )}

        {/* Status strip */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0 12px', maxWidth: isMobile ? undefined : 560, flexShrink: 0 }}>
          {stages.map((stage, i) => (
            <Fragment key={stage.label}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: stage.reached ? stage.color : token.colorFillSecondary,
                  border: `2px solid ${stage.reached ? stage.color : token.colorBorderSecondary}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: stage.isCurrent
                    ? `0 0 0 3px ${token.colorBgContainer}, 0 0 0 5px ${stage.color}60, 0 0 14px ${stage.color}50`
                    : stage.reached
                    ? `0 0 8px ${stage.color}40`
                    : 'none',
                  transition: 'all 0.3s',
                }}>
                  {stage.isCurrent && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                  )}
                  {stage.reached && !stage.isCurrent && i < 2 && (
                    <CheckOutlined style={{ fontSize: token.fontSizeXS, color: '#fff' }} />
                  )}
                  {stage.reached && i === 2 && status === 'Validated' && (
                    <CheckOutlined style={{ fontSize: token.fontSizeXS, color: '#fff' }} />
                  )}
                  {stage.reached && i === 2 && status === 'Invalidated' && (
                    <CloseOutlined style={{ fontSize: token.fontSizeXS, color: '#fff' }} />
                  )}
                </div>
                <Text style={{
                  fontSize: token.fontSizeSM,
                  fontWeight: 600,
                  color: stage.reached ? stage.color : token.colorTextQuaternary,
                  whiteSpace: 'nowrap',
                }}>
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

        {/* Two-column layout filling remaining height */}
        <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, minHeight: isMobile ? undefined : 0 }}>

          {/* Left: tabbed card (details + log) */}
          <div style={{ flex: isMobile ? undefined : 3, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Card
              size="small"
              tabList={[
                { key: 'details',     label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{isMobile ? 'Details' : 'Event Details'}</span> },
                { key: 'log',         label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{isMobile ? 'Logs' : 'Activity Log'}</span> },
                { key: 'attachments', label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}><PaperClipOutlined style={{ marginRight: 4 }} />Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}</span> },
                ...(isMobile ? [{ key: 'photos', label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Photos</span> }] : []),
              ]}
              activeTabKey={activeTab}
              onTabChange={(key) => setActiveTab(key as 'details' | 'log' | 'photos' | 'attachments')}
              tabBarExtraContent={
                activeTab === 'details' ? (
                  !editable ? null : editingComponent ? (
                    <Space size={isMobile ? 8 : 4}>
                      <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setEditingComponent(false)}>Cancel</Button>
                      <Button type="primary" size="small" icon={<SaveFilled />} onClick={handleSaveEdits}>{!isMobile && 'Save'}</Button>
                    </Space>
                  ) : (
                    <Button type="text" size="small" icon={<EditFilled style={{ fontSize: token.fontSizeSM }} />} onClick={() => {
                      resetPartDrafts(partsState[selectedPartIdx]);
                      setEditingComponent(true);
                    }}>
                      {!isMobile && 'Edit'}
                    </Button>
                  )
                ) : activeTab === 'photos' ? (
                  !canAugment ? null : (
                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => photoInputRef.current?.click()} />
                  )
                ) : activeTab === 'attachments' ? null : null
              }
              style={isMobile ? undefined : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              styles={{ body: isMobile ? { padding: 16, display: 'flex', flexDirection: 'column' } : { flex: 1, overflow: 'auto', padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
            >
              {activeTab === 'details' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Row gutter={[16, 0]} style={{ flex: 1, minHeight: 0 }}>

                    {/* Left: all data (~3/5) */}
                    <Col xs={24} md={15} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                      {/* Upper content — scrolls independently if tall */}
                      <div style={{ overflow: 'auto', flexShrink: 1, minHeight: 0 }}>
                      {/* Submission metadata — Plant has its own inline edit affordance; the rest is read-only */}
                      <div style={{
                        display: 'flex', gap: 24, marginBottom: 14,
                        padding: '8px 12px',
                        background: token.colorFillTertiary,
                        borderRadius: token.borderRadiusSM,
                        flexWrap: 'wrap',
                      }}>
                        {([
                          { label: 'Reported By', node: <Text style={{ fontSize: token.fontSizeSM }}>{event.reportedBy}</Text> },
                          { label: 'Branch',      node: <Text style={{ fontSize: token.fontSizeSM }}>{event.branch}</Text> },
                          { label: 'Plant',       node: editingPlant ? (
                              <Space size={4}>
                                <Select
                                  autoFocus
                                  size="small"
                                  value={plantDraft}
                                  onChange={setPlantDraft}
                                  options={PLANT_OPTIONS.map(v => ({ value: v, label: v }))}
                                  style={{ width: 160 }}
                                />
                                <Button
                                  type="text" size="small" icon={<CheckOutlined style={{ fontSize: token.fontSizeSM }} />}
                                  onClick={() => {
                                    if (plantDraft !== plant) {
                                      logEditEntry('Plant', plant, plantDraft);
                                      patchEvent(event.id, { plant: plantDraft });
                                      setPlant(plantDraft);
                                    }
                                    setEditingPlant(false);
                                  }}
                                />
                                <Button
                                  type="text" size="small" icon={<CloseOutlined style={{ fontSize: token.fontSizeSM }} />}
                                  onClick={() => setEditingPlant(false)}
                                />
                              </Space>
                            ) : (
                              <Space size={6}>
                                <Text style={{ fontSize: token.fontSizeSM }}>{plant.split(' ')[0]}</Text>
                                {editable && (
                                  <Button
                                    type="text" size="small"
                                    icon={<EditFilled style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }} />}
                                    onClick={() => { setPlantDraft(plant); setEditingPlant(true); }}
                                  />
                                )}
                              </Space>
                            ) },
                          { label: 'Date',        node: <Text style={{ fontSize: token.fontSizeSM }}>{reportedDate}</Text> },
                          ...(effectiveOrderId ? [{ label: ' ', node: (
                            <Link href={`/orders/${effectiveOrderId}`} style={{ fontSize: token.fontSizeSM, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              View Order <ArrowRightOutlined style={{ fontSize: token.fontSizeXS }} />
                            </Link>
                          ) }] : []),
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

                      {sectionLabel('Component Issue')}
                      {editingComponent && editable ? (
                        <Form
                          form={editForm}
                          layout="vertical"
                          size="small"
                          initialValues={{
                            issue:            currentIssue,
                            door:             currentDoor,
                            jobNo:            currentJobNo,
                            dfo:              String(currentDfo),
                            elLine:           currentElLine != null ? String(currentElLine) : '',
                            component:        currentComponent,
                            issueDescription: currentIssueDescription,
                          }}
                        >
                          <Row gutter={8}>
                            <Col flex={2}>
                              <Form.Item name="issue" label="Issue" style={{ marginBottom: 10 }}>
                                <Select options={ISSUE_OPTIONS.map(v => ({ value: v, label: v }))} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col flex={1}>
                              <Form.Item name="door" label="Door" style={{ marginBottom: 10 }}>
                                <Select options={DOOR_OPTIONS.map(v => ({ value: v, label: v }))} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={8}>
                            <Col style={{ width: 148 }}>
                              <Form.Item name="jobNo" label="Job No" style={{ marginBottom: 10 }}>
                                <Input maxLength={11} />
                              </Form.Item>
                            </Col>
                            {isSO && (
                              <>
                                <Col style={{ width: 76 }}>
                                  <Form.Item name="dfo" label="DFO LIN" labelCol={{ style: { whiteSpace: 'nowrap' } }} style={{ marginBottom: 10 }}>
                                    <Input maxLength={2} />
                                  </Form.Item>
                                </Col>
                                <Col style={{ width: 76 }}>
                                  <Form.Item name="elLine" label="EL LIN" labelCol={{ style: { whiteSpace: 'nowrap' } }} style={{ marginBottom: 10 }}>
                                    <Input maxLength={2} />
                                  </Form.Item>
                                </Col>
                              </>
                            )}
                            <Col flex={1}>
                              <Form.Item name="component" label="Component" style={{ marginBottom: 10 }}>
                                <Select options={COMPONENT_OPTIONS.map(v => ({ value: v, label: v }))} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item name="issueDescription" label="Issue Description" style={{ marginBottom: 0 }}>
                            <Input.TextArea rows={4} />
                          </Form.Item>
                        </Form>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                          {displayField('Issue', currentIssue, true)}
                          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            {displayField('Job No', currentJobNo, false, true)}
                            {isSO && currentElLine != null && (
                              <>
                                <Text style={{ color: token.colorTextTertiary, paddingBottom: 3 }}>·</Text>
                                {displayField('EL LIN', currentElLine, false, true)}
                              </>
                            )}
                            {isSO && (
                              <>
                                <Text style={{ color: token.colorTextTertiary, paddingBottom: 3 }}>|</Text>
                                {displayField('DFO LIN', currentDfo, false, true)}
                              </>
                            )}
                          </div>
                          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            {displayField('Component', currentComponent)}
                            {displayField('Door', currentDoor)}
                          </div>
                          {displayField('Issue Description', currentIssueDescription, true)}
                        </div>
                      )}

                      </div>{/* end upper scrollable content */}

                      {/* Parts Request + Hardware Kit */}
                      <Divider style={{ margin: '16px 0 12px' }} />
                      <Row gutter={[16, 12]} style={{ flex: 1, alignItems: 'stretch', minHeight: 0 }}>
                        <Col xs={24} sm={12} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600, color: token.colorText, display: 'block', marginBottom: 10 }}>
                            Parts Request
                          </Text>
                          {partsState.length > 0 ? (
                            <>
                              {partsState.length > 1 && (
                                <div style={{ marginBottom: 10 }}>
                                  <Select
                                    size="small"
                                    value={selectedPartIdx}
                                    onChange={idx => {
                                      setSelectedPartIdx(idx);
                                      resetPartDrafts(partsState[idx]);
                                    }}
                                    options={partsState.map((_, i) => ({ value: i, label: `Part ${i + 1}` }))}
                                    style={{ width: 120 }}
                                  />
                                </div>
                              )}
                              {editingComponent && editable ? (
                                <Form layout="vertical" size="small">
                                  <Row gutter={8}>
                                    <Col flex={1}>
                                      <Form.Item label="Part #" style={{ marginBottom: 10 }}>
                                        <Select
                                          showSearch
                                          value={editPartNumber || partsState[selectedPartIdx].partNumber}
                                          options={PART_CATALOG.map(p => ({ value: p.partNumber, label: p.partNumber }))}
                                          onChange={v => {
                                            setEditPartNumber(v);
                                            const match = PART_CATALOG.find(p => p.partNumber === v);
                                            if (match) setEditPartDescription(match.partDescription);
                                          }}
                                          style={{ width: '100%' }}
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col flex={2}>
                                      <Form.Item label="Part Description" style={{ marginBottom: 10 }}>
                                        <Select
                                          showSearch
                                          value={editPartDescription || partsState[selectedPartIdx].description}
                                          options={PART_CATALOG.map(p => ({ value: p.partDescription, label: p.partDescription }))}
                                          onChange={v => {
                                            setEditPartDescription(v);
                                            const match = PART_CATALOG.find(p => p.partDescription === v);
                                            if (match) setEditPartNumber(match.partNumber);
                                          }}
                                          style={{ width: '100%' }}
                                        />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                  <Row gutter={8}>
                                    <Col flex={1}>
                                      <Form.Item label="Quantity Type" style={{ marginBottom: 0 }}>
                                        <Select
                                          value={editPartQuantityType || partsState[selectedPartIdx].quantityType}
                                          onChange={setEditPartQuantityType}
                                          options={['Piece', 'Length'].map(v => ({ value: v, label: v }))}
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col style={{ width: 72 }}>
                                      <Form.Item label="Qty" style={{ marginBottom: 0 }}>
                                        <Input
                                          value={editPartQuantity || String(partsState[selectedPartIdx].quantity)}
                                          onChange={e => setEditPartQuantity(e.target.value)}
                                        />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </Form>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                  {displayField('Part #', partsState[selectedPartIdx].partNumber, false, true)}
                                  {displayField('Parts Description', partsState[selectedPartIdx].description)}
                                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    {displayField('Quantity Type', partsState[selectedPartIdx].quantityType)}
                                    {displayField('Qty', partsState[selectedPartIdx].quantity)}
                                  </div>
                                </div>
                              )}
                              {editable && (
                                <div style={{ marginTop: 12 }}>
                                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={openAddPartRequest}>
                                    Add Parts Request
                                  </Button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{
                              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                              justifyContent: 'center', gap: 8, padding: '20px 12px',
                              background: token.colorFillQuaternary, borderRadius: token.borderRadius,
                              textAlign: 'center',
                            }}>
                              <FileAddFilled style={{ fontSize: token.fontSizeXL, color: token.colorTextTertiary }} />
                              <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.5 }}>
                                No parts request filed for this event.
                              </Text>
                              {editable && (
                                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={openAddPartRequest}>
                                  Add Parts Request
                                </Button>
                              )}
                            </div>
                          )}
                        </Col>

                        {currentComponent === 'Hardware Kit' && (
                        <Col xs={24} sm={12} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          {sectionLabel('Hardware Kit')}
                          {hkMode === null ? (
                            <div style={{
                              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                              justifyContent: 'center', gap: 8, padding: '20px 12px',
                              background: token.colorFillQuaternary, borderRadius: token.borderRadius,
                              textAlign: 'center',
                            }}>
                              <ToolFilled style={{ fontSize: token.fontSizeXL, color: token.colorTextTertiary }} />
                              <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.5 }}>
                                No hardware kit on file for this event.
                              </Text>
                              {editable && (
                                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={openAddPartRequest}>
                                  Add Hardware Kit
                                </Button>
                              )}
                            </div>
                          ) : editingComponent && editable ? (
                            <Form layout="vertical" size="small">
                              <Form.Item label="Hardware Kit Information" style={{ marginBottom: 10 }}>
                                <Select
                                  value={hkMode}
                                  onChange={(v: 'entire' | 'components') => setHkMode(v)}
                                  options={[
                                    { value: 'entire', label: 'Entire Hardware Kit' },
                                    { value: 'components', label: 'Components within Hardware Kit' },
                                  ]}
                                />
                              </Form.Item>
                              {hkMode === 'entire' ? (
                                <Form.Item label="Serial #" style={{ marginBottom: 0 }}>
                                  <Input defaultValue={event.hardwareKit?.serialNumber} />
                                </Form.Item>
                              ) : (
                                <>
                                  {hkComponents.map((comp, i) => (
                                    <div key={i} style={{ marginBottom: 8 }}>
                                      <Row gutter={6} align="middle">
                                        <Col flex={1}>
                                          <Form.Item label="Part #" style={{ marginBottom: 0 }}>
                                            <Input
                                              value={comp.partNumber}
                                              onChange={e => setHkComponents(prev => prev.map((c, j) => j === i ? { ...c, partNumber: e.target.value } : c))}
                                            />
                                          </Form.Item>
                                        </Col>
                                        <Col flex={2}>
                                          <Form.Item label="Description" style={{ marginBottom: 0 }}>
                                            <Input
                                              value={comp.description}
                                              onChange={e => setHkComponents(prev => prev.map((c, j) => j === i ? { ...c, description: e.target.value } : c))}
                                            />
                                          </Form.Item>
                                        </Col>
                                        {hkComponents.length > 1 && (
                                          <Col style={{ paddingTop: 22 }}>
                                            <Button
                                              type="text" size="small" icon={<CloseOutlined />}
                                              onClick={() => setHkComponents(prev => prev.filter((_, j) => j !== i))}
                                            />
                                          </Col>
                                        )}
                                      </Row>
                                    </div>
                                  ))}
                                  <Button
                                    size="small" type="dashed" block icon={<PlusOutlined />}
                                    style={{ marginTop: 4 }}
                                    onClick={() => setHkComponents(prev => [...prev, { partNumber: '', description: '' }])}
                                  >
                                    Add Part
                                  </Button>
                                </>
                              )}
                            </Form>
                          ) : hkMode === 'entire' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {displayField('Hardware Kit Information', 'Entire Hardware Kit')}
                              {displayField('Serial #', event.hardwareKit?.serialNumber, false, true)}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {displayField('Hardware Kit Information', 'Components within Hardware Kit')}
                              {hkComponents.map((comp, i) => (
                                <div key={i} style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                  {displayField(`Part ${i + 1} #`, comp.partNumber || null)}
                                  {displayField('Description', comp.description || null)}
                                </div>
                              ))}
                            </div>
                          )}
                        </Col>
                        )}
                      </Row>
                    </Col>

                    {/* Right: photos — desktop only (mobile uses Photos tab) */}
                    {!isMobile && <Col xs={24} md={9} style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        flex: 1,
                        minHeight: 140,
                        background: token.colorFillTertiary,
                        border: `1px dashed ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadiusSM,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        marginBottom: 8,
                      }} onClick={() => setExpandedImg(0)}>
                        <PictureFilled style={{ fontSize: token.fontSizeHeading3, color: token.colorTextQuaternary }} />
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No photos attached</Text>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Click to expand</Text>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        {[1, 2, 3].map(i => (
                          <div key={i} onClick={() => setExpandedImg(i)} style={{
                            flex: 1, aspectRatio: '1',
                            background: token.colorFillTertiary,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: token.borderRadiusSM,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}>
                            <PictureFilled style={{ fontSize: token.fontSize, color: token.colorTextQuaternary }} />
                          </div>
                        ))}
                      </div>
                      {canAugment && (
                        <Button
                          size="small"
                          type="text"
                          icon={<PlusOutlined style={{ fontSize: token.fontSizeSM }} />}
                          style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          Upload Photo
                        </Button>
                      )}
                    </Col>}

                  </Row>
                </div>
              )}

              {activeTab === 'photos' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {photosContent}
                </div>
              )}

              {activeTab === 'attachments' && (() => {
                const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
                const fileIcon = (name: string) => {
                  const ext = name.split('.').pop()?.toLowerCase();
                  if (ext === 'pdf') return <FilePdfOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />;
                  if (['xlsx', 'xls', 'csv'].includes(ext ?? '')) return <FileExcelOutlined style={{ fontSize: 20, color: '#52c41a' }} />;
                  if (['doc', 'docx'].includes(ext ?? '')) return <FileWordOutlined style={{ fontSize: 20, color: '#1677ff' }} />;
                  if (['eml', 'msg'].includes(ext ?? '')) return <MessageFilled style={{ fontSize: 20, color: '#1677ff' }} />;
                  return <FileOutlined style={{ fontSize: 20, color: token.colorTextTertiary }} />;
                };
                return (
                  <>
                  <Modal
                    open={previewFile !== null}
                    onCancel={() => setPreviewFile(null)}
                    footer={null}
                    title={<Text style={{ fontSize: token.fontSizeSM, fontWeight: 500 }} ellipsis={{ tooltip: previewFile?.name }}>{previewFile?.name}</Text>}
                    width="80vw"
                    styles={{ body: { padding: 0, overflow: 'hidden', borderRadius: token.borderRadiusSM } }}
                    destroyOnHidden
                  >
                    {(() => {
                      if (!previewFile) return null;
                      const ext = previewFile.name.split('.').pop()?.toLowerCase() ?? '';
                      const isImage = ['png','jpg','jpeg'].includes(ext);
                      const isEmbeddable = ['pdf','txt','csv'].includes(ext);
                      // Runtime blob preview; next/image offers no benefit for object URLs.
                      if (isImage) return (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewFile.blobUrl} alt={previewFile.name} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
                        </>
                      );
                      if (isEmbeddable) return (
                        <iframe src={previewFile.blobUrl} style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }} title={previewFile.name} />
                      );
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 24px' }}>
                          <FileOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />
                          <Text style={{ color: token.colorTextSecondary }}>Preview not available for this file type.</Text>
                          <a href={previewFile.blobUrl} download={previewFile.name}>
                            <Button type="primary">Download</Button>
                          </a>
                        </div>
                      );
                    })()}
                  </Modal>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {canAugment && (
                      <Upload.Dragger
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.eml,.msg"
                        showUploadList={false}
                        beforeUpload={(file) => {
                          const blobUrl = URL.createObjectURL(file);
                          const att = { uid: `att_${Date.now()}_${file.name}`, name: file.name, size: file.size, date: nowTs(), blobUrl };
                          setAttachments(prev => [...prev, att]);
                          addToActivityLog(`Attachment added: ${file.name}`);
                          return false;
                        }}
                        style={{ borderRadius: token.borderRadiusSM }}
                      >
                        <p style={{ margin: 0, paddingBottom: 4 }}><InboxOutlined style={{ fontSize: 24, color: token.colorPrimary }} /></p>
                        <p style={{ margin: 0, fontSize: token.fontSizeSM, color: token.colorText }}>Drag files here or <span style={{ color: token.colorPrimary }}>click to upload</span></p>
                        <p style={{ margin: '4px 0 0', fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>
                          PDF · Excel · CSV · Images
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: token.fontSizeXS, color: token.colorTextQuaternary }}>
                          Email chains: .eml (standard) or .msg (Outlook)
                        </p>
                      </Upload.Dragger>
                    )}
                    {attachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {attachments.map(att => (
                          <div key={att.uid} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px',
                            background: token.colorFillQuaternary,
                            borderRadius: token.borderRadiusSM,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            cursor: 'pointer',
                          }}
                            onClick={() => setPreviewFile({ name: att.name, blobUrl: att.blobUrl })}
                          >
                            {fileIcon(att.name)}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: token.fontSizeSM, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: token.colorPrimary }}>{att.name}</Text>
                              <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>{fmtSize(att.size)} · {att.date}</Text>
                            </div>
                            {editable && (
                              <Button
                                type="text" size="small" icon={<DeleteOutlined />}
                                style={{ color: token.colorTextTertiary, flexShrink: 0 }}
                                onClick={(e) => { e.stopPropagation(); setAttachments(prev => prev.filter(a => a.uid !== att.uid)); }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </>
                );
              })()}

              {activeTab === 'log' && (
                <>
                  {isMobile ? (
                    <div>
                      {activityLog.length === 0 && (
                        <Text type="secondary" style={{ display: 'block', padding: '16px 0', textAlign: 'center', fontSize: token.fontSizeSM }}>
                          No activity logged for this event yet.
                        </Text>
                      )}
                      {[...activityLog].reverse().map((entry: ActivityLog) => (
                        <div key={entry.id} style={{
                          padding: '10px 12px',
                          marginBottom: 8,
                          background: token.colorFillQuaternary,
                          borderRadius: token.borderRadiusSM,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <StatusTag status={entry.status} />
                              <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>{entry.date}</Text>
                            </div>
                          </div>
                          <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, display: 'block', marginBottom: 4 }}>
                            {entry.employee} · {entry.role}
                          </Text>
                          <Text style={{ fontSize: token.fontSizeSM }}>{entry.comment}</Text>
                          {(entry.editFrom != null || entry.editTo != null) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, textDecoration: 'line-through' }}>{entry.editFrom}</Text>
                              <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>→</Text>
                              <Text style={{ fontSize: token.fontSizeSM }}>{entry.editTo}</Text>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Table
                      dataSource={[...activityLog].reverse()}
                      columns={logColumns}
                      rowKey="id"
                      size="small"
                      locale={{ emptyText: 'No activity logged for this event yet.' }}
                      scroll={{ x: 560 }}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '25', '50'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                      }}
                    />
                  )}

                </>
              )}
            </Card>
          </div>

          {/* Right: messages + assessment stacked — desktop only */}
          {!isMobile && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
              <Card
                size="small"
                title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Messages</span>}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                styles={{ body: { flex: 1, overflow: 'auto', padding: 16, minHeight: 0 } }}
              >
                {messagesContent}
              </Card>
              <Card
                size="small"
                title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Assessment</span>}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                styles={{ body: { flex: 1, overflow: 'auto', padding: 16, minHeight: 0 } }}
              >
                {analysisContent}
              </Card>
            </div>
          )}
        </div>

      </div>

      {/* Mobile: sticky Analysis bar + bottom-sheet Drawer */}
      {isMobile && (
        <>
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            padding: '10px 16px',
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            zIndex: 100,
          }}>
            <Button
              block
              type="primary"
              icon={<StarFilled />}
              onClick={() => setAnalysisDrawerOpen(true)}
            >
              Assessment
            </Button>
          </div>
          <Drawer
            placement="bottom"
            open={analysisDrawerOpen}
            onClose={() => setAnalysisDrawerOpen(false)}
            closable
            title={
              <div
                style={{ userSelect: 'none' }}
                onTouchStart={(e) => { dragStartY.current = e.touches[0].clientY; }}
                onTouchEnd={(e) => {
                  if (e.changedTouches[0].clientY - dragStartY.current > 60) setAnalysisDrawerOpen(false);
                }}
              >
                Assessment
              </div>
            }
            styles={{
              wrapper: { borderRadius: '12px 12px 0 0', overflow: 'hidden' },
              body: { padding: 16, overflowY: 'auto', maxHeight: '75vh' },
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, marginTop: -4, cursor: 'grab' }}
              onTouchStart={(e) => { dragStartY.current = e.touches[0].clientY; }}
              onTouchEnd={(e) => {
                if (e.changedTouches[0].clientY - dragStartY.current > 60) setAnalysisDrawerOpen(false);
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: token.colorFill }} />
            </div>
            <Segmented
              block
              size="small"
              value={analysisTab}
              onChange={v => setAnalysisTab(v as 'analysis' | 'messages')}
              options={[
                { label: 'Messages', value: 'messages' },
                { label: 'Assessment', value: 'analysis' },
              ]}
              style={{ marginBottom: 12 }}
            />
            {analysisTab === 'analysis' ? analysisContent : messagesContent}
          </Drawer>
        </>
      )}

      {/* VALIDATE MODAL */}
      <Modal
        title={validateSuccess ? null : 'Validate Event'}
        open={validateOpen}
        onCancel={() => { setValidateOpen(false); setValidateNote(''); setValidateSuccess(false); }}
        footer={validateSuccess ? null : undefined}
        onOk={() => {
          setStatus('Validated');
          patchEvent(event.id, { status: 'Validated' });
          addToActivityLog(validateNote.trim() ? `Event validated. Note: ${validateNote}` : 'Event validated.', 'Validated');
          setValidateSuccess(true);
        }}
        okText="Validate & Notify"
        okButtonProps={{ type: 'primary' }}
      >
        {validateSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Event Validated</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {event.id} has been validated. Customer Service and field tech {event.reportedBy} have been notified to proceed with fulfillment.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                icon={<ExclamationCircleFilled />}
                onClick={() => {
                  setValidateOpen(false); setValidateNote(''); setValidateSuccess(false);
                  setCreateEscOpen(true);
                }}
              >
                Escalate
              </Button>
              <Button type="primary" onClick={() => { setValidateOpen(false); setValidateNote(''); setValidateSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              Validating this event will mark it as confirmed and send notifications to Customer Service and field tech <strong>{event.reportedBy}</strong> to proceed with parts fulfillment.
            </Text>
            <Input.TextArea
              value={validateNote}
              onChange={e => setValidateNote(e.target.value)}
              placeholder="Add a validation note (optional)..."
              rows={3}
              autoFocus
            />
          </>
        )}
      </Modal>

      {/* INVALIDATE MODAL */}
      <Modal
        title={invalidateSuccess ? null : 'Invalidate Event'}
        open={invalidateOpen}
        onCancel={() => { setInvalidateOpen(false); setInvalidateNote(''); setInvalidateSuccess(false); }}
        footer={invalidateSuccess ? null : undefined}
        onOk={() => {
          setStatus('Invalidated');
          patchEvent(event.id, { status: 'Invalidated' });
          addToActivityLog(invalidateNote.trim() ? `Event invalidated. Reason: ${invalidateNote}` : 'Event invalidated.', 'Invalidated');
          setInvalidateSuccess(true);
        }}
        okText="Invalidate & Notify"
        okButtonProps={{ danger: true }}
      >
        {invalidateSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CloseCircleFilled style={{ color: token.colorTextSecondary, fontSize: token.fontSize }} />
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Event Invalidated</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {event.id} has been marked as invalid. Customer Service and field tech {event.reportedBy} have been notified that no further action is required.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setInvalidateOpen(false); setInvalidateNote(''); setInvalidateSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 12, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              Invalidating this event will close the investigation and send notifications to Customer Service and field tech <strong>{event.reportedBy}</strong> that no further action is required.
            </Text>
            <Input.TextArea
              value={invalidateNote}
              onChange={e => setInvalidateNote(e.target.value)}
              placeholder="Add an invalidation note (optional)..."
              rows={3}
              autoFocus
            />
          </>
        )}
      </Modal>

      {/* START INVESTIGATION MODAL */}
      <Modal
        title={startInvSuccess ? null : 'Start Investigation'}
        open={startInvOpen}
        onCancel={() => { setStartInvOpen(false); setStartInvNote(''); setStartInvReqInfo(true); setStartInvSuccess(false); }}
        footer={startInvSuccess ? null : undefined}
        onOk={() => {
          setStatus('Under Investigation');
          patchEvent(event.id, { status: 'Under Investigation' });
          addToActivityLog('Investigation started.', 'Under Investigation');
          if (startInvReqInfo) {
            thread.sendInfoRequest(startInvNote, thread.infoThreads.length ? 'new' : 'initial', 'Under Investigation');
          }
          setStartInvSuccess(true);
        }}
        okText="Start Investigation"
        okButtonProps={{ type: 'primary', disabled: startInvReqInfo && !startInvNote.trim() }}
      >
        {startInvSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Investigation Started</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {event.id} is now Under Investigation.{startInvReqInfo && ` Field tech ${event.reportedBy} has been notified and asked to provide additional information.`}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setStartInvOpen(false); setStartInvNote(''); setStartInvReqInfo(true); setStartInvSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Text style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize, color: token.colorTextSecondary }}>
              This will move the event to <strong>Under Investigation</strong> status.
            </Text>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px',
              background: token.colorFillTertiary,
              borderRadius: token.borderRadiusSM,
              marginBottom: startInvReqInfo ? 12 : 0,
            }}>
              <Text style={{ fontSize: token.fontSize }}>Request additional information from field tech</Text>
              <Switch checked={startInvReqInfo} onChange={setStartInvReqInfo} />
            </div>
            {startInvReqInfo && (
              <Input.TextArea
                value={startInvNote}
                onChange={e => setStartInvNote(e.target.value)}
                placeholder="Describe what additional information is needed (required)..."
                rows={3}
                autoFocus
              />
            )}
          </>
        )}
      </Modal>

      {/* REOPEN EVENT MODAL */}
      <Modal
        title={reopenEvtSuccess ? null : 'Reopen Event'}
        open={reopenEvtOpen}
        onCancel={() => { setReopenEvtOpen(false); setReopenEvtSuccess(false); }}
        footer={reopenEvtSuccess ? null : undefined}
        onOk={() => {
          setStatus(reopenTarget);
          patchEvent(event.id, { status: reopenTarget });
          addToActivityLog(`Event reopened to ${reopenTarget} status.`, reopenTarget);
          setReopenEvtSuccess(true);
        }}
        okText="Reopen Event"
      >
        {reopenEvtSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
              <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Event Reopened</Text>
            </div>
            <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {event.id} has been returned to {reopenTarget} status.
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={() => { setReopenEvtOpen(false); setReopenEvtSuccess(false); }}>Done</Button>
            </div>
          </div>
        ) : (
          <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
            This will reopen the event and return it to <strong>{reopenTarget}</strong> status.
          </Text>
        )}
      </Modal>

      {/* ESCALATION CONFIRM MODAL */}
      <Modal
        title="Link Escalation"
        open={escConfirmOpen}
        onCancel={() => { setEscConfirmOpen(false); setPendingEscalation(null); }}
        onOk={() => {
          if (pendingEscalation) {
            const target = effectiveEscalations.find(e => e.id === pendingEscalation);
            linkEventToEscalation(pendingEscalation, event.id, target?.eventIds ?? []);
          }
          setEscalation(pendingEscalation);
          patchEvent(event.id, { escalation: pendingEscalation });
          addToActivityLog(`Linked to escalation: ${pendingEscalation}.`);
          setEscConfirmOpen(false);
          setPendingEscalation(null);
        }}
        okText="Confirm"
        okButtonProps={{ type: 'primary' }}
      >
        <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
          Link escalation <strong>{pendingEscalation}</strong> to this event?
        </Text>
      </Modal>

      {/* ADD PART REQUEST MODAL */}
      <Modal
        title="Add Part Request"
        open={partModalOpen}
        onCancel={() => { setPartModalOpen(false); partForm.resetFields(); }}
        onOk={handleSavePartRequest}
        okText="Add Part"
        width={540}
      >
        <Form form={partForm} layout="vertical" size="small" style={{ marginTop: 8 }}>
          <Row gutter={8}>
            <Col style={{ width: 148 }}>
              <Form.Item label="Job No." name="jobNo" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
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
          </Row>
          <Form.Item label="Door Type" name="door" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
            <Select
              showSearch
              optionFilterProp="label"
              options={DOOR_OPTIONS.map(v => ({ value: v, label: v }))}
            />
          </Form.Item>
          <Row gutter={8}>
            <Col flex={1}>
              <Form.Item label="Part #" name="partNumber" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={PART_CATALOG.map(p => ({ value: p.partNumber, label: p.partNumber }))}
                  onChange={(v: string) => {
                    const m = PART_CATALOG.find(p => p.partNumber === v);
                    if (m) partForm.setFieldValue('partDescription', m.partDescription);
                  }}
                />
              </Form.Item>
            </Col>
            <Col flex={1}>
              <Form.Item label="Part Description" name="partDescription" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={PART_CATALOG.map(p => ({ value: p.partDescription, label: p.partDescription }))}
                  onChange={(v: string) => {
                    const m = PART_CATALOG.find(p => p.partDescription === v);
                    if (m) partForm.setFieldValue('partNumber', m.partNumber);
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
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
              {partModalKitInfo === 'Entire Hardware Kit' && (
                <Col flex={1}>
                  <Form.Item label="Serial #" name="serialNumber" style={{ marginBottom: 10 }}>
                    <Input placeholder="Enter serial number" />
                  </Form.Item>
                </Col>
              )}
            </Row>
          )}
          <Form.Item label="Quantity Type" name="quantityType" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
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
                  value={partModalQty}
                  onChange={(v) => partForm.setFieldValue('quantity', v)}
                  marks={{ 1: '1', 25: '25', 50: '50', 75: '75', 100: '100' }}
                />
              </div>
              <InputNumber
                min={1}
                max={100}
                value={partModalQty}
                onChange={(v) => partForm.setFieldValue('quantity', v ?? 1)}
                style={{ width: 68 }}
              />
            </div>
            <Form.Item name="quantity" noStyle rules={[{ required: true }]}>
              <Input type="hidden" />
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>

      {/* IMAGE EXPAND MODAL */}
      <Modal
        open={expandedImg !== null}
        onCancel={() => setExpandedImg(null)}
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

    </div>
  );
}
