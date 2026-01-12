"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <Button
      onClick={handleLogout}
      variant="outline"
      className="button-primary btn-gradient-primary"
    >
      Çıkış Yap
    </Button>
  );
}

