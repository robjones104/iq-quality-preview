'use client';

import { Form, Input, Modal, Typography, notification, theme } from 'antd';

const { TextArea } = Input;
const { Text } = Typography;

interface Props {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  eventIds?: string[];
}

export function CreateEscalationModal({ open, onCancel, onSuccess, eventIds = [] }: Props) {
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  const handleOk = () => {
    form.validateFields().then(() => {
      notification.success({
        message: 'Custom escalation created',
        description: eventIds.length > 0
          ? `${eventIds.length} event${eventIds.length > 1 ? 's' : ''} linked.`
          : undefined,
        placement: 'bottomRight',
        duration: 4,
      });
      form.resetFields();
      onSuccess();
    });
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="Create Custom Escalation"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Create Escalation"
      width={560}
      destroyOnClose
    >
      {eventIds.length > 0 && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: token.fontSize }}>
          {eventIds.length} event{eventIds.length > 1 ? 's' : ''} will be linked to this escalation.
        </Text>
      )}
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
          <Input placeholder="Brief title describing the escalation" />
        </Form.Item>
        <Form.Item name="reportedIssue" label="Reported Issue" rules={[{ required: true, message: 'Reported issue is required' }]}>
          <TextArea rows={3} placeholder="Describe the reported issue" />
        </Form.Item>
        <Form.Item name="rootCause" label="Root Cause (optional)" style={{ marginBottom: 10 }}>
          <TextArea rows={2} placeholder="Root cause, if known" />
        </Form.Item>
        <Form.Item name="correctionImplemented" label="Correction Implemented (optional)" style={{ marginBottom: 10 }}>
          <TextArea rows={2} placeholder="Steps taken or planned" />
        </Form.Item>
        <Form.Item name="fieldAction" label="Field Action (optional)" style={{ marginBottom: 0 }}>
          <TextArea rows={2} placeholder="Instructions for field technicians" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
