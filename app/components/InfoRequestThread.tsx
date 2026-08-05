'use client';

import { useState, useRef, useEffect } from 'react';
import { App, Button, Input, Typography, theme } from 'antd';
import { isReporterSide } from './TechReplyWarning';
import { MessageFilled, RedoOutlined } from '@ant-design/icons';
import { useEventStore } from '@/store/eventStore';
import { capabilitiesFor } from '@/lib/roles';
import { nowStampIso } from '@/lib/appTime';
import type { AdditionalInfoRequest, EventStatus, QualityEvent } from '@/data/types';
const { Text } = Typography;

// Messages identify the person, not the role (Rob's ruling 2026-08-03): the
// name comes from the party's demo persona (office roles) or the event's
// reporter (Tech). Avatars keep side-coded colors so the two sides of the
// conversation stay scannable without role labels: office = gray steps,
// reporter side (Tech, Intake) = gold family.
// All four fills carry white initials at AA (4.5:1+) in both themes:
// #434343 10.4:1, #595959 7.0:1, #ad6800 4.4:1, #7A5200 6.9:1. The dark
// theme's global colorTextLightSolid is near-black (gold-button labels), so
// the initials color must be explicit, never token-derived.
const SENDER_META: Record<NonNullable<AdditionalInfoRequest['sentBy']>, { avatarBg: string }> = {
  'Field Quality': { avatarBg: '#434343' },
  'Customer Service': { avatarBg: '#595959' },
  Tech: { avatarBg: '#ad6800' },
  Intake: { avatarBg: '#7A5200' },
};

// Deterministic initials circle: antd Avatar centers its string child with an
// absolutely-positioned transform, which sits optically off at 24px, and it
// inherits colorTextLightSolid for the text.
function InitialsAvatar({ bg, initials }: { bg: string; initials: string }) {
  return (
    <div
      aria-hidden
      style={{
        width: 24, height: 24, borderRadius: '50%', background: bg,
        color: '#FFFFFF', fontSize: 10, fontWeight: 600, lineHeight: 1,
        letterSpacing: 0.3, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, marginTop: 2,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}

/** "Theron K. Aldwick" -> "TA" */
function nameInitials(name: string): string {
  const words = name.split(' ').filter(w => w.length > 1 || !w.endsWith('.'));
  const first = words[0]?.[0] ?? '';
  const last = words[words.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase();
}

type SenderRole = 'Field Quality' | 'Customer Service';

interface UseInfoRequestThreadOpts {
  onActivity?: (summary: string, forStatus?: EventStatus) => void;
}

export function useInfoRequestThread(
  event: Pick<QualityEvent, 'id' | 'reportedBy' | 'additionalInfoRequests'>,
  senderRole: SenderRole,
  opts: UseInfoRequestThreadOpts = {}
) {
  const { mutations, patchEvent } = useEventStore();
  const evtStored = mutations[event.id] ?? {};

  const [reqDraftOpen, setReqDraftOpen] = useState(false);
  const [reqDraftText, setReqDraftText] = useState('');

  const infoRequests: AdditionalInfoRequest[] = evtStored.additionalInfoRequests ?? event.additionalInfoRequests ?? [];
  const infoThreads = infoRequests.filter(r => r.kind === 'initial' || r.kind === 'new');
  const followupsFor = (threadId: string) => infoRequests.filter(r => r.relatesTo === threadId);

  const nowTs = () => nowStampIso();

  // The store overlay REPLACES the static thread once present (mergeEvent
  // semantics), so every write must carry the full thread: seeding the overlay
  // with only the new entry would erase the seeded conversation app-wide.
  const appendToThread = (entry: AdditionalInfoRequest) => {
    patchEvent(event.id, { additionalInfoRequests: [...infoRequests, entry] });
  };

  const sendInfoRequest = (text: string, kind: 'initial' | 'new', forStatus?: EventStatus) => {
    const entry: AdditionalInfoRequest = { id: `air_${Date.now()}`, text, sentAt: nowTs(), kind, sentBy: senderRole };
    appendToThread(entry);
    opts.onActivity?.(
      kind === 'new'
        ? `Additional information requested from ${event.reportedBy} (new request).`
        : `Additional information requested from ${event.reportedBy}.`,
      forStatus
    );
  };

  const cancelDraft = () => {
    setReqDraftOpen(false);
    setReqDraftText('');
  };

  const startNewRequest = () => {
    setReqDraftText('');
    setReqDraftOpen(true);
  };

  return {
    infoThreads, followupsFor, reqDraftOpen, reqDraftText, setReqDraftText,
    sendInfoRequest, startNewRequest, cancelDraft, senderRole,
  };
}

type ThreadState = ReturnType<typeof useInfoRequestThread>;

export function InfoRequestThreadPanel({
  reportedBy, canSend, infoThreads, followupsFor, reqDraftOpen, reqDraftText, setReqDraftText,
  sendInfoRequest, startNewRequest, cancelDraft,
}: ThreadState & { reportedBy: string; canSend: boolean }) {
  const { token } = theme.useToken();
  const { notification } = App.useApp();

  // Tech renders as the event's reporter; every other party renders as its
  // demo persona (Intake may answer on a tech-reported event, so reportedBy
  // would be wrong there; office parties store no person on the message).
  const senderName = (sentBy: AdditionalInfoRequest['sentBy']) =>
    sentBy === 'Tech' ? reportedBy : capabilitiesFor(sentBy ?? 'Field Quality').displayName;

  // Awaiting is a MESSAGE-level fact: the newest non-reminder message decides
  // ownership (thread-level checks kept the ask button hidden after a reply).
  const allMessages = infoThreads
    .flatMap(t => [t, ...followupsFor(t.id)])
    .filter(m => m.kind !== 'followup')
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const lastMessage = allMessages[allMessages.length - 1];
  const awaitingReply = !!lastMessage && !isReporterSide(lastMessage.sentBy);

  // Chat anchoring (Rob 2026-08-05): the newest message is in view on open
  // and on every send; older history is a scroll up away.
  const endRef = useRef<HTMLDivElement>(null);
  const messageCount = infoThreads.reduce((n, t) => n + 1 + followupsFor(t.id).length, 0);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messageCount]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', height: '100%', minHeight: 0 }}>
      <div tabIndex={0} role="region" aria-label="Messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {infoThreads.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6, padding: '16px', textAlign: 'center', flex: 1,
        }}>
          <MessageFilled style={{ fontSize: token.fontSizeHeading2, color: token.colorTextQuaternary }} />
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>No messages yet</Text>
        </div>
      )}
      {infoThreads.map(t => {
        const messages: AdditionalInfoRequest[] = [t, ...followupsFor(t.id)]
          .slice()
          .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
        return (
          <div key={t.id} style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusSM, padding: '4px 12px' }}>
            <div>
              {messages.map(m => {
                if (m.kind === 'followup') {
                  return (
                    <div key={m.id} style={{ padding: '6px 0 6px 42px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RedoOutlined style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }} />
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                          Reminder sent · {m.sentAt}
                        </Text>
                      </div>
                    </div>
                  );
                }
                const meta = SENDER_META[m.sentBy ?? 'Field Quality'];
                const name = senderName(m.sentBy);
                return (
                  <div key={m.id} style={{ padding: '10px 0' }}>
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                      <InitialsAvatar bg={meta.avatarBg} initials={nameInitials(name)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                          <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {name}
                          </Text>
                          <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
                            {m.sentAt}
                          </Text>
                        </div>
                        <Text style={{ fontSize: token.fontSizeSM, lineHeight: 1.5 }}>{m.text}</Text>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div ref={endRef} aria-hidden />
      </div>
      {canSend && (
        reqDraftOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Input.TextArea
              autoFocus
              rows={4}
              aria-label="Additional information request"
              aria-required
              placeholder="Describe what additional information is needed from the field tech..."
              value={reqDraftText}
              onChange={e => setReqDraftText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={cancelDraft}>Cancel</Button>
              <Button
                size="small"
                type="primary"
                icon={<MessageFilled />}
                disabled={!reqDraftText.trim()}
                onClick={() => {
                  sendInfoRequest(reqDraftText, infoThreads.length ? 'new' : 'initial');
                  cancelDraft();
                  notification.success({ message: `Request sent to ${reportedBy}.` });
                }}
              >
                Send Request
              </Button>
            </div>
          </div>
        ) : awaitingReply ? (
          // Manual reminders were cut (Rob, 2026-08-03): the system nudges the
          // reporter on a fixed cadence while a response is pending.
          <Text type="secondary" style={{ fontSize: token.fontSizeSM, textAlign: 'center', padding: '4px 0' }}>
            <RedoOutlined style={{ marginRight: 6 }} />
            Response pending. A reminder will be sent every 48 hours.
          </Text>
        ) : (
          <Button block icon={<MessageFilled />} onClick={startNewRequest}>
            Request Additional Information
          </Button>
        )
      )}
    </div>
  );
}
