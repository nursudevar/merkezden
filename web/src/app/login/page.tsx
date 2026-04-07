import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HeaderClientWrapper } from '@/components/layout/header.client';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  noStore();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return (
    <div className="page-container">
      <HeaderClientWrapper />
      <LoginClient />
    </div>
  );
}
