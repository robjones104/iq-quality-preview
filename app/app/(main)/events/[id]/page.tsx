import { events } from '@/data/events';
import { orders } from '@/data/orders';
import EventDetailClient from './EventDetailClient';
import { CreatedEventDetail } from './CreatedEventDetail';

export function generateStaticParams() {
  return events.map((e) => ({ id: e.id }));
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find((e) => e.id === id);
  // Unknown to the static data: may be a runtime-created event living in the
  // client store (portal intake submission). Resolve client-side.
  if (!event) return <CreatedEventDetail id={id} />;
  const order = orders.find((o) => o.eventId === id);
  return <EventDetailClient event={event} orderId={order?.id ?? null} />;
}
