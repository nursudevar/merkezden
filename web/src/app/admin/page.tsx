"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveIsAdminFromUserRolesClient } from "@/lib/auth/authBrowserClient";
import AdminPageClient from "./AdminPageClient";

export default function AdminPage() {
  const router = useRouter();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setAuthUserId(session?.user?.id ?? null);
      setIsAuthReady(true);
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setAuthUserId(session?.user?.id ?? null);
      if (!session?.user) {
        setAdminLoaded(false);
        setIsAdmin(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!authUserId) {
      router.replace("/login?next=/admin");
      return;
    }

    let cancelled = false;
    setAdminLoaded(false);
    resolveIsAdminFromUserRolesClient(authUserId).then((value) => {
      if (cancelled) return;
      setIsAdmin(value);
      setAdminLoaded(true);
      if (!value) {
        router.replace("/");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, authUserId, router]);

  if (!isAuthReady || !authUserId || !adminLoaded) {
    return (
      <div className="page-container">
        <HeaderClientWrapper />
        <main className="main-layout">
          <div className="main-content">
            <section className="section">
              <p>Yükleniyor...</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) return null;

  return <AdminPageClient />;
}

