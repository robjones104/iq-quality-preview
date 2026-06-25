import { notFound } from 'next/navigation';
import { events } from '@/data/events';
import { orders } from '@/data/orders';
import EventDetailClient from './EventDetailClient';

export function generateStaticParams() {
  return events.map((e) => ({ id: e.id }));
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find((e) => e.id === id);
  if (!event) notFound();
  const order = orders.find((o) => o.eventId === id);
  return <EventDetailClient event={event} orderId={order?.id ?? null} />;
}
