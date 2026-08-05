import type { ThemeConfig } from 'antd';

// ---------------------------------------------------------------------------
// SEED TOKENS
// Only the values that differ from AntD defaults. The algorithm (light or dark)
// derives everything else: hover states, fills, borders, text hierarchy,
// backgrounds. Never override map tokens here — it breaks dark mode.
// ---------------------------------------------------------------------------
export const SEED_TOKENS: ThemeConfig['token'] = {
  // 4.9:1 on white inputs (antd default #bfbfbf is 1.8:1).
  colorTextPlaceholder: '#6B6B6B',
  // Semantic TEXT tokens, seeded to AA twins (the base status colors are
  // fills; antd's derived *Text values do not clear 4.5:1). Components must
  // read token.colorErrorText etc. for status-colored text, never the fill.
  colorErrorText:   '#cf1322',
  colorSuccessText: '#237804',
  colorWarningText: '#AD4E00',
  colorInfoText:    '#0958D9',
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
  // Brand link teal, light mode (Rob, 2026-08-04): the LIGHTEST shade of the
  // #319FC8 hue/saturation that clears AA — "hit the standard perfectly, not
  // above." Computed by holding H+S and lowering lightness until >= 4.5:1:
  // base #277FA0 4.54:1, hover #216C88 5.89:1, active #1B586F 7.86:1 (states
  // darken toward more contrast). Dark mode runs the raw hex (passes there).
  // Supersedes the 08-03 AA exception (raw teal measured 3.03:1 on white).
  colorLink:          '#277FA0',
  colorLinkHover:     '#216C88',
  colorLinkActive:    '#1B586F',
  // WCAG AA: Ant Design derives colorTextTertiary ≈ #8C8C8C on white = 3.36:1 (fails). #6B6B6B = 5.33:1 ✅
  colorTextTertiary:  '#6B6B6B',
};

// Overrides applied on top of SEED_TOKENS in dark mode only.
// Uses Ant Design palette mid-range values — bright enough to read on dark surfaces.
export const DARK_SEED_OVERRIDES: ThemeConfig['token'] = {
  // 5.6:1 on dark inputs.
  colorTextPlaceholder: '#8C8C8C',
  // AA text twins on dark surfaces: 7.2 / 9.6 / 9.7 / 6.2 on #141414.
  colorErrorText:   '#ff7875',
  colorSuccessText: '#73d13d',
  colorWarningText: '#faad14',
  colorInfoText:    '#4096ff',
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
  // WCAG AA: #595959 on dark card #141414 = 2.63:1 (fails). #8C8C8C passed on
  // cards but sat 4.4:1 on raised fills (#272727); #999999 clears 5.2:1 there.
  colorTextTertiary:    '#999999',
};

// ---------------------------------------------------------------------------
// COLOR CONSTITUTION — THE GOLD & TEAL LAWS (Rob, 2026-08-04)
// "Gold is the brand, teal is your cursor." Every hue in the app belongs to
// exactly one law. When adding UI, find the law first; if neither fits, the
// element is neutral.
//
// GOLD LAW — the brand and its actions. Where gold is seen:
//   1. Primary CTA buttons, both themes (gold fill, near-black text).
//   2. Secondary (default) button hover/active, both themes (gold border +
//      dark-gold text in light for AA; raw gold in dark).
//   3. Brand surface tints: table header band, sorted-column wash, active
//      nav item band/pill.
//   4. Attention flags, always icon- or text-paired: awaiting/stale age,
//      manual-entry signature, direct-ship pin, queue-card count Tag.
//   5. Reporter-side thread avatars (gold family = the field's voice).
//   6. LIGHT-SURFACE FALLBACK CLAUSE: where raw gold cannot hold on white
//      (tab ink, small chrome), gold expresses as the brand near-black
//      #141414 in light and raw gold in dark. Precedent: the dark-CTA
//      button family (Filter/Save, SEMANTIC.colorBrandAction). The light
//      black tab ink IS the gold tab, translated.
//
// TEAL LAW — live interaction, "your cursor." Where teal is seen:
//   1. Links and link-role text (IDs, View in Table, drill-ins).
//   2. Focus rings on every control, both themes.
//   3. Checked/selected control states: checkbox, radio, switch-on.
//   4. Calendar range selection; active pagination item.
//   5. Active sort carets, applied-filter funnels, filter category bar,
//      filter selection-count badges.
//   Light teal = #277FA0 (AA-exact); dark teal = #319FC8 (raw brand hex).
//
// Count badges disambiguated: filter counts (what YOU selected) = teal;
// queue counts (what needs attention) = gold.
//
// EVERYTHING ELSE:
//   - Saturated chromatic fills = RECORD SUBSTATES ONLY, always with text.
//       Events:  Reported blue, Under Investigation orange, Validated green,
//                Invalidated gray.
//       Orders:  Pending Decision blue, Approved light green, Fulfilled solid
//                green, Declined red. Orange is Events-only.
//   - Open/Closed containers are NEUTRAL chips on both record types.
//   - ROLES/IDENTITY are monochromatic; names carry the meaning.
//   - PURPLE = Fulfillment (location), exclusively.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BRAND CONSTANTS
// Design decisions that don't map to AntD tokens.
// Import from here — never hardcode these values in components.
// ---------------------------------------------------------------------------
export const BRAND = {
  // The brand gold itself, for chart/bar fills on brand surfaces. Values are
  // always printed as adjacent text (the 4px bars are redundant encoding), so
  // the fill is exempt from the 3:1 non-text floor.
  colorGold: '#FFD20B',
  // Deep gold for attention-flag icons on light surfaces (ship-to pin,
  // reporter avatars use the same family). ~2.9:1 on white, 6.6:1 on dark —
  // meaning is always redundant with adjacent text.
  colorGoldDeep: '#D48806',
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
// AA-safe TEXT twins for chromatic fills. Node dots and chart fills keep the
// grammar hue; any LABEL TEXT in that hue must use its twin. Ratios on
// #f5f5f5 (light) / #141414 (dark): #0958D9 5.6, #AD4E00 4.9, #237804 5.1,
// #8C8C8C 5.6. Fills already passing (#595959 light 6.4) map to themselves.
export const AA_LABEL_TEXT: { light: Record<string, string>; dark: Record<string, string> } = {
  light: {
    '#13c2c2': '#006d75',
    '#1677ff': '#0958D9',
    '#d46b08': '#AD4E00',
    '#389e0d': '#237804',
    '#595959': '#595959',
  },
  dark: {
    // Measured on #141414 (worst common surface): 6.2 / 9.7 / 8.1 / 6.5;
    // teal 8.5.
    '#13c2c2': '#13c2c2',
    '#1677ff': '#4096ff',
    '#d46b08': '#ffa940',
    '#389e0d': '#52c41a',
    '#595959': '#999999',
  },
};
// Non-text fills are held to 3:1: the only failure is the terminal gray in
// dark (#595959 = 2.6:1 on #141414); its dark fill twin measures 4.2:1.
export function stageFill(fill: string, isDark: boolean): string {
  return isDark && fill === '#595959' ? '#757575' : fill;
}

// Ownership sublabel text (order timeline): 9.0:1 light, 8.9:1 dark (the
// brighter dark step matches the Beta tag's dark purple).
export const OWNERSHIP_TEXT = { light: '#531DAB', dark: '#D3ADF7' } as const;

export function aaLabelColor(fill: string, isDark: boolean): string {
  return (isDark ? AA_LABEL_TEXT.dark : AA_LABEL_TEXT.light)[fill] ?? fill;
}
// Inactive/disabled step labels: 4.9:1 light, 5.6:1 dark.
export const AA_INACTIVE_LABEL = { light: '#6B6B6B', dark: '#999999' } as const;

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
  // Teal = live interaction (Rob, 2026-08-04: "gold is the brand, teal is
  // your cursor"). Focus rings and checked/selected states on every control
  // speak teal in both themes; gold stays on buttons, tints, nav, attention.
  Input:       { colorPrimary: '#319FC8', algorithm: true },
  InputNumber: { colorPrimary: '#319FC8', algorithm: true },
  Select:      { colorPrimary: '#319FC8', algorithm: true },
  Checkbox:    { colorPrimary: '#319FC8', algorithm: true },
  Radio:       { colorPrimary: '#319FC8', algorithm: true },
  Switch:      { colorPrimary: '#319FC8', algorithm: true },
  Pagination:  { colorPrimary: '#319FC8', algorithm: true },
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
  // Calendar selection matches dark mode (Rob, 2026-08-03: light and dark must
  // work cohesively; the navy selection clashed with the teal system). Teal-
  // seeded with dark text on the endpoints (6.08:1, the same rendering dark
  // mode gets via its global colorTextLightSolid); in-range wash derives to a
  // light teal tint.
  DatePicker: {
    colorPrimary: '#319FC8',
    colorTextLightSolid: '#141414',
    algorithm: true,
  },
  // Teal = live interaction (Rob, 2026-08-04): focus rings and checked states
  // on every control. Light uses the AA-exact link teal so derived hover
  // borders stay above the 3:1 non-text bar; buttons/nav/tints keep gold.
  Input:       { colorPrimary: '#277FA0', algorithm: true },
  InputNumber: { colorPrimary: '#277FA0', algorithm: true },
  Select:      { colorPrimary: '#277FA0', algorithm: true },
  Checkbox:    { colorPrimary: '#277FA0', algorithm: true },
  Radio:       { colorPrimary: '#277FA0', algorithm: true },
  Switch:      { colorPrimary: '#277FA0', algorithm: true },
  Pagination:  { colorPrimary: '#277FA0', algorithm: true },
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
    // Gold Law 2: secondary buttons hover gold in light like they do in dark.
    // Dark-gold values pass AA: border #B08900 3.27:1 (non-text), text
    // #946200 5.24:1, active #7A5200 7.0:1-class.
    defaultHoverBorderColor: '#B08900',
    defaultHoverColor: '#946200',
    defaultActiveBorderColor: '#7A5200',
    defaultActiveColor: '#7A5200',
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
