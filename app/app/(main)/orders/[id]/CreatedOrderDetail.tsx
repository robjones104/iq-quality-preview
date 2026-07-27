'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Empty, Button } from 'antd';
import { useOrderStore } from '@/store/orderStore';
import { useEffectiveEventMap } from '@/lib/effectiveEvents';
import { OrderDetailClient } from './OrderDetailClient';

// Fallback for order ids the server doesn't know: orders created at runtime
// (parts request added to an orderless event) live in the client store only.
export function CreatedOrderDetail({ id }: { id: string }) {
  const createdOrders = useOrderStore((s) => s.createdOrders);
  const router = useRouter();
  // The store rehydrates from localStorage after mount; wait one tick before
  // declaring the order missing.
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHydrated(true); }, []);

  const order = createdOrders[id];
  const eventMap = useEffectiveEventMap();
  const event = order ? eventMap.get(order.eventId) : undefined;

  if (order && event) return <OrderDetailClient order={order} event={event} />;
  if (!hydrated) return null;

  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
      <Empty description="Order not found.">
        <Button type="primary" onClick={() => router.push('/orders')}>Back to Orders</Button>
      </Empty>
    </div>
  );
}
