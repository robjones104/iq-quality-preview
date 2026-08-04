# iQ Quality Preview: Developer Handoff

Audience: the development team wiring this prototype to a real backend. This document maps every place the UI touches data, so you can replace the mock layer without reverse-engineering the screens. Product/priority history lives in `AUDIT.md`; personas and the feature matrix live in `PERSONAS.md`.

Prepared 2026-07-27. Toolchain: Node 24.x, pnpm 10.x, Next.js 16 (App Router), TypeScript, Ant Design v6, Zustand.

```bash
cd app && pnpm install && pnpm dev   # needs app/.env.local: PREVIEW_PASSWORD, TOKEN_SECRET
pnpm build                           # production gate: full static prerender, ~1000 detail pages
pnpm exec tsc --noEmit && pnpm exec eslint .
```

---

## 1. Architecture in one pass

```
data/*.ts  (static mock records, ~600 events / ~400 orders, ids QE_*)
    |
    v
store/*.ts (Zustand overlay stores, persisted to localStorage)
    |         mutations: Record<id, Partial<Entity>>   (patches on static records)
    |         created:   Record<id, Entity>            (records created at runtime)
    v
lib/effective*.ts (merge static + overlay into the "effective" record)
    |         mergeEvent / useEffectiveEvents / useEffectiveEventMap
    |         useEffectiveEscalations
    v
UI (App Router pages + components; RoleGuard + capability gating)
```

The overlay pattern is the whole trick: static records are never mutated. Every user action writes a patch (or a new record) into a store, and every read path merges the overlay back over the static data through an `effective*` hook. **The stores are exactly where a backend replaces localStorage**: each named store action below is one API mutation, and each `effective*` hook becomes a query/cache read.

Time is frozen: `lib/appTime.ts` pins "now" to 2026-06-24 so the demo data never goes stale. Every timestamp in the app routes through its helpers (`now()`, `nowDate()`, `nowStampIso()`, `nowStampUs()`, `nowDateStr()`). With a real backend, change `APP_NOW` to `dayjs()` and delete nothing else. The only intentional exceptions are CSV export filenames (real date is correct there) and `Date.now()` used as an id-uniqueness token.

Preview auth is throwaway: `proxy.ts` checks an `iq-auth` cookie against `TOKEN_SECRET`; `/api/auth` sets/clears it from the `/login` password form (`PREVIEW_PASSWORD`). `lib/auth.ts` hardcodes the signed-in identity. All of it is replaced by real SSO; user provisioning is out of scope by design (it lives in Allegion Access Management, which is why the App Manager persona has no screens here).

## 2. Store actions = your API surface

Every state mutation in the app goes through one of these named actions. No component writes a store any other way (verified; the one adapter is `ManageListsClient`'s `setEscTypes`, which calls `setTypes`).

### eventStore (`store/eventStore.ts`, key `iq-event-mutations`)

| Action | Semantics | Suggested endpoint |
|---|---|---|
| `createEvent(event)` | Event created from the portal intake form (Intake role; INTAKE-SPEC.md). Parts request on the submission also fires `createOrder` | `POST /events` |
| `patchEvent(eventId, patch)` | Field-level edit: status, issue, component, door, root cause, tags, escalation link, parts request, ship-to (`shipTo`/`shipToAddress`), photos. Also carries thread messages: senders write the FULL `additionalInfoRequests` array (the overlay replaces the static thread, so appends must include the existing conversation) | `PATCH /events/:id`; thread appends become `POST /events/:id/info-requests` |
| `pushActivityLog(eventId, entry)` | Append to the event activity log | server-side effect of the mutation that caused it |
| `pushEditHistory(eventId, entry)` | Append to the edit-history audit trail | server-side effect of `PATCH /events/:id` |

`pushActivityLog` and `pushEditHistory` exist because the client must simulate what a backend would derive. When real mutations land server-side, generate log/audit entries there and drop these two actions.

Reminders on unanswered info requests are SYSTEM-GENERATED (product ruling 2026-08-03): there is no manual send-reminder action anywhere in the UI, and the seed threads' `kind: 'followup'` entries represent what the scheduler would emit. The backend owns the nudge cadence (e.g. a scheduled job that appends a followup message and notifies the reporter after N days without a reply).

### orderStore (`store/orderStore.ts`, key `iq-order-mutations`)

| Action | Semantics | Suggested endpoint |
|---|---|---|
| `createOrder(order)` | Order auto-created from a parts request on an orderless event | `POST /orders` (or a server-side effect of the parts-request mutation) |
| `patchOrder(orderId, patch)` | Approve / decline / close / reopen / assign to procurement / replacement # / tracking # (`trackingNumber`, must notify the tech) / consolidation fields (`consolidated`, `consolidatedInto`, `eventIds`, `partsOverride`) | `PATCH /orders/:id`; consolidation via `POST /orders/:id/consolidate` (transactional, see fulfillment rules) |
| `pushOrderLog(orderId, entry)` | Append to the order log | server-side effect of the mutation |

### escalationStore (`store/escalationStore.ts`, key `iq-escalations`)

| Action | Semantics | Suggested endpoint |
|---|---|---|
| `createEscalation(esc)` | New escalation (FQ escalate flow or /escalations list) | `POST /escalations` |
| `patchEscalation(id, patch)` | Edit fields, close, reopen | `PATCH /escalations/:id` |
| `linkEvent(escalationId, eventId, currentEventIds)` | Link an event (idempotent) | `POST /escalations/:id/events` |
| `unlinkEvent(escalationId, eventId, currentEventIds)` | Unlink an event | `DELETE /escalations/:id/events/:eventId` |

Linking is bidirectional in the UI: callers also `patchEvent(eventId, { escalation })` so both sides stay in sync. Server-side, make the link one write and derive both reads.

### escalationTypeStore (`store/escalationTypeStore.ts`, key `iq-escalation-types`)

| Action | Semantics | Suggested endpoint |
|---|---|---|
| `addType(name, createdBy)` | Inline "+ Create" in the escalate modal | `POST /escalation-types` |
| `setTypes(types)` | Wholesale list replacement from the Categories CRUD screen (rename / delete / batch delete) | split into `PATCH /escalation-types/:id` and `DELETE /escalation-types/:id` |

### Client-only stores (no backend equivalent)

- `filterStore` (`iq-quality-filters-v2`): per-screen filter and date-range persistence. Keep client-side, or move to user preferences.
- `roleStore` (`iq-quality-role`): the demo "View as" role switcher. Replaced entirely by real auth claims.
- `themeStore` (`iq-theme`): light/dark preference.

### Known gap, intentional

Root causes and tags on the Categories screen are plain `useState` seeded from `data/manageLists.ts` (`DEFAULT_ROOT_CAUSES`, `DEFAULT_TAGS`); edits do not survive a reload. Only escalation types got a persisted store, because the escalate flow reads them cross-screen. Backend-wise all three lists are the same shape: a managed taxonomy with CRUD endpoints mirroring the escalation-type table above.

## 3. RBAC

Single source of truth: `lib/roles.ts` (`ROLES`, `RoleCapabilities`, `capabilitiesFor`). Enforcement is two-layer: nav hides links per capability (`components/SidebarNav.tsx`), and `components/RoleGuard.tsx` (mounted once in the `(main)` layout) hard-redirects direct URLs to the role's landing page. Action-level gating reads the same capabilities (`useCapabilities()` from `roleStore`), so a real backend should map auth claims onto the same `RoleCapabilities` shape and keep every gate working unchanged. Server-side enforcement of the same matrix is still required; the client gates are UX, not security.

| Capability | Full Access | Field Quality | Customer Service | Procurement | Global (View-Only) | Branch (View-Only) |
|---|---|---|---|---|---|---|
| dashboard | x | x | x | x | x | x |
| events | x | x | x | | x | x |
| orders | x | x | x | x | x | x |
| escalations | x | x | | | x | |
| procurementQueue | x | x | x | x | | |
| categories (manage) | x | x | | | | |
| editEvents | x | x | | | | |
| decideOrders | x | | x | | | |
| closeOrders | x | | x | x | | |
| manageLists | x | x | | | | |
| branchScoped | | | | | | x (Atlanta) |

Landings: CS starts at `/dashboard?view=orders`, Procurement at `/procurement`, everyone else at `/dashboard`. Branch scoping is applied in `lib/useScopedData.ts` (events, orders, dashboard aggregate off the same scoped hooks). App Manager is deliberately absent (provisioning-only persona, no operational surface).

## 4. Domain vocabulary (single sources of truth)

| Vocabulary | Lives in | Notes |
|---|---|---|
| Event status + colors | `data/types.ts` (`EventStatus`), `components/StatusTag.tsx` (`STATUS_COLORS` hex for charts, presets + WCAG light-mode text overrides for tags) | Reported -> Under Investigation -> Validated/Invalidated |
| Order status | `data/orders.ts` (`OrderStatus`) | Open/Closed; Open=blue / Closed=green only on order detail; list screens color by the linked event's status via `eventStatusTagProps` |
| Filter categories | `data/filterOptions.ts` (`EVENT_FILTER_CATEGORIES`, `ORDER_FILTER_CATEGORIES`, plus option arrays) | Orders page composes both; dashboard is view-aware |
| Managed lists | `data/manageLists.ts` defaults + `escalationTypeStore` | See gap note above |
| Roles | `lib/roles.ts` | Includes demo persona names/emails |
| Time | `lib/appTime.ts` | The only place that defines "now" |

Business rules encoded in the UI worth knowing before schema design: order type derives from `jobNo` prefix (`WO` = Work Order, else Sales Order); an order's `jobNo` always equals its linked event's `jobNo`; DFO LIN / EL LIN are Sales-Order-only fields; `QualityEvent.jobNoManualEntry` records that the tech keyed the SO number by hand instead of scanning it (SO-only, captured at submission by the tech's mobile app; the UI flags manual entries ahead of the Job No. as a verify-before-fulfillment cue); Validated events stay enrichable (root cause, tags, photos, attachments) while Invalidated events are fully locked; orders auto-create from parts requests; escalation<->event links are many-to-many; escalation "titles" for reference-number types (CAR, PR, Assist IT) are external system ids, mapped in `escalationTitleMeta` in `data/manageLists.ts`.

**The order state machine (canonical, 2026-07-29).** Every live order is in exactly one of five states, composed from three axes (status, decision, location):

| State | Meaning |
|---|---|
| Open · No Decision | Awaiting approve/decline (the CS queue) |
| Open · Approved · with Customer Service | CS closing it out: replacement #, tracking, or handoff |
| Open · Approved · with Procurement | Procurement sourcing the part |
| Closed · Approved | Fulfilled: replacement placed, tech updated |
| Closed · Declined | Closed without fulfillment, documented reason |

Transitions: approve (1→2), decline (1→5), assign to Procurement (2→3), return to CS (3→2), close with replacement (2→4 or 3→4), reopen (4→1 or 5→1, clears the decision), consolidate (any open state → Closed · Consolidated, a sixth terminal state excluded from live-demand counts because the surviving order carries it). Impossible combinations, enforce server-side: Open · Declined (declining closes) and Closed · No Decision (closing requires a decision). The dashboard KPI bar renders exactly this machine (Total, then Open split into Pending Decision + Approved, Closed split into Fulfilled + Declined; Fulfilled is the UI label for Closed · Approved, matching the backend's order:fulfill action) and its tooltips state each lane's formal state; model the backend's order status as this enum or derive it from the three axes, but keep the invariants.

**Color constitution (see `lib/theme.ts`):** saturated chromatic fills are reserved for record lifecycle (event statuses; order decisions, with Approved in two green shades split by status); roles/identity are monochromatic; purple belongs to Procurement exclusively; gold is the accent/attention family. The Decision Trend chart uses `@antv/g2` directly (pinned to the version in the dependency tree) because the `@ant-design/plots` wrapper cannot express grouped-stacked columns in this version; every other chart uses the wrapper.

Fulfillment-loop rules (2026-07-27, demo walkthroughs in `STORIES.md`):

- **Ship-to** is a property of the parts request, chosen by the tech at submission: `QualityEvent.shipTo` (`'branch'` default | `'address'`) plus `shipToAddress` (structured lite: street, city/state/zip). Surfaced on every orders screen; Procurement pastes it into shipping.
- **Tracking** (`trackingNumber` order mutation) is entered at close time or added later to a closed order; either write must notify the reporting tech (the prototype simulates this with System entries on the order log and the event activity log). Server-side this is a real notification to the tech's mobile app.
- **Invalidation cascades**: invalidating an event declines and closes its open orders (decline reason "Event invalidated"). Approval is never blocked by an unanswered info request, but the UI warns first (`components/TechReplyWarning.tsx`).
- **Consolidation**: several events on one SO can fold into one order. Source orders close with `consolidated: true` + `consolidatedInto` (a disposition distinct from Declined everywhere: filters, KPIs, tech messaging); the survivor carries the merged `eventIds` and a replaced parts list (`partsOverride` mutation). Event-to-order resolution must check `eventIds`, not just the primary `eventId`. Suggested endpoint: `POST /orders/:id/consolidate` taking source order ids plus the replacement part, performing all of the above transactionally.

## 4b. Integration notes: the four patterns to replace

Audited 2026-07-28 specifically for backend integration. These are the places where the prototype's architecture differs from what a production app does, in the order they will bite.

**1. Ad-hoc effective-order merging (the one real structural gap).** Events have a single merge point: `lib/effectiveEvents.ts`. Orders never got the equivalent, so five files each merge `orderMutations` over static orders with their own field subsets: `dashboard/page.tsx` (an `effectiveOrders` memo with an explicit field list), `orders/page.tsx` (per-field helper functions), `procurement/page.tsx`, `orders/[id]/OrderDetailClient.tsx`, and `events/[id]/EventDetailClient.tsx`. The field lists have already drifted once (the dashboard merge had to be manually extended for consolidation). **For integration this is actually a simplification opportunity: replace all five sites with one orders query hook and the ad-hoc merging disappears entirely.** Do not replicate the five-site pattern server-side.

**2. Screen-local optimistic state.** The two detail screens (`OrderDetailClient`, `EventDetailClient`) keep `useState` mirrors seeded from the persisted overlay (4 each: status, approved, replacement #, tracking / status, plant, parts, escalation) and every action writes both the local state and the store. This is the prototype's substitute for optimistic updates. With a real backend, replace both write paths with a mutation + cache-invalidation pattern (React Query or equivalent); do not port the double-write.

**3. Static prerender + client-side runtime-record resolution.** All three `[id]` routes (`events`, `orders`, `escalations`) use `generateStaticParams` over the mock data (~1000 pages) and resolve runtime-created records client-side (`CreatedOrderDetail` and the escalation `id === 'new'` / `ESC_R*` patterns). With a backend, these become ordinary server-rendered dynamic routes and the client-side fallback components are deleted.

**4. Client-simulated side effects.** Everything a server would derive is currently written by the client so screens behave correctly: activity logs, edit history, order logs (`pushActivityLog`, `pushEditHistory`, `pushOrderLog`), tech notifications (replacement/tracking, ship-to changes, invalidation cascades, consolidation), and the AI summary (700ms fake latency, deterministic content). Photos and attachments are simulated entirely; real upload is a net-new capability (object storage + attachments endpoint), not a wiring exercise.

**Verified inventories (2026-07-28):** every internal deep link's query params are parsed by its target page (`status`, `issue`, `component`, `branch`, `flag`, `rootCause`, `tag`, `from/to`, `ids`, `decision`, `orderStatus`, `type`); all runtime state lives in the seven localStorage keys listed below; RoleGuard covers every `(main)` route; no store writes occur outside named actions; frozen-clock discipline holds (the only real-clock reads are CSV export filenames, intentionally); mock data is internally consistent (0 orphan orders, 0 order/event jobNo mismatches, 0 duplicate ids, ship-to and manual-entry flags well-formed).

## 5. Demo state and reset

All runtime state lives in seven localStorage keys: `iq-event-mutations`, `iq-order-mutations`, `iq-escalations`, `iq-escalation-types`, `iq-quality-filters-v2`, `iq-quality-role`, `iq-theme`. To reset a demo machine to pristine, clear those keys (DevTools > Application > Local Storage) and reload. There is no in-app reset control.

## 6. State of the codebase at handoff

- Re-audited 2026-07-28 ahead of the engineering handoff: `pnpm build` passes (full static prerender, 1025 pages), `tsc --noEmit` clean, `eslint .` zero errors and zero warnings, all integration inventories in section 4b verified.
- Dead code removed in the 2026-07-27 audit pass: `/prototype` (early dashboard draft) and `/logs` (unreachable route; `data/logs.ts` is still live, it seeds event activity logs).
- Ant Design v6 deprecation warnings resolved; the dev console is clean.
- Approved but unbuilt (see `AUDIT.md` "Still open"): P2 invalidation cascades decline+close to open orders; P3 approve-modal soft warning when the tech has not replied.
- Route inventory is exactly what `pnpm build` prints: dashboard, events (+detail), orders (+detail), escalations (+detail), procurement, manage/{escalations,root-causes,tags}, account, login.
