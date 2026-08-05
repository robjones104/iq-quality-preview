'use client';

import type { CSSProperties } from 'react';
import { Alert, theme } from 'antd';
import type { AdditionalInfoRequest } from '@/data/types';

// The reporter side of a thread: the field tech (mobile app) or the branch's
// Intake user (portal). Either one's reply satisfies an awaiting thread.
export function isReporterSide(sentBy: AdditionalInfoRequest['sentBy']): boolean {
  return sentBy === 'Tech' || sentBy === 'Branch';
}

// The two conversation states of an info-request thread, both keyed off the
// latest message. Awaiting: the reporter side owes a reply. Replied: the
// reporter side answered and the office owes the next move.
export function awaitingTechReply(thread?: AdditionalInfoRequest[]): boolean {
  if (!thread?.length) return false;
  return !isReporterSide(thread[thread.length - 1]?.sentBy);
}

export function hasTechReply(thread?: AdditionalInfoRequest[]): boolean {
  if (!thread?.length) return false;
  return isReporterSide(thread[thread.length - 1]?.sentBy);
}

type OfficeParty = 'Field Quality' | 'Customer Service';

// Requests have owners: a CS request does not put Field Quality on the hook,
// but an FQ request gates validation and therefore also matters to CS. Absent
// sentBy on early messages means Field Quality (same convention as the thread
// UI in InfoRequestThread).

// Ownership-split display helpers (Rob's ruling 2026-08-04): the order chip
// carries CS-owned conversation state, the event badge carries FQ-owned state.
// The thread is linear, so at most one of the four is ever true per row.
export function partyAwaiting(thread: AdditionalInfoRequest[] | undefined, party: 'Field Quality' | 'Customer Service'): boolean {
  return awaitingParty(thread) === party;
}
export function partyResponded(thread: AdditionalInfoRequest[] | undefined, party: 'Field Quality' | 'Customer Service'): boolean {
  return replyReviewParty(thread) === party;
}

/** The office party whose unanswered question the thread is waiting on. */
export function awaitingParty(thread?: AdditionalInfoRequest[]): OfficeParty | null {
  if (!awaitingTechReply(thread)) return null;
  const last = thread![thread!.length - 1];
  return (last.sentBy as OfficeParty | undefined) ?? 'Field Quality';
}

/** When the reporter side has replied: the office party whose question was answered and who owes the next move. */
export function replyReviewParty(thread?: AdditionalInfoRequest[]): OfficeParty | null {
  if (!hasTechReply(thread)) return null;
  for (let i = thread!.length - 2; i >= 0; i--) {
    const m = thread![i];
    if (!isReporterSide(m.sentBy)) return (m.sentBy as OfficeParty | undefined) ?? 'Field Quality';
  }
  return 'Field Quality';
}

// Pipeline rule (2026-07-24, P3): an unanswered info request never blocks
// approval, but CS should know before committing parts. Renders nothing when
// the tech has replied or no request exists.
export function TechReplyWarning({ thread, style }: { thread?: AdditionalInfoRequest[]; style?: CSSProperties }) {
  const { token } = theme.useToken();
  if (!awaitingTechReply(thread)) return null;
  // Single compact line: the two-tier Alert reads oversized inside modals.
  return (
    <Alert
      type="warning"
      showIcon
      message="The field tech has not replied to the information request on this event. You can still approve, or wait for the reply."
      style={{ fontSize: token.fontSizeSM, padding: '6px 10px', ...style }}
    />
  );
}
