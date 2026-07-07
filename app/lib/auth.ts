'use client';

import { useRouter } from 'next/navigation';

export const CURRENT_USER_EMAIL = 'sophronia.aldwick@allegion.com';

export function useSignOut() {
  const router = useRouter();

  return async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.replace('/login');
  };
}
