import { Tag, Tooltip, theme } from 'antd';
import { ShoppingCartOutlined, InfoCircleOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { EventStatus } from '@/data/types';
import { useThemeStore } from '@/store/themeStore';

// Hex values kept for chart library use (bar chart series colors in TriageReview)
export const STATUS_COLORS: Record<EventStatus, string> = {
  Reported:              '#1677ff',
  'Under Investigation': '#d46b08',
  Validated:             '#389e0d',
  Invalidated:           '#595959',
};

// Status badges are solid fills with white text in BOTH themes (Rob,
// 2026-08-05; extends the 2026-08-03 light-mode inversion). Fills are the
// AA-passing dark step of each lifecycle hue — the raw STATUS_COLORS fail
// 4.5:1 under white text (blue 4.10:1, orange 3.56:1, green 3.55:1). White
// text ratios: #0958D9 6.15:1, #AD4E00 5.43:1, #237804 5.59:1, #595959
// 7.00:1. Dark theme swaps only the gray: #595959 sits 2.6:1 against dark
// cards (chip boundary), so Invalidated brightens to #757575 (4.2:1 vs card,
// white text 4.5:1).
const SOLID_BADGE_BG: Record<'light' | 'dark', Record<EventStatus, string>> = {
  light: {
    Reported:              '#0958D9',
    'Under Investigation': '#AD4E00',
    Validated:             '#237804',
    Invalidated:           '#595959',
  },
  dark: {
    Reported:              '#0958D9',
    'Under Investigation': '#AD4E00',
    Validated:             '#237804',
    Invalidated:           '#757575',
  },
};

const solidBadgeStyle = (status: EventStatus, isDark: boolean): CSSProperties => ({
  background: SOLID_BADGE_BG[isDark ? 'dark' : 'light'][status],
  color: '#FFFFFF',
  borderColor: 'transparent',
});

// Order pipeline stages as solid tags (Rob 2026-08-05): on order surfaces
// the ORDER wears the color and the event demotes to neutral. Approved is
// deep teal #006d75 (white 5.9:1), deliberately not the cursor teal #277FA0:
// interaction teal stays reserved. Declined shares the terminal gray with
// Invalidated (brighter in dark for the chip boundary).
export type OrderStage = 'Pending Decision' | 'Approved' | 'Fulfilled' | 'Declined';
const ORDER_STAGE_BG: Record<'light' | 'dark', Record<OrderStage, string>> = {
  light: {
    'Pending Decision': '#0958D9',
    Approved:           '#006d75',
    Fulfilled:          '#237804',
    Declined:           '#595959',
  },
  dark: {
    'Pending Decision': '#0958D9',
    Approved:           '#006d75',
    Fulfilled:          '#237804',
    Declined:           '#757575',
  },
};

export function OrderStageTag({ stage, assigned, additionalInfoRequested, responseReceived, awaitingTooltip, respondedTooltip }: {
  stage: OrderStage;
  // Approved order handed to Fulfillment: send glyph on the chip.
  assigned?: boolean;
  additionalInfoRequested?: boolean;
  responseReceived?: boolean;
  awaitingTooltip?: string;
  respondedTooltip?: string;
}) {
  const { token } = theme.useToken();
  const isDark = useThemeStore(st => st.darkMode);
  return (
    <Tag
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: ORDER_STAGE_BG[isDark ? 'dark' : 'light'][stage],
        color: '#FFFFFF',
        borderColor: 'transparent',
      }}
    >
      {stage}
      {assigned && (
        <Tooltip title="Assigned to Fulfillment">
          <SendOutlined tabIndex={0} aria-label="Assigned to Fulfillment" style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      {assigned && (additionalInfoRequested || responseReceived) && (
        <span
          aria-hidden
          style={{ width: 1, height: 10, background: 'currentColor', opacity: 0.4, display: 'inline-block' }}
        />
      )}
      <ThreadStateIcons awaiting={additionalInfoRequested} responded={responseReceived} awaitingTooltip={awaitingTooltip} respondedTooltip={respondedTooltip} />
    </Tag>
  );
}

// The two thread states, shape-differentiated (color stays lifecycle-only):
// info circle = a question is out, the reporter side owes an answer;
// message bubble = the answer came back, the office owes the next move.
// The two are mutually exclusive (both key off the thread's latest message).
// Callers gate both to records still in play (active events / open orders) so
// terminal rows stay quiet. Inherits the surrounding tag's text color.
export function ThreadStateIcons({ awaiting, responded, awaitingTooltip, respondedTooltip }: {
  awaiting?: boolean;
  responded?: boolean;
  awaitingTooltip?: string;
  respondedTooltip?: string;
}) {
  const { token } = theme.useToken();
  return (
    <>
      {awaiting && (
        <Tooltip title={awaitingTooltip ?? 'Information requested, response pending'}>
          <InfoCircleOutlined tabIndex={0} aria-label={awaitingTooltip ?? 'Information requested, response pending'} style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      {responded && (
        <Tooltip title={respondedTooltip ?? 'Response received'}>
          <MessageOutlined tabIndex={0} aria-label={respondedTooltip ?? 'Response received'} style={{ fontSize: token.fontSizeSM }} />
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
  awaitingTooltip?: string;
  respondedTooltip?: string;
};

export function StatusTag({ status, hasOrder, additionalInfoRequested, responseReceived, awaitingTooltip, respondedTooltip }: Props) {
  const { token } = theme.useToken();
  const isDark = useThemeStore(st => st.darkMode);

  return (
    <Tag
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...solidBadgeStyle(status, isDark),
      }}
    >
      {status}
      {hasOrder && (
        <Tooltip title="Order attached">
          <ShoppingCartOutlined style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      {hasOrder && (additionalInfoRequested || responseReceived) && (
        <span
          aria-hidden
          style={{ width: 1, height: 10, background: 'currentColor', opacity: 0.4, display: 'inline-block' }}
        />
      )}
      <ThreadStateIcons awaiting={additionalInfoRequested} responded={responseReceived} awaitingTooltip={awaitingTooltip} respondedTooltip={respondedTooltip} />
    </Tag>
  );
}
