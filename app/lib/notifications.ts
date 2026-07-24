import dayjs from 'dayjs';
import type { QualityEvent, Escalation } from '@/data/types';
import type { Order } from '@/data/orders';

export type NotificationKind = 'escalation' | 'info-request' | 'order-approval';

export const NEW_WINDOW_HOURS = 48;

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  timestamp: string;
  href: string;
}

export function getNotifications(
  events: QualityEvent[],
  escalations: Escalation[],
  orders: Order[]
): AppNotification[] {
  const notifications: AppNotification[] = [];

  for (const escalation of escalations) {
    if (escalation.status !== 'Open') continue;
    notifications.push({
      id: `escalation-${escalation.id}`,
      kind: 'escalation',
      title: escalation.title,
      description: `${escalation.type} escalation is open`,
      timestamp: escalation.updatedAt,
      href: '/manage/escalations',
    });
  }

  for (const event of events) {
    if (!event.additionalInfoRequested) continue;
    const requests = event.additionalInfoRequests ?? [];
    const latest = requests[requests.length - 1];
    notifications.push({
      id: `info-request-${event.id}`,
      kind: 'info-request',
      title: `Info requested — ${event.id}`,
      description: `Waiting on additional info for ${event.component} at ${event.branch}`,
      timestamp: latest?.sentAt ?? event.reportedAt,
      href: `/events/${event.id}`,
    });
  }

  for (const order of orders) {
    if (order.orderStatus !== 'Open') continue;
    if (order.approved || order.declined) continue;
    notifications.push({
      id: `order-approval-${order.id}`,
      kind: 'order-approval',
      title: `Order ${order.jobNo} needs approval`,
      description: 'Awaiting approve/decline decision',
      timestamp: dayjs(order.lastUpdated, 'MM-DD-YYYY HH:mm').toISOString(),
      href: `/orders/${order.id}`,
    });
  }

  return notifications.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
}

export function isNewNotification(notification: AppNotification): boolean {
  return dayjs().diff(dayjs(notification.timestamp), 'hour') < NEW_WINDOW_HOURS;
}

export function countNewNotifications(notifications: AppNotification[]): number {
  return notifications.filter(isNewNotification).length;
}
