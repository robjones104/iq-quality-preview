'use client';

import { Typography } from 'antd';

const { Title, Text } = Typography;

export function StubPage({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ padding: '32px 20px' }}>
      <Title level={4} style={{ marginBottom: 4 }}>{title}</Title>
      <Text type="secondary">{description ?? 'This page is coming soon.'}</Text>
    </div>
  );
}
