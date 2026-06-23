import { notFound } from 'next/navigation';
import { orders } from '@/data/orders';
import { events } from '@/data/events';
import { OrderDetailClient } from './OrderDetailClient';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = orders.find(o => o.id === id);
  if (!order) notFound();
  const event = events.find(e => e.id === order.eventId);
  if (!event) notFound();
  return <OrderDetailClient order={order} event={event} />;
}
