export interface ListItem {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  isSystem?: boolean; // system defaults can't be deleted
}

export const DEFAULT_ROOT_CAUSES: ListItem[] = [
  { id: 'rc-1',  name: 'Ordering Error',          createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-2',  name: 'Wrong Order From Branch',  createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-3',  name: 'Sales Order Error',        createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-4',  name: 'Installation Error',       createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-5',  name: 'Factory Issue',            createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-6',  name: 'Configuration Problem',    createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-7',  name: 'Training Issue',           createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-8',  name: 'Supplier Issue',           createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-9',  name: 'Engineering Issue',        createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
  { id: 'rc-10', name: 'Short Shipping',           createdBy: 'System', createdAt: '2026-01-01', isSystem: true },
];

export const ESCALATION_TYPE_OPTIONS = [
  'IT Ticket', 'EH&S', 'Corrective Action Report', 'Problem Report', 'Custom',
].map(v => ({ value: v, label: v }));

export const DEFAULT_TAGS: ListItem[] = [
  { id: 'tag-1',  name: 'Urgent',             createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-2',  name: 'Controller',         createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-3',  name: 'Power Failure',      createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-4',  name: 'Short Shipping',     createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-5',  name: 'Build Error',        createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-6',  name: 'Glass',              createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-7',  name: 'Factory',            createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-8',  name: 'Supplier Follow-up', createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-9',  name: 'Freight Damage',     createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
  { id: 'tag-10', name: 'Loose Component',    createdBy: 'System', createdAt: '2026-01-01', isSystem: false },
];
