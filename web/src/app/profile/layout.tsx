import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUserRole } from '@/lib/auth/getCurrentUserRole';

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const { user, userType } = await getCurrentUserRole();

  if (!user) {
    redirect('/login');
  }

  if (userType !== 'individual') {
    redirect('/');
  }

  return <>{children}</>;
}

