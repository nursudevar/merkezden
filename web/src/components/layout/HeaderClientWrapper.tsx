"use client";

import { useEffect, useState } from 'react';
import HeaderClient from './HeaderClient';

export default function HeaderClientWrapper() {
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
          console.error('[HeaderClientWrapper] Error fetching user role:', error);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, []);

  if (loading) {
    return <HeaderClient initialUser={null} initialUserType={null} />;
  }

  return <HeaderClient initialUser={user} initialUserType={userType} />;
}
