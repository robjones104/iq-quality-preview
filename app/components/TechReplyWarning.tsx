'use client';

import type { CSSProperties } from 'react';
import { Alert } from 'antd';
import type { AdditionalInfoRequest } from '@/data/types';

// Same waiting-on-tech rule as the dashboard's Pending Information card: a
// non-empty info-request thread whose last message is not from the tech.
export function awaitingTechReply(thread?: AdditionalInfoRequest[]): boolean {
  if (!thread?.length) return false;
  return thread[thread.length - 1]?.sentBy !== 'Tech';
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
