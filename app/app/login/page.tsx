'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Form, Typography, theme } from 'antd';

const { Title, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async ({ password }: { password: string }) => {
    setLoading(true);
    setError(false);

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: token.colorBgLayout,
    }}>
      <Card style={{ width: 360 }} variant="outlined">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.png" alt="iQ Quality" style={{ width: 72, height: 72, marginBottom: 12, mixBlendMode: 'screen' }} />
          <Title level={4} style={{ margin: '0 0 4px' }}>iQ Quality Preview</Title>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Enter the access code to continue</Text>
        </div>
        <Form onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="password"
            validateStatus={error ? 'error' : ''}
            help={error ? 'Incorrect access code' : ''}
          >
            <Input.Password
              placeholder="Access code"
              size="large"
              onChange={() => setError(false)}
              autoFocus
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Enter
          </Button>
        </Form>
      </Card>
    </div>
  );
}
