'use client';

import { useMemo } from 'react';
import { Card, Tag, Tooltip, Typography, theme } from 'antd';
import { InfoCircleOutlined, MessageFilled } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QueueRow } from '@/components/QueueRow';
import { capabilitiesFor } from '@/lib/roles';
import type { Order } from '@/data/orders';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';
import { replyReviewParty } from '@/components/TechReplyWarning';

const { Text } = Typography;

// The message cards consume EFFECTIVE orders (mutations already merged by the
// dashboard) so runtime decisions move orders in and out of the lanes live.
export type EffectiveOrder = Order & { trackingNumber?: string };

function CardShell({ title, tooltip, count, viewAllHref, children }: {
  title: string; tooltip: string; count: number; viewAllHref?: string; children: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: token.fontSizeSM, fontWeight: 500 }}>
          <MessageFilled style={{ color: token.colorWarning, fontSize: token.fontSizeSM }} />
          <span>{title}</span>
          {count > 0 && <Tag color="gold">{count}</Tag>}
          <Tooltip title={tooltip}>
            <InfoCircleOutlined style={{ color: token.colorTextTertiary, fontSize: token.fontSizeSM, cursor: 'help' }} />
          </Tooltip>
        </span>
      }
      extra={
        count === 0
          ? <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>All clear</Text>
          : viewAllHref
            ? <Link href={viewAllHref} style={{ fontSize: token.fontSizeSM }}>View in Table ({count})</Link>
            : <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>({count})</Text>
      }
      style={{ height: '100%' }}
    >
      {children}
    </Card>
  );
}

function Empty({ icon, message }: { icon: React.ReactNode; message: string }) {
  const { token } = theme.useToken();
  return (
    <div style={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: token.colorTextTertiary }}>
      <span style={{ fontSize: token.fontSizeHeading3 }}>{icon}</span>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{message}</Text>
    </div>
  );
}

// The Awaiting Response lane was cut (Rob, 2026-08-03): reminders are
// system-generated, so chasing is not a human queue. Responses only.

export function OrderResponseReceivedCard({ orders, viewAllHref, maxRows = 5 }: { orders: EffectiveOrder[]; viewAllHref?: string; maxRows?: number }) {
  const router = useRouter();
  const eventMap = useEffectiveEventMap();
  const responded = useMemo(() =>
    orders
      .filter(o => o.orderStatus === 'Open' && replyReviewParty(eventMap.get(o.eventId)?.additionalInfoRequests) !== null)
      .sort((a, b) => {
        const la = eventMap.get(a.eventId)?.additionalInfoRequests?.at(-1)?.sentAt ?? '';
        const lb = eventMap.get(b.eventId)?.additionalInfoRequests?.at(-1)?.sentAt ?? '';
        return lb.localeCompare(la);
      }),
    [orders, eventMap]);
  return (
    <CardShell
      title="Needs Your Response"
      tooltip="The technician has replied on an open order's thread, newest first. CS-tagged replies answer your questions; FQ-tagged replies answer Field Quality's and may mean validation is close."
      count={responded.length}
      viewAllHref={viewAllHref}
    >
      {responded.length === 0
        ? <Empty icon={<MessageFilled />} message="No technician replies waiting for review" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {responded.slice(0, maxRows).map((o, i) => {
              const ev = eventMap.get(o.eventId);
              const last = ev?.additionalInfoRequests?.at(-1);
              const party = replyReviewParty(ev?.additionalInfoRequests);
              return (
                <QueueRow
                  key={o.id}
                  id={o.eventId}
                  personName={party ? capabilitiesFor(party).displayName : ''}
                  personTooltip={party === 'Customer Service'
                    ? 'The technician answered your question. Review it and move the order forward.'
                    : 'The technician answered Field Quality. Check the reply; validation may be about to unblock this order.'}
                  text={last?.text}
                  dateLabel={last?.sentAt.slice(0, 10)}
                  actionLabel="Review"
                  onOpen={() => router.push(`/orders/${o.id}`)}
                  topBorder={i > 0}
                />
              );
            })}
          </div>
        )}
    </CardShell>
  );
}

/** Compact preview for the mobile carousel: count line + top three replies. */
export function OrderResponseReceivedPreview({ orders }: { orders: EffectiveOrder[] }) {
  const router = useRouter();
  const { token } = theme.useToken();
  const eventMap = useEffectiveEventMap();
  const responded = useMemo(() =>
    orders
      .filter(o => o.orderStatus === 'Open' && replyReviewParty(eventMap.get(o.eventId)?.additionalInfoRequests) !== null)
      .sort((a, b) => {
        const la = eventMap.get(a.eventId)?.additionalInfoRequests?.at(-1)?.sentAt ?? '';
        const lb = eventMap.get(b.eventId)?.additionalInfoRequests?.at(-1)?.sentAt ?? '';
        return lb.localeCompare(la);
      }),
    [orders, eventMap]);
  if (responded.length === 0) {
    return <Empty icon={<MessageFilled />} message="No technician replies waiting for review" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginBottom: 2 }}>
        {responded.length} waiting for review
      </div>
      {responded.slice(0, 3).map((o, i) => {
        const ev = eventMap.get(o.eventId);
        const last = ev?.additionalInfoRequests?.at(-1);
        const party = replyReviewParty(ev?.additionalInfoRequests);
        return (
          <QueueRow
            key={o.id}
            id={o.eventId}
            personName={party ? capabilitiesFor(party).displayName : ''}
            text={last?.text}
            dateLabel={last?.sentAt.slice(0, 10)}
            actionLabel="Review"
            onOpen={() => router.push(`/orders/${o.id}`)}
            topBorder={i > 0}
          />
        );
      })}
    </div>
  );
}
