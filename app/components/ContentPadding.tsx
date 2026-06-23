'use client';

import { Grid, theme } from 'antd';

export function ContentPadding({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const side = screens.xxl ? 80 : screens.xl ? 48 : token.paddingMD;
  return (
    <div style={{ paddingInline: side, transition: 'padding 0.2s' }}>
      {children}
    </div>
  );
}
