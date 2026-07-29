'use client';

import type { CSSProperties } from 'react';
import { Alert } from 'antd';
import type { AdditionalInfoRequest } from '@/data/types';

// The two conversation states of an info-request thread, both keyed off the
// latest message. Awaiting: the tech owes a reply. Replied: the tech answered
// and the office owes the next move.
export function awaitingTechReply(thread?: AdditionalInfoRequest[]): boolean {
  if (!thread?.length) return false;
  return thread[thread.length - 1]?.sentBy !== 'Tech';
}

export function hasTechReply(thread?: AdditionalInfoRequest[]): boolean {
  if (!thread?.length) return false;
  return thread[thread.length - 1]?.sentBy === 'Tech';
}

type OfficeParty = 'Field Quality' | 'Customer Service';

// Requests have owners: a CS request does not put Field Quality on the hook,
// but an FQ request gates validation and therefore also matters to CS. Absent
// sentBy on early messages means Field Quality (same convention as the thread
// UI in InfoRequestThread).

/** The office party whose unanswered question the thread is waiting on. */
export function awaitingParty(thread?: AdditionalInfoRequest[]): OfficeParty | null {
  if (!awaitingTechReply(thread)) return null;
  const last = thread![thread!.length - 1];
  return (last.sentBy as OfficeParty | undefined) ?? 'Field Quality';
}

/** When the tech has replied: the office party whose question was answered and who owes the next move. */
export function replyReviewParty(thread?: AdditionalInfoRequest[]): OfficeParty | null {
  if (!hasTechReply(thread)) return null;
  for (let i = thread!.length - 2; i >= 0; i--) {
    const m = thread![i];
    if (m.sentBy !== 'Tech') return (m.sentBy as OfficeParty | undefined) ?? 'Field Quality';
  }
  return 'Field Quality';
}

// Pipeline rule (2026-07-24, P3): an unanswered info request never blocks
// approval, but CS should know before committing parts. Renders nothing when
// the tech has replied or no request exists.
export function TechReplyWarning({ thread, style }: { thread?: AdditionalInfoRequest[]; style?: CSSProperties }) {
  if (!awaitingTechReply(thread)) return null;
  return (
    <Alert
      type="warning"
      showIcon
      message="The field tech has not replied to the information request on this event."
      description="You can still approve, or wait for the reply before committing parts."
      style={style}
    />
  );
}
