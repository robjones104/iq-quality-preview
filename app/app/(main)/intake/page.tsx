import { Suspense } from 'react';
import { IntakeHomeClient } from './IntakeHomeClient';

export default function IntakePage() {
  return (
    <Suspense>
      <IntakeHomeClient />
    </Suspense>
  );
}
