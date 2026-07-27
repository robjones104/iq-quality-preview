import { events } from '@/data/events';
import { DEFAULT_ROOT_CAUSES, DEFAULT_TAGS } from '@/data/manageLists';
import { ManageListsClient } from '../ManageListsClient';

export default function TagsPage() {
  return (
    <ManageListsClient
      defaultTab="tags"
      events={events}
      initialRootCauses={DEFAULT_ROOT_CAUSES}
      initialTags={DEFAULT_TAGS}
    />
  );
}
