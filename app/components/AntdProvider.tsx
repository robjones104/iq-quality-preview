'use client';

import { useEffect } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { useThemeStore } from '@/store/themeStore';
import { SEED_TOKENS, DARK_SEED_OVERRIDES, LIGHT_COMPONENT_TOKENS, DARK_COMPONENT_TOKENS } from '@/lib/theme';
import { useLargeScreen } from '@/hooks/useLargeScreen';

// Renders nothing — just syncs the resolved colorBgLayout token to document.body.
// Must live inside ConfigProvider so useToken() sees the current algorithm.
function BodyBackground() {
  const { token } = antdTheme.useToken();
  const { darkMode } = useThemeStore();
  useEffect(() => {
    document.body.style.background = token.colorBgLayout;
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [token.colorBgLayout, darkMode]);
  return null;
}

export function AntdProvider({ children }: { children: React.ReactNode }) {
  const { darkMode } = useThemeStore();
  const isLarge = useLargeScreen();
  const baseFontSize = isLarge ? 17 : 14;

  return (
    <ConfigProvider
      theme={{
        algorithm: darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { ...SEED_TOKENS, fontSize: baseFontSize, fontSizeXS: baseFontSize - 4, ...(darkMode && DARK_SEED_OVERRIDES) },
        components: darkMode ? DARK_COMPONENT_TOKENS : LIGHT_COMPONENT_TOKENS,
      }}
    >
      <BodyBackground />
      {children}
    </ConfigProvider>
  );
}
