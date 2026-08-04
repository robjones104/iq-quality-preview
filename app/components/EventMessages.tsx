'use client';

import { useMemo } from 'react';
import { Card, Tag, Typography, theme } from 'antd';
import { MessageFilled, InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QueueRow } from '@/components/QueueRow';
import type { QualityEvent } from '@/data/types';
import { awaitingParty, replyReviewParty } from '@/components/TechReplyWarning';

const { Text } = Typography;
const MAX_ROWS = 5;

// The events dashboard is Field Quality's screen, so both lanes scope to
// FQ-owned conversations: CS requests do not put FQ on the hook. (The orders
// view is the opposite: any pending request gates a CS decision, so it counts
// both parties' threads.)

/** Awaiting a tech reply to a Field Quality request. */
export function awaitingFqResponse(e: QualityEvent): boolean {
  return awaitingParty(e.additionalInfoRequests) === 'Field Quality';
}

/** A tech reply to a Field Quality request, on an event still in play. */
export function respondedNeedsReview(e: QualityEvent): boolean {
  return replyReviewParty(e.additionalInfoRequests) === 'Field Quality'
    && e.status !== 'Validated'
    && e.status !== 'Invalidated';
}

function lastMessage(e: QualityEvent) {
  const t = e.additionalInfoRequests;
  return t?.length ? t[t.length - 1] : undefined;
}

// Rows use the shared QueueRow (the intake Needs Your Response anatomy;
// Rob, 2026-08-04): flat hairline-divided rows, single-line text, date, action.

function CardShell({ title, tooltip, count, viewAllHref, children }: {
  title: string; tooltip: string; count: number; viewAllHref?: string; children: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageFilled style={{ color: token.colorWarning }} />
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
// system-generated, so chasing unanswered requests is not a human queue.
// Responses are the only lane; it runs full width on the dashboard.

export function ResponseReceivedCard({ events, viewAllHref }: { events: QualityEvent[]; viewAllHref?: string }) {
  const router = useRouter();
  const responded = useMemo(() =>
    events
      .filter(respondedNeedsReview)
      .sort((a, b) => {
        const la = lastMessage(a)?.sentAt ?? '';
        const lb = lastMessage(b)?.sentAt ?? '';
        return lb.localeCompare(la);
      }),
    [events]
  );
  return (
    <CardShell
      title="Response Received"
      tooltip="The technician has replied to a Field Quality request and the event is waiting on your next step. Newest replies first."
      count={responded.length}
      viewAllHref={viewAllHref}
    >
      {responded.length === 0
        ? <Empty icon={<MessageFilled />} message="No technician replies waiting for review" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {responded.slice(0, MAX_ROWS).map((e, i) => {
              const last = lastMessage(e);
              return (
                <QueueRow
                  key={e.id}
                  id={e.id}
                  personName={e.reportedBy}
                  personTooltip={`${e.reportedBy} replied. Review the answer.`}
                  text={last?.text}
                  dateLabel={last?.sentAt.slice(0, 10)}
                  actionLabel="Review"
                  onOpen={() => router.push(`/events/${e.id}`)}
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
export function ResponseReceivedPreview({ events }: { events: QualityEvent[] }) {
  const router = useRouter();
  const { token } = theme.useToken();
  const responded = useMemo(() =>
    events.filter(respondedNeedsReview).sort((a, b) =>
      (lastMessage(b)?.sentAt ?? '').localeCompare(lastMessage(a)?.sentAt ?? '')),
    [events]
  );
  if (responded.length === 0) {
    return <Empty icon={<MessageFilled />} message="No technician replies waiting for review" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginBottom: 2 }}>
        {responded.length} waiting for review
      </div>
      {responded.slice(0, 3).map((e, i) => {
        const last = lastMessage(e);
        return (
          <QueueRow
            key={e.id}
            id={e.id}
            personName={e.reportedBy}
            personTooltip={`${e.reportedBy} replied. Review the answer.`}
            text={last?.text}
            dateLabel={last?.sentAt.slice(0, 10)}
            actionLabel="Review"
            onOpen={() => router.push(`/events/${e.id}`)}
            topBorder={i > 0}
          />
        );
      })}
    </div>
  );
}
