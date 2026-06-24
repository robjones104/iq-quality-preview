import { Tag, Tooltip, theme } from 'antd';
import { ShoppingCartOutlined, InfoCircleFilled } from '@ant-design/icons';
import type { EventStatus } from '@/data/types';

// Hex values kept for chart library use (bar chart series colors in TriageReview)
export const STATUS_COLORS: Record<EventStatus, string> = {
  Reported:              '#1677ff',
  'Under Investigation': '#d46b08',
  Validated:             '#389e0d',
  Invalidated:           '#595959',
};

// Ant Design preset color names — respects theme changes
const STATUS_PRESETS: Record<EventStatus, string> = {
  Reported:              'blue',
  'Under Investigation': 'orange',
  Validated:             'green',
  Invalidated:           'default',
};

type Props = {
  status: EventStatus;
  hasOrder?: boolean;
  additionalInfoRequested?: boolean;
};

// Light-on-dark contrast: always white background so tooltips are readable in dark theme
const TOOLTIP_BG    = '#f5f5f5';
const TOOLTIP_TEXT  = 'rgba(0, 0, 0, 0.88)';

export function StatusTag({ status, hasOrder, additionalInfoRequested }: Props) {
  const { token } = theme.useToken();
  const tipInner = { color: TOOLTIP_TEXT, fontSize: token.fontSizeSM };
  return (
    <Tag color={STATUS_PRESETS[status]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {status}
      {hasOrder && (
        <Tooltip title="Order attached" color={TOOLTIP_BG} overlayInnerStyle={tipInner}>
          <ShoppingCartOutlined style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      {additionalInfoRequested && (
        <Tooltip title="Additional info requested from tech" color={TOOLTIP_BG} overlayInnerStyle={tipInner}>
          <InfoCircleFilled style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
    </Tag>
  );
}
