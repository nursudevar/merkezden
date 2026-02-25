"use client";

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { resolveUserTypeFromUsersClient } from '@/lib/auth/resolveUserTypeFromUsersClient';
import HeaderWithSearchClient from './HeaderWithSearchClient';

interface HeaderWithSearchProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchButtonText?: string;
  showSearchButton?: boolean;
}

export default function HeaderWithSearch({
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchButtonText,
  showSearchButton,
}: HeaderWithSearchProps) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userType, setUserType] = useState<'individual' | 'institution' | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user ?? null;
      setUser(authUser ? { id: authUser.id, email: authUser.email } : null);
      if (!authUser) {
        setUserType(null);
      }
      setIsAuthReady(true);
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser ? { id: authUser.id, email: authUser.email } : null);
      if (!authUser) {
        setUserType(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setUserType(null);
      return;
    }
    let cancelled = false;
    resolveUserTypeFromUsersClient(user.id).then((type) => {
      if (!cancelled) setUserType(type);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    console.log('Header role:', { authUid: user?.id, userType });
  }, [user?.id, userType]);

  const displayUser = isAuthReady ? user : null;
  const displayUserType = isAuthReady ? userType : null;

  return (
    <HeaderWithSearchClient
      user={displayUser}
      userType={displayUserType}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchButtonText={searchButtonText}
      showSearchButton={showSearchButton}
    />
  );
}
