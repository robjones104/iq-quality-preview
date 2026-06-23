'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import type { Escalation } from '@/data/escalations';

const { Text } = Typography;

type EventMapEntry = {
  reportedBy: string;
  branch: string;
  product: string;
};

type Props = {
  escalations: Escalation[];
  eventMap: Record<string, EventMapEntry>;
};

export function EscalationsClient({ escalations, eventMap }: Props) {
  const router = useRouter();
  const { token } = theme.useToken();
  const [_eventMap] = useState(eventMap);

  const columns: ColumnsType<Escalation> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 96,
      render: (id: string) => (
        <Link
          href={`/escalations/${id}`}
          style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, color: token.colorPrimary }}
          onClick={(e) => e.stopPropagation()}
        >
          {id}
        </Link>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string) => (
        <Text style={{ fontSize: token.fontSize }} ellipsis>
          {title}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (type: string) => <Tag style={{ fontSize: token.fontSizeSM }}>{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'Closed' ? 'green' : 'blue'} style={{ fontSize: token.fontSizeSM }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Events',
      key: 'events',
      width: 80,
      render: (_: unknown, row: Escalation) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {row.eventIds.length} event{row.eventIds.length !== 1 ? 's' : ''}
        </Text>
      ),
    },
    {
      title: 'Root Cause',
      dataIndex: 'rootCause',
      key: 'rootCause',
      ellipsis: true,
      render: (val: string | null) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
          {val ?? '—'}
        </Text>
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 140,
      render: (name: string) => <Text style={{ fontSize: token.fontSizeSM }}>{name}</Text>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 100,
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {val.slice(0, 10)}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        left={
          <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
            Escalations
          </Text>
        }
        right={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/escalations/new')}
          >
            New Escalation
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <Card
          size="small"
          styles={{ body: { padding: 0 } }}
        >
          <Table<Escalation>
            columns={columns}
            dataSource={escalations}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 25, size: 'small' }}
            locale={{ emptyText: 'No escalations yet.' }}
            onRow={(record) => ({
              onClick: () => router.push(`/escalations/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
      </div>
    </div>
  );
}
