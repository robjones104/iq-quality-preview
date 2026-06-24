import type { ThemeConfig } from 'antd';

// ---------------------------------------------------------------------------
// SEED TOKENS
// Only the values that differ from AntD defaults. The algorithm (light or dark)
// derives everything else: hover states, fills, borders, text hierarchy,
// backgrounds. Never override map tokens here — it breaks dark mode.
// ---------------------------------------------------------------------------
export const SEED_TOKENS: ThemeConfig['token'] = {
  colorPrimary: '#1677FF',
  borderRadius: 4,
  fontSize: 14,
  fontFamily: "'Montserrat', sans-serif",
  colorError:   '#B00020',
  colorWarning: '#FAA614',
  colorSuccess: '#008738',
  colorInfo:    '#006BB2',
};

// Overrides applied on top of SEED_TOKENS in dark mode only.
// Uses Ant Design palette mid-range values — bright enough to read on dark surfaces.
export const DARK_SEED_OVERRIDES: ThemeConfig['token'] = {
  colorPrimary:         '#FFD20B',
  colorTextLightSolid:  '#141414',
  colorLink:            '#4096ff',
  colorLinkHover:       '#69b1ff',
  colorError:           '#ff4d4f',
  colorSuccess:         '#52c41a',
  colorWarning:         '#faad14',
};

// ---------------------------------------------------------------------------
// BRAND CONSTANTS
// Design decisions that don't map to AntD tokens.
// Import from here — never hardcode these values in components.
// ---------------------------------------------------------------------------
export const BRAND = {
  colorActionDark: '#141414',
  colorActionDarkHover: '#333333',
  colorAiButton: 'linear-gradient(257deg, #000 43%, #555 93%)',
} as const;

// ---------------------------------------------------------------------------
// SEMANTIC TOKENS
// Named by intent, not value. Same key works in both light and dark mode.
// Use these for layout/surface/text decisions outside AntD components.
// AntD component internals (Button, Tag, Input, etc.) are handled by the
// algorithm — don't duplicate those here.
// ---------------------------------------------------------------------------
export const SEMANTIC = {
  light: {
    colorBgPage:        '#F5F5F5',  // outermost layout background
    colorBgSurface:     '#FFFFFF',  // cards, panels, popovers
    colorBgSunken:      '#FAFAFA',  // table headers, inset areas
    colorTextPrimary:   '#141414',
    colorTextSecondary: '#595959',
    colorTextMuted:     '#8C8C8C',
    colorBorderDefault: '#D9D9D9',
    colorBorderSubtle:  '#F0F0F0',
    colorBrandAction:   '#141414',  // dark CTA buttons (Filter, Save, Edit)
    colorBrandHover:    '#333333',
  },
  dark: {
    colorBgPage:        '#0A0A0A',
    colorBgSurface:     '#141414',
    colorBgSunken:      '#1A1A1A',
    colorTextPrimary:   '#FFFFFF',
    colorTextSecondary: '#A3A3A3',
    colorTextMuted:     '#595959',
    colorBorderDefault: '#303030',
    colorBorderSubtle:  '#1F1F1F',
    colorBrandAction:   '#FFFFFF',
    colorBrandHover:    '#D9D9D9',
  },
} as const;

export type SemanticTokens = { [K in keyof typeof SEMANTIC.light]: string };

// ---------------------------------------------------------------------------
// DARK-MODE COMPONENT OVERRIDES
// Scoped to dark mode only — forces exact yellow on primary buttons and
// dark text so the yellow CTA reads correctly against dark surfaces.
// ---------------------------------------------------------------------------
export const DARK_COMPONENT_TOKENS: ThemeConfig['components'] = {
  Card: {
    bodyPaddingSM: 20,
    headerHeightSM: 48,
  },
  Table: {
    cellPaddingBlockSM: 16,
    cellPaddingInlineSM: 12,
  },
  Button: {
    fontWeight: 600,
  },
};

// ---------------------------------------------------------------------------
// SHARED COMPONENT OVERRIDES — applied in both light and dark mode
// ---------------------------------------------------------------------------
export const SHARED_COMPONENT_TOKENS: ThemeConfig['components'] = {
  Card: {
    bodyPaddingSM: 20,   // small card body (default 12)
    headerHeightSM: 48,  // small card header height (default 38)
  },
  Table: {
    cellPaddingBlockSM: 16,   // small table row height (default 8) — user requested
    cellPaddingInlineSM: 12,  // small table cell sides (default 8)
  },
};

// ---------------------------------------------------------------------------
// LIGHT-MODE COMPONENT OVERRIDES
// Only applied in light mode. Dark mode lets the algorithm decide.
// ---------------------------------------------------------------------------
export const LIGHT_COMPONENT_TOKENS: ThemeConfig['components'] = {
  ...SHARED_COMPONENT_TOKENS,
  Table: {
    ...SHARED_COMPONENT_TOKENS.Table,
    headerBg: '#fafafa',
  },
  Tabs: {
    inkBarColor: '#141414',
    itemSelectedColor: '#141414',
    itemHoverColor: '#141414',
  },
};
