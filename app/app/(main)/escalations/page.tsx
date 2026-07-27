import { Suspense } from 'react';
import { EscalationsClient } from './EscalationsClient';

export default function EscalationsPage() {
  return (
    <Suspense>
      <EscalationsClient />
    </Suspense>
  );
}
