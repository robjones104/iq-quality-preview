'use client';

import { useMemo } from 'react';
import { Card, Tag, Tooltip, Typography, theme } from 'antd';
import { HourglassFilled, InfoCircleOutlined, MessageFilled } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
import { capabilitiesFor } from '@/lib/roles';
import type { Order } from '@/data/orders';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';
import { awaitingTechReply, awaitingParty, replyReviewParty } from '@/components/TechReplyWarning';

const { Text, Paragraph } = Typography;
const TODAY = now();
const STALE_MIN = 7;

// The message cards consume EFFECTIVE orders (mutations already merged by the
// dashboard) so runtime decisions move orders in and out of the lanes live.
export type EffectiveOrder = Order & { trackingNumber?: string };

function daysSinceIso(iso: string): number {
  return Math.max(0, TODAY.diff(dayjs(iso), 'day'));
}

function CardShell({ title, tooltip, count, viewAllHref, children }: {
  title: string; tooltip: string; count: number; viewAllHref?: string; children: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      title={
        <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
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

// The owner tag names the person, not the role (Rob's ruling 2026-08-03):
// office parties map to their demo personas. Monochromatic by design decision:
// chromatic fills are reserved for record lifecycle, gold for accents. Tooltip
// copy is supplied per card, because the same tag means "chase them" on the
// awaiting lane and "check their answer" on the responded lane.
function LaneRow({ orderId, eventId, meta, snippet, ageDays, hotWhenStale, owner, ownerTooltip }: {
  orderId: string; eventId: string; meta: string; snippet?: string; ageDays: number; hotWhenStale: boolean;
  owner?: 'Field Quality' | 'Customer Service' | null;
  ownerTooltip?: string;
}) {
  const { token } = theme.useToken();
  const hot = hotWhenStale && ageDays >= STALE_MIN;
  const ownerName = owner ? capabilitiesFor(owner).displayName : null;
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
          <Link href={`/orders/${orderId}`} style={{ fontSize: token.fontSizeSM, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {eventId}
          </Link>
          {ownerName && (
            <Tooltip title={ownerTooltip}>
              <Tag style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px', margin: 0 }}>
                {ownerName}
              </Tag>
            </Tooltip>
          )}
        </div>
        <Text type="secondary" style={{ fontSize: token.fontSizeXS, whiteSpace: 'nowrap' }}>{meta}</Text>
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
        <Text style={{ flexShrink: 0, fontSize: token.fontSizeXS, fontWeight: 600, color: hot ? token.colorWarning : token.colorTextTertiary, lineHeight: '16px' }}>
          {ageDays}d
        </Text>
      </div>
    </div>
  );
}

export function OrderAwaitingResponseCard({ orders, viewAllHref, maxRows = 5 }: { orders: EffectiveOrder[]; viewAllHref?: string; maxRows?: number }) {
  const eventMap = useEffectiveEventMap();
  const waiting = useMemo(() =>
    orders
      .filter(o => o.orderStatus === 'Open' && awaitingTechReply(eventMap.get(o.eventId)?.additionalInfoRequests))
      .sort((a, b) => {
        const la = eventMap.get(a.eventId)?.additionalInfoRequests?.at(-1)?.sentAt ?? '';
        const lb = eventMap.get(b.eventId)?.additionalInfoRequests?.at(-1)?.sentAt ?? '';
        return la.localeCompare(lb);
      }),
    [orders, eventMap]);
  return (
    <CardShell
      title="Awaiting Response"
      tooltip="Open orders where a request for more information has not yet been answered by the technician, oldest first. The tag shows who asked: either party's request gates your decision, but a stalled FQ request is chased through Field Quality, not the tech."
      count={waiting.length}
      viewAllHref={viewAllHref}
    >
      {waiting.length === 0
        ? <Empty icon={<HourglassFilled />} message="No open orders awaiting a technician response" />
        : waiting.slice(0, maxRows).map(o => {
            const ev = eventMap.get(o.eventId);
            const last = ev?.additionalInfoRequests?.at(-1);
            return (
              <LaneRow
                key={o.id}
                orderId={o.id}
                eventId={o.eventId}
                meta={`${o.jobNo} · ${ev?.branch ?? '—'}`}
                snippet={last?.text}
                ageDays={last ? daysSinceIso(last.sentAt) : 0}
                hotWhenStale
                owner={awaitingParty(ev?.additionalInfoRequests)}
                ownerTooltip={awaitingParty(ev?.additionalInfoRequests) === 'Customer Service'
                  ? 'Requested by Customer Service.'
                  : 'Requested by Field Quality. If it stalls, follow up with Field Quality, not the tech.'}
              />
            );
          })}
    </CardShell>
  );
}

export function OrderResponseReceivedCard({ orders, viewAllHref, maxRows = 5 }: { orders: EffectiveOrder[]; viewAllHref?: string; maxRows?: number }) {
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
      title="Response Received"
      tooltip="The technician has replied on an open order's thread, newest first. CS-tagged replies answer your questions; FQ-tagged replies answer Field Quality's and may mean validation is close."
      count={responded.length}
      viewAllHref={viewAllHref}
    >
      {responded.length === 0
        ? <Empty icon={<MessageFilled />} message="No technician replies waiting for review" />
        : responded.slice(0, maxRows).map(o => {
            const ev = eventMap.get(o.eventId);
            const last = ev?.additionalInfoRequests?.at(-1);
            const party = replyReviewParty(ev?.additionalInfoRequests);
            return (
              <LaneRow
                key={o.id}
                orderId={o.id}
                eventId={o.eventId}
                meta={`${o.jobNo} · ${ev?.branch ?? '—'}`}
                snippet={last ? `"${last.text}"` : undefined}
                ageDays={last ? daysSinceIso(last.sentAt) : 0}
                hotWhenStale={false}
                owner={party}
                ownerTooltip={party === 'Customer Service'
                  ? 'The technician answered your question. Review it and move the order forward.'
                  : 'The technician answered Field Quality. Check the reply; validation may be about to unblock this order.'}
              />
            );
          })}
    </CardShell>
  );
}

/** Compact preview for the mobile carousel: count line + top three replies. */
export function OrderResponseReceivedPreview({ orders }: { orders: EffectiveOrder[] }) {
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
      {responded.slice(0, 3).map(o => {
        const ev = eventMap.get(o.eventId);
        const last = ev?.additionalInfoRequests?.at(-1);
        return (
          <LaneRow
            key={o.id}
            orderId={o.id}
            eventId={o.eventId}
            meta={`${o.jobNo} · ${ev?.branch ?? '—'}`}
            snippet={last ? `"${last.text}"` : undefined}
            ageDays={last ? daysSinceIso(last.sentAt) : 0}
            hotWhenStale={false}
          />
        );
      })}
    </div>
  );
}
