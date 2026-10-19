import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { resolveInstitutionPanelAccess } from '@/lib/auth/authServer';
import { InstitutionPanelAccessError } from './InstitutionPanelAccessError';

export default async function InstitutionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const access = await resolveInstitutionPanelAccess();

  if (access === 'anonymous') {
    redirect('/giris');
  }

  if (access === 'unauthorized') {
    redirect('/');
  }

  if (access === 'error') {
    return <InstitutionPanelAccessError />;
  }

  return <>{children}</>;
}

