"use client";

import HeaderWithSearchClient from './HeaderWithSearchClient';

interface HeaderClientProps {
  initialUser: { id: string; email?: string } | null;
  initialUserType: 'individual' | 'institution' | null;
}

export default function HeaderClient({
  initialUser,
  initialUserType,
}: HeaderClientProps) {
  return <HeaderWithSearchClient user={initialUser} userType={initialUserType} />;
}
