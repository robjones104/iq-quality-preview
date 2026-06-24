import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EventStatus, ActivityLog, EditHistoryEntry } from '@/data/types';

type EventMutations = {
  status?: EventStatus;
  rootCause?: string | null;
  escalation?: string | null;
  tags?: string[];
  additionalInfoRequested?: boolean;
  rootCauseOptions?: { value: string; label: string }[];
  editHistory?: EditHistoryEntry[];
  activityLogAdditions?: ActivityLog[];
};

type EventMutationStore = {
  mutations: Record<string, EventMutations>;
  patchEvent: (eventId: string, patch: Partial<EventMutations>) => void;
  pushActivityLog: (eventId: string, entry: ActivityLog) => void;
  pushEditHistory: (eventId: string, entry: EditHistoryEntry) => void;
};

export const useEventStore = create<EventMutationStore>()(
  persist(
    (set) => ({
      mutations: {},
      patchEvent: (eventId, patch) =>
        set(state => ({
          mutations: {
            ...state.mutations,
            [eventId]: { ...state.mutations[eventId], ...patch },
          },
        })),
      pushActivityLog: (eventId, entry) =>
        set(state => ({
          mutations: {
            ...state.mutations,
            [eventId]: {
              ...state.mutations[eventId],
              activityLogAdditions: [
                ...(state.mutations[eventId]?.activityLogAdditions ?? []),
                entry,
              ],
            },
          },
        })),
      pushEditHistory: (eventId, entry) =>
        set(state => ({
          mutations: {
            ...state.mutations,
            [eventId]: {
              ...state.mutations[eventId],
              editHistory: [
                ...(state.mutations[eventId]?.editHistory ?? []),
                entry,
              ],
            },
          },
        })),
    }),
    { name: 'iq-event-mutations' }
  )
);
