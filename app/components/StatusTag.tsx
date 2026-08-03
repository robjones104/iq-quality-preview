import { Tag, Tooltip, theme } from 'antd';
import { ShoppingCartOutlined, InfoCircleOutlined, MessageOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { EventStatus } from '@/data/types';

// Hex values kept for chart library use (bar chart series colors in TriageReview)
export const STATUS_COLORS: Record<EventStatus, string> = {
  Reported:              '#1677ff',
  'Under Investigation': '#d46b08',
  Validated:             '#389e0d',
  Invalidated:           '#595959',
};

// Ant Design preset color names — respects dark-mode theme changes
const STATUS_PRESETS: Record<EventStatus, string> = {
  Reported:              'blue',
  'Under Investigation': 'orange',
  Validated:             'green',
  Invalidated:           'default',
};

// WCAG AA: orange and green preset tags fail in light mode at 14px (normal text needs 4.5:1).
// AntD orange-8 (#873800) on orange-1 (#FFF7E6) = 7.59:1; AntD green-8 (#237804) on green-1 (#F6FFED) = 5.42:1.
// Dark mode uses different palette values that already pass — override light mode only.
const LIGHT_MODE_TEXT: Partial<Record<EventStatus, string>> = {
  'Under Investigation': '#873800',
  Validated:             '#237804',
};

// Reusable by any tag that needs to be colored by an event's status while showing its own label
// (e.g. Orders/Procurement "Open"/"Closed" badges colored by the linked event's status).
export function eventStatusTagProps(status: EventStatus, isDark: boolean): { color: string; style?: CSSProperties } {
  const color = STATUS_PRESETS[status];
  const textOverride = !isDark ? LIGHT_MODE_TEXT[status] : undefined;
  return textOverride ? { color, style: { color: textOverride } } : { color };
}

// The two thread states, shape-differentiated (color stays lifecycle-only):
// info circle = a question is out, the reporter side owes an answer;
// message bubble = the answer came back, the office owes the next move.
// The two are mutually exclusive (both key off the thread's latest message).
// Callers gate both to records still in play (active events / open orders) so
// terminal rows stay quiet. Inherits the surrounding tag's text color.
export function ThreadStateIcons({ awaiting, responded }: { awaiting?: boolean; responded?: boolean }) {
  const { token } = theme.useToken();
  return (
    <>
      {awaiting && (
        <Tooltip title="Information requested, response pending">
          <InfoCircleOutlined style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      {responded && (
        <Tooltip title="Response received">
          <MessageOutlined style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
    </>
  );
}

type Props = {
  status: EventStatus;
  hasOrder?: boolean;
  additionalInfoRequested?: boolean;
  responseReceived?: boolean;
};

export function StatusTag({ status, hasOrder, additionalInfoRequested, responseReceived }: Props) {
  const { token } = theme.useToken();
  const isDark = token.colorBgContainer !== '#ffffff';
  const textOverride = !isDark ? LIGHT_MODE_TEXT[status] : undefined;

  return (
    <Tag
      color={STATUS_PRESETS[status]}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...(textOverride ? { color: textOverride } : {}),
      }}
    >
      {status}
      {hasOrder && (
        <Tooltip title="Order attached">
          <ShoppingCartOutlined style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      <ThreadStateIcons awaiting={additionalInfoRequested} responded={responseReceived} />
    </Tag>
  );
}
