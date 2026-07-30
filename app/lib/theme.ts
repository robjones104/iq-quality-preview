import type { ThemeConfig } from 'antd';

// ---------------------------------------------------------------------------
// SEED TOKENS
// Only the values that differ from AntD defaults. The algorithm (light or dark)
// derives everything else: hover states, fills, borders, text hierarchy,
// backgrounds. Never override map tokens here — it breaks dark mode.
// ---------------------------------------------------------------------------
export const SEED_TOKENS: ThemeConfig['token'] = {
  // Figma Interactive/Primary. WCAG AA verified via antd's own getDesignToken():
  // colorPrimary/colorPrimaryText 7.96:1, colorPrimaryTextHover 5.61:1 on white — all pass.
  // #1677FF (AntD default) failed at 4.10:1 (large-text only) and its hover state failed at 2.99:1.
  colorPrimary:       '#225093',
  borderRadius:       4,
  fontSize:           14,
  fontFamily:         "'Montserrat', sans-serif",
  colorError:         '#B00020',
  // Darkened from Figma's raw Status/Warning (#FAA614, 1.99:1 — fails hard as text).
  // #946200 passes as colorWarningText (5.24:1) and colorWarningTextActive (8.35:1).
  colorWarning:       '#946200',
  colorSuccess:       '#008738',
  colorInfo:          '#006BB2',
  // WCAG AA: colorLink base 10.55:1, colorLinkHover 5.71:1, colorLinkActive 14.40:1 — all pass.
  // #0958D9 passed as a base link color but its derived hover state failed at 2.80:1.
  colorLink:          '#003D82',
  // WCAG AA: Ant Design derives colorTextTertiary ≈ #8C8C8C on white = 3.36:1 (fails). #6B6B6B = 5.33:1 ✅
  colorTextTertiary:  '#6B6B6B',
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
  // colorInfo was previously unset here, so it fell back to the light-mode seed (#006BB2),
  // which the dark algorithm derives at 2.69:1 on #141414 (fails). #4096ff passes at 4.78:1.
  colorInfo:            '#4096ff',
  // WCAG AA: #595959 on dark card #141414 = 2.63:1 (fails). #8C8C8C = 5.48:1 ✅
  colorTextTertiary:    '#8C8C8C',
};

// ---------------------------------------------------------------------------
// COLOR CONSTITUTION (2026-07-29, Rob's rulings)
// Hue meaning is allocated by semantic layer, app-wide:
//   - Saturated chromatic fills = RECORD LIFECYCLE ONLY.
//       Events:  Reported blue, Under Investigation orange, Validated green,
//                Invalidated gray.
//       Orders:  Pending blue, Approved green (light #95de64 while open,
//                solid #389e0d once closed), Declined red. Orange is
//                Events-only.
//     Nothing else may use these hues as fills; KPI swatches carry them.
//   - ROLES/IDENTITY are monochromatic (FQ/CS tags, thread avatars): the
//     letters carry the meaning, never a hue.
//   - PURPLE = Procurement (location), exclusively.
//   - GOLD (the brand accent, #FFD20B dark / gold family light) = accents and
//     attention flags (awaiting, stale age, manual entry, direct ship),
//     always paired with an icon or text, never a category color.
// ---------------------------------------------------------------------------

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
    colorTextMuted:     '#6B6B6B',
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
    colorTextMuted:     '#8C8C8C',
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
  Tooltip: {
    colorBgSpotlight: '#EBEBEB',
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
  // Mirror of the dark-mode Tooltip pin: tooltips always invert their theme.
  // Without an explicit bg, antd v6 derives a light spotlight surface here
  // while the text token stays light-solid white — white on white.
  Tooltip: {
    colorBgSpotlight: 'rgba(38, 38, 38, 0.96)',
  },
};
