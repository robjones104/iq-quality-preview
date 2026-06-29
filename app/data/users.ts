export type UserRole =
  | 'Full Access'
  | 'Field Quality'
  | 'Customer Service'
  | 'Procurement'
  | 'Global (View-Only)'
  | 'Branch (View-Only)'
  | 'App Manager';

export type UserStatus = 'Active' | 'Inactive' | 'Pending';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branch?: string;
  status: UserStatus;
  addedBy: string;
  addedAt: string;
  lastLogin?: string;
}

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'Full Access',          label: 'Full Access' },
  { value: 'Field Quality',        label: 'Field Quality' },
  { value: 'Customer Service',     label: 'Customer Service' },
  { value: 'Procurement',          label: 'Procurement' },
  { value: 'Global (View-Only)',   label: 'Global (View-Only)' },
  { value: 'Branch (View-Only)',   label: 'Branch (View-Only)' },
  { value: 'App Manager',          label: 'App Manager' },
];

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  'Full Access':          'Unrestricted admin — all data, all workflow actions, classification list management.',
  'Field Quality':        'Primary operators — validate data, categorize events, route actions, use AI insights.',
  'Customer Service':     'Process replacement orders, approve or decline part fulfillment requests.',
  'Procurement':          'Enter replacement order numbers, receive approved requests, close complaints.',
  'Global (View-Only)':   'Read-only access across all branches and plants. No workflow actions.',
  'Branch (View-Only)':   'Read-only access scoped to one assigned branch via SSO.',
  'App Manager':          'Provision and revoke user access only. No access to operational data.',
};

export const BRANCH_OPTIONS = [
  'Atlanta, GA',
  'Boston, MA',
  'Charlotte, NC',
  'Chicago, IL',
  'Dallas, TX',
  'Denver, CO',
  'Detroit, MI',
  'Houston, TX',
  'Indianapolis, IN',
  'Nashville, TN',
  'Orlando, FL',
  'Phoenix, AZ',
  'Portland, OR',
  'Seattle, WA',
].map(b => ({ value: b, label: b }));

export const users: AppUser[] = [
  { id: 'u-001', name: 'Theron K. Aldwick',     email: 'theron.aldwick@allegion.com',     role: 'Full Access',          status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-01-15', lastLogin: '06-18-2026' },
  { id: 'u-002', name: 'Sable T. Moorwick',     email: 'sable.moorwick@allegion.com',     role: 'Field Quality',        status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-01-15', lastLogin: '06-18-2026' },
  { id: 'u-003', name: 'Tavian V. Dunford',     email: 'tavian.dunford@allegion.com',     role: 'Field Quality',        status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-02-03', lastLogin: '06-17-2026' },
  { id: 'u-004', name: 'Lyra M. Ashdown',       email: 'lyra.ashdown@allegion.com',       role: 'Field Quality',        status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-02-10', lastLogin: '06-17-2026' },
  { id: 'u-005', name: 'Orion T. Dunsworth',    email: 'orion.dunsworth@allegion.com',    role: 'Field Quality',        status: 'Inactive', addedBy: 'Corvus M. Aldsworth', addedAt: '2025-11-20', lastLogin: '05-01-2026' },
  { id: 'u-006', name: 'Tempest V. Foxhollow',  email: 'tempest.foxhollow@allegion.com',  role: 'Customer Service',     status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-01-15', lastLogin: '06-18-2026' },
  { id: 'u-007', name: 'Evander T. Blackfen',   email: 'evander.blackfen@allegion.com',   role: 'Customer Service',     status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-03-01', lastLogin: '06-16-2026' },
  { id: 'u-008', name: 'Solene K. Aldmoor',     email: 'solene.aldmoor@allegion.com',     role: 'Procurement',          status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-01-15', lastLogin: '06-17-2026' },
  { id: 'u-009', name: 'Cael V. Thornfield',    email: 'cael.thornfield@allegion.com',    role: 'Global (View-Only)',   status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-04-10', lastLogin: '06-10-2026' },
  { id: 'u-010', name: 'Nyx T. Ashwood',        email: 'nyx.ashwood@allegion.com',        role: 'Branch (View-Only)',   branch: 'Chicago, IL',  status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-02-22', lastLogin: '06-12-2026' },
  { id: 'u-011', name: 'Wren M. Thornbarrow',   email: 'wren.thornbarrow@allegion.com',   role: 'Branch (View-Only)',   branch: 'Dallas, TX',   status: 'Active',   addedBy: 'Corvus M. Aldsworth', addedAt: '2026-03-08', lastLogin: '06-14-2026' },
  { id: 'u-012', name: 'Sage T. Ashfen',        email: 'sage.ashfen@allegion.com',        role: 'Branch (View-Only)',   branch: 'Houston, TX',  status: 'Pending',  addedBy: 'Corvus M. Aldsworth', addedAt: '2026-06-15' },
  { id: 'u-013', name: 'Corvus M. Aldsworth',   email: 'corvus.aldsworth@allegion.com',   role: 'App Manager',          status: 'Active',   addedBy: 'System',              addedAt: '2025-09-01', lastLogin: '06-17-2026' },
];
