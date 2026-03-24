"use client";

import HeaderWithSearchClient from './HeaderWithSearchClient';

interface HeaderClientProps {
  initialUser: { id: string; email?: string } | null;
  initialUserType: 'individual' | 'institution' | null;
  initialInstitutionName?: string | null;
  initialIndividualName?: string | null;
}

export default function HeaderClient({
  initialUser,
  initialUserType,
  initialInstitutionName,
  initialIndividualName,
}: HeaderClientProps) {
  return (
    <HeaderWithSearchClient
      user={initialUser}
      userType={initialUserType}
      institutionName={initialInstitutionName}
      individualName={initialIndividualName}
    />
  );
}
