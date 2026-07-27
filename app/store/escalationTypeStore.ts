import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_ESCALATION_TYPES, type ListItem } from '@/data/manageLists';

// Managed escalation-type taxonomy (Categories > Escalations). Seeded with the
// system defaults; runtime additions/renames/removals persist per browser.
type EscalationTypeStore = {
  types: ListItem[];
  addType: (name: string, createdBy: string) => void;
  renameType: (id: string, name: string) => void;
  removeType: (id: string) => void;
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
              createdAt: new Date().toISOString().slice(0, 10),
              isSystem: false,
            },
          ],
        })),
      renameType: (id, name) =>
        set(state => ({
          types: state.types.map(t => (t.id === id ? { ...t, name } : t)),
        })),
      removeType: (id) =>
        set(state => ({
          types: state.types.filter(t => t.id !== id),
        })),
    }),
    { name: 'iq-escalation-types' }
  )
);
