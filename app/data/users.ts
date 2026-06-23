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
  { id: 'u-001', name: 'Rob Jones',       email: 'rob.jones@allegion.com',       role: 'Full Access',          status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-01-15', lastLogin: '06-18-2026' },
  { id: 'u-002', name: 'Taylor Harris',   email: 'taylor.harris@allegion.com',   role: 'Field Quality',        status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-01-15', lastLogin: '06-18-2026' },
  { id: 'u-003', name: 'Jordan Williams', email: 'jordan.williams@allegion.com', role: 'Field Quality',        status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-02-03', lastLogin: '06-17-2026' },
  { id: 'u-004', name: 'Casey Morgan',    email: 'casey.morgan@allegion.com',    role: 'Field Quality',        status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-02-10', lastLogin: '06-17-2026' },
  { id: 'u-005', name: 'Alex Thompson',   email: 'alex.thompson@allegion.com',   role: 'Field Quality',        status: 'Inactive', addedBy: 'Pat Nguyen', addedAt: '2025-11-20', lastLogin: '05-01-2026' },
  { id: 'u-006', name: 'Sam Rivera',      email: 'sam.rivera@allegion.com',      role: 'Customer Service',     status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-01-15', lastLogin: '06-18-2026' },
  { id: 'u-007', name: 'Chris Baker',     email: 'chris.baker@allegion.com',     role: 'Customer Service',     status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-03-01', lastLogin: '06-16-2026' },
  { id: 'u-008', name: 'Dana Lee',        email: 'dana.lee@allegion.com',        role: 'Procurement',          status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-01-15', lastLogin: '06-17-2026' },
  { id: 'u-009', name: 'Morgan Chen',     email: 'morgan.chen@allegion.com',     role: 'Global (View-Only)',   status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-04-10', lastLogin: '06-10-2026' },
  { id: 'u-010', name: 'Avery Wilson',    email: 'avery.wilson@allegion.com',    role: 'Branch (View-Only)',   branch: 'Chicago, IL',  status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-02-22', lastLogin: '06-12-2026' },
  { id: 'u-011', name: 'Jamie Garcia',    email: 'jamie.garcia@allegion.com',    role: 'Branch (View-Only)',   branch: 'Dallas, TX',   status: 'Active',   addedBy: 'Pat Nguyen', addedAt: '2026-03-08', lastLogin: '06-14-2026' },
  { id: 'u-012', name: 'Quinn Patel',     email: 'quinn.patel@allegion.com',     role: 'Branch (View-Only)',   branch: 'Houston, TX',  status: 'Pending',  addedBy: 'Pat Nguyen', addedAt: '2026-06-15' },
  { id: 'u-013', name: 'Pat Nguyen',      email: 'pat.nguyen@allegion.com',      role: 'App Manager',          status: 'Active',   addedBy: 'System',     addedAt: '2025-09-01', lastLogin: '06-17-2026' },
];
