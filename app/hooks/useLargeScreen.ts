'use client';
import { useEffect, useState } from 'react';

export function useLargeScreen(threshold = 2400): boolean {
  const [isLarge, setIsLarge] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${threshold}px)`);
    setIsLarge(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [threshold]);
  return isLarge;
}
