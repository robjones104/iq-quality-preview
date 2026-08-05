'use client';

import { Button, theme } from 'antd';

export function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { token } = theme.useToken();
  // Typography.Link renders an hrefless <a>: no role, no keyboard, no state.
  return (
    <Button
      type="link"
      size="small"
      aria-expanded={expanded}
      onClick={onToggle}
      style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap', padding: 0, height: 'auto' }}
    >
      {expanded ? 'Collapse' : 'Expand'}
    </Button>
  );
}

export function Dot() {
  const { token } = theme.useToken();
  return <span style={{ color: token.colorTextQuaternary, fontSize: token.fontSizeSM }}>·</span>;
}
