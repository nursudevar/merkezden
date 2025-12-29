import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import HeaderActions from './HeaderActions';

export default async function Header() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className="header-brand">
            <Link href="/" className="header-title-link">
              <span className="header-title">MERKEZDEN.COM</span>
            </Link>
            <span className="header-subtitle">HAYATIN MERKEZİ</span>
          </div>
          <HeaderActions initialUser={user} />
        </div>
      </header>
    </>
  );
}
