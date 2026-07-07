'use client';

import { Button, Card, Form, Input, Typography, message, theme } from 'antd';
import { PageHeader } from '@/components/PageHeader';

const { Text } = Typography;

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function AccountPage() {
  const { token } = theme.useToken();
  const [form] = Form.useForm<PasswordFormValues>();

  const handleSubmit = () => {
    message.success('Password updated');
    form.resetFields();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        left={
          <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
            Edit Password
          </Text>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <Card title="Change Password" size="small">
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              name="currentPassword"
              label="Current Password"
              rules={[{ required: true, message: 'Enter your current password' }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="New Password"
              rules={[{ required: true, message: 'Enter a new password' }, { min: 8, message: 'Password must be at least 8 characters' }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Confirm New Password"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Confirm your new password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Update Password
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
