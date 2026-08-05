# Accessibility Specification

Audience: the development team implementing this design, and the designer annotating the Figma file. This documents every accessibility behavior the prototype implements so production preserves them, plus the items that are deliberately still open. Target standard: **WCAG 2.2 AA**. Audit trail: axe-core sweeps, a Machado-matrix CVD simulation pass, a 24x24 target-size DOM scan, and four persona code reviews (semantics/ARIA, keyboard/focus, forms/errors, WCAG 2.2 specifics) ran 2026-08-04; the mechanical fix package landed 2026-08-05.

## 1. Structure and landmarks

- **Every page has exactly one `h1`**, visually hidden in the sticky page header, derived from the route ("Dashboard", "Events", "Event QE_2687", "Report a Quality Event", ...). `PageHeader` accepts a `pageTitle` override. The login page's visible title is its `h1` (level 1 styled as level 4).
- The top bar is a **`<header>` landmark**; the sidebar is a **`<nav>`**; page content lives in **`<main id="main-content">`**.
- **Skip link**: the first tab stop on every page is "Skip to main content" (`.skip-link` in globals.css, visually hidden until focused, jumps to `#main-content` which carries `tabIndex={-1}`).
- **Sticky-header clearance**: the scroll container sets `scroll-padding-top: 64px` so keyboard-focus scrolls never land content under the 56px sticky header (WCAG 2.4.11).
- **Mobile nav** is a real `<nav aria-label="Main navigation">` with a list of links (`aria-current="page"` on the active one). The antd Menu below it holds only action items (role switcher, account, theme), never page links.

## 2. Names and labels

Conventions production must keep:

- **Icon-only controls carry contextual `aria-label`s**, not the icon's name: "Open filters", "Open navigation menu", "Toggle dark mode", "Switch viewing role. Currently viewing as {role}", "Account menu for {email}", "Remove filter {label}", "Copy {value}", "Expand photo {n}", "Preview attachment {name}".
- **The collapsed sidebar** is the critical case: the role-switcher and account controls are icon-only there, so their names must never depend on the expanded state (they are `aria-label`ed and `tabIndex={0}`, `aria-haspopup="menu"`).
- **Every Modal keeps its title in every sub-state**, including success screens. `title={null}` strips the dialog's accessible name (rc-dialog wires `aria-labelledby` only from the title).
- **Form fields**: antd `Form.Item` only associates its label when it has a `name` prop. Wherever the prototype uses label-without-name (the assessment selects, part editors, plant select, ship-to inputs, replacement #), the control carries an `aria-label` equal to the visible label. All confirm-modal and reply `TextArea`s have `aria-label`s, plus `aria-required` when the submit button gates on them.
- Login: the access-code field is labeled ("Access code") and sets `autoComplete="current-password"` (WCAG 3.3.8).
- **Empty table header cells** (chevron / actions columns) get visually hidden titles ("Open", "Actions") via the `.sr-only` pattern.
- Decorative icons (row chevrons, dividers between badge icons) are `aria-hidden`.

## 3. Keyboard

Everything clickable is reachable and operable by keyboard. House patterns:

- Custom interactive elements use `role="button"` (or `role="tab"` in the filter category list, with `aria-selected`), `tabIndex={0}`, and an `onKeyDown` accepting **Enter and Space** (Space calls `preventDefault` to stop page scroll).
- Applied instances: copy-to-clipboard chips (`CopyableValue`), filter category switcher, date-range trigger, photo/label-scan thumbnails, attachment preview rows, select-all toggles in the filter drawer.
- **Read-only scrollable regions** (event details pane, message thread) carry `tabIndex={0}` + `role="region"` + `aria-label` so keyboard users can scroll them.
- **Expand/collapse** affordances are real buttons with `aria-expanded` (`ExpandToggle`).
- **Icon tooltips that carry material information are focusable** (`tabIndex={0}` on the icon): thread-state icons in badges, the manual-entry signature flag, metric info icons. antd tooltips open on focus.
- Focus visibility relies on antd v6's 3px outlines - verified passing; do not suppress outlines in production CSS.
- Modals and drawers trap focus and return it on close (antd default - keep it).

## 4. Target size (WCAG 2.5.8, 24x24 floor)

- Metric info icons are 24x24 `<button>`s (negative margin keeps the 12px visual glyph).
- Filter-chip close targets are padded to >= 24x24 with cancelling negative margin (glyph unchanged).
- antd `size="small"` icon buttons are exactly 24x24 by antd CSS - safe to use.
- Inline text links are exempt (inline exception).

## 5. Color and contrast canon

All values verified against WCAG AA (4.5:1 text, 3:1 non-text). The full color constitution (Gold & Teal Laws) lives in `app/lib/theme.ts`; the accessibility-relevant rulings:

- **Links**: light theme `#277FA0` = 4.54:1 on white (deliberately "exactly AA"); dark theme `#319FC8`.
- **Status badges (light)** invert to solid dark fills with white text: Reported `#0958D9`, Under Investigation `#AD4E00`, Validated `#237804`, Invalidated `#595959` - all AA.
- **State grammar**: blue = start, green = "ended in yes" (Validated / Fulfilled), gray `#595959` = "ended in no" (Invalidated / Declined). Red is reserved for genuine attention and is not used for routine terminals.
- **Thread avatars**: explicit white initials on `#434343` / `#595959` (office) and `#ad6800` / `#7A5200` (reporter side) - 4.4:1 minimum. Never token-derive avatar text color: dark mode sets `colorTextLightSolid` near-black for gold buttons.
- **Attention gold**: `#D48806` (`BRAND.colorGoldDeep`) for flag icons (direct-address ship-to pin); brand gold `#FFD20B` (`BRAND.colorGold`) for chart bar fills whose values are always printed as adjacent text.
- **CVD**: chart series are luminance-ladders, verified under Machado protanopia/deuteranopia/tritanopia matrices. The two-green Approved/Fulfilled pair sits in different columns; Declined is gray, not red, partly for this reason.

## 6. Charts

Canvas charts are opaque to assistive tech, so:

- Chart containers carry `role="img"` + a sentence-long `aria-label` describing what the chart encodes.
- Legends are **real HTML text**, not canvas paint (Decision Trend renders a grouped legend: Open | Closed with a divider).
- Values a chart encodes are always available as text elsewhere (KPI lanes, "View in Table" links, tooltips); chart click-filtering is an enhancement, not the only path. Known gap: the chart drill-downs themselves have no keyboard equivalent (see section 8).

## 7. Forms and feedback

- Toasts announce via `role="alert"` (antd default - keep).
- Required-ness is programmatic (`aria-required`) wherever a submit button gates on a field.
- Ship-to editing pre-fills current values (no redundant entry, WCAG 3.3.7).
- The intake form marks optional fields (`requiredMark="optional"`) and antd wires `aria-required` on the rest.

## 8. Known open items (deliberate, tracked)

- Stepper/timeline label text on tinted backgrounds is below AA in places (fix approved in principle: darkened AA-safe label variants).
- antd Select placeholder gray fails AA app-wide (`colorTextPlaceholder` seed pending).
- A few preset Tags (cyan Replacement, dark Beta) sit near 3.4:1.
- `prefers-reduced-motion` gate not yet applied to transitions/shimmer/chart animation.
- Chart drill-down clicks have no keyboard equivalent (mitigated: all destinations reachable via table filters).
- Intake tracker rows and Categories drill-in rows are click-only (equivalent links exist for the primary flows).
- Detail-page Tabs render action buttons inside `role="tablist"` via `tabBarExtraContent` (antd structural; needs a clean v6 route).
