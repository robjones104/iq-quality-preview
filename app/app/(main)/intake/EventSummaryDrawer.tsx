'use client';

import { useState } from 'react';
import { App, Button, Descriptions, Divider, Drawer, Input, Typography, theme } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { StatusTag } from '@/components/StatusTag';
import { JobNoValue } from '@/components/JobNoValue';
import { ShipToLine } from '@/components/ShipToLine';
import { InfoRequestThreadPanel, useInfoRequestThread } from '@/components/InfoRequestThread';
import { awaitingTechReply, hasTechReply, awaitingParty } from '@/components/TechReplyWarning';
import { useEventStore } from '@/store/eventStore';
import { capabilitiesFor } from '@/lib/roles';
import { nowStampIso } from '@/lib/appTime';
import type { AdditionalInfoRequest, QualityEvent } from '@/data/types';

const { Text, Paragraph } = Typography;

// Read-only event view for the Intake role, which never visits /events/[id].
// Shows the submitted facts plus the info-request thread, with a reply box
// when the office is waiting on the reporter side (the loop-closing surface:
// an Intake reply flips Awaiting Response to Response Received on the FQ/CS
// dashboards).
export function EventSummaryDrawer({
  event,
  open,
  onClose,
}: {
  event: QualityEvent | null;
  open: boolean;
  onClose: () => void;
}) {
  const { token } = theme.useToken();
  const { notification } = App.useApp();
  const patchEvent = useEventStore((s) => s.patchEvent);
  const [replyText, setReplyText] = useState('');

  // Sender role is unused in read-only mode; the hook only feeds the panel's
  // thread rendering here.
  const thread = useInfoRequestThread(
    event ?? { id: '', reportedBy: '', additionalInfoRequests: [] },
    'Field Quality'
  );

  if (!event) return null;

  const isSO = event.jobNo.startsWith('SO');

  const effectiveThread = ((): AdditionalInfoRequest[] => {
    // The hook already merges store mutations over the event's static thread.
    const roots = thread.infoThreads;
    const all = roots.flatMap(r => [r, ...thread.followupsFor(r.id)]);
    return all.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  })();

  const awaiting = awaitingTechReply(effectiveThread);
  // Surfaces name the person asking, not their role (office parties map to
  // their demo personas).
  const askingParty = awaitingParty(effectiveThread);
  const asking = askingParty ? capabilitiesFor(askingParty).displayName : null;
  const latestRoot = thread.infoThreads
    .slice()
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    .pop();

  const sendReply = () => {
    if (!latestRoot || !replyText.trim()) return;
    // Write the FULL thread: the store overlay replaces the static thread once
    // present (mergeEvent semantics), so appending only the reply would erase
    // the seeded conversation app-wide. `event` is the effective event, so its
    // thread already includes any prior overlay writes.
    patchEvent(event.id, {
      additionalInfoRequests: [
        ...(event.additionalInfoRequests ?? []),
        {
          id: `air_${Date.now()}`,
          text: replyText.trim(),
          sentAt: nowStampIso(),
          kind: 'reply',
          relatesTo: latestRoot.id,
          sentBy: 'Intake',
        },
      ],
    });
    setReplyText('');
    notification.success({ message: `Response sent to ${asking ?? capabilitiesFor('Field Quality').displayName}.` });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="large"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontFamily: 'monospace', fontSize: token.fontSizeLG }}>{event.id}</Text>
          <StatusTag
            status={event.status}
            additionalInfoRequested={awaiting}
            responseReceived={
              event.status !== 'Validated' && event.status !== 'Invalidated' && hasTechReply(effectiveThread)
            }
          />
        </div>
      }
    >
      <Descriptions
        column={2}
        size="small"
        items={[
          { key: 'job', label: 'Job No.', children: <JobNoValue jobNo={event.jobNo} manualEntry={event.jobNoManualEntry} /> },
          { key: 'reported', label: 'Reported', children: event.reportedAt.slice(0, 16).replace('T', ' ') },
          ...(isSO ? [
            { key: 'dfo', label: 'DFO LIN', children: String(event.dfo) },
            { key: 'el', label: 'EL LIN', children: event.elLine != null ? String(event.elLine) : 'Not provided' },
          ] : []),
          { key: 'door', label: 'Door', children: event.door },
          { key: 'component', label: 'Component', children: event.component },
          { key: 'issue', label: 'Issue', children: event.issue },
          { key: 'branch', label: 'Branch', children: event.branch },
          { key: 'reportedBy', label: 'Reported By', children: event.reportedBy },
        ]}
      />

      <Divider titlePlacement="start" plain style={{ marginTop: 20, marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Issue Description</Text>
      </Divider>
      <Paragraph style={{ fontSize: token.fontSize, marginBottom: 0 }}>{event.issueDescription}</Paragraph>

      {(event.partsRequest?.length ?? 0) > 0 && (
        <>
          <Divider titlePlacement="start" plain style={{ marginTop: 20, marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Parts Requested</Text>
          </Divider>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {event.partsRequest!.map((p, i) => (
              <div
                key={`${p.partNumber}_${i}`}
                style={{
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadiusSM,
                  padding: '8px 12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM }}>{p.partNumber}</Text>
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    Qty {p.quantity} ({p.quantityType})
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{p.description}</Text>
              </div>
            ))}
            <ShipToLine shipTo={event.shipTo} address={event.shipToAddress} branch={event.branch} />
          </div>
        </>
      )}

      <Divider titlePlacement="start" plain style={{ marginTop: 20, marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Additional Information Requests</Text>
      </Divider>
      {/* The panel stretches to its container (height: 100%); cap it so the
          reply box sits right under the messages instead of below a void. */}
      <div style={{ height: 'auto', display: 'block' }}>
        <InfoRequestThreadPanel {...thread} reportedBy={event.reportedBy} canSend={false} />
      </div>

      {awaiting && latestRoot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {asking ?? capabilitiesFor('Field Quality').displayName} is waiting on a response to the question above.
          </Text>
          <Input.TextArea
            rows={3}
            placeholder="Write your response..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={!replyText.trim()}
            onClick={sendReply}
            style={{ alignSelf: 'flex-end' }}
          >
            Send Response
          </Button>
        </div>
      )}
    </Drawer>
  );
}
