'use client';

import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Card, Empty, Tag, Typography, theme } from 'antd';
import {
  ExclamationCircleFilled,
  MessageFilled,
  ShoppingFilled,
} from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { events } from '@/data/events';
import { orders } from '@/data/orders';
import { escalations } from '@/data/escalations';
import { getNotifications, isNewNotification, type NotificationKind } from '@/lib/notifications';
import { APP_NOW } from '@/lib/appTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const KIND_ICON: Record<NotificationKind, React.ReactNode> = {
  escalation: <ExclamationCircleFilled />,
  'info-request': <MessageFilled />,
  'order-approval': <ShoppingFilled />,
};

export default function NotificationsPage() {
  const { token } = theme.useToken();
  const notifications = getNotifications(events, escalations, orders);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        left={
          <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
            Notifications
          </Text>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', maxWidth: 640 }}>
        {notifications.length === 0 ? (
          <Empty description="You're all caught up." style={{ marginTop: 80 }} />
        ) : (
          <Card size="small" styles={{ body: { padding: 0 } }}>
            {notifications.map((n, i) => {
              const isNew = isNewNotification(n);
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderTop: i === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                    color: 'inherit',
                  }}
                >
                  <span style={{ fontSize: token.fontSizeLG, color: token.colorTextSecondary, marginTop: 2 }}>
                    {KIND_ICON[n.kind]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontWeight: isNew ? 600 : 400 }}>{n.title}</Text>
                      {isNew && <Tag color="blue">New</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block' }}>
                      {n.description}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap', marginTop: 2 }}>
                    {dayjs(n.timestamp).from(APP_NOW)}
                  </Text>
                </Link>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
