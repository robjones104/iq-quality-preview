import { escalations } from '@/data/escalations';
import { events } from '@/data/events';
import { EscalationDetailClient } from './EscalationDetailClient';

export function generateStaticParams() {
  return [...escalations.map((e) => ({ id: e.id })), { id: 'new' }];
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EscalationDetailPage({ params }: Props) {
  const { id } = await params;

  if (id === 'new') {
    return (
      <EscalationDetailClient
        escalation={null}
        allEvents={events}
        isNew={true}
      />
    );
  }

  const escalation = escalations.find((e) => e.id === id) ?? null;

  // Unknown ids may be runtime-created escalations (client store); the client
  // resolves them and renders its own not-found state otherwise.
  return (
    <EscalationDetailClient
      escalation={escalation}
      escalationId={id}
      allEvents={events}
      isNew={false}
    />
  );
}
