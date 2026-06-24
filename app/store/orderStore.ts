import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  assignedToProcurement?: boolean;
  replacementOrderNo?: string;
  logAdditions?: OrderLogEntry[];
};

type OrderMutationStore = {
  mutations: Record<string, OrderMutations>;
  patchOrder: (orderId: string, patch: Partial<OrderMutations>) => void;
  pushOrderLog: (orderId: string, entry: OrderLogEntry) => void;
};

export const useOrderStore = create<OrderMutationStore>()(
  persist(
    (set) => ({
      mutations: {},
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
