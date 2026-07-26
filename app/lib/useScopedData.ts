'use client';

import { useMemo } from 'react';
import { useCapabilities } from '@/store/roleStore';
import { useOrderStore } from '@/store/orderStore';
import { events as allEvents } from '@/data/events';
import { orders as allOrders } from '@/data/orders';
import type { QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';

// Branch (View-Only) users only see their assigned branch's data. Orders carry
// no branch of their own, so they inherit it from their linked event.
const eventBranch = new Map(allEvents.map((e) => [e.id, e.branch]));

export function scopeEvents(events: QualityEvent[], branch: string | null): QualityEvent[] {
  if (!branch) return events;
  return events.filter((e) => e.branch === branch);
}

export function scopeOrders(orders: Order[], branch: string | null): Order[] {
  if (!branch) return orders;
  return orders.filter((o) => eventBranch.get(o.eventId) === branch);
}

/** Events filtered to the current role's data scope. */
export function useScopedEvents(events: QualityEvent[] = allEvents): QualityEvent[] {
  const caps = useCapabilities();
  const branch = caps.branchScoped ? caps.assignedBranch ?? null : null;
  return useMemo(() => scopeEvents(events, branch), [events, branch]);
}

/** Orders filtered to the current role's data scope, including runtime-created
 *  orders (parts requests added to orderless events auto-create orders). */
export function useScopedOrders(orders: Order[] = allOrders): Order[] {
  const caps = useCapabilities();
  const createdOrders = useOrderStore((s) => s.createdOrders);
  const branch = caps.branchScoped ? caps.assignedBranch ?? null : null;
  return useMemo(
    () => scopeOrders([...orders, ...Object.values(createdOrders)], branch),
    [orders, createdOrders, branch]
  );
}
