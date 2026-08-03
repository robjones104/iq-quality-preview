'use client';

import Link from 'next/link';
import { Card, theme } from 'antd';
import { StatusTag } from './StatusTag';
import { awaitingTechReply, hasTechReply } from './TechReplyWarning';
import type { QualityEvent } from '@/data/types';

interface EventCardProps {
  event: QualityEvent;
  hasOrder: boolean;
}

export function EventCard({ event, hasOrder }: EventCardProps) {
  const { token } = theme.useToken();
  // Live thread state; terminal statuses stay quiet (see events table).
  const active = event.status === 'Reported' || event.status === 'Under Investigation';

  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <Card
        size="small"
        hoverable
        style={{ height: '100%' }}
        styles={{
          body: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: token.fontSize, color: token.colorText, lineHeight: 1.4 }}>
            {event.id}
          </span>
          <StatusTag
            status={event.status}
            hasOrder={hasOrder}
            additionalInfoRequested={active && awaitingTechReply(event.additionalInfoRequests)}
            responseReceived={active && hasTechReply(event.additionalInfoRequests)}
          />
        </div>

        <div style={{ fontSize: token.fontSize, color: token.colorText, fontWeight: 500, lineHeight: 1.4 }}>
          {event.issue}
        </div>

        {event.rootCause && (
          <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.4 }}>
            {event.rootCause}
          </div>
        )}

        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, lineHeight: 1.4 }}>
          {event.component} · {event.door}
        </div>

        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.4, marginTop: 'auto' }}>
          {event.branch} · {event.date} · {event.reportedBy}
        </div>
      </Card>
    </Link>
  );
}
