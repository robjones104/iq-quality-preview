'use client';

import { useMemo } from 'react';
import { Card, Typography, theme } from 'antd';
import { HourglassFilled, MessageFilled, InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import Link from 'next/link';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
import type { QualityEvent } from '@/data/types';
import { StatusTag } from '@/components/StatusTag';
import { awaitingParty, replyReviewParty } from '@/components/TechReplyWarning';

const { Text, Paragraph } = Typography;
const TODAY = now();
const STALE_MIN = 7;
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

function daysSince(iso: string): number {
  return Math.max(0, TODAY.diff(dayjs(iso), 'day'));
}

function MessageRow({ event, snippet, ageDays, hotWhenStale }: {
  event: QualityEvent; snippet?: string; ageDays: number; hotWhenStale: boolean;
}) {
  const { token } = theme.useToken();
  const hot = hotWhenStale && ageDays >= STALE_MIN;
  return (
    <div style={{
      background: token.colorFillQuaternary,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusSM,
      padding: '8px 10px',
      display: 'flex',
      gap: 10,
    }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <Link href={`/events/${event.id}`} style={{ fontSize: token.fontSizeSM, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {event.id}
          </Link>
          <StatusTag status={event.status} additionalInfoRequested={!!event.additionalInfoRequested} />
        </div>
        <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap' }}>
          {event.reportedBy} · {event.branch}
        </Text>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        {snippet && (
          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{ flex: 1, minWidth: 0, marginBottom: 0, fontSize: token.fontSizeSM, color: token.colorTextSecondary, overflowWrap: 'anywhere' }}
          >
            {snippet}
          </Paragraph>
        )}
        <Text style={{
          flexShrink: 0,
          fontSize: token.fontSizeXS,
          fontWeight: 600,
          color: hot ? token.colorWarning : token.colorTextTertiary,
          lineHeight: '16px',
        }}>
          {ageDays}d
        </Text>
      </div>
    </div>
  );
}

function CardShell({ title, tooltip, accent, count, viewAllHref, children }: {
  title: string; tooltip: string; accent: string; count: number; viewAllHref?: string; children: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      title={
        <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: accent, flexShrink: 0 }} />
          {title}
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
      styles={{ body: { minHeight: 300, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 } }}
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

export function AwaitingResponseCard({ events, viewAllHref }: { events: QualityEvent[]; viewAllHref?: string }) {
  const waiting = useMemo(() =>
    events
      .filter(awaitingFqResponse)
      .sort((a, b) => daysSince(b.date) - daysSince(a.date)),
    [events]
  );
  return (
    <CardShell
      title="Awaiting Response"
      tooltip="Field Quality requests for more information that the technician has not yet answered, oldest first. Requests sent by Customer Service live on the Orders view."
      accent="#faad14"
      count={waiting.length}
      viewAllHref={viewAllHref}
    >
      {waiting.length === 0
        ? <Empty icon={<HourglassFilled />} message="No events awaiting a technician response" />
        : waiting.slice(0, MAX_ROWS).map(e => (
            <MessageRow
              key={e.id}
              event={e}
              snippet={lastMessage(e)?.text ?? e.additionalInfoNote}
              ageDays={daysSince(e.date)}
              hotWhenStale
            />
          ))}
    </CardShell>
  );
}

export function ResponseReceivedCard({ events, viewAllHref }: { events: QualityEvent[]; viewAllHref?: string }) {
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
      accent="#389e0d"
      count={responded.length}
      viewAllHref={viewAllHref}
    >
      {responded.length === 0
        ? <Empty icon={<MessageFilled />} message="No technician replies waiting for review" />
        : responded.slice(0, MAX_ROWS).map(e => {
            const last = lastMessage(e);
            return (
              <MessageRow
                key={e.id}
                event={e}
                snippet={last ? `"${last.text}"` : undefined}
                ageDays={last ? daysSince(last.sentAt) : 0}
                hotWhenStale={false}
              />
            );
          })}
    </CardShell>
  );
}

/** Compact preview for the mobile carousel: count line + top three replies. */
export function ResponseReceivedPreview({ events }: { events: QualityEvent[] }) {
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
      {responded.slice(0, 3).map(e => {
        const last = lastMessage(e);
        return (
          <MessageRow
            key={e.id}
            event={e}
            snippet={last ? `"${last.text}"` : undefined}
            ageDays={last ? daysSince(last.sentAt) : 0}
            hotWhenStale={false}
          />
        );
      })}
    </div>
  );
}
