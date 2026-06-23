'use client';

import { useThemeStore } from '@/store/themeStore';
import { SEMANTIC, type SemanticTokens } from '@/lib/theme';

export function useSemanticTokens(): SemanticTokens {
  const darkMode = useThemeStore((s) => s.darkMode);
  return darkMode ? SEMANTIC.dark : SEMANTIC.light;
}
