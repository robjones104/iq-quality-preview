import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dayjs from 'dayjs';
import type { DateRange } from '@/components/DateRangeFilter';

type FilterStore = {
  // Dashboard state — persists for KPI card navigation carry-over
  dateRange: DateRange | null;
  setDateRange: (range: DateRange | null) => void;
  dashboardFilters: Record<string, string[]>;
  setDashboardFilters: (f: Record<string, string[]>) => void;
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
      dateRange: [dayjs().subtract(30, 'day'), dayjs()],
      setDateRange: (dateRange) => set({ dateRange }),
      dashboardFilters: {},
      setDashboardFilters: (dashboardFilters) => set({ dashboardFilters }),
      eventsDateRange: [dayjs().subtract(30, 'day'), dayjs()],
      setEventsDateRange: (eventsDateRange) => set({ eventsDateRange }),
      eventsFilters: {},
      setEventsFilters: (eventsFilters) => set({ eventsFilters }),
      ordersDateRange: [dayjs().subtract(30, 'day'), dayjs()],
      setOrdersDateRange: (ordersDateRange) => set({ ordersDateRange }),
      ordersFilters: {},
      setOrdersFilters: (ordersFilters) => set({ ordersFilters }),
    }),
    {
      name: 'iq-quality-filters',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.dateRange      = toDateRange(state.dateRange);
        state.eventsDateRange  = toDateRange(state.eventsDateRange);
        state.ordersDateRange  = toDateRange(state.ordersDateRange);
      },
    }
  )
);
