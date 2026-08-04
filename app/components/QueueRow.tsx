'use client';

import { Button, Tag, Tooltip, Typography, theme } from 'antd';

const { Text } = Typography;

// The shared message-queue row (Rob, 2026-08-04): the intake home's Needs Your
// Response anatomy, adopted by the dashboards' Response Received cards. Flat
// hairline-divided rows: ID, person tag, single-line text stretched across,
// date, action button. One artifact, three surfaces.
export function QueueRow({ id, personName, personTooltip, text, dateLabel, actionLabel, onOpen, topBorder }: {
  id: string;
  personName: string;
  personTooltip?: string;
  text?: string;
  dateLabel?: string;
  actionLabel: string;
  onOpen: () => void;
  topBorder: boolean;
}) {
  const { token } = theme.useToken();
  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 4px',
        cursor: 'pointer',
        borderTop: topBorder ? `1px solid ${token.colorBorderSecondary}` : undefined,
      }}
    >
      <Text style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorLink, flexShrink: 0 }}>
        {id}
      </Text>
      <Tooltip title={personTooltip}>
        <Tag style={{ flexShrink: 0, marginInlineEnd: 0 }}>{personName}</Tag>
      </Tooltip>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM, flex: 1, minWidth: 0 }} ellipsis>
        {text}
      </Text>
      {dateLabel && (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM, flexShrink: 0 }}>
          {dateLabel}
        </Text>
      )}
      <Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
        {actionLabel}
      </Button>
    </div>
  );
}
