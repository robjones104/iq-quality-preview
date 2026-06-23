import { create } from 'zustand';
import dayjs from 'dayjs';
import type { DateRange } from '@/components/DateRangeFilter';

type FilterStore = {
  // Dashboard date range — owned by the dashboard page only
  dateRange: DateRange | null;
  setDateRange: (range: DateRange | null) => void;
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

export const useFilterStore = create<FilterStore>()((set) => ({
  dateRange: [dayjs().subtract(30, 'day'), dayjs()],
  setDateRange: (dateRange) => set({ dateRange }),
  eventsDateRange: [dayjs().subtract(30, 'day'), dayjs()],
  setEventsDateRange: (eventsDateRange) => set({ eventsDateRange }),
  eventsFilters: {},
  setEventsFilters: (eventsFilters) => set({ eventsFilters }),
  ordersDateRange: [dayjs().subtract(30, 'day'), dayjs()],
  setOrdersDateRange: (ordersDateRange) => set({ ordersDateRange }),
  ordersFilters: {},
  setOrdersFilters: (ordersFilters) => set({ ordersFilters }),
}));
