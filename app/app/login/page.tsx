'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, Input, Button, Form, Typography, theme } from 'antd';
import { login } from '@/lib/auth';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { token } = theme.useToken();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = ({ password }: { password: string }) => {
    setLoading(true);
    setError(false);

    if (login(password)) {
      router.replace('/dashboard');
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
          <Image src="/logo.png" alt="iQ Quality" width={72} height={72} style={{ marginBottom: 12, mixBlendMode: 'screen' }} />
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
