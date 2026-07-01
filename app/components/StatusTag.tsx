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

type Props = {
  status: EventStatus;
  hasOrder?: boolean;
  additionalInfoRequested?: boolean;
};

export function StatusTag({ status, hasOrder, additionalInfoRequested }: Props) {
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
