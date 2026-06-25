# Ant Design Deck — PowerPoint Content
# iQ Quality: Why Ant Design

Paste each slide section into PowerPoint. Suggested layout: dark background, white text, one key stat per slide as a large display number where noted.

---

## SLIDE 1 — Title

**Heading:** Why Ant Design
**Subheading:** A technology decision record for the iQ Quality portal
**Footer:** Rob Jones · UX Designer · June 2026

---

## SLIDE 2 — What We Were Building

**Heading:** iQ Quality is an enterprise data application

**Bullets:**
- Complex data tables with filtering, sorting, and pagination
- Date range controls with presets
- Multi-step modal flows and confirmation dialogs
- KPI cards, charts, and data visualizations
- Dark mode, responsive layout, persistent filter state
- Role-based navigation across 7 user roles

**One line:** This is not a marketing surface. It is an operations tool.

---

## SLIDE 3 — The Standard Option

**Heading:** Phoenix — Allegion's design system

**Bullets:**
- Built on Material Design
- Covers buttons, typography, color tokens, basic form inputs
- Right tool for consumer-facing and brand-consistent UI

**Display number:** 29
**Caption:** Total components available in Phoenix

---

## SLIDE 4 — The Gap

**Heading:** What Phoenix doesn't have

**Two columns:**

Missing from Phoenix:
- Data table (sort, filter, select, pagination)
- Date range picker
- AutoComplete / typeahead
- Statistic / KPI component
- Notification / toast API
- Segmented control
- Popconfirm
- Chart library
- Dark mode token system
- CLI tooling

What that means:
- 5+ separate third-party libraries
- No shared token or theming layer
- Each library solves dark mode differently
- 5 separate upgrade and maintenance chains
- Months of integration work before a single screen ships

---

## SLIDE 5 — Ant Design

**Heading:** Ant Design — one library, everything included

**Display number:** 200+
**Caption:** Components in the Ant Design library

**Bullets:**
- Full-featured Table, DatePicker, AutoComplete, Statistic, Modal, Notification — all built in
- @ant-design/plots — native chart library, theme-integrated
- One token system across every component
- Dark mode via a single config change
- @ant-design/cli for scaffolding and tooling
- Built specifically for enterprise data applications

---

## SLIDE 6 — What It Delivered

**Heading:** Built in 6 weeks, one person

**Bullets:**
- Full dashboard — live-filtered charts, KPI bar, AI summary
- Events and Orders — tables, detail pages, modal flows
- Manage Lists, Users, Escalations pages
- Dark mode — full app, all components and charts
- Mobile responsive layout
- Persistent filter state across navigation
- Role-aware navigation

**One line:** One coherent library. No integration debt.

---

## SLIDE 7 — Brand Alignment

**Heading:** AntD doesn't block brand alignment

**Bullets:**
- Seed tokens accept Allegion/Stanley brand colors in one place
- All 200+ components inherit overrides automatically
- Dark mode uses Stanley yellow — configured once in ConfigProvider
- If a formal Stanley token set is defined, it slots directly in — no component changes

**Code block (optional):**
```
colorPrimary: '#1677FF'   → swap to Allegion blue
fontFamily: 'Montserrat'  → Allegion typography
colorPrimary (dark): '#FFD20B'  → Stanley yellow
```

---

## SLIDE 8 — Trade-offs

**Heading:** Honest trade-offs

| | |
|---|---|
| Not Phoenix-standard | Deliberate exception for this project's scope |
| Larger bundle | Acceptable for an internal portal |
| Migration cost exists | Fully documented in ANT_DESIGN_AUDIT.md |
| AntD visual language | Brand tokens handle color + type; spacing is AntD-native |

---

## SLIDE 9 — Bottom Line

**Heading:** Right tool for the job

**Three points (large text):**

1. Phoenix has 29 components. iQ Quality needed 40+ that Phoenix doesn't have.

2. Building on Phoenix meant assembling 5+ unrelated libraries with no shared theming layer.

3. Ant Design delivered a complete, themeable, production-quality application in 6 weeks.

**Footer:** Full component audit and migration reference: ANT_DESIGN_AUDIT.md
