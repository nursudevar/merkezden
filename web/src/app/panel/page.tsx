"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveUserTypeFromUsersClient } from "@/lib/auth/resolveUserTypeFromUsersClient";
import HeaderClientWrapper from "@/components/layout/HeaderClientWrapper";
import "@/styles/main.scss";
import "@/styles/pages/panel.scss";

export default function PanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userType, setUserType] = useState<"individual" | "institution" | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ? { id: session.user.id } : null);
      setIsAuthReady(true);
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
      if (!session?.user) {
        setUserType(null);
        setRoleLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || user !== null) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) setUser({ id: session.user.id });
      else router.replace("/login");
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, router]);

  useEffect(() => {
    if (!user?.id) {
      setRoleLoaded(false);
      return;
    }
    let cancelled = false;
    setRoleLoaded(false);
    resolveUserTypeFromUsersClient(user.id).then((type) => {
      if (!cancelled) {
        setUserType(type);
        setRoleLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthReady || !user || !roleLoaded) return;
    if (userType !== "institution") {
      router.replace("/");
    }
  }, [isAuthReady, user, roleLoaded, userType, router]);

  if (!isAuthReady || (user && !roleLoaded)) {
    return (
      <div className="panel-page">
        <HeaderClientWrapper />
        <div className="panel-page-loading">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (userType !== "institution") return null;

  return (
    <div className="panel-page">
      <HeaderClientWrapper />
      <div className="panel-page-container">
        <h1 className="panel-page-title">Yönetim Paneli</h1>
        <div className="panel-page-main">
          <section className="panel-section">
            <h2 className="panel-section-title">Kurum Bilgileri</h2>
            <p className="panel-section-placeholder">İçerik yakında eklenecek.</p>
          </section>
          <section className="panel-section">
            <h2 className="panel-section-title">Programlar</h2>
            <p className="panel-section-placeholder">İçerik yakında eklenecek.</p>
          </section>
          <section className="panel-section">
            <h2 className="panel-section-title">Ayarlar</h2>
            <p className="panel-section-placeholder">İçerik yakında eklenecek.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
