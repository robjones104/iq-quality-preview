'use client';

import React, { useMemo, useState } from 'react';
import {
  AutoComplete, Badge, Button, Form, Input, Modal, Popconfirm,
  Select, Table, Tag, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloseOutlined, DeleteFilled, EditFilled, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import {
  users as SEED_USERS,
  ROLE_OPTIONS,
  ROLE_DESCRIPTIONS,
  BRANCH_OPTIONS,
} from '@/data/users';
import type { AppUser, UserRole, UserStatus } from '@/data/users';

const USER_FILTER_CATEGORIES = [
  { key: 'role',   label: 'Role',   options: ROLE_OPTIONS.map(r => r.label as string) },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive', 'Pending'] },
];

const { Text } = Typography;

type FormValues = {
  name: string;
  email: string;
  role: UserRole;
  branch?: string;
  status?: UserStatus;
};

export default function UsersPage() {
  const { token } = theme.useToken();
  const [users, setUsers]           = useState<AppUser[]>(SEED_USERS);
  const [userFilters, setUserFilters] = useState<Record<string, string[]>>({});
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form]                      = Form.useForm<FormValues>();
  const selectedRole                = Form.useWatch('role', form) as UserRole | undefined;

  const [searchText, setSearchText] = useState('');

  const searchOptions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    const filterOpts = USER_FILTER_CATEGORIES.flatMap(cat =>
      cat.options
        .filter(opt => opt.toLowerCase().includes(q))
        .map(opt => ({ value: `filter::${cat.key}::${opt}`, label: `${cat.label}: ${opt}` }))
    );
    return filterOpts.length > 0 ? [{ label: 'Filter by', options: filterOpts }] : [];
  }, [searchText]);

  const handleSearchSelect = (value: string) => {
    setSearchText('');
    if (value.startsWith('filter::')) {
      const rest = value.slice('filter::'.length);
      const sep  = rest.indexOf('::');
      const key  = rest.slice(0, sep);
      const val  = rest.slice(sep + 2);
      setUserFilters(prev => ({ ...prev, [key]: [...new Set([...(prev[key] ?? []), val])] }));
    }
  };

  const chips = USER_FILTER_CATEGORIES.flatMap(cat =>
    (userFilters[cat.key] ?? []).map(val => `${cat.label}: ${val}`)
  );

  const removeChip = (chip: string) => {
    const [catLabel, val] = chip.split(': ');
    const cat = USER_FILTER_CATEGORIES.find(c => c.label === catLabel);
    if (!cat) return;
    setUserFilters(prev => {
      const next = { ...prev };
      next[cat.key] = (next[cat.key] ?? []).filter(v => v !== val);
      return next;
    });
  };

  const filtered = users.filter(u => {
    const roleMatch   = !userFilters.role?.length   || userFilters.role.includes(u.role);
    const statusMatch = !userFilters.status?.length || userFilters.status.includes(u.status);
    return roleMatch && statusMatch;
  });

  const openAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      name:   user.name,
      email:  user.email,
      role:   user.role,
      branch: user.branch,
      status: user.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    form.resetFields();
    setEditingUser(null);
  };

  const handleSubmit = (values: FormValues) => {
    const branch = values.role === 'Branch (View-Only)' ? values.branch : undefined;
    if (editingUser) {
      setUsers(prev => prev.map(u =>
        u.id === editingUser.id
          ? { ...u, name: values.name, email: values.email, role: values.role, branch, status: values.status ?? u.status }
          : u
      ));
    } else {
      const newUser: AppUser = {
        id:      `u-${Date.now()}`,
        name:    values.name,
        email:   values.email,
        role:    values.role,
        branch,
        status:  'Pending',
        addedBy: 'Corvus M. Aldsworth',
        addedAt: new Date().toISOString().slice(0, 10),
      };
      setUsers(prev => [...prev, newUser]);
    }
    closeModal();
  };

  const deleteUser = (id: string) => setUsers(prev => prev.filter(u => u.id !== id));

  const columns: ColumnsType<AppUser> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text style={{ fontSize: token.fontSize }}>{name}</Text>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{email}</Text>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 190,
      render: (role: UserRole) => (
        <Text style={{ fontSize: token.fontSizeSM }}>{role}</Text>
      ),
    },
    {
      title: 'Branch / Scope',
      key: 'scope',
      width: 160,
      render: (_, r) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {r.role === 'Branch (View-Only)' ? (r.branch ?? '—') : 'All Branches'}
        </Text>
      ),
    },
    {
      title: 'Added',
      dataIndex: 'addedAt',
      key: 'addedAt',
      width: 110,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{v}</Text>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 120,
      render: (v?: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{v ?? '—'}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: UserStatus) => (
        <Badge
          status={s === 'Active' ? 'success' : s === 'Pending' ? 'processing' : 'default'}
          text={<Text style={{ fontSize: token.fontSizeSM }}>{s}</Text>}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 72,
      render: (_, r) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <Button
            size="small"
            type="text"
            icon={<EditFilled />}
            style={{ color: token.colorTextTertiary }}
            onClick={() => openEdit(r)}
          />
          <Popconfirm
            title={`Remove ${r.name}?`}
            description="This will revoke their portal access immediately."
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteUser(r.id)}
          >
            <Button
              size="small"
              type="text"
              icon={<DeleteFilled />}
              style={{ color: token.colorTextTertiary }}
            />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        left={
          <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
            User Management
          </Text>
        }
        center={
          <AutoComplete
            value={searchText}
            onChange={setSearchText}
            onSelect={handleSearchSelect}
            options={searchOptions}
            placeholder="Filter by role or status..."
            style={{ width: '100%' }}
            allowClear
          >
            <Input suffix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />} />
          </AutoComplete>
        }
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Invite User
          </Button>
        }
      />

      <div style={{ padding: '16px 20px' }}>
        {chips.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: token.marginXS, marginBottom: token.margin }}>
            {chips.map(chip => (
              <Tag key={chip} closable onClose={() => removeChip(chip)} closeIcon={<CloseOutlined />} style={{ margin: 0 }}>
                {chip}
              </Tag>
            ))}
            <Button type="link" size="small" onClick={() => setUserFilters({})} style={{ padding: '0 4px' }}>
              Clear all
            </Button>
          </div>
        )}
        <Table
          dataSource={filtered}
          rowKey="id"
          size="small"
          pagination={{
            pageSize: 15,
            size: 'small',
            showTotal: (total) => `${total} user${total !== 1 ? 's' : ''}`,
          }}
          columns={columns}
        />
      </div>

      <Modal
        title={editingUser ? 'Edit User' : 'Invite User'}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Form
          form={form}
          layout="vertical"
          size="small"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: 12 }}
          >
            <Input placeholder="e.g. Jane Smith" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
            style={{ marginBottom: 12 }}
          >
            <Input placeholder="e.g. jane.smith@allegion.com" />
          </Form.Item>

          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: selectedRole ? 4 : 12 }}
          >
            <Select options={ROLE_OPTIONS} placeholder="Select a role" />
          </Form.Item>

          {selectedRole && (
            <div style={{
              marginBottom: 12,
              padding: '6px 10px',
              background: token.colorFillAlter,
              borderRadius: token.borderRadiusSM,
              fontSize: token.fontSizeSM,
              color: token.colorTextSecondary,
            }}>
              {ROLE_DESCRIPTIONS[selectedRole]}
            </div>
          )}

          {selectedRole === 'Branch (View-Only)' && (
            <Form.Item
              label="Branch"
              name="branch"
              rules={[{ required: true, message: 'Required' }]}
              style={{ marginBottom: 12 }}
            >
              <Select options={BRANCH_OPTIONS} placeholder="Select branch" />
            </Form.Item>
          )}

          {editingUser && (
            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true }]}
              style={{ marginBottom: 12 }}
            >
              <Select
                options={[
                  { value: 'Active',   label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' },
                  { value: 'Pending',  label: 'Pending' },
                ]}
              />
            </Form.Item>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={closeModal}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              {editingUser ? 'Save Changes' : 'Send Invite'}
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
