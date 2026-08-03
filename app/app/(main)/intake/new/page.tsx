import { Suspense } from 'react';
import { IntakeFormClient } from './IntakeFormClient';

export default function IntakeNewPage() {
  return (
    <Suspense>
      <IntakeFormClient />
    </Suspense>
  );
}
