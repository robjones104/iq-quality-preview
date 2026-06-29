'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button, Divider, Input, Popconfirm, Table, Tabs, Tag, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined, CloseOutlined, DeleteFilled, EditFilled,
  PlusOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { StatusTag } from '@/components/StatusTag';
import type { QualityEvent, EventStatus } from '@/data/types';
import type { Escalation } from '@/data/escalations';
import type { ListItem } from '@/data/manageLists';

const { Text } = Typography;

type Props = {
  defaultTab: 'root-causes' | 'tags' | 'escalations';
  events: QualityEvent[];
  escalations: Escalation[];
  initialRootCauses: ListItem[];
  initialTags: ListItem[];
};

export function ManageListsClient({
  defaultTab,
  events,
  escalations,
  initialRootCauses,
  initialTags,
}: Props) {
  const router = useRouter();
  const { token } = theme.useToken();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [rootCauses, setRootCauses] = useState<ListItem[]>(initialRootCauses);
  const [tags, setTags] = useState<ListItem[]>(initialTags);
  const [selectedItem, setSelectedItem] = useState<{
    type: 'root-cause' | 'tag' | 'escalation';
    name: string;
    id: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [addingTo, setAddingTo] = useState<'root-causes' | 'tags' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [selectedRootCauseKeys, setSelectedRootCauseKeys] = useState<React.Key[]>([]);
  const [selectedTagKeys, setSelectedTagKeys] = useState<React.Key[]>([]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const nextId = (_prefix: string, _list: ListItem[]) =>
    `${_prefix}-${Date.now()}`;

  const sectionLabel = (text: string) => (
    <Text
      style={{
        fontSize: token.fontSizeSM,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        color: token.colorTextTertiary,
      }}
    >
      {text}
    </Text>
  );

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const saveEdit = (
    list: ListItem[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
  ) => {
    setList(list.map(item =>
      item.id === editingId ? { ...item, name: editingName } : item,
    ));
    // If the selected item was the one being edited, update its name in state too
    if (selectedItem?.id === editingId) {
      setSelectedItem(prev => prev ? { ...prev, name: editingName } : null);
    }
    setEditingId(null);
    setEditingName('');
  };

  const deleteItem = (
    id: string,
    _list: ListItem[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
  ) => {
    setList(prev => prev.filter(item => item.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
  };

  const addItem = (type: 'root-causes' | 'tags') => {
    if (!newItemName.trim()) return;
    const newItem: ListItem = {
      id: nextId(type === 'root-causes' ? 'rc' : 'tag', type === 'root-causes' ? rootCauses : tags),
      name: newItemName.trim(),
      createdBy: 'Theron K. Aldwick',
      createdAt: new Date().toISOString().slice(0, 10),
      isSystem: false,
    };
    if (type === 'root-causes') setRootCauses(prev => [...prev, newItem]);
    else setTags(prev => [...prev, newItem]);
    setNewItemName('');
    setAddingTo(null);
  };

  const batchDelete = (
    keys: React.Key[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
    setKeys: React.Dispatch<React.SetStateAction<React.Key[]>>,
  ) => {
    setList(prev => prev.filter(item => !keys.includes(item.id)));
    if (selectedItem && keys.includes(selectedItem.id)) setSelectedItem(null);
    setKeys([]);
  };

  const batchToolbar = (
    keys: React.Key[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
    setKeys: React.Dispatch<React.SetStateAction<React.Key[]>>,
  ) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px',
      background: token.colorPrimaryBg,
      border: `1px solid ${token.colorPrimaryBorder}`,
      borderRadius: token.borderRadiusSM,
      marginBottom: 4,
    }}>
      <Text style={{ fontSize: token.fontSizeSM, color: token.colorText, flex: 1 }}>
        {keys.length} selected
      </Text>
      <Popconfirm
        title={`Delete ${keys.length} item${keys.length !== 1 ? 's' : ''}?`}
        description="This will remove them from all dropdowns."
        okText="Delete"
        okButtonProps={{ danger: true }}
        onConfirm={() => batchDelete(keys, setList, setKeys)}
      >
        <Button size="small" type="primary" danger icon={<DeleteFilled />}>
          Delete
        </Button>
      </Popconfirm>
      <Button size="small" type="text" onClick={() => setKeys([])}>
        Clear
      </Button>
    </div>
  );

  // ── Column builders ────────────────────────────────────────────────────────

  const listColumns = (
    type: 'root-causes' | 'tags',
    list: ListItem[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
  ): ColumnsType<ListItem> => [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ListItem) => {
        if (editingId === record.id) {
          return (
            <Input
              size="small"
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              onPressEnter={() => saveEdit(list, setList)}
              autoFocus
              style={{ width: 200 }}
            />
          );
        }
        return <Text style={{ fontSize: token.fontSize }}>{name}</Text>;
      },
    },
    {
      title: 'Events',
      key: 'events',
      width: 80,
      render: (_: unknown, record: ListItem) => {
        const count =
          type === 'root-causes'
            ? events.filter(e => e.rootCause === record.name).length
            : events.filter(e => e.tags?.includes(record.name)).length;
        return (
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {count}
          </Text>
        );
      },
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{v}</Text>
      ),
    },
    {
      title: 'Added',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{v.slice(0, 10)}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ListItem) => {
        if (editingId === record.id) {
          return (
            <span style={{ display: 'flex', gap: 4 }}>
              <Button
                size="small"
                type="text"
                icon={<CheckOutlined />}
                style={{ color: token.colorSuccess }}
                onClick={() => saveEdit(list, setList)}
              />
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined />}
                style={{ color: token.colorTextTertiary }}
                onClick={() => { setEditingId(null); setEditingName(''); }}
              />
            </span>
          );
        }
        return (
          <span style={{ display: 'flex', gap: 4 }}>
            <Button
              size="small"
              type="text"
              icon={<EditFilled />}
              style={{ color: token.colorTextTertiary }}
              onClick={e => {
                e.stopPropagation();
                setEditingId(record.id);
                setEditingName(record.name);
              }}
            />
            <Popconfirm
              title="Delete this item?"
              description={
                record.isSystem
                  ? 'This is a system default. Deleting it will remove it from all dropdowns.'
                  : 'This will remove it from all dropdowns.'
              }
              onConfirm={e => {
                e?.stopPropagation();
                deleteItem(record.id, list, setList);
              }}
              okText="Delete"
              okButtonProps={{ danger: true }}
              onCancel={e => e?.stopPropagation()}
            >
              <Button
                size="small"
                type="text"
                icon={<DeleteFilled />}
                style={{ color: token.colorTextTertiary }}
                onClick={e => e.stopPropagation()}
              />
            </Popconfirm>
          </span>
        );
      },
    },
  ];

  const escalationColumns: ColumnsType<Escalation> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: string) => (
        <Link
          href={`/escalations/${id}`}
          style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, color: token.colorPrimary }}
          onClick={e => e.stopPropagation()}
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
      render: (t: string) => (
        <Text style={{ fontSize: token.fontSizeSM }} ellipsis>{t}</Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (t: string) => (
        <Tag style={{ fontSize: token.fontSizeSM, margin: 0 }}>{t}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) => (
        <Tag
          color={s === 'Closed' ? 'green' : 'blue'}
          style={{ fontSize: token.fontSizeSM, margin: 0 }}
        >
          {s}
        </Tag>
      ),
    },
    {
      title: 'Events',
      key: 'events',
      width: 72,
      render: (_: unknown, row: Escalation) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{row.eventIds.length}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 64,
      render: (_: unknown, row: Escalation) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <Button
            size="small"
            type="text"
            icon={<EditFilled />}
            style={{ color: token.colorTextTertiary }}
            onClick={e => {
              e.stopPropagation();
              router.push(`/escalations/${row.id}`);
            }}
          />
          <Popconfirm
            title="Remove this escalation from the list?"
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={e => {
              e?.stopPropagation();
              if (selectedItem?.id === row.id) setSelectedItem(null);
            }}
            onCancel={e => e?.stopPropagation()}
          >
            <Button
              size="small"
              type="text"
              icon={<DeleteFilled />}
              style={{ color: token.colorTextTertiary }}
              onClick={e => e.stopPropagation()}
            />
          </Popconfirm>
        </span>
      ),
    },
  ];

  // ── Derived panel data ─────────────────────────────────────────────────────

  const panelEvents: QualityEvent[] = (() => {
    if (!selectedItem) return [];
    if (selectedItem.type === 'root-cause') {
      return events.filter(e => e.rootCause === selectedItem.name);
    }
    if (selectedItem.type === 'tag') {
      return events.filter(e => e.tags?.includes(selectedItem.name));
    }
    // escalation
    const esc = escalations.find(e => e.id === selectedItem.id);
    if (!esc) return [];
    return events.filter(e => esc.eventIds.includes(e.id));
  })();

  // ── Add-row UI ─────────────────────────────────────────────────────────────

  const addRowUI = (type: 'root-causes' | 'tags') =>
    addingTo === type ? (
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 0',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Input
          size="small"
          placeholder={`New ${type === 'root-causes' ? 'root cause' : 'tag'}...`}
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          onPressEnter={() => addItem(type)}
          autoFocus
          style={{ flex: 1 }}
        />
        <Button size="small" type="primary" onClick={() => addItem(type)}>
          Add
        </Button>
        <Button
          size="small"
          type="text"
          onClick={() => { setAddingTo(null); setNewItemName(''); }}
        >
          Cancel
        </Button>
      </div>
    ) : null;

  // ── Tab content ────────────────────────────────────────────────────────────

  const rootCausesTabContent = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {selectedRootCauseKeys.length > 0 && batchToolbar(selectedRootCauseKeys, setRootCauses, setSelectedRootCauseKeys)}
      <Table
        dataSource={rootCauses}
        rowKey="id"
        size="small"
        pagination={false}
        rowSelection={{ selectedRowKeys: selectedRootCauseKeys, onChange: setSelectedRootCauseKeys }}
        columns={listColumns('root-causes', rootCauses, setRootCauses)}
        onRow={record => ({
          onClick: () =>
            setSelectedItem({ type: 'root-cause', name: record.name, id: record.id }),
          style: {
            cursor: 'pointer',
            background:
              selectedItem?.id === record.id ? token.colorPrimaryBg : undefined,
          },
        })}
      />
      {addRowUI('root-causes')}
    </div>
  );

  const tagsTabContent = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {selectedTagKeys.length > 0 && batchToolbar(selectedTagKeys, setTags, setSelectedTagKeys)}
      <Table
        dataSource={tags}
        rowKey="id"
        size="small"
        pagination={false}
        rowSelection={{ selectedRowKeys: selectedTagKeys, onChange: setSelectedTagKeys }}
        columns={listColumns('tags', tags, setTags)}
        onRow={record => ({
          onClick: () =>
            setSelectedItem({ type: 'tag', name: record.name, id: record.id }),
          style: {
            cursor: 'pointer',
            background:
              selectedItem?.id === record.id ? token.colorPrimaryBg : undefined,
          },
        })}
      />
      {addRowUI('tags')}
    </div>
  );

  const escalationsTabContent = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Table
        dataSource={escalations}
        rowKey="id"
        size="small"
        pagination={false}
        columns={escalationColumns}
        onRow={record => ({
          onClick: () =>
            setSelectedItem({ type: 'escalation', name: record.title, id: record.id }),
          style: {
            cursor: 'pointer',
            background:
              selectedItem?.id === record.id ? token.colorPrimaryBg : undefined,
          },
        })}
      />
    </div>
  );

  // ── Right panel ────────────────────────────────────────────────────────────

  const rightPanel = selectedItem ? (
    <div
      style={{
        width: 380,
        flexShrink: 0,
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        padding: '16px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sectionLabel(
            selectedItem.type === 'escalation'
              ? 'Escalation'
              : selectedItem.type === 'root-cause'
              ? 'Root Cause'
              : 'Tag',
          )}
          <Text style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorText }}>
            {selectedItem.name}
          </Text>
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={() => setSelectedItem(null)}
          style={{ color: token.colorTextTertiary }}
        />
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* Count */}
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {panelEvents.length} event{panelEvents.length !== 1 ? 's' : ''}
      </Text>

      {/* Events table */}
      <Table
        dataSource={panelEvents}
        rowKey="id"
        size="small"
        pagination={panelEvents.length > 10 ? { pageSize: 10, size: 'small' } : false}
        locale={{ emptyText: 'No events found.' }}
        columns={[
          {
            title: 'Event',
            dataIndex: 'id',
            key: 'id',
            width: 100,
            render: (id: string) => (
              <Link
                href={`/events/${id}`}
                style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, color: token.colorPrimary }}
              >
                {id}
              </Link>
            ),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (s: EventStatus) => <StatusTag status={s} />,
          },
          {
            title: 'Branch',
            dataIndex: 'branch',
            key: 'branch',
            render: (b: string) => <Text style={{ fontSize: token.fontSizeSM }}>{b}</Text>,
          },
          {
            title: 'Product',
            dataIndex: 'product',
            key: 'product',
            render: (p: string) => <Text style={{ fontSize: token.fontSizeSM }}>{p}</Text>,
          },
        ]}
        onRow={record => ({
          onClick: () => router.push(`/events/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  ) : null;

  // ── Header action — varies by active tab ──────────────────────────────────

  const headerAction = activeTab === 'root-causes' ? (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddingTo('root-causes')}>
      Add Root Cause
    </Button>
  ) : activeTab === 'tags' ? (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddingTo('tags')}>
      Add Tag
    </Button>
  ) : (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/escalations/new')}>
      New Escalation
    </Button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        left={
          <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
            Manage Lists
          </Text>
        }
        right={headerAction}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: tabs + tables */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={key => {
              setActiveTab(key as typeof activeTab);
              setSelectedItem(null);
              setSelectedRootCauseKeys([]);
              setSelectedTagKeys([]);
            }}
            size="small"
            style={{ flex: 1 }}
            items={[
              {
                key: 'root-causes',
                label: `Root Causes (${rootCauses.length})`,
                children: rootCausesTabContent,
              },
              {
                key: 'tags',
                label: `Tags (${tags.length})`,
                children: tagsTabContent,
              },
              {
                key: 'escalations',
                label: `Escalations (${escalations.length})`,
                children: escalationsTabContent,
              },
            ]}
          />
        </div>
        {/* Right: event panel */}
        {selectedItem && rightPanel}
      </div>
    </div>
  );
}
