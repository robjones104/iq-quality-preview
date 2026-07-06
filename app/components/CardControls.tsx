'use client';

import { Typography, theme } from 'antd';

export function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { token } = theme.useToken();
  return (
    <Typography.Link style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap' }} onClick={onToggle}>
      {expanded ? 'Collapse' : 'Expand'}
    </Typography.Link>
  );
}

export function Dot() {
  const { token } = theme.useToken();
  return <span style={{ color: token.colorTextQuaternary, fontSize: token.fontSizeSM }}>·</span>;
}
