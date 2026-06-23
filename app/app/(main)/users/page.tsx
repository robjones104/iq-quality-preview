'use client';

import React, { useState } from 'react';
import {
  Badge, Button, Form, Input, Modal, Popconfirm,
  Select, Table, Typography, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteFilled, EditFilled, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import {
  users as SEED_USERS,
  ROLE_OPTIONS,
  ROLE_DESCRIPTIONS,
  BRANCH_OPTIONS,
} from '@/data/users';
import type { AppUser, UserRole, UserStatus } from '@/data/users';

const USERS_SMART_SEARCH_OPTIONS = [
  {
    label: 'Role',
    options: ROLE_OPTIONS.map(r => ({ value: `role::${r.value}`, label: r.label })),
  },
  {
    label: 'Status',
    options: ['Active', 'Inactive', 'Pending'].map(s => ({ value: `status::${s}`, label: s })),
  },
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

  const usersSelectValue = Object.entries(userFilters).flatMap(([key, vals]) =>
    vals.map(v => `${key}::${v}`)
  );

  const handleUsersSmartSearch = (values: string[]) => {
    const next: Record<string, string[]> = {};
    for (const v of values) {
      const sep = v.indexOf('::');
      const key = v.slice(0, sep);
      const val = v.slice(sep + 2);
      if (!next[key]) next[key] = [];
      next[key].push(val);
    }
    setUserFilters(next);
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
        addedBy: 'Pat Nguyen',
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
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Filter by role or status..."
              options={USERS_SMART_SEARCH_OPTIONS}
              value={usersSelectValue}
              onChange={handleUsersSmartSearch}
              maxTagCount="responsive"
              style={{ width: 260 }}
              suffixIcon={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Invite User
            </Button>
          </div>
        }
      />

      <div style={{ padding: '16px 20px' }}>
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
