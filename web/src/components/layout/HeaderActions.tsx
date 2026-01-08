"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import LogoutButton from '@/components/auth/LogoutButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface HeaderActionsProps {
  initialUser: User | null;
}

export default function HeaderActions({
  initialUser,
}: HeaderActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser);
  const isProfilePage = pathname === '/profile';

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Initialize user from session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="header-actions">
      {user ? (
        <>
          {!isProfilePage && (
            <Link href="/profile">
              <Button className="button-primary btn-gradient-primary" variant="default">
                Profil
              </Button>
            </Link>
          )}
          <LogoutButton />
        </>
      ) : (
        <Link href="/login">
          <Button className="button-primary btn-gradient-primary" variant="default">
            GİRİŞ YAP
          </Button>
        </Link>
      )}
    </div>
  );
}

