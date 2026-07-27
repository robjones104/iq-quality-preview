import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order, OrderPart } from '@/data/orders';

export type OrderLogEntry = {
  id: string;
  timestamp: string;
  role: string;
  employee: string;
  orderStatus: 'Open' | 'Closed';
  submittedStatus: string;
  content: string;
  auto: boolean;
};

type OrderMutations = {
  status?: 'Open' | 'Closed';
  approved?: boolean;
  declined?: boolean;
  declineReason?: string;
  assignedToProcurement?: boolean;
  replacementOrderNo?: string;
  trackingNumber?: string;
  // Same-SO consolidation. Source orders close with `consolidated` (a distinct
  // disposition, deliberately not `declined`) pointing at the surviving order;
  // the survivor gets the merged `eventIds` and its parts replaced by
  // `partsOverride` (the single real fix, e.g. a complete door).
  consolidated?: boolean;
  consolidatedInto?: string;
  eventIds?: string[];
  partsOverride?: OrderPart[];
  logAdditions?: OrderLogEntry[];
};

type OrderMutationStore = {
  mutations: Record<string, OrderMutations>;
  // Orders created at runtime — e.g. adding a parts request to an event that
  // has no open order auto-creates one (pipeline rule, 2026-07-24).
  createdOrders: Record<string, Order>;
  patchOrder: (orderId: string, patch: Partial<OrderMutations>) => void;
  pushOrderLog: (orderId: string, entry: OrderLogEntry) => void;
  createOrder: (order: Order) => void;
};

export const useOrderStore = create<OrderMutationStore>()(
  persist(
    (set) => ({
      mutations: {},
      createdOrders: {},
      createOrder: (order) =>
        set(state => ({
          createdOrders: { ...state.createdOrders, [order.id]: order },
        })),
      patchOrder: (orderId, patch) =>
        set(state => ({
          mutations: {
            ...state.mutations,
            [orderId]: { ...state.mutations[orderId], ...patch },
          },
        })),
      pushOrderLog: (orderId, entry) =>
        set(state => ({
          mutations: {
            ...state.mutations,
            [orderId]: {
              ...state.mutations[orderId],
              logAdditions: [
                ...(state.mutations[orderId]?.logAdditions ?? []),
                entry,
              ],
            },
          },
        })),
    }),
    { name: 'iq-order-mutations' }
  )
);
