'use client';
import { useCallback, useSyncExternalStore } from 'react';

export function useLargeScreen(threshold = 2400): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(`(min-width: ${threshold}px)`);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [threshold]);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(`(min-width: ${threshold}px)`).matches,
    () => false,
  );
}
