import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Escalation } from '@/data/types';
import { now } from '@/lib/appTime';

// Runtime escalation state, mirroring the eventStore/orderStore overlay
// pattern: `mutations` patch static escalations by id, `created` holds
// escalations created at runtime (from the FQ escalate flow or /escalations/new).
export type EscalationMutations = Partial<
  Pick<
    Escalation,
    | 'type'
    | 'title'
    | 'status'
    | 'reportedIssue'
    | 'rootCause'
    | 'correctionImplemented'
    | 'fieldAction'
    | 'eventIds'
    | 'updatedAt'
    | 'closedAt'
  >
>;

type EscalationStore = {
  mutations: Record<string, EscalationMutations>;
  created: Record<string, Escalation>;
  patchEscalation: (id: string, patch: EscalationMutations) => void;
  createEscalation: (esc: Escalation) => void;
  // currentEventIds = the escalation's effective event list (static + overlay),
  // supplied by the caller so a first-time link doesn't drop static links.
  linkEvent: (escalationId: string, eventId: string, currentEventIds: string[]) => void;
  unlinkEvent: (escalationId: string, eventId: string, currentEventIds: string[]) => void;
};

export const useEscalationStore = create<EscalationStore>()(
  persist(
    (set, get) => ({
      mutations: {},
      created: {},
      patchEscalation: (id, patch) =>
        set(state =>
          state.created[id]
            ? { created: { ...state.created, [id]: { ...state.created[id], ...patch } } }
            : { mutations: { ...state.mutations, [id]: { ...state.mutations[id], ...patch } } }
        ),
      createEscalation: (esc) =>
        set(state => ({ created: { ...state.created, [esc.id]: esc } })),
      linkEvent: (escalationId, eventId, currentEventIds) => {
        if (currentEventIds.includes(eventId)) return;
        get().patchEscalation(escalationId, {
          eventIds: [...currentEventIds, eventId],
          updatedAt: now().toISOString(),
        });
      },
      unlinkEvent: (escalationId, eventId, currentEventIds) => {
        get().patchEscalation(escalationId, {
          eventIds: currentEventIds.filter(id => id !== eventId),
          updatedAt: now().toISOString(),
        });
      },
    }),
    { name: 'iq-escalations' }
  )
);
