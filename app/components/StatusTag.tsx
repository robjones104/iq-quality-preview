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

export function StatusTag({ status, hasOrder, additionalInfoRequested }: Props) {
  const { token } = theme.useToken();
  return (
    <Tag color={STATUS_PRESETS[status]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {status}
      {hasOrder && (
        <Tooltip title="Order attached" overlayInnerStyle={{ fontSize: token.fontSizeSM }}>
          <ShoppingCartOutlined style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
      {additionalInfoRequested && (
        <Tooltip title="Additional info requested from tech" overlayInnerStyle={{ fontSize: token.fontSizeSM }}>
          <InfoCircleFilled style={{ fontSize: token.fontSizeSM }} />
        </Tooltip>
      )}
    </Tag>
  );
}
