'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useRoleStore } from '@/store/roleStore';
import { capabilitiesFor, type RoleCapabilities } from '@/lib/roles';

// Maps a pathname to the capability required to view it. Screens not listed
// (e.g. /account) are open to every role.
function requiredCapability(pathname: string): keyof RoleCapabilities | null {
  if (pathname.startsWith('/dashboard'))    return 'dashboard';
  if (pathname.startsWith('/events'))       return 'events';
  if (pathname.startsWith('/orders'))       return 'orders';
  if (pathname.startsWith('/procurement'))  return 'procurementQueue';
  if (pathname.startsWith('/manage'))       return 'categories';
  if (pathname.startsWith('/escalations'))  return 'editEvents';
  return null;
}

// Enforces per-role route access. Nav hiding keeps links honest; this guard
// covers direct URLs, stale links, and cross-screen navigation (e.g. an order's
// event reference when the role has no Events access). Redirects go to the
// role's landing page.
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRoleStore((s) => s.role);
  const caps = capabilitiesFor(role);

  const required = requiredCapability(pathname);
  const allowed = required === null || Boolean(caps[required]);

  useEffect(() => {
    if (!allowed) router.replace(caps.landing);
  }, [allowed, caps.landing, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
