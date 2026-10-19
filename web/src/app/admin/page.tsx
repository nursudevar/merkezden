"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { HomeSectionLoadError } from "@/components/home/HomeSectionLoadError";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveIsAdminResolutionFromUserRolesClient } from "@/lib/auth/authBrowserClient";
import AdminPageClient from "./AdminPageClient";

const SESSION_CHECK_ERROR =
  "Oturum doğrulanamadı. Bağlantı sorunu olabilir. Lütfen tekrar deneyin.";
const ADMIN_CHECK_ERROR =
  "Admin yetkisi doğrulanamadı. Bağlantı sorunu olabilir. Lütfen tekrar deneyin.";

export default function AdminPage() {
  const router = useRouter();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(false);
  const [sessionRetryCount, setSessionRetryCount] = useState(0);
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [adminCheckFailed, setAdminCheckFailed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminRetryCount, setAdminRetryCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const sessionRetryLockRef = useRef(false);
  const adminRetryLockRef = useRef(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function initSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setSessionCheckFailed(true);
        setAuthUserId(null);
        setIsAuthReady(true);
        setSessionChecking(false);
        sessionRetryLockRef.current = false;
        return;
      }
      setSessionCheckFailed(false);
      setAuthUserId(session?.user?.id ?? null);
      setIsAuthReady(true);
      setSessionChecking(false);
      sessionRetryLockRef.current = false;
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) setSessionCheckFailed(false);
      setAuthUserId(session?.user?.id ?? null);
      if (!session?.user) {
        setAdminLoaded(false);
        setIsAdmin(false);
        setAdminCheckFailed(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [sessionRetryCount]);

  useEffect(() => {
    if (!isAuthReady || sessionCheckFailed) return;
    if (!authUserId) {
      router.replace("/giris?next=/admin");
      return;
    }

    let cancelled = false;
    const sameUserRetry = adminRetryLockRef.current;
    if (!sameUserRetry) setAdminLoaded(false);
    setAdminChecking(true);
    resolveIsAdminResolutionFromUserRolesClient(authUserId).then((resolution) => {
      if (cancelled) return;
      adminRetryLockRef.current = false;
      setAdminChecking(false);
      if (resolution.status === "error") {
        setIsAdmin(false);
        setAdminCheckFailed(true);
        setAdminLoaded(true);
        return;
      }
      setAdminCheckFailed(false);
      setIsAdmin(resolution.isAdmin);
      setAdminLoaded(true);
      if (!resolution.isAdmin) router.replace("/");
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, sessionCheckFailed, authUserId, adminRetryCount, router]);

  const retrySession = () => {
    if (sessionRetryLockRef.current || sessionChecking) return;
    sessionRetryLockRef.current = true;
    setSessionChecking(true);
    setSessionRetryCount((count) => count + 1);
  };

  const retryAdminCheck = () => {
    if (adminRetryLockRef.current || adminChecking || !adminCheckFailed) return;
    adminRetryLockRef.current = true;
    setAdminChecking(true);
    setAdminRetryCount((count) => count + 1);
  };

  if (sessionCheckFailed) {
    return (
      <div className="page-container">
        <HeaderClientWrapper />
        <div className="auth-check-error">
          <HomeSectionLoadError
            message={SESSION_CHECK_ERROR}
            loading={sessionChecking}
            onRetry={retrySession}
          />
        </div>
      </div>
    );
  }

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

  if (adminCheckFailed) {
    return (
      <div className="page-container">
        <HeaderClientWrapper />
        <div className="auth-check-error">
          <HomeSectionLoadError
            message={ADMIN_CHECK_ERROR}
            loading={adminChecking}
            onRetry={retryAdminCheck}
          />
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return <AdminPageClient />;
}

