import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUserRole } from '@/lib/auth/getCurrentUserRole';

export default async function InstitutionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const { user, userType } = await getCurrentUserRole();

  if (!user) {
    redirect('/login');
  }

  if (userType !== 'institution') {
    redirect('/');
  }

  return <>{children}</>;
}

