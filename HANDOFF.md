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
| `patchEvent(eventId, patch)` | Field-level edit: status, issue, component, door, root cause, tags, escalation link, parts request, photos | `PATCH /events/:id` |
| `pushActivityLog(eventId, entry)` | Append to the event activity log | server-side effect of the mutation that caused it |
| `pushEditHistory(eventId, entry)` | Append to the edit-history audit trail | server-side effect of `PATCH /events/:id` |
| `pushAdditionalInfoRequest(eventId, entry)` | New message in the FQ/CS <-> tech thread | `POST /events/:id/info-requests` |
| `updateAdditionalInfoRequest(eventId, id, patch)` | Mark replied / bump resend count | `PATCH /events/:id/info-requests/:requestId` |

`pushActivityLog` and `pushEditHistory` exist because the client must simulate what a backend would derive. When real mutations land server-side, generate log/audit entries there and drop these two actions.

### orderStore (`store/orderStore.ts`, key `iq-order-mutations`)

| Action | Semantics | Suggested endpoint |
|---|---|---|
| `createOrder(order)` | Order auto-created from a parts request on an orderless event | `POST /orders` (or a server-side effect of the parts-request mutation) |
| `patchOrder(orderId, patch)` | Approve / decline / close / reopen / assign to procurement / replacement # | `PATCH /orders/:id` |
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

Business rules encoded in the UI worth knowing before schema design: order type derives from `jobNo` prefix (`WO` = Work Order, else Sales Order); DFO LIN / EL LIN are Sales-Order-only fields; Validated events stay enrichable (root cause, tags, photos, attachments) while Invalidated events are fully locked; orders auto-create from parts requests; escalation<->event links are many-to-many.

## 5. Demo state and reset

All runtime state lives in seven localStorage keys: `iq-event-mutations`, `iq-order-mutations`, `iq-escalations`, `iq-escalation-types`, `iq-quality-filters-v2`, `iq-quality-role`, `iq-theme`. To reset a demo machine to pristine, clear those keys (DevTools > Application > Local Storage) and reload. There is no in-app reset control.

## 6. State of the codebase at handoff

- `pnpm build` passes (full static prerender), `tsc --noEmit` clean, `eslint .` zero errors and zero warnings.
- Dead code removed in the 2026-07-27 audit pass: `/prototype` (early dashboard draft) and `/logs` (unreachable route; `data/logs.ts` is still live, it seeds event activity logs).
- Ant Design v6 deprecation warnings resolved; the dev console is clean.
- Approved but unbuilt (see `AUDIT.md` "Still open"): P2 invalidation cascades decline+close to open orders; P3 approve-modal soft warning when the tech has not replied.
- Route inventory is exactly what `pnpm build` prints: dashboard, events (+detail), orders (+detail), escalations (+detail), procurement, manage/{escalations,root-causes,tags}, account, login.
