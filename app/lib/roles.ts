// RBAC role model for the prototype's "View as" role switcher.
//
// Six of the seven PERSONAS.md roles appear here. App Manager is deliberately
// omitted: its sole function is user provisioning, which happens in separate
// software (Allegion Access Management), so it has no surface in this portal.
//
// Note on "Close order / add Replacement #": the persona prose assigns this to
// Procurement (and Customer Service); the feature matrix marks App Manager, which
// reads as a typo since App Manager has no operational access. The prototype
// follows the prose — Procurement + CS close orders.

export const ROLES = [
  'Full Access',
  'Field Quality',
  'Customer Service',
  'Procurement',
  'Global (View-Only)',
  'Branch (View-Only)',
] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = 'Field Quality';

// The branch a Branch (View-Only) user is scoped to. Chosen for having rich
// data across events and orders so the scoped views still demo well.
export const ASSIGNED_BRANCH = 'Atlanta';

export interface RoleCapabilities {
  // Access / navigation
  dashboard: boolean;
  events: boolean;           // can view the events list + detail
  orders: boolean;           // can view the orders list + detail
  procurementQueue: boolean; // can see the /procurement screen
  categories: boolean;       // can see the Categories (manage) screen
  // Actions
  editEvents: boolean;       // validate / invalidate / edit / tag / root cause / escalate / message
  decideOrders: boolean;     // approve / decline
  closeOrders: boolean;      // close + replacement # + assign to procurement + return
  manageLists: boolean;      // Categories CRUD (root causes / tags / escalations)
  // Data scoping
  branchScoped: boolean;
  assignedBranch?: string;
  // Where this role starts after login, and where guards send them when they
  // hit a screen outside their access.
  landing: string;
  // Display identity
  displayName: string;
  email: string;
}

const CAPS: Record<Role, RoleCapabilities> = {
  'Full Access': {
    dashboard: true, events: true, orders: true, procurementQueue: true, categories: true,
    editEvents: true, decideOrders: true, closeOrders: true, manageLists: true,
    branchScoped: false,
    landing: '/dashboard',
    displayName: 'Sophronia T. Aldwick', email: 'sophronia.aldwick@allegion.com',
  },
  'Field Quality': {
    dashboard: true, events: true, orders: true, procurementQueue: true, categories: true,
    editEvents: true, decideOrders: false, closeOrders: false, manageLists: true,
    branchScoped: false,
    landing: '/dashboard',
    displayName: 'Callum V. Blackswood', email: 'callum.blackswood@allegion.com',
  },
  'Customer Service': {
    dashboard: true, events: true, orders: true, procurementQueue: true, categories: false,
    editEvents: false, decideOrders: true, closeOrders: true, manageLists: false,
    branchScoped: false,
    landing: '/dashboard?view=orders',
    displayName: 'Theron K. Aldwick', email: 'theron.aldwick@allegion.com',
  },
  'Procurement': {
    dashboard: true, events: false, orders: true, procurementQueue: true, categories: false,
    editEvents: false, decideOrders: false, closeOrders: true, manageLists: false,
    branchScoped: false,
    landing: '/procurement',
    displayName: 'Ptolemy R. Dunholm', email: 'ptolemy.dunholm@allegion.com',
  },
  'Global (View-Only)': {
    dashboard: true, events: true, orders: true, procurementQueue: false, categories: false,
    editEvents: false, decideOrders: false, closeOrders: false, manageLists: false,
    branchScoped: false,
    landing: '/dashboard',
    displayName: 'Marchmont R. Fenwick', email: 'marchmont.fenwick@allegion.com',
  },
  'Branch (View-Only)': {
    dashboard: true, events: true, orders: true, procurementQueue: false, categories: false,
    editEvents: false, decideOrders: false, closeOrders: false, manageLists: false,
    branchScoped: true, assignedBranch: ASSIGNED_BRANCH,
    landing: '/dashboard',
    displayName: 'Persephone T. Whitmore', email: 'persephone.whitmore@allegion.com',
  },
};

export function capabilitiesFor(role: Role): RoleCapabilities {
  // Fall back to the default role if a stale persisted value (e.g. the removed
  // App Manager role) is passed in.
  return CAPS[role] ?? CAPS[DEFAULT_ROLE];
}

// One-line summary of each role, for the switcher UI.
export const ROLE_BLURB: Record<Role, string> = {
  'Full Access': 'Unrestricted — all data and actions',
  'Field Quality': 'Validates, categorizes, and routes events',
  'Customer Service': 'Approves, declines, and closes orders',
  'Procurement': 'Sources parts and closes assigned orders',
  'Global (View-Only)': 'Read-only oversight, all branches',
  'Branch (View-Only)': `Read-only, ${ASSIGNED_BRANCH} branch only`,
};
