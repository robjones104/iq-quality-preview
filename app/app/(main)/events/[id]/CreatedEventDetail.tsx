'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Empty, Button } from 'antd';
import { useEventStore } from '@/store/eventStore';
import EventDetailClient from './EventDetailClient';

// Fallback for event ids the server doesn't know: events created at runtime
// (portal intake submissions) live in the client store only.
export function CreatedEventDetail({ id }: { id: string }) {
  const createdEvents = useEventStore((s) => s.createdEvents);
  const router = useRouter();
  // The store rehydrates from localStorage after mount; wait one tick before
  // declaring the event missing.
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHydrated(true); }, []);

  const event = createdEvents[id];

  // EventDetailClient resolves a runtime-created order for the event itself,
  // so no orderId is passed here.
  if (event) return <EventDetailClient event={event} orderId={null} />;
  if (!hydrated) return null;

  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
      <Empty description="Event not found.">
        <Button type="primary" onClick={() => router.push('/events')}>Back to Events</Button>
      </Empty>
    </div>
  );
}
