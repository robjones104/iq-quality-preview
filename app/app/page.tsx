'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRoleStore } from '@/store/roleStore';
import { capabilitiesFor } from '@/lib/roles';

export default function RootPage() {
  const router = useRouter();
  const role = useRoleStore((s) => s.role);
  const landing = capabilitiesFor(role).landing;
  useEffect(() => { router.replace(landing); }, [router, landing]);
  return null;
}
