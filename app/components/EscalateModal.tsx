'use client';

import { useEffect, useState } from 'react';
import { Form, Input, Modal, Radio, Select, Typography, theme } from 'antd';
import { useEscalationTypeStore } from '@/store/escalationTypeStore';
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
  onCreate: (payload: EscalateCreatePayload) => void;
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

  // Re-prefill each time the modal opens for a fresh event context.
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        type: undefined,
        title: `${event.issue}: ${event.component}`,
        reportedIssue: event.issueDescription,
      });
      setMode('new');
      setExistingId(undefined);
    }
  }, [open, event.id, event.issue, event.component, event.issueDescription, form]);

  const handleOk = () => {
    if (mode === 'existing') {
      if (existingId) onLink(existingId);
      return;
    }
    form.validateFields().then(values => {
      onCreate({ type: values.type, title: values.title.trim(), reportedIssue: values.reportedIssue.trim() });
    });
  };

  return (
    <Modal
      title="Escalate Event"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText={mode === 'new' ? 'Create Escalation' : 'Add to Escalation'}
      okButtonProps={{ disabled: mode === 'existing' && !existingId }}
      width={560}
      maskClosable={false}
      destroyOnClose
    >
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
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="type" label="Escalation Type" rules={[{ required: true, message: 'Type is required' }]}>
            <Select
              showSearch
              placeholder="Select or create a type"
              filterOption={false}
              onSearch={setTypeSearch}
              onChange={(v: string) => {
                if (v?.startsWith('__create__')) {
                  const name = v.slice('__create__'.length).trim();
                  addType(name, createdBy);
                  form.setFieldValue('type', name);
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
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="Brief title describing the escalation" />
          </Form.Item>
          <Form.Item name="reportedIssue" label="Reported Issue" rules={[{ required: true, message: 'Reported issue is required' }]} style={{ marginBottom: 0 }}>
            <TextArea rows={4} placeholder="Describe the reported issue" />
          </Form.Item>
        </Form>
      ) : (
        <Select
          showSearch
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
    </Modal>
  );
}
