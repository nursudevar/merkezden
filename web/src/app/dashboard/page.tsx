import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Header from '@/components/layout/Header';
import '@/styles/main.scss';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/giris?next=/dashboard');
  }

  return (
    <div className="page-container">
      <Header />
      <main className="main-layout">
        <div className="main-content">
          <section className="section">
            <div className="section-header">
              <h1 className="section-title">Dashboard</h1>
              <p className="section-subtitle">
                Hoş geldiniz, {user.email}!
              </p>
            </div>
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p>Bu korumalı bir sayfadır. Sadece giriş yapmış kullanıcılar burayı görebilir.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

