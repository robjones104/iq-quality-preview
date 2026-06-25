# Technology Decision Record
## UI Component Library — iQ Quality Portal

**Decision:** Use Ant Design as the primary UI component library.
**Author:** Rob Jones, UX Designer (Contract)
**Audience:** Allegion SAT Development Team
**Date:** June 2026

---

## The Short Version

Phoenix was not React-ready when this project started. Ant Design was. iQ Quality needed enterprise data patterns — complex tables, date range filtering, charts, modals, notifications, dark mode — that Phoenix does not currently provide for React. Ant Design delivered all of it in one system. The portal went from zero to a near-complete working product in six weeks.

---

## Why Phoenix Was Not an Option

This is not a preference decision. Phoenix had fundamental blockers for a React project in 2026.

| Phoenix Limitation | Status at Time of Decision |
|---|---|
| React framework support | **Not available.** Phoenix Flame (React component strategy) was planned but not released. |
| Documentation | Contribution guidelines being created in Confluence — incomplete at time of decision. |
| React roadmap | No published timeline for React support or component releases. |
| 1.0 → 2.0 migration | Requires full rewrite of UI components. Not backward compatible. |
| Angular compatibility | Latest Phoenix versions not compatible with latest Angular — adoption being slowed pending updates. |

**Phoenix is not a React component library today.** Using Phoenix on iQ Quality would have meant waiting for a roadmap that had no published timeline, or building a custom React wrapper layer from scratch — which defeats the purpose of a design system.

---

## Why Ant Design Was the Right Fit

iQ Quality is a data-dense enterprise portal, not a marketing surface. It required:

- **Complex data tables** — sorting, filtering, pagination, row selection, sticky headers, persistent filter state
- **Date range controls** — picker with presets, custom range selection, URL-param carry-over
- **Dashboard patterns** — KPI cards, statistics with deltas, live-filtered charts
- **Workflow UI** — multi-step modals, confirmation dialogs, notification toasts, role-based navigation
- **Dark mode** — full app, all components and charts consistent

Ant Design provided every one of these out of the box. Phoenix (29 components, no React build) provided none of them.

| | Phoenix | Ant Design |
|---|---|---|
| React component library | No | Yes |
| Total components | 29 | 200+ |
| Enterprise table | No | Yes |
| Date range picker | No | Yes |
| Chart library | No | Yes (`@ant-design/plots`) |
| Dark mode token system | No | Yes |
| Notification / toast API | No | Yes |
| Maintained for React | No | Yes |

---

## Brand Alignment Is Not Blocked

Ant Design uses a centralized token system. Allegion and Stanley brand values — colors, typography, border radius, spacing — are configured once in `ConfigProvider` and propagate to all 200+ components automatically. Dark mode already uses Stanley yellow (`#FFD20B`) as the primary brand color.

When Phoenix Flame ships and a formal Stanley React token set is defined, those values map directly into the Ant Design theme layer. A full component migration reference is documented in `ANT_DESIGN_AUDIT.md` in this repository.

---

## Trade-offs

| Trade-off | Assessment |
|---|---|
| Not the Allegion standard | Deliberate exception. Phoenix was not a viable option for React at the time. |
| Larger bundle | Acceptable for an internal portal. Tree-shaking keeps it manageable. |
| Ant Design visual language | Brand tokens handle color and typography. Shape and spacing are AntD-native — acceptable for a prototype. |
| Future migration cost | Documented in `ANT_DESIGN_AUDIT.md`. Highest-cost items are token rewiring and the date range picker. |

---

## Bottom Line

Phoenix is the right design system for Allegion. It was not the right tool for this project at this time — because it does not yet exist as a React library.

Ant Design gave iQ Quality a complete, production-quality enterprise component system on day one. One designer/developer built a full working portal in six weeks: filtered tables, live charts, dark mode, role-based navigation, persistent state, and complex modal flows. That speed was only possible because the required patterns already existed in a single, coherent library.

When Phoenix Flame ships for React, this audit and migration reference will be the starting point.
