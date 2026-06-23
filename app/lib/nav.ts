// Single source of truth for navigation structure.
// SidebarNav (desktop) and PageHeader mobile drawer both import from here.

export type NavItem = {
  href: string;
  label: string;
};

export const NAV_TOP: NavItem[] = [
  { href: '/dashboard', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/orders', label: 'Orders' },
  { href: '/users', label: 'Users' },
];

export const NAV_MANAGE: NavItem[] = [
  { href: '/manage/root-causes', label: 'Root Causes' },
  { href: '/manage/tags', label: 'Tags' },
  { href: '/manage/escalations', label: 'Escalation Types' },
];

export const NAV_BOTTOM: NavItem[] = [
  { href: '/notifications', label: 'Notifications' },
  { href: '/settings', label: 'Settings' },
  { href: '/account', label: 'Profile' },
];
