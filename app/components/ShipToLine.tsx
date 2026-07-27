'use client';

import type { CSSProperties } from 'react';
import { Typography, theme } from 'antd';
import { EnvironmentFilled, ShopFilled } from '@ant-design/icons';
import type { QualityEvent } from '@/data/types';

const { Text } = Typography;

// One-line ship-to summary for a parts request: the branch (normal path) or
// the direct address the tech supplied at submission. Direct addresses get the
// map-pin icon so CS and Procurement spot the non-standard destination.
export function ShipToLine({
  shipTo,
  address,
  branch,
  style,
}: {
  shipTo?: QualityEvent['shipTo'];
  address?: QualityEvent['shipToAddress'];
  branch: string;
  style?: CSSProperties;
}) {
  const { token } = theme.useToken();
  const direct = shipTo === 'address' && address;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {direct
        ? <EnvironmentFilled style={{ color: token.colorWarning, fontSize: token.fontSizeSM }} />
        : <ShopFilled style={{ color: token.colorTextTertiary, fontSize: token.fontSizeSM }} />}
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        Ship to:{' '}
        {direct
          ? <Text style={{ fontSize: token.fontSizeSM }}>{address.street}, {address.cityStateZip}</Text>
          : <Text style={{ fontSize: token.fontSizeSM }}>{branch} branch</Text>}
      </Text>
    </div>
  );
}
