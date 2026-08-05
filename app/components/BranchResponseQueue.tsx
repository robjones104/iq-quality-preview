'use client';

import { useMemo, useState } from 'react';
import { Card, Empty, Tag, theme } from 'antd';
import { MessageFilled } from '@ant-design/icons';
import { QueueRow } from './QueueRow';
import { awaitingTechReply, awaitingParty } from './TechReplyWarning';
import { EventSummaryDrawer } from '@/app/(main)/intake/EventSummaryDrawer';
import { useEffectiveEvents } from '@/lib/effectiveEvents';
import { useScopedEvents } from '@/lib/useScopedData';
import { capabilitiesFor } from '@/lib/roles';
import type { QualityEvent } from '@/data/types';

// The branch user's reply queue, lifted from the retired Intake home when the
// role merged into Branch (Rob 2026-08-05): open office questions on the
// branch's events that the reporter side has not answered. Branch-wide on
// purpose: the branch user answers for its techs too.
export function BranchResponseQueue() {
  const { token } = theme.useToken();
  const events = useScopedEvents(useEffectiveEvents());
  const [drawerEvent, setDrawerEvent] = useState<QualityEvent | null>(null);

  const sorted = useMemo(
    () => events.slice().sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
    [events]
  );
  const needsResponse = useMemo(
    () => sorted.filter(e => e.status !== 'Invalidated' && awaitingTechReply(e.additionalInfoRequests)),
    [sorted]
  );
  // Keep the drawer's event fresh: replies mutate the thread, and the stale
  // captured object would hide them.
  const drawerCurrent = drawerEvent
    ? sorted.find(e => e.id === drawerEvent.id) ?? drawerEvent
    : null;

  return (
    <>
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageFilled style={{ color: token.colorWarning }} />
            <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Needs Your Response</span>
            {needsResponse.length > 0 && <Tag color="gold">{needsResponse.length}</Tag>}
          </div>
        }
      >
        {needsResponse.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No open questions. You are all caught up."
            style={{ margin: '12px 0' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {needsResponse.slice(0, 6).map((e, i) => {
              const thread = e.additionalInfoRequests ?? [];
              const last = thread[thread.length - 1];
              const asking = capabilitiesFor(awaitingParty(thread) ?? 'Field Quality').displayName;
              return (
                <QueueRow
                  key={e.id}
                  id={e.id}
                  personName={asking}
                  text={last?.text}
                  dateLabel={last?.sentAt.slice(0, 10)}
                  actionLabel="Respond"
                  onOpen={() => setDrawerEvent(e)}
                  topBorder={i > 0}
                />
              );
            })}
          </div>
        )}
      </Card>
      <EventSummaryDrawer event={drawerCurrent} open={drawerEvent !== null} onClose={() => setDrawerEvent(null)} />
    </>
  );
}
