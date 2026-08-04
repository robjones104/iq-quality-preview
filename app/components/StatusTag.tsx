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

// Ant Design preset color names — dark mode keeps antd's derived dark tints.
const STATUS_PRESETS: Record<EventStatus, string> = {
  Reported:              'blue',
  'Under Investigation': 'orange',
  Validated:             'green',
  Invalidated:           'default',
};

// Light mode inverts the badge (Rob, 2026-08-03): solid dark fill, white text,
// instead of antd's pastel tint + colored text. Fills are the AA-passing dark
// step of each lifecycle hue — the raw STATUS_COLORS fail 4.5:1 under white
// text (blue 4.10:1, orange 3.56:1, green 3.55:1). White text ratios:
// #0958D9 6.15:1, #AD4E00 5.43:1, #237804 5.59:1, #595959 7.00:1.
const LIGHT_INVERSE_BG: Record<EventStatus, string> = {
  Reported:              '#0958D9',
  'Under Investigation': '#AD4E00',
  Validated:             '#237804',
  Invalidated:           '#595959',
};

const lightInverseStyle = (status: EventStatus): CSSProperties => ({
  background: LIGHT_INVERSE_BG[status],
  color: '#FFFFFF',
  borderColor: 'transparent',
});

// Order-status (Open/Closed) badges share the light-mode inversion (Rob,
// 2026-08-04: detail pages must match the tables). Same AA-passing dark steps:
// white on #0958D9 6.15:1, on #237804 5.59:1. Dark mode keeps antd presets.
// Call sites must SPREAD the returned style into their own (a style prop after
// the spread clobbers it — the bug class from 08-03).
export function orderStatusTagProps(status: 'Open' | 'Closed', isDark: boolean): { color?: string; style: CSSProperties } {
  return isDark
    ? { color: status === 'Open' ? 'blue' : 'green', style: {} }
    : { style: { background: status === 'Open' ? '#0958D9' : '#237804', color: '#FFFFFF', borderColor: 'transparent' } };
}

// Reusable by any tag that needs to be colored by an event's status while showing its own label
// (e.g. Orders/Procurement "Open"/"Closed" badges colored by the linked event's status).
export function eventStatusTagProps(status: EventStatus, isDark: boolean): { color?: string; style?: CSSProperties } {
  return isDark
    ? { color: STATUS_PRESETS[status] }
    : { style: lightInverseStyle(status) };
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

  return (
    <Tag
      color={isDark ? STATUS_PRESETS[status] : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...(isDark ? {} : lightInverseStyle(status)),
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
