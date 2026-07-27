'use client';

import { useMemo } from 'react';
import { events as staticEvents } from '@/data/events';
import { useEventStore, type EventMutations } from '@/store/eventStore';
import type { QualityEvent } from '@/data/types';

// Applies the persisted runtime mutations (eventStore) over a static event.
// Field semantics mirror EventDetailClient/InfoRequestThread: scalar fields
// override when set, additionalInfoRequests replaces the static thread once
// present, editHistory entries are additions appended to the static history.
export function mergeEvent(e: QualityEvent, m?: EventMutations): QualityEvent {
  // Normalized multi root-cause list; `rootCause` stays as the primary for
  // single-value consumers (charts, AI summary).
  const rootCauses =
    m?.rootCauses ??
    (m && m.rootCause !== undefined
      ? (m.rootCause ? [m.rootCause] : [])
      : e.rootCauses ?? (e.rootCause ? [e.rootCause] : []));
  if (!m) return { ...e, rootCauses, rootCause: (rootCauses[0] ?? null) as QualityEvent['rootCause'] };
  return {
    ...e,
    status:                  m.status ?? e.status,
    plant:                   m.plant ?? e.plant,
    rootCauses,
    rootCause:               (rootCauses[0] ?? null) as QualityEvent['rootCause'],
    issue:                   m.issue ?? e.issue,
    component:               m.component ?? e.component,
    door:                    m.door ?? e.door,
    jobNo:                   m.jobNo ?? e.jobNo,
    issueDescription:        m.issueDescription ?? e.issueDescription,
    dfo:                     m.dfo ?? e.dfo,
    elLine:                  m.elLine ?? e.elLine,
    partsRequest:            m.partsRequest ?? e.partsRequest,
    shipTo:                  m.shipTo ?? e.shipTo,
    shipToAddress:           m.shipToAddress ?? e.shipToAddress,
    tags:                    m.tags ?? e.tags,
    additionalInfoRequested: m.additionalInfoRequested ?? e.additionalInfoRequested,
    additionalInfoRequests:  m.additionalInfoRequests ?? e.additionalInfoRequests,
    editHistory:             m.editHistory?.length
      ? [...(e.editHistory ?? []), ...m.editHistory]
      : e.editHistory,
  };
}

// The full event set with runtime mutations applied. Every list/dashboard
// surface should read events through this hook (not '@/data/events') so
// detail-screen actions are reflected everywhere.
export function useEffectiveEvents(): QualityEvent[] {
  const mutations = useEventStore(s => s.mutations);
  return useMemo(() => staticEvents.map(e => mergeEvent(e, mutations[e.id])), [mutations]);
}

export function useEffectiveEventMap(): Map<string, QualityEvent> {
  const events = useEffectiveEvents();
  return useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
}
