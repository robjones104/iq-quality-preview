'use client';

import { useMemo } from 'react';
import { escalations as staticEscalations } from '@/data/escalations';
import { useEscalationStore, type EscalationMutations } from '@/store/escalationStore';
import type { Escalation } from '@/data/types';

export function mergeEscalation(e: Escalation, m?: EscalationMutations): Escalation {
  if (!m) return e;
  return { ...e, ...m };
}

// Static escalations with the runtime overlay applied, plus runtime-created
// escalations (newest first). Every escalation surface reads through this.
export function useEffectiveEscalations(): Escalation[] {
  const mutations = useEscalationStore(s => s.mutations);
  const created = useEscalationStore(s => s.created);
  return useMemo(() => {
    const createdList = Object.values(created).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [...createdList, ...staticEscalations.map(e => mergeEscalation(e, mutations[e.id]))];
  }, [mutations, created]);
}

export function useEffectiveEscalationMap(): Map<string, Escalation> {
  const escalations = useEffectiveEscalations();
  return useMemo(() => new Map(escalations.map(e => [e.id, e])), [escalations]);
}
