'use client';

import { useState } from 'react';
import { Table, Button, Typography, Tooltip, Input, Select, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MoreOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { logs } from '@/data/logs';
import { StatusTag } from '@/components/StatusTag';
import { PageHeader } from '@/components/PageHeader';
import type { ActivityLog, EventStatus } from '@/data/types';
const { Text } = Typography;

export default function LogsPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'All'>('All');
  const { token } = theme.useToken();

  const filtered = logs.filter((log) => {
    const matchSearch =
      !search ||
      log.employee.toLowerCase().includes(search.toLowerCase()) ||
      log.comment.toLowerCase().includes(search.toLowerCase()) ||
      log.eventId.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'All' || log.role === roleFilter;
    const matchStatus = statusFilter === 'All' || log.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const uniqueRoles = ['All', ...Array.from(new Set(logs.map((l) => l.role)))];

  const columns: ColumnsType<ActivityLog> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: 'descend',
      render: (date: string) => <Text style={{ whiteSpace: 'nowrap' }}>{date}</Text>,
      width: 160,
    },
    {
      title: 'Event',
      dataIndex: 'eventId',
      key: 'eventId',
      sorter: (a, b) => a.eventId.localeCompare(b.eventId),
      render: (eventId: string) => (
        <Link href={`/events/${eventId}`} style={{ color: token.colorLink, fontWeight: 500, textDecoration: 'none' }}>
          {eventId}
        </Link>
      ),
      width: 110,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      sorter: (a, b) => a.role.localeCompare(b.role),
      filters: uniqueRoles.filter((r) => r !== 'All').map((r) => ({ text: r, value: r })),
      onFilter: (value, record) => record.role === value,
      width: 160,
    },
    {
      title: 'Employee',
      dataIndex: 'employee',
      key: 'employee',
      sorter: (a, b) => a.employee.localeCompare(b.employee),
      width: 220,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      filters: ['Reported', 'Under Investigation', 'Validated', 'Invalidated'].map((s) => ({ text: s, value: s })),
      onFilter: (value, record) => record.status === value,
      render: (status: EventStatus) => <StatusTag status={status} />,
      width: 160,
    },
    {
      title: 'Comment',
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string) => (
        <Text style={{ display: 'block', lineHeight: '20px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
          {comment}
        </Text>
      ),
    },
    {
      title: '',
      key: 'options',
      width: 48,
      render: () => (
        <Tooltip title="Options">
          <Button type="text" size="small" icon={<MoreOutlined style={{ fontSize: token.fontSizeLG }} />} />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        left={
          <Input.Search
            placeholder="Search employee, comment, event ID..."
            allowClear
            style={{ width: 300 }}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setSearch(v)}
          />
        }
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              value={roleFilter}
              onChange={(v) => setRoleFilter(v)}
              style={{ width: 160 }}
              options={uniqueRoles.map((r) => ({ value: r, label: r === 'All' ? 'All Roles' : r }))}
            />
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 180 }}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Reported', label: 'Reported' },
                { value: 'Under Investigation', label: 'Under Investigation' },
                { value: 'Validated', label: 'Validated' },
                { value: 'Invalidated', label: 'Invalidated' },
              ]}
            />
          </div>
        }
      />

      <div style={{ padding: `${token.padding}px ${token.paddingMD}px` }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
          }}
        />
      </div>
    </>
  );
}
