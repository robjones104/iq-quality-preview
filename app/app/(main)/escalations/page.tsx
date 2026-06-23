import { escalations } from '@/data/escalations';
import { events } from '@/data/events';
import { EscalationsClient } from './EscalationsClient';

export default function EscalationsPage() {
  const eventMap = Object.fromEntries(
    events.map((e) => [
      e.id,
      {
        reportedBy: e.reportedBy,
        branch: e.branch,
        product: e.product,
      },
    ])
  );

  return <EscalationsClient escalations={escalations} eventMap={eventMap} />;
}
