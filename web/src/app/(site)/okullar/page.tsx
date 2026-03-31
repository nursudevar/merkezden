import { Suspense } from 'react';
import OkullarPageClient from './OkullarPageClient';

export default function OkullarPage() {
  return (
    <Suspense fallback={<></>}>
      <OkullarPageClient />
    </Suspense>
  );
}
