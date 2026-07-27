'use client';

import { useState } from 'react';
import { App, Avatar, Button, Input, Tag, Typography, theme } from 'antd';
import { MessageFilled, RedoOutlined } from '@ant-design/icons';
import { useEventStore } from '@/store/eventStore';
import { nowStampIso } from '@/lib/appTime';
import type { AdditionalInfoRequest, EventStatus, QualityEvent } from '@/data/types';
const { Text } = Typography;

const SENDER_META: Record<NonNullable<AdditionalInfoRequest['sentBy']>, { tagColor: string; avatarBg: string; initial: string }> = {
  'Field Quality': { tagColor: 'blue', avatarBg: '#1677ff', initial: 'FQ' },
  'Customer Service': { tagColor: 'purple', avatarBg: '#722ed1', initial: 'CS' },
  Tech: { tagColor: 'gold', avatarBg: '#d48806', initial: 'T' },
};

type SenderRole = 'Field Quality' | 'Customer Service';

interface UseInfoRequestThreadOpts {
  onActivity?: (summary: string, forStatus?: EventStatus) => void;
}

export function useInfoRequestThread(
  event: Pick<QualityEvent, 'id' | 'reportedBy' | 'additionalInfoRequests'>,
  senderRole: SenderRole,
  opts: UseInfoRequestThreadOpts = {}
) {
  const { mutations, pushAdditionalInfoRequest, updateAdditionalInfoRequest } = useEventStore();
  const { notification } = App.useApp();
  const evtStored = mutations[event.id] ?? {};

  const [reqDraftOpen, setReqDraftOpen] = useState(false);
  const [reqDraftText, setReqDraftText] = useState('');

  const infoRequests: AdditionalInfoRequest[] = evtStored.additionalInfoRequests ?? event.additionalInfoRequests ?? [];
  const infoThreads = infoRequests.filter(r => r.kind === 'initial' || r.kind === 'new');
  const followupsFor = (threadId: string) => infoRequests.filter(r => r.relatesTo === threadId);

  const nowTs = () => nowStampIso();

  const sendInfoRequest = (text: string, kind: 'initial' | 'new', forStatus?: EventStatus) => {
    const entry: AdditionalInfoRequest = { id: `air_${Date.now()}`, text, sentAt: nowTs(), kind, sentBy: senderRole };
    pushAdditionalInfoRequest(event.id, entry);
    opts.onActivity?.(
      kind === 'new'
        ? `Additional information requested from ${event.reportedBy} (new request).`
        : `Additional information requested from ${event.reportedBy}.`,
      forStatus
    );
  };

  const resendRequest = (id: string) => {
    const root = infoRequests.find(r => r.id === id);
    if (!root) return;
    const followup: AdditionalInfoRequest = {
      id: `air_${Date.now()}`, text: root.text, sentAt: nowTs(), kind: 'followup', relatesTo: id, sentBy: senderRole,
    };
    pushAdditionalInfoRequest(event.id, followup);
    updateAdditionalInfoRequest(event.id, id, { resendCount: (root.resendCount ?? 0) + 1 });
    opts.onActivity?.(`Follow-up reminder sent to ${event.reportedBy}.`);
    notification.success({ message: 'Follow-up reminder sent.' });
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
    sendInfoRequest, resendRequest, startNewRequest, cancelDraft, senderRole,
  };
}

type ThreadState = ReturnType<typeof useInfoRequestThread>;

export function InfoRequestThreadPanel({
  reportedBy, canSend, infoThreads, followupsFor, reqDraftOpen, reqDraftText, setReqDraftText,
  sendInfoRequest, resendRequest, startNewRequest, cancelDraft, senderRole,
}: ThreadState & { reportedBy: string; canSend: boolean }) {
  const { token } = theme.useToken();
  const { notification } = App.useApp();

  const senderName = (sentBy: AdditionalInfoRequest['sentBy']) => (sentBy === 'Tech' ? reportedBy : sentBy ?? 'Field Quality');

  const sortedThreads = infoThreads.slice().sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const latestThread = sortedThreads[sortedThreads.length - 1];
  const isOwnLatestThread = !!latestThread && (latestThread.sentBy ?? 'Field Quality') === senderRole;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', height: '100%' }}>
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
                return (
                  <div key={m.id} style={{ padding: '10px 0' }}>
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                      <Avatar size="small" style={{ background: meta.avatarBg, fontSize: token.fontSizeSM, flexShrink: 0, marginTop: 2 }}>
                        {meta.initial}
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <Text style={{ fontSize: token.fontSizeSM, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {senderName(m.sentBy)}
                            </Text>
                            <Tag color={meta.tagColor} style={{ marginInlineStart: 0, flexShrink: 0, width: 'fit-content' }}>
                              {m.sentBy ?? 'Field Quality'}
                            </Tag>
                          </div>
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
      {canSend && (
        reqDraftOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Input.TextArea
              autoFocus
              rows={4}
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
        ) : isOwnLatestThread ? (
          <Button block icon={<RedoOutlined />} onClick={() => resendRequest(latestThread.id)}>
            Send a Reminder
          </Button>
        ) : (
          <Button block icon={<MessageFilled />} onClick={startNewRequest}>
            Request Additional Information
          </Button>
        )
      )}
    </div>
  );
}
