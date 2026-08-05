'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Segmented, Select, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { useEffectiveEscalations } from '@/lib/effectiveEscalations';
import { useEscalationTypeStore } from '@/store/escalationTypeStore';
import { useCapabilities } from '@/store/roleStore';
import type { Escalation } from '@/data/escalations';

const { Text } = Typography;

export function EscalationsClient() {
  const router = useRouter();
  const { token } = theme.useToken();
  const caps = useCapabilities();
  const escalations = useEffectiveEscalations();
  const managedTypes = useEscalationTypeStore(s => s.types);

  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Closed'>('All');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(searchParams.get('type') ?? undefined);

  // Filter options cover managed types plus any legacy types still on data.
  const typeOptions = useMemo(() => {
    const names = new Set<string>(managedTypes.map(t => t.name));
    escalations.forEach(e => names.add(e.type));
    return [...names].map(name => ({ value: name, label: name }));
  }, [managedTypes, escalations]);

  const visible = useMemo(
    () => escalations.filter(e =>
      (statusFilter === 'All' || e.status === statusFilter) &&
      (!typeFilter || e.type === typeFilter)
    ),
    [escalations, statusFilter, typeFilter],
  );

  const columns: ColumnsType<Escalation> = [
    {
      // The ID column was cut (Rob, 2026-08-03): the reference number lives in
      // the title for reference-type escalations, and rows navigate on click.
      // Title is the drill-in link.
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, row) => (
        <Link
          href={`/escalations/${row.id}`}
          style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorLink, textDecoration: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {title}
        </Link>
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
          caps.editEvents ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push('/escalations/new')}
            >
              New Escalation
            </Button>
          ) : undefined
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <Segmented
            options={['All', 'Open', 'Closed']}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as 'All' | 'Open' | 'Closed')}
          />
          <Select
            allowClear
            aria-label="Filter by escalation type"
            placeholder="All types"
            style={{ minWidth: 220 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
          />
          <Text type="secondary" style={{ fontSize: token.fontSizeSM, marginLeft: 'auto' }}>
            {visible.length} escalation{visible.length !== 1 ? 's' : ''}
          </Text>
        </div>
        <Card
          size="small"
          styles={{ body: { padding: 0 } }}
        >
          <Table<Escalation>
            columns={columns}
            dataSource={visible}
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
