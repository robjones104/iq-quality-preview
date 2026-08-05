'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useRoleStore } from '@/store/roleStore';
import { capabilitiesFor, type RoleCapabilities } from '@/lib/roles';

// Maps a pathname to the capability required to view it. Screens not listed
// (e.g. /account) are open to every role.
function requiredCapability(pathname: string): keyof RoleCapabilities | null {
  if (pathname.startsWith('/dashboard'))    return 'dashboard';
  if (pathname.startsWith('/events'))       return 'events';
  if (pathname.startsWith('/orders'))       return 'orders';
  if (pathname.startsWith('/escalations'))  return 'escalations';
  if (pathname.startsWith('/fulfillment'))  return 'fulfillmentQueue';
  if (pathname.startsWith('/manage'))       return 'categories';
  if (pathname.startsWith('/intake'))       return 'intake';
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

  // The persisted role rehydrates after first render; until then the store
  // holds the default role. Enforcing early misroutes roles whose access the
  // default role lacks (a hard load of /intake redirected to /dashboard), so
  // enforcement waits one tick for the real role.
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHydrated(true); }, []);

  const required = requiredCapability(pathname);
  const allowed = required === null || Boolean(caps[required]);

  useEffect(() => {
    if (hydrated && !allowed) router.replace(caps.landing);
  }, [hydrated, allowed, caps.landing, router]);

  if (!hydrated) return null;
  if (!allowed) return null;
  return <>{children}</>;
}
