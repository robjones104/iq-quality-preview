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
  // Brand link teal, raw, both themes (Rob, 2026-08-03).
  // DOCUMENTED AA EXCEPTION — Rob's explicit call after seeing the compliant
  // alternative: #319FC8 on white = 3.03:1, which fails AA for normal text
  // (passes the 3:1 large-text/UI bar only). The AA-passing twin (#17789F,
  // 4.97:1) was built first and rejected as reading navy, not teal. Interaction
  // states DARKEN toward compliance instead of lightening away from it:
  // hover #2589AF 3.98:1, active #17789F 4.97:1.
  colorLink:          '#319FC8',
  colorLinkHover:     '#2589AF',
  colorLinkActive:    '#17789F',
  // WCAG AA: Ant Design derives colorTextTertiary ≈ #8C8C8C on white = 3.36:1 (fails). #6B6B6B = 5.33:1 ✅
  colorTextTertiary:  '#6B6B6B',
};

// Overrides applied on top of SEED_TOKENS in dark mode only.
// Uses Ant Design palette mid-range values — bright enough to read on dark surfaces.
export const DARK_SEED_OVERRIDES: ThemeConfig['token'] = {
  colorPrimary:         '#FFD20B',
  colorTextLightSolid:  '#141414',
  // Brand link teal, raw (Rob, 2026-08-03). WCAG AA on #141414: base 6.08:1,
  // hover #5BB8DA 8.17:1, active #2589AF 4.63:1 — all pass.
  colorLink:            '#319FC8',
  colorLinkHover:       '#5BB8DA',
  colorLinkActive:      '#2589AF',
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
//       Orders:  Pending blue, Approved green (light #95de64 while open;
//                solid #389e0d once closed, labeled "Fulfilled" after the
//                backend's order:fulfill action), Declined red. Orange is
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
    // Active sort carets / applied-filter funnels pop in the brand teal
    // (Rob, 2026-08-03) instead of inheriting the gold primary. algorithm:true
    // re-derives the component's own hover/bg states from the teal seed.
    colorPrimary: '#319FC8',
    algorithm: true,
  },
  // The dark calendar's in-range highlight derived a murky olive from the gold
  // primary (Rob: "throw up yellow"). Selection inside the picker is teal-
  // seeded instead: endpoints solid teal (dark text 6.08:1), in-range fill a
  // derived dark teal. Gold stays outside the panel as the CTA color.
  DatePicker: {
    colorPrimary: '#319FC8',
    algorithm: true,
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
    // Brand-family header tint (Rob, 2026-08-03): a very light opaque yellow.
    // Opaque on purpose — alpha yellows blend muddy over row stripes. Sort
    // hover/active states are pinned to deeper steps of the same tint so
    // antd's gray fills don't sit on top of the yellow.
    headerBg: '#FFFBE6',
    headerSortHoverBg: '#FAF3CD',
    headerSortActiveBg: '#F5ECBB',
    // Active sort carets / applied-filter funnels in the brand teal so they
    // pop against the gold header tint (Rob, 2026-08-03).
    colorPrimary: '#319FC8',
    algorithm: true,
  },
  // Primary buttons carry the brand gold in light mode too (Rob, 2026-08-03:
  // "brand the light theme better" — light chrome was all navy). Scoped to
  // Button only: gold as a GLOBAL colorPrimary would derive illegible gold
  // text/border states on white. Label contrast: #141414 on #FFD20B 13.8:1,
  // on hover #E9C300 ~12:1, on active #D4B200 8.9:1 — all pass. Known trade:
  // the gold fill's boundary against white is ~1.4:1 (yellow CTAs always are);
  // the label carries the contrast.
  Button: {
    fontWeight: 600,
    colorPrimary: '#FFD20B',
    colorPrimaryHover: '#E9C300',
    colorPrimaryActive: '#D4B200',
    primaryColor: '#141414',
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
