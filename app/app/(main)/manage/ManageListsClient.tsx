'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button, Card, Grid, Input, Modal, Table, Tabs, Tag, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined, CloseOutlined, DeleteFilled, EditFilled,
  PlusOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import type { QualityEvent } from '@/data/types';
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
  const screens = Grid.useBreakpoint();

  const [activeTab, setActiveTab]   = useState(defaultTab);
  const [rootCauses, setRootCauses] = useState<ListItem[]>(initialRootCauses);
  const [tags, setTags]             = useState<ListItem[]>(initialTags);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [addingTo, setAddingTo]     = useState<'root-causes' | 'tags' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [selectedRootCauseKeys, setSelectedRootCauseKeys] = useState<React.Key[]>([]);
  const [selectedTagKeys, setSelectedTagKeys]             = useState<React.Key[]>([]);

  // Delete modals
  type DeleteItemTarget = {
    record: ListItem;
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>;
  };
  type BatchDeleteTarget = {
    keys: React.Key[];
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>;
    setKeys: React.Dispatch<React.SetStateAction<React.Key[]>>;
  };
  const [deleteItemTarget,  setDeleteItemTarget]  = useState<DeleteItemTarget | null>(null);
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<BatchDeleteTarget | null>(null);
  const [deleteEscTarget,   setDeleteEscTarget]   = useState<Escalation | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const nextId = (_prefix: string, _list: ListItem[]) =>
    `${_prefix}-${Date.now()}`;

  const sectionLabel = (text: string) => (
    <Text style={{
      fontSize: token.fontSizeSM, fontWeight: 600,
      textTransform: 'uppercase' as const, letterSpacing: '0.5px',
      color: token.colorTextTertiary,
    }}>
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
    setEditingId(null);
    setEditingName('');
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

  const eventCount = (type: 'root-causes' | 'tags', record: ListItem) =>
    type === 'root-causes'
      ? events.filter(e => e.rootCause === record.name).length
      : events.filter(e => e.tags?.includes(record.name)).length;

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
      <Button
        size="small" type="primary" danger icon={<DeleteFilled />}
        onClick={() => setBatchDeleteTarget({ keys, setList, setKeys })}
      >
        Delete
      </Button>
      <Button size="small" type="text" onClick={() => setKeys([])}>
        Clear
      </Button>
    </div>
  );

  // ── Card renderer (mobile/tablet) ──────────────────────────────────────────

  const listItemCard = (
    type: 'root-causes' | 'tags',
    record: ListItem,
    list: ListItem[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
  ) => (
    <Card
      key={record.id}
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 } }}
      onClick={() => router.push(
        type === 'root-causes'
          ? `/events?rootCause=${encodeURIComponent(record.name)}`
          : `/events?tag=${encodeURIComponent(record.name)}`
      )}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {editingId === record.id ? (
          <Input
            size="small"
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onPressEnter={() => saveEdit(list, setList)}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <Text style={{ fontWeight: 600, fontSize: token.fontSize, lineHeight: 1.4 }}>
            {record.name}
          </Text>
        )}

        <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.4 }}>
          {eventCount(type, record)} event{eventCount(type, record) !== 1 ? 's' : ''}
          {record.isSystem ? ' · System default' : ''}
        </Text>

        <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.4 }}>
          {record.createdBy} · {record.createdAt.slice(0, 10)}
        </Text>
      </div>

      <div
        style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {editingId === record.id ? (
          <>
            <Button size="small" type="text" icon={<CheckOutlined />}
              style={{ color: token.colorSuccess }}
              onClick={() => saveEdit(list, setList)} />
            <Button size="small" type="text" icon={<CloseOutlined />}
              style={{ color: token.colorTextTertiary }}
              onClick={() => { setEditingId(null); setEditingName(''); }} />
          </>
        ) : (
          <>
            <Button size="small" type="text" icon={<EditFilled />}
              style={{ color: token.colorTextTertiary }}
              onClick={() => { setEditingId(record.id); setEditingName(record.name); }} />
            <Button size="small" type="text" icon={<DeleteFilled />}
              style={{ color: token.colorTextTertiary }}
              onClick={() => setDeleteItemTarget({ record, setList })} />
          </>
        )}
      </div>
    </Card>
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
      sorter: (a, b) => a.name.localeCompare(b.name),
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
      sorter: (a, b) => eventCount(type, a) - eventCount(type, b),
      render: (_: unknown, record: ListItem) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {eventCount(type, record)}
        </Text>
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
      sorter: (a, b) => a.createdBy.localeCompare(b.createdBy),
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{v}</Text>
      ),
    },
    {
      title: 'Added',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
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
              <Button size="small" type="text" icon={<CheckOutlined />}
                style={{ color: token.colorSuccess }}
                onClick={() => saveEdit(list, setList)} />
              <Button size="small" type="text" icon={<CloseOutlined />}
                style={{ color: token.colorTextTertiary }}
                onClick={() => { setEditingId(null); setEditingName(''); }} />
            </span>
          );
        }
        return (
          <span style={{ display: 'flex', gap: 4 }}>
            <Button size="small" type="text" icon={<EditFilled />}
              style={{ color: token.colorTextTertiary }}
              onClick={e => {
                e.stopPropagation();
                setEditingId(record.id);
                setEditingName(record.name);
              }} />
            <Button size="small" type="text" icon={<DeleteFilled />}
              style={{ color: token.colorTextTertiary }}
              onClick={e => {
                e.stopPropagation();
                setDeleteItemTarget({ record, setList });
              }} />
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
      sorter: (a, b) => a.id.localeCompare(b.id),
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
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (t: string) => (
        <Text style={{ fontSize: token.fontSizeSM }} ellipsis>{t}</Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      sorter: (a, b) => a.type.localeCompare(b.type),
      render: (t: string) => (
        <Tag style={{ fontSize: token.fontSizeSM, margin: 0 }}>{t}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (s: string) => (
        <Tag color={s === 'Closed' ? 'green' : 'blue'} style={{ fontSize: token.fontSizeSM, margin: 0 }}>
          {s}
        </Tag>
      ),
    },
    {
      title: 'Events',
      key: 'events',
      width: 72,
      sorter: (a, b) => a.eventIds.length - b.eventIds.length,
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
          <Button size="small" type="text" icon={<EditFilled />}
            style={{ color: token.colorTextTertiary }}
            onClick={e => { e.stopPropagation(); router.push(`/escalations/${row.id}`); }} />
          <Button size="small" type="text" icon={<DeleteFilled />}
            style={{ color: token.colorTextTertiary }}
            onClick={e => { e.stopPropagation(); setDeleteEscTarget(row); }} />
        </span>
      ),
    },
  ];

  // ── Add-row UI ─────────────────────────────────────────────────────────────

  const addRowUI = (type: 'root-causes' | 'tags') =>
    addingTo === type ? (
      <div style={{
        display: 'flex', gap: 8, padding: '8px 0',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}>
        <Input
          size="small"
          placeholder={`New ${type === 'root-causes' ? 'root cause' : 'tag'}...`}
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          onPressEnter={() => addItem(type)}
          autoFocus
          style={{ flex: 1 }}
        />
        <Button size="small" type="primary" onClick={() => addItem(type)}>Add</Button>
        <Button size="small" type="text" onClick={() => { setAddingTo(null); setNewItemName(''); }}>
          Cancel
        </Button>
      </div>
    ) : null;

  // ── Tab content ────────────────────────────────────────────────────────────

  const listTabContent = (
    type: 'root-causes' | 'tags',
    list: ListItem[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
    selectedKeys: React.Key[],
    setKeys: React.Dispatch<React.SetStateAction<React.Key[]>>,
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {selectedKeys.length > 0 && batchToolbar(selectedKeys, setList, setKeys)}
      {screens.xl === false ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: screens.md !== false ? 'repeat(2, 1fr)' : '1fr',
          gap: 12,
        }}>
          {list.map(record => listItemCard(type, record, list, setList))}
        </div>
      ) : (
        <Table
          dataSource={list}
          rowKey="id"
          size="small"
          pagination={false}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setKeys }}
          columns={listColumns(type, list, setList)}
          onRow={record => ({
            onClick: () => router.push(
              type === 'root-causes'
                ? `/events?rootCause=${encodeURIComponent(record.name)}`
                : `/events?tag=${encodeURIComponent(record.name)}`
            ),
            style: { cursor: 'pointer' },
          })}
        />
      )}
      {addRowUI(type)}
    </div>
  );

  const escalationsTabContent = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {screens.xl === false ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: screens.md !== false ? 'repeat(2, 1fr)' : '1fr',
          gap: 12,
        }}>
          {escalations.map(esc => (
            <Card
              key={esc.id}
              size="small"
              hoverable
              style={{ height: '100%' }}
              styles={{ body: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 } }}
              onClick={() => {
                const ids = esc.eventIds.join(',');
                router.push(ids ? `/events?ids=${ids}` : '/events');
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <Link
                    href={`/escalations/${esc.id}`}
                    style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, color: token.colorPrimary }}
                    onClick={e => e.stopPropagation()}
                  >
                    {esc.id}
                  </Link>
                  <Tag
                    color={esc.status === 'Closed' ? 'green' : 'blue'}
                    style={{ fontSize: token.fontSizeSM, margin: 0 }}
                  >
                    {esc.status}
                  </Tag>
                </div>

                <Text style={{ fontSize: token.fontSize, fontWeight: 500, lineHeight: 1.4 }}>
                  {esc.title}
                </Text>

                <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.4 }}>
                  {esc.type} · {esc.eventIds.length} event{esc.eventIds.length !== 1 ? 's' : ''}
                </Text>
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 'auto' }}
                onClick={e => e.stopPropagation()}
              >
                <Button size="small" type="text" icon={<EditFilled />}
                  style={{ color: token.colorTextTertiary }}
                  onClick={() => router.push(`/escalations/${esc.id}`)} />
                <Button size="small" type="text" icon={<DeleteFilled />}
                  style={{ color: token.colorTextTertiary }}
                  onClick={() => setDeleteEscTarget(esc)} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          dataSource={escalations}
          rowKey="id"
          size="small"
          pagination={false}
          columns={escalationColumns}
          onRow={record => ({
            onClick: () => {
              const ids = record.eventIds.join(',');
              router.push(ids ? `/events?ids=${ids}` : '/events');
            },
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </div>
  );

  // ── Header action ──────────────────────────────────────────────────────────

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
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
          <Tabs
            activeKey={activeTab}
            onChange={key => {
              setActiveTab(key as typeof activeTab);
              setSelectedRootCauseKeys([]);
              setSelectedTagKeys([]);
            }}
            size="small"
            style={{ flex: 1 }}
            items={[
              {
                key: 'root-causes',
                label: `Root Causes (${rootCauses.length})`,
                children: listTabContent('root-causes', rootCauses, setRootCauses, selectedRootCauseKeys, setSelectedRootCauseKeys),
              },
              {
                key: 'tags',
                label: `Tags (${tags.length})`,
                children: listTabContent('tags', tags, setTags, selectedTagKeys, setSelectedTagKeys),
              },
              {
                key: 'escalations',
                label: `Escalations (${escalations.length})`,
                children: escalationsTabContent,
              },
            ]}
          />
        </div>
      </div>

      {/* Delete single item */}
      <Modal
        title="Delete Item"
        open={deleteItemTarget !== null}
        onCancel={() => setDeleteItemTarget(null)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDeleteItemTarget(null)}>Cancel</Button>
            <Button danger type="primary" onClick={() => {
              if (!deleteItemTarget) return;
              deleteItemTarget.setList(prev => prev.filter(item => item.id !== deleteItemTarget.record.id));
              setDeleteItemTarget(null);
            }}>
              Delete
            </Button>
          </div>
        }
        width={400}
      >
        <p style={{ margin: '16px 0' }}>
          Delete <strong>{deleteItemTarget?.record.name}</strong>?
          {deleteItemTarget?.record.isSystem
            ? ' This is a system default — removing it will affect all dropdowns.'
            : ' This will remove it from all dropdowns.'}
        </p>
      </Modal>

      {/* Batch delete */}
      <Modal
        title="Delete Items"
        open={batchDeleteTarget !== null}
        onCancel={() => setBatchDeleteTarget(null)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setBatchDeleteTarget(null)}>Cancel</Button>
            <Button danger type="primary" onClick={() => {
              if (!batchDeleteTarget) return;
              batchDeleteTarget.setList(prev => prev.filter(item => !batchDeleteTarget.keys.includes(item.id)));
              batchDeleteTarget.setKeys([]);
              setBatchDeleteTarget(null);
            }}>
              Delete {batchDeleteTarget?.keys.length} Item{(batchDeleteTarget?.keys.length ?? 0) !== 1 ? 's' : ''}
            </Button>
          </div>
        }
        width={400}
      >
        <p style={{ margin: '16px 0' }}>
          Delete {batchDeleteTarget?.keys.length} selected item{(batchDeleteTarget?.keys.length ?? 0) !== 1 ? 's' : ''}?
          This will remove them from all dropdowns.
        </p>
      </Modal>

      {/* Delete escalation */}
      <Modal
        title="Remove Escalation"
        open={deleteEscTarget !== null}
        onCancel={() => setDeleteEscTarget(null)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDeleteEscTarget(null)}>Cancel</Button>
            <Button danger type="primary" onClick={() => setDeleteEscTarget(null)}>
              Remove
            </Button>
          </div>
        }
        width={400}
      >
        <p style={{ margin: '16px 0' }}>
          Remove <strong>{deleteEscTarget?.id}</strong> — {deleteEscTarget?.title}?
        </p>
      </Modal>
    </div>
  );
}
