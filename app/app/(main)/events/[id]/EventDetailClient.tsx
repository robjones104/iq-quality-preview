'use client';

import { useState, useRef, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button, Card, Col, Divider, Form, Input, Modal, Row, Select, Space,
  Table, Typography, notification, theme,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, EditFilled, ExclamationCircleFilled,
  FileAddFilled, MessageFilled, MoreOutlined, PictureFilled, PlusOutlined,
  RollbackOutlined, SaveFilled, SearchOutlined, StarFilled, StopFilled, ToolFilled,
} from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import type { ColumnsType } from 'antd/es/table';
import { StatusTag, STATUS_COLORS } from '@/components/StatusTag';
import { PageHeader } from '@/components/PageHeader';
import { logs } from '@/data/logs';
import { events as allEvents } from '@/data/events';
import { ESCALATION_TYPE_OPTIONS } from '@/data/manageLists';
import { CreateEscalationModal } from '@/components/CreateEscalationModal';
import type { QualityEvent, EventStatus, RootCause, ActivityLog, EditHistoryEntry } from '@/data/types';
const { Text, Paragraph } = Typography;

const ROOT_CAUSE_OPTIONS = [
  'Ordering Error', 'Wrong Order From Branch', 'Sales Order Error',
  'Installation Error', 'Factory Issue', 'Configuration Problem',
  'Training Issue', 'Supplier Issue', 'Engineering Issue', 'Short Shipping',
].map(v => ({ value: v, label: v }));

const ESCALATION_OPTIONS = ESCALATION_TYPE_OPTIONS;

const STATUS_STEP: Record<EventStatus, number> = {
  Reported:              0,
  'Under Investigation': 1,
  Validated:             2,
  Invalidated:           2,
};

function generateInsights(event: QualityEvent, rootCause: string | null): string {
  const age = Math.max(0, Math.round((Date.now() - new Date(event.date).getTime()) / 86400000));
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
  return `${event.discrepancy} reported for ${event.product} (${event.door}) at the ${event.branch} branch. ${rc} ${parts} ${urgency} Recommended action: ${action}`;
}

function generateHistoricalInsights(event: QualityEvent, pool: QualityEvent[]): string {
  const similar = pool.filter(e =>
    e.id !== event.id &&
    (e.discrepancy === event.discrepancy || e.product === event.product || e.branch === event.branch)
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

  return `${count} similar events found matching this discrepancy, product, or branch. ${rcLine}${rateLine}${invLine}Use the similar events table to identify recurring patterns or suppliers.`;
}


export default function EventDetailClient({ event }: { event: QualityEvent }) {
  const [status, setStatus]                   = useState<EventStatus>(event.status);
  const [editingProduct, setEditingProduct]   = useState(false);
  const [selectedPartIdx, setSelectedPartIdx] = useState(0);
  const [rootCause, setRootCause]             = useState<string | null>(event.rootCause);
  const [rootCauseOptions, setRootCauseOptions] = useState(ROOT_CAUSE_OPTIONS);
  const [rcSearch, setRcSearch]               = useState('');
  const [escalation, setEscalation]           = useState<string | null>(null);
  const [createEscOpen, setCreateEscOpen]     = useState(false);
  const [tags, setTags]                       = useState<string[]>([]);
  const [insights, setInsights]               = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [historical, setHistorical]           = useState<string | null>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [insightsStep, setInsightsStep]       = useState<null | 'summary' | 'historical'>(null);
  const [activeTab, setActiveTab]             = useState<'details' | 'log'>('details');
  const [addingLog, setAddingLog]             = useState(false);
  const [newLogComment, setNewLogComment]     = useState('');
  const [validateOpen, setValidateOpen]       = useState(false);
  const [invalidateOpen, setInvalidateOpen]   = useState(false);
  const [editHistory, setEditHistory]         = useState<EditHistoryEntry[]>(event.editHistory ?? []);
  const [editForm]                            = Form.useForm();
  const lastLoggedRootCause                   = useRef<string | null>(event.rootCause);
  const { token } = theme.useToken();
  const router = useRouter();

  const logEditEntry = (field: string, from: string | null, to: string | null) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setEditHistory(prev => [...prev, {
      id: `eh_${Date.now()}_${field}`,
      timestamp,
      editedBy: 'Current User',
      role: 'Field Quality',
      field,
      from,
      to,
    }]);
  };

  const handleSaveEdits = () => {
    const values = editForm.getFieldsValue();
    const tracked: Array<[string, string, keyof typeof values]> = [
      ['Discrepancy',       event.discrepancy,       'discrepancy'],
      ['Product',           event.product,            'product'],
      ['Door',              event.door,               'door'],
      ['Job No.',           event.jobNo,              'jobNo'],
      ['Issue Description', event.issueDescription,   'issueDescription'],
    ];
    for (const [label, original, key] of tracked) {
      const next = String(values[key] ?? '');
      if (next && next !== String(original)) {
        logEditEntry(label, String(original), next);
      }
    }
    setEditingProduct(false);
  };

  const [hkMode, setHkMode] = useState<'entire' | 'components' | null>(() =>
    event.hardwareKit ? (event.hardwareKit.kitInfo === 'Entire Hardware Kit' ? 'entire' : 'components') : null
  );
  const [hkComponents, setHkComponents] = useState<Array<{ partNumber: string; description: string }>>(
    [{ partNumber: '', description: '' }]
  );

  const eventLogs    = logs.filter(l => l.eventId === event.id);
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
      setInsights(generateInsights(event, rootCause));
      setLoadingInsights(false);
      setInsightsStep('summary');
    }, 900);
  };

  const handleGenerateHistorical = () => {
    setLoadingHistorical(true);
    setTimeout(() => {
      setHistorical(generateHistoricalInsights(event, allEvents));
      setLoadingHistorical(false);
      setInsightsStep('historical');
    }, 1100);
  };

  const handleViewSimilarEvents = () => {
    router.push(`/events?discrepancy=${encodeURIComponent(event.discrepancy)}&backTo=${event.id}`);
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
    { title: 'Comment',  dataIndex: 'comment',  key: 'comment',              render: (c: string)      => <Text style={{ fontSize: token.fontSizeSM }}>{c}</Text> },
    { title: '',         key: 'options', width: 64, render: () => <Button type="text" size="small" icon={<MoreOutlined />} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CreateEscalationModal
        open={createEscOpen}
        onCancel={() => setCreateEscOpen(false)}
        onSuccess={() => { setCreateEscOpen(false); setEscalation('Custom'); }}
        eventIds={[event.id]}
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
          <Space>
            {status === 'Reported' && (
              <Button icon={<SearchOutlined />} onClick={() => setStatus('Under Investigation')}>
                Start Investigation
              </Button>
            )}
            {status === 'Under Investigation' && (
              <Button type="text" icon={<RollbackOutlined />} onClick={() => setStatus('Reported')}>
                Reopen
              </Button>
            )}
            {(status === 'Validated' || status === 'Invalidated') && (
              <Button type="text" icon={<RollbackOutlined />} onClick={() => setStatus('Reported')}>
                Reopen
              </Button>
            )}
            {status === 'Validated' && (
              <Button icon={<ExclamationCircleFilled />} onClick={() => router.push('/escalations/new')}>
                Escalate
              </Button>
            )}
            <Divider type="vertical" style={{ margin: '0 4px' }} />
            <Button
              icon={<StopFilled />}
              disabled={status === 'Invalidated'}
              onClick={() => setInvalidateOpen(true)}
            >
              Invalidate
            </Button>
            <Button
              icon={<CheckOutlined />}
              type="primary"
              disabled={status === 'Validated'}
              onClick={() => setValidateOpen(true)}
            >
              Validate
            </Button>
          </Space>
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 20px 16px', minHeight: 0 }}>

        {/* Status strip */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0 12px', maxWidth: 560, flexShrink: 0 }}>
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
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>

          {/* Left: tabbed card (details + log) */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Card
              size="small"
              tabList={[
                { key: 'details', label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Event Details</span> },
                { key: 'log',     label: <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Activity Log</span> },
              ]}
              activeTabKey={activeTab}
              onTabChange={(key) => setActiveTab(key as 'details' | 'log')}
              tabBarExtraContent={
                activeTab === 'details' ? (
                  editingProduct ? (
                    <Space size={4}>
                      <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setEditingProduct(false)}>Cancel</Button>
                      <Button size="small" icon={<SaveFilled />} onClick={handleSaveEdits}>Save</Button>
                    </Space>
                  ) : (
                    <Button type="text" size="small" icon={<EditFilled style={{ fontSize: token.fontSizeSM }} />} onClick={() => setEditingProduct(true)}>
                      Edit
                    </Button>
                  )
                ) : (
                  <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setAddingLog(v => !v)}>
                    Add Log
                  </Button>
                )
              }
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              styles={{ body: { flex: 1, overflow: 'auto', padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
            >
              {activeTab === 'details' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Row gutter={[16, 0]} style={{ flex: 1, minHeight: 0 }}>

                    {/* Left: all data (~3/5) */}
                    <Col xs={24} md={15} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                      {/* Upper content — scrolls independently if tall */}
                      <div style={{ overflow: 'auto', flexShrink: 1, minHeight: 0 }}>
                      {/* Submission metadata — always read-only */}
                      <div style={{
                        display: 'flex', gap: 24, marginBottom: 14,
                        padding: '8px 12px',
                        background: token.colorFillTertiary,
                        borderRadius: token.borderRadiusSM,
                        flexWrap: 'wrap',
                      }}>
                        {[
                          { label: 'Reported By', value: event.reportedBy },
                          { label: 'Branch',      value: event.branch },
                          { label: 'Plant',       value: event.plant.split(' ')[0] },
                          { label: 'Date',        value: reportedDate },
                        ].map(({ label, value }, i, arr) => (
                          <Fragment key={label}>
                            <div>
                              <Text style={{ display: 'block', fontSize: token.fontSizeXS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: token.colorTextTertiary, marginBottom: 2 }}>
                                {label}
                              </Text>
                              <Text style={{ fontSize: token.fontSizeSM }}>{value}</Text>
                            </div>
                            {i < arr.length - 1 && (
                              <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch' }} />
                            )}
                          </Fragment>
                        ))}
                      </div>

                      {sectionLabel('Product Issue')}
                      {editingProduct ? (
                        <Form
                          form={editForm}
                          layout="vertical"
                          size="small"
                          initialValues={{
                            discrepancy:      event.discrepancy,
                            door:             event.door,
                            jobNo:            event.jobNo,
                            dfo:              String(event.dfo),
                            elLine:           event.elLine != null ? String(event.elLine) : '',
                            product:          event.product,
                            issueDescription: event.issueDescription,
                          }}
                        >
                          <Row gutter={8}>
                            <Col flex={2}>
                              <Form.Item name="discrepancy" label="Discrepancy" style={{ marginBottom: 10 }}>
                                <Select options={[{ value: event.discrepancy, label: event.discrepancy }]} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col flex={1}>
                              <Form.Item name="door" label="Door" style={{ marginBottom: 10 }}>
                                <Select options={[{ value: event.door, label: event.door }]} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={8}>
                            <Col style={{ width: 148 }}>
                              <Form.Item name="jobNo" label="Job No" style={{ marginBottom: 10 }}>
                                <Input maxLength={11} />
                              </Form.Item>
                            </Col>
                            {!event.jobNo.startsWith('WO') && (
                              <>
                                <Col style={{ width: 60 }}>
                                  <Form.Item name="dfo" label="DFO LIN" style={{ marginBottom: 10 }}>
                                    <Input maxLength={2} />
                                  </Form.Item>
                                </Col>
                                <Col style={{ width: 60 }}>
                                  <Form.Item name="elLine" label="EL LIN" style={{ marginBottom: 10 }}>
                                    <Input maxLength={2} />
                                  </Form.Item>
                                </Col>
                              </>
                            )}
                            <Col flex={1}>
                              <Form.Item name="product" label="Product" style={{ marginBottom: 10 }}>
                                <Select options={[{ value: event.product, label: event.product }]} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item name="issueDescription" label="Issue Description" style={{ marginBottom: 0 }}>
                            <Input.TextArea rows={4} />
                          </Form.Item>
                        </Form>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                          {displayField('Discrepancy', event.discrepancy, true)}
                          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
                            {displayField('Job No', event.jobNo, false, true)}
                            {!event.jobNo.startsWith('WO') && displayField('DFO LIN', event.dfo, false, true)}
                            {!event.jobNo.startsWith('WO') && event.elLine != null && displayField('EL LIN', event.elLine, false, true)}
                          </div>
                          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            {displayField('Product', event.product)}
                            {displayField('Door', event.door)}
                          </div>
                          {displayField('Issue Description', event.issueDescription, true)}
                        </div>
                      )}

                      </div>{/* end upper scrollable content */}

                      {/* Parts Request + Hardware Kit */}
                      <Divider style={{ margin: '16px 0 12px' }} />
                      <Row gutter={[16, 12]} style={{ flex: 1, alignItems: 'stretch', minHeight: 0 }}>
                        <Col xs={24} sm={12} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          {sectionLabel('Parts Request')}
                          {event.partsRequest && event.partsRequest.length > 0 ? (
                            <>
                              {event.partsRequest.length > 1 && (
                                <div style={{ marginBottom: 10 }}>
                                  <Select
                                    size="small"
                                    value={selectedPartIdx}
                                    onChange={setSelectedPartIdx}
                                    options={event.partsRequest.map((_, i) => ({ value: i, label: `Part ${i + 1}` }))}
                                    style={{ width: 120 }}
                                  />
                                </div>
                              )}
                              {editingProduct ? (
                                <Form layout="vertical" size="small">
                                  <Form.Item label="Part #" style={{ marginBottom: 10 }}>
                                    <Input defaultValue={event.partsRequest[selectedPartIdx].partNumber} />
                                  </Form.Item>
                                  <Form.Item label="Parts Description" style={{ marginBottom: 10 }}>
                                    <Input.TextArea defaultValue={event.partsRequest[selectedPartIdx].description} rows={2} />
                                  </Form.Item>
                                  <Row gutter={8}>
                                    <Col flex={1}>
                                      <Form.Item label="Quantity Type" style={{ marginBottom: 0 }}>
                                        <Select
                                          defaultValue={event.partsRequest[selectedPartIdx].quantityType}
                                          options={['Piece', 'Length'].map(v => ({ value: v, label: v }))}
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col style={{ width: 72 }}>
                                      <Form.Item label="Qty" style={{ marginBottom: 0 }}>
                                        <Input defaultValue={String(event.partsRequest[selectedPartIdx].quantity)} />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </Form>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                  {displayField('Part #', event.partsRequest[selectedPartIdx].partNumber, false, true)}
                                  {displayField('Parts Description', event.partsRequest[selectedPartIdx].description)}
                                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    {displayField('Quantity Type', event.partsRequest[selectedPartIdx].quantityType)}
                                    {displayField('Qty', event.partsRequest[selectedPartIdx].quantity)}
                                  </div>
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
                              <Button size="small" type="dashed" icon={<PlusOutlined />}>
                                Add Parts Request
                              </Button>
                            </div>
                          )}
                        </Col>

                        {event.product === 'Hardware Kit' && (
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
                              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setHkMode('entire')}>
                                Add Hardware Kit
                              </Button>
                            </div>
                          ) : editingProduct ? (
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

                    {/* Right: photos — full card height (~2/5) */}
                    <Col xs={24} md={9} style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        flex: 1,
                        background: token.colorFillTertiary,
                        border: `1px dashed ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadiusSM,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginBottom: 8,
                        cursor: 'pointer',
                      }}>
                        <PictureFilled style={{ fontSize: token.fontSizeHeading3, color: token.colorTextQuaternary }} />
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No photos attached</Text>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Click to upload</Text>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            flex: 1, aspectRatio: '1',
                            background: token.colorFillTertiary,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: token.borderRadiusSM,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <PictureFilled style={{ fontSize: token.fontSizeSM, color: token.colorTextQuaternary }} />
                          </div>
                        ))}
                      </div>
                      <Button
                        size="small"
                        type="text"
                        icon={<PlusOutlined style={{ fontSize: token.fontSizeSM }} />}
                        style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}
                      >
                        Upload Photo
                      </Button>
                    </Col>

                  </Row>
                </div>
              )}

              {activeTab === 'log' && (
                <>
                  {addingLog && (
                    <div style={{
                      marginBottom: 16,
                      padding: 12,
                      background: token.colorFillTertiary,
                      borderRadius: token.borderRadiusSM,
                      border: `1px solid ${token.colorBorderSecondary}`,
                    }}>
                      <Text style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'block', marginBottom: 8 }}>New Log Entry</Text>
                      <Input.TextArea
                        value={newLogComment}
                        onChange={e => setNewLogComment(e.target.value)}
                        placeholder="Describe the action taken or observation made..."
                        rows={3}
                        style={{ marginBottom: 8 }}
                      />
                      <Space>
                        <Button
                          size="small"
                          disabled={!newLogComment.trim()}
                          onClick={() => { setAddingLog(false); setNewLogComment(''); }}
                        >
                          Save Entry
                        </Button>
                        <Button size="small" onClick={() => { setAddingLog(false); setNewLogComment(''); }}>
                          Cancel
                        </Button>
                      </Space>
                    </div>
                  )}
                  <Table
                    dataSource={eventLogs}
                    columns={logColumns}
                    rowKey="id"
                    size="small"
                    locale={{ emptyText: 'No activity logged for this event yet.' }}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '25', '50'],
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                    }}
                  />

                  {editHistory.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <Text style={{ display: 'block', fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: token.colorTextTertiary, marginBottom: 10 }}>
                        Edit History
                      </Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[...editHistory].reverse().map(entry => (
                          <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', background: token.colorFillQuaternary, borderRadius: token.borderRadiusSM, borderLeft: `2px solid ${token.colorBorderSecondary}` }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{entry.field}</Text>
                                <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>changed by</Text>
                                <Text style={{ fontSize: token.fontSizeSM }}>{entry.editedBy}</Text>
                                <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>· {entry.role}</Text>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, textDecoration: 'line-through' }}>{entry.from ?? '—'}</Text>
                                <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>→</Text>
                                <Text style={{ fontSize: token.fontSizeSM }}>{entry.to ?? '—'}</Text>
                              </div>
                            </div>
                            <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, flexShrink: 0 }}>{entry.timestamp}</Text>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>

          {/* Right: analysis card */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Card
              size="small"
              title={
                <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>
                  {insightsStep ? 'AI Insights' : 'Analysis'}
                </span>
              }
              extra={
                insightsStep ? (
                  <Button type="text" size="small" icon={<ArrowLeftOutlined style={{ fontSize: token.fontSizeSM }} />} onClick={() => setInsightsStep(null)}>
                    Back
                  </Button>
                ) : undefined
              }
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              styles={{ body: { flex: 1, overflow: 'auto', padding: 16, minHeight: 0 } }}
            >
              {insightsStep !== null ? (
                <>
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
                    <Button
                      block
                      icon={<StarFilled />}
                      loading={loadingHistorical}
                      onClick={handleGenerateHistorical}
                    >
                      Generate Historical Insights
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Form layout="vertical" size="small">
                    <Form.Item label="Root Cause" style={{ marginBottom: 10 }}>
                      <Select
                        showSearch
                        value={rootCause ?? undefined}
                        placeholder="Select or add root cause..."
                        filterOption={false}
                        onSearch={setRcSearch}
                        onChange={(v: string | undefined) => {
                          const next = v ?? null;
                          if (next !== lastLoggedRootCause.current) {
                            logEditEntry('Root Cause', lastLoggedRootCause.current, next);
                            lastLoggedRootCause.current = next;
                          }
                          if (!v) { setRootCause(null); setRcSearch(''); return; }
                          if (!rootCauseOptions.find(o => o.value === v)) {
                            setRootCauseOptions(prev => [...prev, { value: v, label: v }]);
                          }
                          setRootCause(v);
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
                        onClear={() => { setRootCause(null); setRcSearch(''); }}
                      />
                    </Form.Item>
                    <Form.Item label="Escalation" style={{ marginBottom: 10 }}>
                      <Select
                        value={escalation ?? undefined}
                        onChange={(v: string | undefined) => {
                          if (v === 'Custom') { setCreateEscOpen(true); return; }
                          setEscalation(v ?? null);
                        }}
                        placeholder="Link to escalation"
                        options={ESCALATION_OPTIONS}
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item label="Tags" style={{ marginBottom: 0 }}>
                      <Select
                        mode="tags"
                        value={tags}
                        onChange={setTags}
                        placeholder="Add tags"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Form>

                  <Divider style={{ margin: '12px 0' }} />

                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Button
                      block
                      icon={<StarFilled />}
                      loading={loadingInsights}
                      onClick={handleGenerateInsights}
                    >
                      Generate AI Insights
                    </Button>
                    <Button block icon={<MessageFilled />}>
                      Message Technician
                    </Button>
                  </Space>
                </>
              )}
            </Card>
          </div>
        </div>

      </div>

      {/* VALIDATE MODAL */}
      <Modal
        title="Validate Event"
        open={validateOpen}
        onCancel={() => setValidateOpen(false)}
        onOk={() => {
          setStatus('Validated');
          setValidateOpen(false);
          notification.success({
            message: 'Notifications sent',
            description: `Customer Service and field tech ${event.reportedBy} have been notified that ${event.id} is validated and ready for fulfillment.`,
            placement: 'bottomRight',
            duration: 5,
          });
        }}
        okText="Validate & Notify"
        okButtonProps={{ type: 'primary' }}
      >
        <Text style={{ display: 'block', fontSize: token.fontSize, color: token.colorTextSecondary }}>
          Validating this event will mark it as confirmed and send notifications to Customer Service and field tech <strong>{event.reportedBy}</strong> to proceed with parts fulfillment.
        </Text>
      </Modal>

      {/* INVALIDATE MODAL */}
      <Modal
        title="Invalidate Event"
        open={invalidateOpen}
        onCancel={() => setInvalidateOpen(false)}
        onOk={() => {
          setStatus('Invalidated');
          setInvalidateOpen(false);
          notification.success({
            message: 'Notifications sent',
            description: `Customer Service and field tech ${event.reportedBy} have been notified that ${event.id} has been invalidated.`,
            placement: 'bottomRight',
            duration: 5,
          });
        }}
        okText="Invalidate & Notify"
        okButtonProps={{ danger: true }}
      >
        <Text style={{ display: 'block', fontSize: token.fontSize, color: token.colorTextSecondary }}>
          Invalidating this event will close the investigation and send notifications to Customer Service and field tech <strong>{event.reportedBy}</strong> that no further action is required.
        </Text>
      </Modal>

    </div>
  );
}
