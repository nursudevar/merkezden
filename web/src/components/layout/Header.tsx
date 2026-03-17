import { unstable_noStore as noStore } from 'next/cache';
import { getCurrentUserRole } from '@/lib/auth/getCurrentUserRole';
import HeaderWithSearchClient from './HeaderWithSearchClient';

export default async function Header() {
  noStore();
  const { user, userType } = await getCurrentUserRole();

  return (
    <HeaderWithSearchClient
      user={user ? { id: user.id, email: user.email ?? undefined } : null}
      userType={userType}
    />
  );
}
