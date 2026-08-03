import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EventStatus, ActivityLog, EditHistoryEntry, AdditionalInfoRequest, QualityEvent } from '@/data/types';

export type EventMutations = {
  status?: EventStatus;
  plant?: string;
  rootCause?: string | null;
  rootCauses?: string[];
  escalation?: string | null;
  tags?: string[];
  additionalInfoRequested?: boolean;
  additionalInfoRequests?: AdditionalInfoRequest[];
  rootCauseOptions?: { value: string; label: string }[];
  editHistory?: EditHistoryEntry[];
  activityLogAdditions?: ActivityLog[];
  issue?: string;
  component?: string;
  door?: string;
  jobNo?: string;
  issueDescription?: string;
  dfo?: number;
  elLine?: number;
  partsRequest?: QualityEvent['partsRequest'];
  shipTo?: QualityEvent['shipTo'];
  shipToAddress?: QualityEvent['shipToAddress'];
};

type EventMutationStore = {
  mutations: Record<string, EventMutations>;
  // Events created at runtime — portal intake submissions (INTAKE-SPEC.md).
  // Merged into every surface via effectiveEvents, mirroring
  // orderStore.createdOrders.
  createdEvents: Record<string, QualityEvent>;
  createEvent: (event: QualityEvent) => void;
  patchEvent: (eventId: string, patch: Partial<EventMutations>) => void;
  pushActivityLog: (eventId: string, entry: ActivityLog) => void;
  pushEditHistory: (eventId: string, entry: EditHistoryEntry) => void;
  updateAdditionalInfoRequest: (eventId: string, id: string, patch: Partial<AdditionalInfoRequest>) => void;
};

export const useEventStore = create<EventMutationStore>()(
  persist(
    (set) => ({
      mutations: {},
      createdEvents: {},
      createEvent: (event) =>
        set(state => ({
          createdEvents: { ...state.createdEvents, [event.id]: event },
        })),
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
      updateAdditionalInfoRequest: (eventId, id, patch) =>
        set(state => ({
          mutations: {
            ...state.mutations,
            [eventId]: {
              ...state.mutations[eventId],
              additionalInfoRequests: (state.mutations[eventId]?.additionalInfoRequests ?? []).map(
                r => (r.id === id ? { ...r, ...patch } : r)
              ),
            },
          },
        })),
    }),
    { name: 'iq-event-mutations' }
  )
);
