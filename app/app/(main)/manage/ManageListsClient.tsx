'use client';
import React, { useMemo, useState } from 'react';
import { useEventStore } from '@/store/eventStore';
import { mergeEvent } from '@/lib/effectiveEvents';
import { useRouter } from 'next/navigation';
import {
  Button, Card, Grid, Input, Modal, Table, Tabs, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { InputRef } from 'antd';
import { DeleteFilled, EditFilled, PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { useEscalationTypeStore } from '@/store/escalationTypeStore';
import { useCapabilities } from '@/store/roleStore';
import { useEffectiveEscalations } from '@/lib/effectiveEscalations';
import type { QualityEvent } from '@/data/types';

type ManagedListKind = 'root-causes' | 'tags' | 'escalations';

const ADD_LABEL: Record<ManagedListKind, string> = {
  'root-causes': 'Root Cause',
  tags: 'Tag',
  escalations: 'Escalation Type',
};

const nextId = (prefix: string) => `${prefix}-${Date.now()}`;
import type { ListItem } from '@/data/manageLists';
import { nowDateStr } from '@/lib/appTime';

const { Text } = Typography;

type Props = {
  defaultTab: 'root-causes' | 'tags' | 'escalations';
  events: QualityEvent[];
  initialRootCauses: ListItem[];
  initialTags: ListItem[];
};

export function ManageListsClient({
  defaultTab,
  events: eventsProp,
  initialRootCauses,
  initialTags,
}: Props) {
  const evtMutations = useEventStore(s => s.mutations);
  const events = useMemo(() => eventsProp.map(e => mergeEvent(e, evtMutations[e.id])), [eventsProp, evtMutations]);
  const caps = useCapabilities();
  const router = useRouter();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();

  const [activeTab, setActiveTab]   = useState(defaultTab);
  const [rootCauses, setRootCauses] = useState<ListItem[]>(initialRootCauses);
  const [tags, setTags]             = useState<ListItem[]>(initialTags);
  const escTypes = useEscalationTypeStore(st => st.types);
  // Adapts the store to the setState-shaped setter the generic list CRUD expects.
  const setEscTypes: React.Dispatch<React.SetStateAction<ListItem[]>> = (updater) => {
    const { types: prev, setTypes } = useEscalationTypeStore.getState();
    const next = typeof updater === 'function' ? (updater as (p: ListItem[]) => ListItem[])(prev) : updater;
    setTypes(next);
  };
  const effectiveEscalations = useEffectiveEscalations();
  const [addingTo, setAddingTo]     = useState<ManagedListKind | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const addInputRef = React.useRef<InputRef>(null);
  const editInputRef = React.useRef<InputRef>(null);
  const [selectedRootCauseKeys, setSelectedRootCauseKeys] = useState<React.Key[]>([]);
  const [selectedTagKeys, setSelectedTagKeys]             = useState<React.Key[]>([]);
  const [selectedEscTypeKeys, setSelectedEscTypeKeys]     = useState<React.Key[]>([]);

  // Edit + delete modals
  type EditItemTarget = {
    record: ListItem;
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>;
  };
  type DeleteItemTarget = {
    record: ListItem;
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>;
  };
  type BatchDeleteTarget = {
    keys: React.Key[];
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>;
    setKeys: React.Dispatch<React.SetStateAction<React.Key[]>>;
  };
  const [editTarget,        setEditTarget]        = useState<EditItemTarget | null>(null);
  const [editName,          setEditName]          = useState('');
  const [deleteItemTarget,  setDeleteItemTarget]  = useState<DeleteItemTarget | null>(null);
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<BatchDeleteTarget | null>(null);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const openEdit = (record: ListItem, setList: React.Dispatch<React.SetStateAction<ListItem[]>>) => {
    setEditTarget({ record, setList });
    setEditName(record.name);
  };

  const saveEdit = () => {
    if (!editTarget || !editName.trim()) return;
    const { record, setList } = editTarget;
    setList(prev => prev.map(item =>
      item.id === record.id ? { ...item, name: editName.trim() } : item,
    ));
    setEditTarget(null);
    setEditName('');
  };

  const addItem = (type: ManagedListKind) => {
    if (!newItemName.trim()) return;
    const newItem: ListItem = {
      id: nextId(type === 'root-causes' ? 'rc' : type === 'tags' ? 'tag' : 'esct'),
      name: newItemName.trim(),
      createdBy: caps.displayName,
      createdAt: nowDateStr(),
      isSystem: false,
    };
    if (type === 'root-causes') setRootCauses(prev => [...prev, newItem]);
    else if (type === 'tags') setTags(prev => [...prev, newItem]);
    else setEscTypes(prev => [...prev, newItem]);
    setNewItemName('');
    setAddingTo(null);
  };

  const eventCount = (type: ManagedListKind, record: ListItem) =>
    type === 'root-causes'
      ? events.filter(e => (e.rootCauses ?? (e.rootCause ? [e.rootCause] : [])).includes(record.name)).length
      : type === 'tags'
      ? events.filter(e => e.tags?.includes(record.name)).length
      : effectiveEscalations.filter(esc => esc.type === record.name).length;

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
    type: ManagedListKind,
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
          : type === 'tags'
          ? `/events?tag=${encodeURIComponent(record.name)}`
          : `/escalations?type=${encodeURIComponent(record.name)}`
      )}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Text style={{ fontWeight: 600, fontSize: token.fontSize, lineHeight: 1.4 }}>
          {record.name}
        </Text>

        <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.4 }}>
          {eventCount(type, record)} {type === 'escalations' ? 'escalation' : 'event'}{eventCount(type, record) !== 1 ? 's' : ''}
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
        <Button size="small" type="text" icon={<EditFilled />}
          style={{ color: token.colorTextTertiary }}
          onClick={() => openEdit(record, setList)} />
        <Button size="small" type="text" icon={<DeleteFilled />}
          style={{ color: token.colorTextTertiary }}
          onClick={() => setDeleteItemTarget({ record, setList })} />
      </div>
    </Card>
  );

  // ── Column builders ────────────────────────────────────────────────────────

  const listColumns = (
    type: ManagedListKind,
    list: ListItem[],
    setList: React.Dispatch<React.SetStateAction<ListItem[]>>,
  ): ColumnsType<ListItem> => [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string) => <Text style={{ fontSize: token.fontSize }}>{name}</Text>,
    },
    {
      title: type === 'escalations' ? 'Escalations' : 'Events',
      key: 'events',
      width: type === 'escalations' ? 130 : 100,
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
      render: (_: unknown, record: ListItem) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <Button size="small" type="text" icon={<EditFilled />}
            style={{ color: token.colorTextTertiary }}
            onClick={e => {
              e.stopPropagation();
              openEdit(record, setList);
            }} />
          <Button size="small" type="text" icon={<DeleteFilled />}
            style={{ color: token.colorTextTertiary }}
            onClick={e => {
              e.stopPropagation();
              setDeleteItemTarget({ record, setList });
            }} />
        </span>
      ),
    },
  ];

  // ── Tab content ────────────────────────────────────────────────────────────

  const listTabContent = (
    type: ManagedListKind,
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
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={list}
            rowKey="id"
            size="small"
            tableLayout="fixed"
            pagination={false}
            locale={{ emptyText: type === 'root-causes' ? 'No root causes yet.' : type === 'tags' ? 'No tags yet.' : 'No escalation types yet.' }}
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: setKeys }}
            columns={listColumns(type, list, setList)}
            onRow={record => ({
              onClick: () => router.push(
                type === 'root-causes'
                  ? `/events?rootCause=${encodeURIComponent(record.name)}`
                  : type === 'tags'
                  ? `/events?tag=${encodeURIComponent(record.name)}`
                  : `/escalations?type=${encodeURIComponent(record.name)}`
              ),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
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
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddingTo('escalations')}>
      Add Escalation Type
    </Button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        left={
          <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
            Categories
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
              setSelectedEscTypeKeys([]);
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
                label: `Escalation Types (${escTypes.length})`,
                children: listTabContent('escalations', escTypes, setEscTypes, selectedEscTypeKeys, setSelectedEscTypeKeys),
              },
            ]}
          />
        </div>
      </div>

      {/* Add item */}
      <Modal
        title={addingTo ? `Add ${ADD_LABEL[addingTo]}` : ''}
        open={addingTo !== null}
        onCancel={() => { setAddingTo(null); setNewItemName(''); }}
        destroyOnHidden
        // The modal's focus trap grabs focus after mount, so the Input's own
        // autoFocus loses the race; focus it once the open transition settles.
        afterOpenChange={open => { if (open) addInputRef.current?.focus(); }}
        width={400}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setAddingTo(null); setNewItemName(''); }}>Cancel</Button>
            <Button
              type="primary"
              disabled={!newItemName.trim()}
              onClick={() => addingTo && addItem(addingTo)}
            >
              Add
            </Button>
          </div>
        }
      >
        <Input
          ref={addInputRef}
          placeholder={addingTo ? `${ADD_LABEL[addingTo]} name` : ''}
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          onPressEnter={() => addingTo && addItem(addingTo)}
          style={{ margin: '16px 0' }}
        />
      </Modal>

      {/* Edit item */}
      <Modal
        title={`Edit ${ADD_LABEL[activeTab]}`}
        open={editTarget !== null}
        onCancel={() => { setEditTarget(null); setEditName(''); }}
        destroyOnHidden
        afterOpenChange={open => { if (open) editInputRef.current?.focus(); }}
        width={400}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setEditTarget(null); setEditName(''); }}>Cancel</Button>
            <Button type="primary" disabled={!editName.trim()} onClick={saveEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Input
          ref={editInputRef}
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onPressEnter={saveEdit}
          style={{ margin: '16px 0' }}
        />
      </Modal>

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

    </div>
  );
}
