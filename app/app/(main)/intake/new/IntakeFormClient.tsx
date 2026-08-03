'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  App, Button, Card, Checkbox, Descriptions, Form, Input, InputNumber, Modal, Radio,
  Result, Select, Skeleton, Switch, Tag, Typography, Upload, theme,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  ArrowLeftOutlined, BarcodeOutlined, DeleteOutlined, PlusOutlined, SignatureOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { useEventStore } from '@/store/eventStore';
import { useOrderStore } from '@/store/orderStore';
import { useCapabilities } from '@/store/roleStore';
import { nowStampIso, nowStampUs, nowDateStr } from '@/lib/appTime';
import { DOOR_OPTIONS, COMPONENT_OPTIONS, ISSUE_OPTIONS, PART_CATALOG } from '@/data/filterOptions';
import { eligibleParts } from '@/data/partsCatalog';
import type { QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';

const { Text } = Typography;

type PartRow = {
  manual?: boolean;
  partNumber?: string;
  partDescription?: string;
  quantityType?: 'Piece' | 'Length';
  quantity?: number;
};

type FormValues = {
  jobNo: string;
  dfo?: number;
  elLine?: number;
  door: string;
  component: string;
  issue: string;
  issueDescription: string;
  partsNeeded?: boolean;
  parts?: PartRow[];
  shipTo?: 'branch' | 'address';
  shipToStreet?: string;
  shipToCityStateZip?: string;
};

const selectOpts = (values: string[]) => values.map(v => ({ value: v, label: v }));

export function IntakeFormClient() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { notification } = App.useApp();
  const caps = useCapabilities();
  const branch = caps.assignedBranch ?? 'Atlanta';

  const [form] = Form.useForm<FormValues>();
  const { createdEvents, createEvent, pushActivityLog } = useEventStore();
  const createOrder = useOrderStore((s) => s.createOrder);

  // Barcode provenance: scanned fills SO/EL/DFO and the event reads as
  // barcode-sourced; typing (or editing a scanned value) is manual entry and
  // sets jobNoManualEntry, surfacing the existing signature indicator.
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [photos, setPhotos] = useState<UploadFile[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewValues, setReviewValues] = useState<FormValues | null>(null);
  const [submitted, setSubmitted] = useState<{ eventId: string; orderId: string | null } | null>(null);

  const jobNo = Form.useWatch('jobNo', form);
  const door = Form.useWatch('door', form);
  const component = Form.useWatch('component', form);
  const partsNeeded = Form.useWatch('partsNeeded', form);
  const shipTo = Form.useWatch('shipTo', form);
  const isSO = (jobNo ?? '').toUpperCase().startsWith('SO');

  const catalog = useMemo(() => eligibleParts(door, component), [door, component]);

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      const soNum = `SO109${String(Math.floor(Math.random() * 900000) + 100000)}`;
      form.setFieldsValue({
        jobNo: soNum,
        dfo: Math.floor(Math.random() * 6) + 1,
        elLine: Math.floor(Math.random() * 3) + 1,
      });
      setScanned(true);
      setScanning(false);
      notification.success({
        message: 'Barcode read.',
        description: `Sales order, EL line, and DFO line extracted from ${soNum}.`,
      });
    }, 700);
  };

  const nextEventId = (): string => {
    let n = 1;
    while (createdEvents[`QE_R${n}`]) n++;
    return `QE_R${n}`;
  };

  const openReview = () => {
    form.validateFields().then((values) => {
      // Catalog rows carry only the part number; resolve descriptions here
      // rather than in the Select's onChange, whose write races antd's own
      // form-store update. Manual rows already typed their description.
      const parts = (values.parts ?? []).map((r) =>
        r?.partNumber && !r.partDescription
          ? { ...r, partDescription: PART_CATALOG.find(p => p.partNumber === r.partNumber)?.partDescription ?? '' }
          : r
      );
      setReviewValues({ ...values, parts });
      setReviewOpen(true);
    });
  };

  const submit = () => {
    const values = reviewValues!;
    const id = nextEventId();
    const so = values.jobNo.toUpperCase().startsWith('SO');
    const parts = values.partsNeeded ? (values.parts ?? []).filter(p => p.partNumber) : [];
    const shipToVal = (values.shipTo as 'branch' | 'address' | undefined) ?? 'branch';

    const event: QualityEvent = {
      id,
      date: nowDateStr(),
      jobNo: values.jobNo.toUpperCase(),
      ...(so && !scanned ? { jobNoManualEntry: true } : {}),
      dfo: so ? values.dfo ?? 1 : 1,
      ...(so && values.elLine != null ? { elLine: values.elLine } : {}),
      status: 'Reported',
      rootCause: null,
      branch,
      // Plant and assignee belong to FQ's investigation, not intake.
      plant: '',
      component: values.component,
      issue: values.issue,
      door: values.door,
      issueDescription: values.issueDescription,
      assignee: '',
      reportedBy: caps.displayName,
      reportedAt: nowStampIso().replace(' ', 'T'),
      ...(parts.length
        ? {
            partsRequest: parts.map(p => ({
              partNumber: p.partNumber!,
              quantityType: p.quantityType ?? 'Piece',
              quantity: p.quantity ?? 1,
              description: p.partDescription ?? '',
            })),
            shipTo: shipToVal,
            ...(shipToVal === 'address'
              ? { shipToAddress: { street: values.shipToStreet ?? '', cityStateZip: values.shipToCityStateZip ?? '' } }
              : {}),
          }
        : {}),
    };
    createEvent(event);
    pushActivityLog(id, {
      id: `al_${Date.now()}`,
      eventId: id,
      date: nowStampIso(),
      role: 'Intake',
      employee: caps.displayName,
      status: 'Reported',
      comment: `Event reported via portal intake (${branch} branch).`,
    });

    // Pipeline rule (P1, 2026-07-24): a parts request at submission
    // auto-creates the order for Customer Service review.
    let orderId: string | null = null;
    if (parts.length) {
      orderId = `${id}_Order`;
      const order: Order = {
        id: orderId,
        eventId: id,
        orderStatus: 'Open',
        jobNo: event.jobNo,
        lastUpdated: nowStampUs(),
        parts: parts.map((p, i) => ({
          seqNo: i + 1,
          configId: `${event.jobNo}.${i + 1}`,
          dfoLineItem: event.dfo,
          ...(so && event.elLine != null ? { elLineItem: event.elLine } : {}),
          door: values.door,
          partNumber: p.partNumber!,
          quantityType: p.quantityType ?? 'Piece',
          quantity: p.quantity ?? 1,
          partDescription: p.partDescription ?? '',
        })),
      };
      createOrder(order);
      pushActivityLog(id, {
        id: `al_${Date.now() + 1}`,
        eventId: id,
        date: nowStampIso(),
        role: 'Intake',
        employee: caps.displayName,
        status: 'Reported',
        comment: 'Parts request submitted. Order created for Customer Service review.',
      });
    }

    setReviewOpen(false);
    setSubmitted({ eventId: id, orderId });
  };

  const resetAll = () => {
    form.resetFields();
    setPhotos([]);
    setScanned(false);
    setSubmitted(null);
    setReviewValues(null);
  };

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <PageHeader
          left={
            <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
              Report a Quality Event
            </Text>
          }
        />
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Result
            status="success"
            title={`Quality event ${submitted.eventId} submitted`}
            subTitle={
              submitted.orderId
                ? 'Field Quality has been notified. Your parts request created an order for Customer Service review.'
                : 'Field Quality has been notified and will review the event.'
            }
            extra={[
              <Button key="home" type="primary" onClick={() => router.push('/intake')}>
                Back to Intake
              </Button>,
              <Button key="another" onClick={resetAll}>
                Report Another Event
              </Button>,
            ]}
          />
        </div>
      </div>
    );
  }

  const reviewParts = reviewValues?.partsNeeded ? (reviewValues.parts ?? []).filter(p => p.partNumber) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push('/intake')} />
            <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
              Report a Quality Event
            </Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{branch} branch</Text>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <Form<FormValues>
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{ shipTo: 'branch', partsNeeded: false }}
          style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <Card size="small" title="Job Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                border: `1px dashed ${token.colorBorder}`, borderRadius: token.borderRadiusSM,
              }}>
                <BarcodeOutlined style={{ fontSize: token.fontSizeHeading3, color: token.colorTextSecondary }} />
                <div style={{ flex: 1 }}>
                  <Text style={{ display: 'block', fontSize: token.fontSize }}>Have the order barcode?</Text>
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    Upload a scan or photo and the sales order, EL line, and DFO line fill in automatically.
                  </Text>
                </div>
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={() => { simulateScan(); return false; }}
                >
                  <Button loading={scanning}>Upload Barcode</Button>
                </Upload>
              </div>

              {scanning ? (
                <Skeleton.Input active block style={{ height: 64 }} />
              ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Form.Item
                    name="jobNo"
                    label={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        Sales Order # / Work Order #
                        {scanned
                          ? <Tag color="green" style={{ marginInlineEnd: 0 }}>Scanned</Tag>
                          : isSO && jobNo
                            ? <Tag icon={<SignatureOutlined />} style={{ marginInlineEnd: 0 }}>Manual entry</Tag>
                            : null}
                      </span>
                    }
                    rules={[
                      { required: true, message: 'Enter the SO or WO number' },
                      { pattern: /^(SO|WO)\d{6,10}$/i, message: 'Format: SO or WO followed by the order number' },
                    ]}
                    style={{ flex: '1 1 220px', marginBottom: 0 }}
                  >
                    <Input placeholder="SO109XXXXXX" onChange={() => setScanned(false)} />
                  </Form.Item>
                  {isSO && (
                    <>
                      <Form.Item
                        name="elLine"
                        label="EL Line #"
                        style={{ flex: '0 1 170px', minWidth: 150, marginBottom: 0 }}
                      >
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="1" />
                      </Form.Item>
                      <Form.Item
                        name="dfo"
                        label="DFO Line #"
                        rules={[{ required: true, message: 'Required on sales orders' }]}
                        style={{ flex: '0 1 170px', minWidth: 150, marginBottom: 0 }}
                      >
                        <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="1" />
                      </Form.Item>
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card size="small" title="Classification">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Form.Item
                name="door"
                label="Door"
                rules={[{ required: true, message: 'Select the door type' }]}
                style={{ flex: '1 1 220px', marginBottom: 0 }}
              >
                <Select showSearch options={selectOpts(DOOR_OPTIONS)} placeholder="Select door type" />
              </Form.Item>
              <Form.Item
                name="component"
                label="Component"
                rules={[{ required: true, message: 'Select the component' }]}
                style={{ flex: '1 1 200px', marginBottom: 0 }}
              >
                <Select showSearch options={selectOpts(COMPONENT_OPTIONS)} placeholder="Select component" />
              </Form.Item>
              <Form.Item
                name="issue"
                label="Issue"
                rules={[{ required: true, message: 'Select the issue type' }]}
                style={{ flex: '1 1 200px', marginBottom: 0 }}
              >
                <Select showSearch options={selectOpts(ISSUE_OPTIONS)} placeholder="Select issue type" />
              </Form.Item>
            </div>
          </Card>

          <Card size="small" title="Description & Photos">
            <Form.Item
              name="issueDescription"
              label="Issue Description"
              rules={[
                { required: true, message: 'Describe the issue' },
                { min: 20, message: 'Add enough detail for Field Quality to act on (20 characters minimum)' },
              ]}
            >
              <Input.TextArea
                rows={4}
                placeholder="What is wrong, where on the door, and what impact it has on the install..."
              />
            </Form.Item>
            <Form.Item label="Photos of the event" style={{ marginBottom: 0 }}>
              <Upload
                listType="picture-card"
                fileList={photos}
                beforeUpload={() => false}
                onChange={({ fileList }) => setPhotos(fileList)}
                multiple
              >
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 4, fontSize: token.fontSizeSM }}>Add Photo</div>
                </div>
              </Upload>
            </Form.Item>
          </Card>

          <Card
            size="small"
            title="Replacement Parts"
            extra={
              <Form.Item name="partsNeeded" valuePropName="checked" noStyle>
                <Switch checkedChildren="Needed" unCheckedChildren="None" />
              </Form.Item>
            }
          >
            {!partsNeeded ? (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                Toggle on if this event needs replacement parts. A parts request creates an order for
                Customer Service review automatically.
              </Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!door || !component ? (
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    Select the door and component above to narrow the part list to what fits.
                  </Text>
                ) : null}
                <Form.List
                  name="parts"
                  initialValue={[{ quantityType: 'Piece', quantity: 1 }]}
                  rules={[{
                    validator: async (_, rows: PartRow[] | undefined) => {
                      if (partsNeeded && !(rows ?? []).some(r => r?.partNumber)) {
                        throw new Error('Add at least one part or toggle parts off');
                      }
                    },
                  }]}
                >
                  {(fields, { add, remove }, { errors }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {fields.map((field) => {
                        const manual: boolean = form.getFieldValue(['parts', field.name, 'manual']) ?? false;
                        return (
                          <div
                            key={field.key}
                            style={{
                              border: `1px solid ${token.colorBorderSecondary}`,
                              borderRadius: token.borderRadiusSM,
                              padding: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              {manual ? (
                                <>
                                  <Form.Item
                                    name={[field.name, 'partNumber']}
                                    label="Part #"
                                    rules={[{ required: true, message: 'Part number' }]}
                                    style={{ flex: '1 1 160px', marginBottom: 0 }}
                                  >
                                    <Input placeholder="Part number" />
                                  </Form.Item>
                                  <Form.Item
                                    name={[field.name, 'partDescription']}
                                    label="Part Description"
                                    rules={[{ required: true, message: 'Part description' }]}
                                    style={{ flex: '2 1 260px', marginBottom: 0 }}
                                  >
                                    <Input placeholder="Describe the part" />
                                  </Form.Item>
                                </>
                              ) : (
                                <Form.Item
                                  name={[field.name, 'partNumber']}
                                  label="Part"
                                  rules={[{ required: true, message: 'Select a part' }]}
                                  style={{ flex: '2 1 320px', marginBottom: 0 }}
                                >
                                  <Select
                                    showSearch
                                    placeholder={door && component ? 'Select a part that fits this door and component' : 'Select a part'}
                                    optionFilterProp="label"
                                    options={catalog.map(p => ({
                                      value: p.partNumber,
                                      label: `${p.partNumber} · ${p.partDescription}`,
                                    }))}
                                  />
                                </Form.Item>
                              )}
                              <Form.Item
                                name={[field.name, 'quantityType']}
                                label="Quantity Type"
                                rules={[{ required: true, message: 'Type' }]}
                                style={{ flex: '0 1 130px', marginBottom: 0 }}
                              >
                                <Select options={selectOpts(['Piece', 'Length'])} />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'quantity']}
                                label="Quantity"
                                rules={[{ required: true, message: 'Qty' }]}
                                style={{ flex: '0 1 100px', marginBottom: 0 }}
                              >
                                <InputNumber min={1} max={999} style={{ width: '100%' }} />
                              </Form.Item>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Form.Item name={[field.name, 'manual']} valuePropName="checked" noStyle>
                                <Checkbox onChange={() => {
                                  const rows: PartRow[] = form.getFieldValue('parts') ?? [];
                                  rows[field.name] = { ...rows[field.name], partNumber: undefined, partDescription: undefined };
                                  form.setFieldsValue({ parts: [...rows] });
                                }}>
                                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Part not listed</Text>
                                </Checkbox>
                              </Form.Item>
                              {fields.length > 1 && (
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(field.name)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <Form.ErrorList errors={errors} />
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => add({ quantityType: 'Piece', quantity: 1 })}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Add Another Part
                      </Button>
                    </div>
                  )}
                </Form.List>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Form.Item name="shipTo" label="Ship To" style={{ marginBottom: 0 }}>
                    <Radio.Group
                      options={[
                        { value: 'branch', label: `${branch} branch` },
                        { value: 'address', label: 'Direct address' },
                      ]}
                    />
                  </Form.Item>
                  {shipTo === 'address' && (
                    <>
                      <Form.Item
                        name="shipToStreet"
                        label="Street"
                        rules={[{ required: true, message: 'Street address' }]}
                        style={{ flex: '1 1 200px', marginBottom: 0 }}
                      >
                        <Input placeholder="4821 Commerce Park Dr" />
                      </Form.Item>
                      <Form.Item
                        name="shipToCityStateZip"
                        label="City, State ZIP"
                        rules={[{ required: true, message: 'City, state, and ZIP' }]}
                        style={{ flex: '1 1 180px', marginBottom: 0 }}
                      >
                        <Input placeholder="Marietta, GA 30060" />
                      </Form.Item>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingBottom: 24 }}>
            <Button onClick={() => router.push('/intake')}>Cancel</Button>
            <Button type="primary" onClick={openReview}>Review & Submit</Button>
          </div>
        </Form>
      </div>

      <Modal
        open={reviewOpen}
        title="Review Quality Event"
        okText="Submit Event"
        onOk={submit}
        onCancel={() => setReviewOpen(false)}
        mask={{ closable: false }}
        width={640}
      >
        {reviewValues && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <Descriptions
              column={2}
              size="small"
              items={[
                {
                  key: 'job',
                  label: 'Job No.',
                  children: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {reviewValues.jobNo.toUpperCase()}
                      {reviewValues.jobNo.toUpperCase().startsWith('SO') && (
                        scanned
                          ? <Tag color="green" style={{ marginInlineEnd: 0 }}>Scanned</Tag>
                          : <Tag icon={<SignatureOutlined />} style={{ marginInlineEnd: 0 }}>Manual entry</Tag>
                      )}
                    </span>
                  ),
                },
                { key: 'branch', label: 'Branch', children: branch },
                ...(reviewValues.jobNo.toUpperCase().startsWith('SO') ? [
                  { key: 'dfo', label: 'DFO Line #', children: String(reviewValues.dfo ?? 1) },
                  { key: 'el', label: 'EL Line #', children: reviewValues.elLine != null ? String(reviewValues.elLine) : 'Not provided' },
                ] : []),
                { key: 'door', label: 'Door', children: reviewValues.door },
                { key: 'component', label: 'Component', children: reviewValues.component },
                { key: 'issue', label: 'Issue', children: reviewValues.issue },
                { key: 'photos', label: 'Photos', children: `${photos.length} attached` },
                { key: 'desc', label: 'Description', children: reviewValues.issueDescription, span: 2 },
              ]}
            />
            {reviewParts.length > 0 && (
              <div>
                <Text strong style={{ fontSize: token.fontSizeSM, display: 'block', marginBottom: 6 }}>
                  Parts Requested ({reviewParts.length})
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reviewParts.map((p, i) => (
                    <Text key={i} type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {p.partNumber} · Qty {p.quantity ?? 1} ({p.quantityType ?? 'Piece'})
                      {p.partDescription ? ` · ${p.partDescription}` : ''}
                    </Text>
                  ))}
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    Ships to: {reviewValues.shipTo === 'address'
                      ? `${reviewValues.shipToStreet}, ${reviewValues.shipToCityStateZip}`
                      : `${branch} branch`}
                  </Text>
                  <Text style={{ fontSize: token.fontSizeSM }}>
                    Submitting creates an order for Customer Service review.
                  </Text>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
