'use client';

import { useState, useMemo, useEffect } from 'react';
import { useEventStore } from '@/store/eventStore';
import { mergeEvent } from '@/lib/effectiveEvents';
import { useRouter } from 'next/navigation';
import { 
  Button,
  Card,
    Divider,
  Input,
  Modal,
    Select,
  Space,
  Tag,
  Typography,
  Upload,
  notification,
  theme,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  SendOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  EditFilled,
  InboxOutlined,
  FilePdfOutlined,
  FileOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  SaveFilled,
} from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { CopyableValue } from '@/components/CopyableValue';
import { nowStampIso } from '@/lib/appTime';
import { escalationTitleMeta } from '@/data/manageLists';
import { useEscalationStore } from '@/store/escalationStore';
import { useEscalationTypeStore } from '@/store/escalationTypeStore';
import { useCapabilities } from '@/store/roleStore';
import { mergeEscalation } from '@/lib/effectiveEscalations';
import type { Escalation, EscalationType } from '@/data/escalations';
import type { QualityEvent } from '@/data/types';
const { Text, Paragraph } = Typography;

type Props = {
  escalation: Escalation | null;
  // For ids not in the static data: resolved client-side from the store
  // (runtime-created escalations under static export).
  escalationId?: string;
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

export function EscalationDetailClient({ escalation: escalationProp, escalationId, allEvents: allEventsProp, isNew = false }: Props) {
  const evtMutations = useEventStore(s => s.mutations);
  const patchEvent = useEventStore(s => s.patchEvent);
  const allEvents = useMemo(() => allEventsProp.map(e => mergeEvent(e, evtMutations[e.id])), [allEventsProp, evtMutations]);
  const escMutations = useEscalationStore(s => s.mutations);
  const createdEscalations = useEscalationStore(s => s.created);
  const patchEscalation = useEscalationStore(s => s.patchEscalation);
  const createEscalationInStore = useEscalationStore(s => s.createEscalation);
  const managedTypes = useEscalationTypeStore(s => s.types);
  const caps = useCapabilities();
  const canEdit = caps.editEvents;
  const router = useRouter();
  const { token } = theme.useToken();

  // Static escalations get the runtime overlay; unknown ids resolve from the
  // created set (client-side fallback, same pattern as CreatedOrderDetail).
  const escalation = useMemo(() => {
    if (escalationProp) return mergeEscalation(escalationProp, escMutations[escalationProp.id]);
    if (escalationId) return createdEscalations[escalationId] ?? null;
    return null;
  }, [escalationProp, escalationId, escMutations, createdEscalations]);

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
  const [closeMessage, setCloseMessage] = useState('');
  const [eventSearchValue, setEventSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [attachments, setAttachments] = useState<Array<{ uid: string; name: string; size: number; date: string; blobUrl: string }>>([]);
  const [previewFile, setPreviewFile] = useState<{ name: string; blobUrl: string } | null>(null);

  const nowTs = () => nowStampIso();

  const id = escalation?.id ?? 'New Escalation';

  // View-only roles can browse escalations but not create them.
  useEffect(() => {
    if (isNew && !canEdit) router.replace('/escalations');
  }, [isNew, canEdit, router]);

  if (!isNew && !escalation) {
    return <div style={{ padding: 32 }}>Escalation not found.</div>;
  }

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
        e.component.toLowerCase().includes(searchQ))
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

  const syncEventPointers = (escId: string, before: string[], after: string[]) => {
    after.filter(eid => !before.includes(eid)).forEach(eid => patchEvent(eid, { escalation: escId }));
    before.filter(eid => !after.includes(eid)).forEach(eid => patchEvent(eid, { escalation: null }));
  };

  const handleSaveEdit = () => {
    if (!escalation) return;
    patchEscalation(escalation.id, {
      title,
      type,
      reportedIssue,
      rootCause: rootCause.trim() ? rootCause : null,
      correctionImplemented: correctionImplemented.trim() ? correctionImplemented : null,
      fieldAction: fieldAction.trim() ? fieldAction : null,
      eventIds: linkedEventIds,
      updatedAt: nowTs(),
    });
    syncEventPointers(escalation.id, escalation.eventIds, linkedEventIds);
    setEditing(false);
  };

  const handleCreate = () => {
    const newId = `ESC_R${Date.now().toString(36).toUpperCase()}`;
    const ts = nowTs();
    createEscalationInStore({
      id: newId,
      type,
      title: title.trim(),
      status: 'Open',
      reportedIssue: reportedIssue.trim(),
      rootCause: rootCause.trim() ? rootCause : null,
      correctionImplemented: correctionImplemented.trim() ? correctionImplemented : null,
      fieldAction: fieldAction.trim() ? fieldAction : null,
      eventIds: linkedEventIds,
      createdBy: caps.displayName,
      createdAt: ts,
      updatedAt: ts,
    });
    syncEventPointers(newId, [], linkedEventIds);
    router.push(`/escalations/${newId}`);
  };

  const handleCloseSend = () => {
    if (escalation) {
      patchEscalation(escalation.id, { status: 'Closed', closedAt: nowTs(), updatedAt: nowTs() });
    }
    setStatus('Closed');
    setCloseModalOpen(false);
    setCloseMessage('');
    notification.success({
      message: 'Quality Update sent',
      description: closeMessage.trim()
        ? `Notification sent to ${fieldTechNames.length} field technician(s) with your message. Escalation ${id} is now closed.`
        : `Notification sent to ${fieldTechNames.length} field technician(s). Escalation ${id} is now closed.`,
      placement: 'bottomRight',
      duration: 5,
    });
  };

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FilePdfOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />;
    return <FileOutlined style={{ fontSize: 20, color: token.colorTextTertiary }} />;
  };

  const attachmentsTab = (
    <div style={{ padding: '12px 0' }}>
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
          const isImage = ['png', 'jpg', 'jpeg'].includes(ext);
          // Runtime blob preview; next/image offers no benefit for object URLs.
          if (isImage) return (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewFile.blobUrl} alt={previewFile.name} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
            </>
          );
          if (ext === 'pdf') return (
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
        {editing && (
          <Upload.Dragger
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            showUploadList={false}
            beforeUpload={(file) => {
              const blobUrl = URL.createObjectURL(file);
              const att = { uid: `att_${Date.now()}_${file.name}`, name: file.name, size: file.size, date: nowTs(), blobUrl };
              setAttachments(prev => [...prev, att]);
              return false;
            }}
            style={{ borderRadius: token.borderRadiusSM }}
          >
            <p style={{ margin: 0, paddingBottom: 4 }}><InboxOutlined style={{ fontSize: 24, color: token.colorPrimary }} /></p>
            <p style={{ margin: 0, fontSize: token.fontSizeSM, color: token.colorText }}>Drag files here or <span style={{ color: token.colorLink }}>click to upload</span></p>
            <p style={{ margin: '4px 0 0', fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>
              Images, PDFs, and screenshots
            </p>
          </Upload.Dragger>
        )}
        {attachments.length > 0 ? (
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
                role="button" tabIndex={0} aria-label={`Preview attachment ${att.name}`}
                onKeyDown={e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); setPreviewFile({ name: att.name, blobUrl: att.blobUrl }); }}
              >
                {fileIcon(att.name)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: token.fontSizeSM, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: token.colorLink }}>{att.name}</Text>
                  <Text style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>{fmtSize(att.size)} &middot; {att.date}</Text>
                </div>
                {editing && (
                  <Button
                    type="text" size="small" icon={<DeleteOutlined />}
                    style={{ color: token.colorTextTertiary, flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); setAttachments(prev => prev.filter(a => a.uid !== att.uid)); }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : !editing && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ margin: '24px 0' }}
            description={
              <span>
                <span style={{ display: 'block' }}>No attachments on this escalation.</span>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {status === 'Closed'
                    ? 'Attachments can no longer be added to a closed escalation.'
                    : caps.editEvents
                      ? 'Use Edit to add files.'
                      : 'Your role can view attachments but not add them.'}
                </Text>
              </span>
            }
          />
        )}
      </div>
    </div>
  );

  const detailsTab = (
    <div style={{ padding: '12px 0' }}>
      {/* Type and Title are form fields whenever the form is editable (Rob
          2026-08-05): selection is not hidden in the right-hand info card. */}
      {(isNew || editing) && (() => {
        const titleMeta = escalationTitleMeta(type);
        return (
          <>
            <div style={{ marginBottom: 16 }}>
              <SectionLabel token={token}>Escalation Type</SectionLabel>
              <Select<EscalationType>
                value={type}
                onChange={setType}
                size="small"
                style={{ width: '100%' }}
                placeholder="Select escalation type"
                aria-label="Escalation Type"
                options={managedTypes.map(t => ({ value: t.name, label: t.name }))}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <SectionLabel token={token}>{titleMeta.label}</SectionLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                size="small"
                placeholder={titleMeta.placeholder}
              />
              {titleMeta.help && (
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: token.fontSizeSM }}>
                  {titleMeta.help}
                </Text>
              )}
            </div>
            <Divider style={{ margin: '12px 0' }} />
          </>
        );
      })()}

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
          placeholder="Search by QE ID, branch, component..."
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
                <Tag style={{ fontSize: token.fontSizeXS, marginRight: 0 }}>{e.component}</Tag>
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
                      {e.component} &middot; {e.branch}
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
      styles={{ body: { padding: '12px 16px', overflow: 'auto' } }}
      tabList={[
        { key: 'details', tab: 'Details' },
        { key: 'linked-events', tab: `Linked Events (${linkedEventIds.length})` },
        { key: 'attachments', tab: <span><PaperClipOutlined style={{ marginRight: 4 }} />Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}</span> },
      ]}
      activeTabKey={activeTab}
      onTabChange={setActiveTab}
      size="small"
      tabBarExtraContent={
        isNew ? null : editing ? (
          <Space size={4}>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleCancelEdit}>Cancel</Button>
            <Button type="primary" size="small" icon={<SaveFilled />} onClick={handleSaveEdit}>Save</Button>
          </Space>
        ) : status === 'Open' && canEdit ? (
          <Button type="text" size="small" icon={<EditFilled />} onClick={() => setEditing(true)}>Edit</Button>
        ) : null
      }
    >
      {activeTab === 'details' ? detailsTab : activeTab === 'linked-events' ? linkedEventsTab : attachmentsTab}
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
        <Text style={{ fontSize: token.fontSizeSM }}>{type}</Text>
      </DisplayField>

      <DisplayField label="Status" token={token}>
        <Tag style={{ fontSize: token.fontSizeSM }}>
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
        <Space>
          <Button type="text" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleCreate}
            disabled={!title.trim() || !reportedIssue.trim() || !type}
          >
            Create Escalation
          </Button>
        </Space>
      );
    }
    if (!canEdit) return null;
    if (!editing && status === 'Open') {
      return (
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => setCloseModalOpen(true)}
        >
          Close & Send
        </Button>
      );
    }
    if (!editing && status === 'Closed') {
      return (
        <Button type="primary" onClick={() => {
          if (escalation) patchEscalation(escalation.id, { status: 'Open', updatedAt: nowTs() });
          setStatus('Open');
        }}>
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
        {/* Title bar under header when not new; in create mode the title input
            sits inside the details card above Reported Issue. */}
        {!isNew && (
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
              {title}
            </Text>
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
        onCancel={() => { setCloseModalOpen(false); setCloseMessage(''); }}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {fieldTechNames.map((name) => (
              <Tag key={name} style={{ fontSize: token.fontSizeSM, marginRight: 0 }}>
                {name}
              </Tag>
            ))}
          </div>
        )}
        <SectionLabel token={token}>Message (optional)</SectionLabel>
        <Input.TextArea
          value={closeMessage}
          onChange={(e) => setCloseMessage(e.target.value)}
          aria-label="Message for field technicians"
          rows={3}
          size="small"
          placeholder="Add a note for the field technicians..."
        />
      </Modal>
    </div>
  );
}
