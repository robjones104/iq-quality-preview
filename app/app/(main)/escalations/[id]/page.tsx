import { escalations } from '@/data/escalations';
import { events } from '@/data/events';
import { EscalationDetailClient } from './EscalationDetailClient';

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

  if (!escalation) {
    return (
      <div style={{ padding: 32 }}>
        Escalation not found.
      </div>
    );
  }

  return (
    <EscalationDetailClient
      escalation={escalation}
      allEvents={events}
      isNew={false}
    />
  );
}
