'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// Live prefers-reduced-motion flag, SSR-safe (false on the server; charts
// mount client-side after hydration so the corrected value applies).
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
