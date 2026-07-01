'use client';

import { Badge, Button, Card, Typography, theme } from 'antd';
import { DeleteFilled, EditFilled } from '@ant-design/icons';
import type { AppUser } from '@/data/users';

const { Text } = Typography;

interface UserCardProps {
  user: AppUser;
  onEdit: () => void;
  onDelete: () => void;
}

export function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  const { token } = theme.useToken();

  const scope = user.role === 'Branch (View-Only)' ? (user.branch ?? '—') : 'All Branches';

  return (
    <Card
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 } }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ fontWeight: 600, fontSize: token.fontSize, lineHeight: 1.4 }}>
            {user.name}
          </Text>
          <Badge
            status={user.status === 'Active' ? 'success' : user.status === 'Pending' ? 'processing' : 'default'}
            text={<Text style={{ fontSize: token.fontSizeSM }}>{user.status}</Text>}
          />
        </div>

        <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, lineHeight: 1.4 }}>
          {user.role}
        </Text>

        <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.4 }}>
          {user.email}
        </Text>

        <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.4 }}>
          {scope}
          {user.lastLogin ? ` · Last login ${user.lastLogin}` : ''}
        </Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 'auto' }}>
        <Button size="small" type="text" icon={<EditFilled />}
          style={{ color: token.colorTextTertiary }} onClick={onEdit}
          aria-label={`Edit ${user.name}`} />
        <Button size="small" type="text" icon={<DeleteFilled />}
          style={{ color: token.colorTextTertiary }} onClick={onDelete}
          aria-label={`Remove ${user.name}`} />
      </div>
    </Card>
  );
}
