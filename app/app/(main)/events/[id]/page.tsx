import { notFound } from 'next/navigation';
import { events } from '@/data/events';
import EventDetailClient from './EventDetailClient';

export function generateStaticParams() {
  return events.map((e) => ({ id: e.id }));
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find((e) => e.id === id);
  if (!event) notFound();
  return <EventDetailClient event={event} />;
}
