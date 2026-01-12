"use client";

import { useEffect, useState } from 'react';
import HeaderWithSearchClient from './HeaderWithSearchClient';

interface HeaderWithSearchProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchButtonText?: string;
}

export default function HeaderWithSearch({
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchButtonText,
}: HeaderWithSearchProps) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userType, setUserType] = useState<'individual' | 'institution' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const response = await fetch('/api/auth/user-role', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setUserType(data.userType);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[HeaderWithSearch] Error fetching user role:', error);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, []);

  if (loading) {
    return (
      <HeaderWithSearchClient
        user={null}
        userType={null}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        searchButtonText={searchButtonText}
      />
    );
  }

  return (
    <HeaderWithSearchClient
      user={user}
      userType={userType}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchButtonText={searchButtonText}
    />
  );
}
