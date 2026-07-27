import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_ESCALATION_TYPES, type ListItem } from '@/data/manageLists';
import { nowDateStr } from '@/lib/appTime';

// Managed escalation-type taxonomy (Categories > Escalations). Seeded with the
// system defaults; runtime additions/renames/removals persist per browser.
type EscalationTypeStore = {
  types: ListItem[];
  addType: (name: string, createdBy: string) => void;
  // Wholesale replacement used by the Categories screen, whose generic list CRUD
  // (rename / delete / batch delete) produces the next list rather than a delta.
  setTypes: (types: ListItem[]) => void;
};

export const useEscalationTypeStore = create<EscalationTypeStore>()(
  persist(
    (set) => ({
      types: DEFAULT_ESCALATION_TYPES,
      addType: (name, createdBy) =>
        set(state => ({
          types: [
            ...state.types,
            {
              id: `esct-r-${Date.now()}`,
              name,
              createdBy,
              createdAt: nowDateStr(),
              isSystem: false,
            },
          ],
        })),
      setTypes: (types) => set({ types }),
    }),
    { name: 'iq-escalation-types' }
  )
);
