# Filter & Navigation State Spec

How date range and category filters flow across the iQ Quality portal.

---

## State locations

| Store key | Page scope | What it holds |
|---|---|---|
| `dateRange` | Dashboard | Active date range on the dashboard |
| `dashboardFilters` | Dashboard | Active category filters on the dashboard |
| `eventsDateRange` | Events | Active date range on the events list |
| `eventsFilters` | Events | Active category filters on the events list |
| `ordersDateRange` | Orders | Active date range on the orders list |
| `ordersFilters` | Orders | Active category filters on the orders list |

All keys live in `app/store/filterStore.ts` (Zustand, persisted to `localStorage` under key `iq-quality-filters`).

Date range values are serialized as ISO strings in storage and converted back to `dayjs` instances on rehydration via `onRehydrateStorage`. Category filter objects (`Record<string, string[]>`) serialize/deserialize as plain JSON with no special handling.

---

## The core rule

> **URL params are one-time navigation context.**
> They are applied as local React state on mount but are **never written to Zustand**.
> Zustand filter keys are only written when the user explicitly changes filters on that page.

This means:
- Navigating via a KPI card or chart drill-down applies filters for that visit only.
- Navigating directly to a page (sidebar, back button) restores the user's last manually-set filters for that page — not whatever was set by a previous navigation.

---

## Dashboard (`/dashboard`)

- `dateRange` and `dashboardFilters` are read directly from Zustand (no URL params).
- Setting a date range or category filter updates the Zustand store immediately.
- `applyFilters()` checks all 8 `EVENT_FILTER_CATEGORIES` keys including `status`.
- KPI card hrefs are built dynamically via `buildKpiHref()`:
  - Encodes `from` / `to` from `dateRange`
  - Encodes active `dashboardFilters` keys not already in the base URL
  - Example: `Reported` KPI → `/events?status=Reported&from=2026-06-01&to=2026-06-24&branch=Atlanta`

---

## Events page (`/events`)

### Filter initialisation (in order of priority)

1. **URL params present** → apply those as local state (one-time context)
2. **No URL params** → fall back to `eventsFilters` Zustand (user's last manual filters)

Params read from URL: `status`, `branch`, `discrepancy`, `product`, `door`, `rootCause`, `plant`, `reportedBy`, `from`, `to`, `flag`

### Persistence rules

- When the user changes filters on the events page, `setAppliedFilters()` writes both local state and `eventsFilters` Zustand — these persist across event-detail round-trips.
- URL-param-based filters on mount do **not** write to `eventsFilters`.
- `eventsDateRange` Zustand is synced from `from`/`to` URL params on mount so the date range survives event-detail navigation.

### Scenarios

| How you arrived | Filters shown |
|---|---|
| KPI card (`?status=Reported&from=…&to=…`) | URL params applied — status=Reported, date range set |
| Sidebar / direct nav (`/events`) | User's last manually-set `eventsFilters` (default: none) |
| Event detail → back to events | Same as sidebar — user's stored `eventsFilters` |
| Chart drill-down (`?branch=Atlanta`) | URL params applied — branch=Atlanta |

---

## Orders page (`/orders`)

Same rules as Events page, using `ordersDateRange` and `ordersFilters` Zustand keys.

Params read from URL: `orderStatus`, `decision`, `from`, `to`

---

## Sidebar / mobile nav links

The sidebar (`SidebarNav.tsx`) and mobile nav (`PageHeader.tsx`) carry the dashboard's active date range to Events and Orders **when the date range is non-default**.

- If `dateRange` equals the default (last 30 days), the link is a plain `/events` or `/orders`.
- If `dateRange` is custom, the link appends `?from=…&to=…`.
- Category filters (`dashboardFilters`) are **not** carried via sidebar nav — only date range.
- The active-link highlight still uses the base path (`/events`, `/orders`), not the computed href.

---

## What is NOT carried

| Scenario | Category filters | Date range |
|---|---|---|
| Sidebar nav from any page | ✗ | ✓ (if non-default) |
| KPI card from dashboard | ✓ (via URL params) | ✓ (via URL params) |
| Chart drill-down | ✓ (partial — chart-specific) | ✓ (chart-specific date range) |
| Event/order detail → back | ✗ (URL params not re-encoded) | ✓ (eventsDateRange persists) |

---

## Adding a new filter category

1. Add the key/options to `EVENT_FILTER_CATEGORIES` in `app/data/filterOptions.ts`
2. Add the filter check to `applyFilters()` in `dashboard/page.tsx`
3. Add the filter check to the `filtered` array in `events/page.tsx`
4. Add URL param read in `EventsPageContent` (both `useState` init and `useEffect` date-sync block)
5. If the events page should accept this filter via URL navigation, add `params.set(key, ...)` to `buildKpiHref()` in `dashboard/page.tsx`
