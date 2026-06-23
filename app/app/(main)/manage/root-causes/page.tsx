import { events } from '@/data/events';
import { escalations } from '@/data/escalations';
import { DEFAULT_ROOT_CAUSES, DEFAULT_TAGS } from '@/data/manageLists';
import { ManageListsClient } from '../ManageListsClient';

export default function RootCausesPage() {
  return (
    <ManageListsClient
      defaultTab="root-causes"
      events={events}
      escalations={escalations}
      initialRootCauses={DEFAULT_ROOT_CAUSES}
      initialTags={DEFAULT_TAGS}
    />
  );
}
