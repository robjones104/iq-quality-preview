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
        component: e.component,
      },
    ])
  );

  return <EscalationsClient escalations={escalations} eventMap={eventMap} />;
}
