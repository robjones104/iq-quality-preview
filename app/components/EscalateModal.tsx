'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Form, Input, Modal, Radio, Select, Typography, theme } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { useEscalationTypeStore } from '@/store/escalationTypeStore';
import { escalationTitleMeta } from '@/data/manageLists';
import type { Escalation } from '@/data/types';

const { TextArea } = Input;
const { Text } = Typography;

export type EscalateCreatePayload = { type: string; title: string; reportedIssue: string };

interface Props {
  open: boolean;
  onCancel: () => void;
  // Prefill source
  event: { id: string; issue: string; component: string; issueDescription: string };
  // Open escalations the event can be added to (recurrence path)
  openEscalations: Escalation[];
  // Returns the new escalation id; the modal shows an in-place success view
  // so the user stays on the event.
  onCreate: (payload: EscalateCreatePayload) => string;
  onLink: (escalationId: string) => void;
  // Recorded as the creator when a new escalation type is added inline.
  createdBy: string;
}

// The FQ escalate flow, modeled on Jira's "create linked issue": either start a
// new escalation of a managed type with fields prefilled from the event, or
// attach the event to an existing open escalation (systemic-issue recurrence).
export function EscalateModal({ open, onCancel, event, openEscalations, onCreate, onLink, createdBy }: Props) {
  const { token } = theme.useToken();
  const types = useEscalationTypeStore(s => s.types);
  const addType = useEscalationTypeStore(s => s.addType);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [form] = Form.useForm();
  const [existingId, setExistingId] = useState<string | undefined>(undefined);
  const [typeSearch, setTypeSearch] = useState('');
  const [result, setResult] = useState<{ id: string; linked: boolean } | null>(null);
  const selectedType = Form.useWatch('type', form);
  const titleMeta = escalationTitleMeta(selectedType);
  // The descriptive prefill only fits prose-titled types; reference-number
  // types (CAR #, PR #, Ticket #) start empty so the format hint shows.
  const defaultTitle = `${event.issue}: ${event.component}`;

  // destroyOnHidden remounts the Form on each open, so initialValues re-apply;
  // the remaining modal state resets in handleCancel.
  const handleCancel = () => {
    setMode('new');
    setExistingId(undefined);
    setTypeSearch('');
    setResult(null);
    onCancel();
  };

  const handleOk = () => {
    if (mode === 'existing') {
      if (existingId) {
        onLink(existingId);
        setResult({ id: existingId, linked: true });
      }
      return;
    }
    form.validateFields().then(values => {
      const id = onCreate({ type: values.type, title: values.title.trim(), reportedIssue: values.reportedIssue.trim() });
      setResult({ id, linked: false });
    });
  };

  return (
    <Modal
      title="Escalate Event"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={mode === 'new' ? 'Create Escalation' : 'Add to Escalation'}
      okButtonProps={{ disabled: mode === 'existing' && !existingId }}
      footer={result ? null : undefined}
      width={560}
      mask={{ closable: false }}
      destroyOnHidden
    >
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: token.fontSize }} />
            <Text style={{ fontSize: token.fontSize, fontWeight: 600 }}>
              {result.linked ? 'Added to Escalation' : 'Escalation Created'}
            </Text>
          </div>
          <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
            {event.id} is now linked to <Text code style={{ fontSize: token.fontSizeSM }}>{result.id}</Text>.
            You can keep working on this event; the escalation is available anytime from the Escalations screen.
          </Text>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Link href={`/escalations/${result.id}`}>
              <Button>View Escalation</Button>
            </Link>
            <Button type="primary" onClick={handleCancel}>Done</Button>
          </div>
        </div>
      ) : (
      <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: token.fontSizeSM }}>
        {event.id} will be linked to the escalation.
      </Text>

      <Radio.Group
        value={mode}
        onChange={e => setMode(e.target.value)}
        style={{ marginBottom: 16 }}
        options={[
          { value: 'new', label: 'Create new escalation' },
          { value: 'existing', label: 'Add to existing escalation' },
        ]}
      />

      {mode === 'new' ? (
        <Form
          form={form}
          layout="vertical"
          size="small"
          initialValues={{
            title: defaultTitle,
            reportedIssue: event.issueDescription,
          }}
        >
          <Form.Item name="type" label="Escalation Type" rules={[{ required: true, message: 'Type is required' }]}>
            <Select
              showSearch
              placeholder="Select or create a type"
              filterOption={false}
              onSearch={setTypeSearch}
              onChange={(v: string) => {
                let name = v;
                if (v?.startsWith('__create__')) {
                  name = v.slice('__create__'.length).trim();
                  addType(name, createdBy);
                  form.setFieldValue('type', name);
                }
                // Swap the untouched prefill for an empty field (and back) so
                // the reference-number hint shows; a hand-typed title is kept.
                const currentTitle = form.getFieldValue('title');
                if (escalationTitleMeta(name).isReference && currentTitle === defaultTitle) {
                  form.setFieldValue('title', '');
                } else if (!escalationTitleMeta(name).isReference && !currentTitle?.trim()) {
                  form.setFieldValue('title', defaultTitle);
                }
                setTypeSearch('');
              }}
              options={(() => {
                const q = typeSearch.trim().toLowerCase();
                const matches = q
                  ? types.filter(t => t.name.toLowerCase().includes(q))
                  : types;
                const opts = matches.map(t => ({ value: t.name, label: t.name }));
                const hasExact = types.some(t => t.name.toLowerCase() === q);
                return q && !hasExact
                  ? [...opts, { value: `__create__${typeSearch.trim()}`, label: `+ Create "${typeSearch.trim()}"` }]
                  : opts;
              })()}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label={titleMeta.label}
            extra={titleMeta.help}
            rules={[{ required: true, message: `${titleMeta.label} is required` }]}
          >
            <Input placeholder={titleMeta.placeholder} />
          </Form.Item>
          <Form.Item name="reportedIssue" label="Reported Issue" rules={[{ required: true, message: 'Reported issue is required' }]} style={{ marginBottom: 0 }}>
            <TextArea rows={4} placeholder="Describe the reported issue" />
          </Form.Item>
        </Form>
      ) : (
        <Select
          showSearch
          aria-label="Search escalations"
          style={{ width: '100%' }}
          placeholder="Search open escalations"
          value={existingId}
          onChange={setExistingId}
          optionFilterProp="label"
          options={openEscalations.map(e => ({
            value: e.id,
            label: `${e.id}: ${e.title} (${e.type})`,
          }))}
          notFoundContent="No open escalations"
        />
      )}
      </>
      )}
    </Modal>
  );
}
