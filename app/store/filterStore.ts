import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
import type { DateRange } from '@/components/DateRangeFilter';

const defaultRange = (): DateRange => [now().subtract(30, 'day'), now()];

type FilterStore = {
  // Dashboard state — persists for KPI card navigation carry-over
  dateRange: DateRange | null;
  setDateRange: (range: DateRange | null) => void;
  dashboardFilters: Record<string, string[]>;
  setDashboardFilters: (f: Record<string, string[]>) => void;
  // Orders-view category filters — separate record so event and order filter
  // keys never mix when toggling dashboard views.
  dashboardOrderFilters: Record<string, string[]>;
  setDashboardOrderFilters: (f: Record<string, string[]>) => void;
  // Events page state — persists through event-detail navigation
  eventsDateRange: DateRange | null;
  setEventsDateRange: (range: DateRange | null) => void;
  eventsFilters: Record<string, string[]>;
  setEventsFilters: (f: Record<string, string[]>) => void;
  // Orders page state — persists through order-detail navigation
  ordersDateRange: DateRange | null;
  setOrdersDateRange: (range: DateRange | null) => void;
  ordersFilters: Record<string, string[]>;
  setOrdersFilters: (f: Record<string, string[]>) => void;
};

// persist() serializes dayjs objects to ISO strings in localStorage.
// This converts them back to dayjs instances on rehydration.
const toDateRange = (v: unknown): DateRange | null => {
  if (!v || !Array.isArray(v) || v.length < 2) return null;
  return [dayjs(v[0] as string), dayjs(v[1] as string)] as DateRange;
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      dateRange: defaultRange(),
      setDateRange: (dateRange) => set({ dateRange }),
      dashboardFilters: {},
      setDashboardFilters: (dashboardFilters) => set({ dashboardFilters }),
      dashboardOrderFilters: {},
      setDashboardOrderFilters: (dashboardOrderFilters) => set({ dashboardOrderFilters }),
      eventsDateRange: defaultRange(),
      setEventsDateRange: (eventsDateRange) => set({ eventsDateRange }),
      eventsFilters: {},
      setEventsFilters: (eventsFilters) => set({ eventsFilters }),
      ordersDateRange: defaultRange(),
      setOrdersDateRange: (ordersDateRange) => set({ ordersDateRange }),
      ordersFilters: {},
      setOrdersFilters: (ordersFilters) => set({ ordersFilters }),
    }),
    {
      // Bumped from 'iq-quality-filters' when "now" was frozen to APP_NOW — the
      // old key holds real-today ranges that would rehydrate over the new default
      // and leave the dashboard empty.
      name: 'iq-quality-filters-v2',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.dateRange      = toDateRange(state.dateRange);
        state.eventsDateRange  = toDateRange(state.eventsDateRange);
        state.ordersDateRange  = toDateRange(state.ordersDateRange);
      },
    }
  )
);
