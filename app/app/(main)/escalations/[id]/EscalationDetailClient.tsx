'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  Col,
  Divider,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  notification,
  theme,
} from 'antd';
import {
  PlusOutlined,
  SendOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  EditFilled,
  PictureFilled,
} from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { CopyableValue } from '@/components/CopyableValue';
import type { Escalation, EscalationType } from '@/data/escalations';
import type { QualityEvent } from '@/data/types';
const { Text, Paragraph } = Typography;

const ESCALATION_TYPE_OPTIONS: { value: EscalationType; label: string }[] = [
  { value: 'Corrective Action Report', label: 'Corrective Action Report' },
  { value: 'Problem Report', label: 'Problem Report' },
  { value: 'IT Ticket', label: 'IT Ticket' },
  { value: 'EH&S', label: 'EH&S' },
  { value: 'Custom', label: 'Custom' },
];

type Props = {
  escalation: Escalation | null;
  allEvents: QualityEvent[];
  isNew?: boolean;
};

function SectionLabel({ children, token }: { children: React.ReactNode; token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <Text
      style={{
        fontSize: token.fontSizeSM,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: token.colorTextTertiary,
        display: 'block',
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

function DisplayField({
  label,
  children,
  token,
}: {
  label: string;
  children: React.ReactNode;
  token: ReturnType<typeof theme.useToken>['token'];
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: token.fontSizeXS,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: token.colorTextTertiary,
          display: 'block',
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <div style={{ fontSize: token.fontSizeSM, color: token.colorText }}>{children}</div>
    </div>
  );
}

export function EscalationDetailClient({ escalation, allEvents, isNew = false }: Props) {
  const router = useRouter();
  const { token } = theme.useToken();

  const [title, setTitle] = useState(escalation?.title ?? '');
  const [type, setType] = useState<EscalationType>(escalation?.type ?? 'Problem Report');
  const [reportedIssue, setReportedIssue] = useState(escalation?.reportedIssue ?? '');
  const [rootCause, setRootCause] = useState(escalation?.rootCause ?? '');
  const [correctionImplemented, setCorrectionImplemented] = useState(
    escalation?.correctionImplemented ?? ''
  );
  const [fieldAction, setFieldAction] = useState(escalation?.fieldAction ?? '');
  const [linkedEventIds, setLinkedEventIds] = useState<string[]>(escalation?.eventIds ?? []);
  const [status, setStatus] = useState<'Open' | 'Closed'>(escalation?.status ?? 'Open');
  const [editing, setEditing] = useState(isNew);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [eventSearchValue, setEventSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  const id = escalation?.id ?? 'New Escalation';

  // Linked event objects
  const linkedEvents = allEvents.filter((e) => linkedEventIds.includes(e.id));

  // Field tech names from linked events (unique)
  const fieldTechNames = Array.from(new Set(linkedEvents.map((e) => e.reportedBy)));

  // Available events to link: validated, not already linked
  const searchQ = eventSearchValue.trim().toLowerCase();
  const availableEvents = allEvents.filter(
    (e) =>
      e.status === 'Validated' &&
      !linkedEventIds.includes(e.id) &&
      (searchQ.length === 0 ||
        e.id.toLowerCase().includes(searchQ) ||
        e.branch.toLowerCase().includes(searchQ) ||
        e.product.toLowerCase().includes(searchQ))
  );

  const handleCancelEdit = () => {
    if (isNew) {
      router.push('/escalations');
      return;
    }
    setTitle(escalation?.title ?? '');
    setType(escalation?.type ?? 'Problem Report');
    setReportedIssue(escalation?.reportedIssue ?? '');
    setRootCause(escalation?.rootCause ?? '');
    setCorrectionImplemented(escalation?.correctionImplemented ?? '');
    setFieldAction(escalation?.fieldAction ?? '');
    setLinkedEventIds(escalation?.eventIds ?? []);
    setEditing(false);
  };

  const handleCreate = () => {
    router.push('/escalations');
  };

  const handleCloseSend = () => {
    setStatus('Closed');
    setCloseModalOpen(false);
    notification.success({
      message: 'Quality Update sent',
      description: `Notification sent to ${fieldTechNames.length} field technician(s). Escalation ${id} is now closed.`,
      placement: 'bottomRight',
      duration: 5,
    });
  };

  const imageArea = (
    <div
      style={{
        border: `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        padding: 16,
        textAlign: 'center',
        marginTop: 8,
      }}
    >
      <PictureFilled style={{ fontSize: token.fontSizeHeading3, color: token.colorTextQuaternary, display: 'block', marginBottom: 4 }} />
      <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>Attach images or diagrams</Text>
    </div>
  );

  const detailsTab = (
    <div style={{ padding: '12px 0' }}>
      {/* Reported Issue */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel token={token}>Reported Issue</SectionLabel>
        {editing ? (
          <Input.TextArea
            value={reportedIssue}
            onChange={(e) => setReportedIssue(e.target.value)}
            rows={4}
            size="small"
            placeholder="Describe the reported issue..."
          />
        ) : (
          <Paragraph style={{ fontSize: token.fontSize, color: token.colorText, marginBottom: 0 }}>
            {reportedIssue || <Text type="secondary">—</Text>}
          </Paragraph>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Root Cause */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel token={token}>Root Cause</SectionLabel>
        {editing ? (
          <Input.TextArea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            rows={3}
            size="small"
            placeholder="Describe the root cause..."
          />
        ) : (
          <Paragraph style={{ fontSize: token.fontSize, color: token.colorText, marginBottom: 0 }}>
            {rootCause || <Text type="secondary">—</Text>}
          </Paragraph>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Correction Implemented */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel token={token}>Correction Implemented</SectionLabel>
        {editing ? (
          <Input.TextArea
            value={correctionImplemented}
            onChange={(e) => setCorrectionImplemented(e.target.value)}
            rows={6}
            size="small"
            placeholder="Describe the correction implemented..."
          />
        ) : (
          <Paragraph
            style={{ fontSize: token.fontSize, color: token.colorText, whiteSpace: 'pre-wrap', marginBottom: 0 }}
          >
            {correctionImplemented || <Text type="secondary">—</Text>}
          </Paragraph>
        )}
        {imageArea}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Field Action */}
      <div>
        <SectionLabel token={token}>Field Action</SectionLabel>
        {editing ? (
          <Input.TextArea
            value={fieldAction}
            onChange={(e) => setFieldAction(e.target.value)}
            rows={3}
            size="small"
            placeholder="Describe any required field action..."
          />
        ) : (
          <Paragraph style={{ fontSize: token.fontSize, color: token.colorText, marginBottom: 0 }}>
            {fieldAction || <Text type="secondary">—</Text>}
          </Paragraph>
        )}
      </div>
    </div>
  );

  const linkedEventsTab = (
    <div style={{ padding: '12px 0' }}>
      {editing && (
        <Input
          placeholder="Search by QE ID, branch, product..."
          size="small"
          value={eventSearchValue}
          onChange={(e) => setEventSearchValue(e.target.value)}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Linked events */}
      {linkedEvents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {linkedEvents.map((e) => (
            <div
              key={e.id}
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                padding: '8px 10px',
                background: token.colorFillQuaternary,
                position: 'relative',
              }}
            >
              {editing && (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    fontSize: token.fontSizeSM,
                    color: token.colorTextTertiary,
                  }}
                  onClick={() => setLinkedEventIds((ids) => ids.filter((id) => id !== e.id))}
                />
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, fontWeight: 600 }}>{e.id}</Text>
                <Tag style={{ fontSize: token.fontSizeXS, marginRight: 0 }}>{e.product}</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {e.branch} &middot; {e.reportedBy}
              </Text>
            </div>
          ))}
        </div>
      ) : (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          No events linked.
        </Text>
      )}

      {/* Search results to add */}
      {editing && eventSearchValue.trim().length > 0 && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <Text
            style={{
              fontSize: token.fontSizeSM,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: token.colorTextTertiary,
              display: 'block',
              marginBottom: 6,
            }}
          >
            Search Results
          </Text>
          {availableEvents.length === 0 ? (
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              No matching validated events.
            </Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {availableEvents.slice(0, 10).map((e) => (
                <div
                  key={e.id}
                  style={{
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadius,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    background: token.colorBgContainer,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => {
                    setLinkedEventIds((ids) => [...ids, e.id]);
                    setEventSearchValue('');
                  }}
                >
                  <span>
                    <Text style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM }}>{e.id}</Text>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, marginLeft: 8 }}>
                      {e.product} &middot; {e.branch}
                    </Text>
                  </span>
                  <PlusOutlined style={{ fontSize: token.fontSizeSM, color: token.colorPrimary }} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const leftCard = (
    <Card
      style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
      styles={{ body: { padding: '0 16px', overflow: 'auto' } }}
      tabList={[
        { key: 'details', tab: 'Details' },
        { key: 'linked-events', tab: `Linked Events (${linkedEventIds.length})` },
      ]}
      activeTabKey={activeTab}
      onTabChange={setActiveTab}
      size="small"
    >
      {activeTab === 'details' ? detailsTab : linkedEventsTab}
    </Card>
  );

  const rightCard = (
    <Card
      title={<Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>Escalation Info</Text>}
      style={{ width: 320, flexShrink: 0 }}
      size="small"
      styles={{ body: { padding: '12px 16px' } }}
    >
      <DisplayField label="Type" token={token}>
        {editing ? (
          <Select<EscalationType>
            value={type}
            onChange={setType}
            size="small"
            style={{ width: '100%' }}
            options={ESCALATION_TYPE_OPTIONS}
          />
        ) : (
          <Text style={{ fontSize: token.fontSizeSM }}>{type}</Text>
        )}
      </DisplayField>

      <DisplayField label="Status" token={token}>
        <Tag color={status === 'Closed' ? 'green' : 'blue'} style={{ fontSize: token.fontSizeSM }}>
          {status}
        </Tag>
      </DisplayField>

      {!isNew && (
        <>
          <DisplayField label="Created By" token={token}>
            <Text style={{ fontSize: token.fontSizeSM }}>{escalation?.createdBy}</Text>
          </DisplayField>

          <DisplayField label="Created" token={token}>
            <Text style={{ fontSize: token.fontSizeSM }}>{escalation?.createdAt.slice(0, 10)}</Text>
          </DisplayField>

          <DisplayField label="Updated" token={token}>
            <Text style={{ fontSize: token.fontSizeSM }}>{escalation?.updatedAt.slice(0, 10)}</Text>
          </DisplayField>

          {status === 'Closed' && escalation?.closedAt && (
            <DisplayField label="Sent" token={token}>
              <Text style={{ fontSize: token.fontSizeSM }}>{escalation.closedAt.slice(0, 10)}</Text>
            </DisplayField>
          )}
        </>
      )}

      <Divider style={{ margin: '10px 0' }} />

      <div style={{ marginBottom: 4 }}>
        <Text
          style={{
            fontSize: token.fontSizeXS,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: token.colorTextTertiary,
            display: 'block',
            marginBottom: 6,
          }}
        >
          Notified Field Techs
        </Text>
        {fieldTechNames.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {fieldTechNames.map((name) => (
              <Tag key={name} style={{ fontSize: token.fontSizeSM, marginRight: 0 }}>
                {name}
              </Tag>
            ))}
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            — None yet
          </Text>
        )}
      </div>
    </Card>
  );

  // Header action buttons
  const headerActions = () => {
    if (editing && isNew) {
      return (
        <Space size="small">
          <Button size="small" type="text" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleCreate}>
            Create Escalation
          </Button>
        </Space>
      );
    }
    if (editing && !isNew) {
      return (
        <Space size="small">
          <Button size="small" type="text" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => setEditing(false)}>
            Save Changes
          </Button>
        </Space>
      );
    }
    if (!editing && status === 'Open') {
      return (
        <Space size="small">
          <Button size="small" type="primary" icon={<EditFilled />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<SendOutlined />}
            onClick={() => setCloseModalOpen(true)}
          >
            Close & Send
          </Button>
        </Space>
      );
    }
    if (!editing && status === 'Closed') {
      return (
        <Button size="small" type="primary" onClick={() => setStatus('Open')}>
          Reopen
        </Button>
      );
    }
    return null;
  };

  const headerLeft = (
    <Space size={4} style={{ alignItems: 'center' }}>
      <Button
        type="text"
        size="small"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push('/escalations')}
        style={{ padding: '0 4px' }}
      />
      <Text style={{ color: token.colorTextTertiary, fontSize: token.fontSize }}>|</Text>
      {isNew ? (
        <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
          New Escalation
        </Text>
      ) : (
        <>
          <CopyableValue value={id} />
          {status && (
            <Tag
              color={status === 'Closed' ? 'green' : 'blue'}
              style={{ fontSize: token.fontSizeSM, marginLeft: 4, marginRight: 0 }}
            >
              {status}
            </Tag>
          )}
        </>
      )}
    </Space>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader left={headerLeft} right={headerActions()} />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {/* Title bar under header when not new */}
        {!isNew && (
          <div style={{ marginBottom: 12 }}>
            {editing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="small"
                style={{ fontSize: token.fontSizeLG, fontWeight: 600 }}
                placeholder="Escalation title..."
              />
            ) : (
              <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
                {title}
              </Text>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', height: '100%' }}>
          {leftCard}
          {rightCard}
        </div>
      </div>

      <Modal
        open={closeModalOpen}
        title="Close & Send Quality Update"
        okText="Close & Send"
        okButtonProps={{ type: 'primary', icon: <SendOutlined /> }}
        onOk={handleCloseSend}
        onCancel={() => setCloseModalOpen(false)}
        width={440}
      >
        <Paragraph style={{ fontSize: token.fontSize, marginBottom: 12 }}>
          This will mark the escalation as Closed and send a notification to{' '}
          <strong>{fieldTechNames.length}</strong> field technician
          {fieldTechNames.length !== 1 ? 's' : ''} linked to the{' '}
          <strong>{linkedEventIds.length}</strong> associated event
          {linkedEventIds.length !== 1 ? 's' : ''}.
        </Paragraph>
        {fieldTechNames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {fieldTechNames.map((name) => (
              <Tag key={name} style={{ fontSize: token.fontSizeSM, marginRight: 0 }}>
                {name}
              </Tag>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
