"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthErrorMessageTr } from "@/lib/auth/authBrowserClient";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";

export default function UpdatePasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canUpdatePassword, setCanUpdatePassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setCanUpdatePassword(Boolean(data.session?.user));
      setChecking(false);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || Boolean(session?.user)) {
        setCanUpdatePassword(true);
      }
      setChecking(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();
    if (!trimmedPassword || !trimmedConfirm) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }
    if (trimmedPassword.length < 8) {
      setError("Yeni şifreniz en az 8 karakter olmalıdır.");
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: trimmedPassword });
      if (updateError) {
        setError(
          getAuthErrorMessageTr(updateError, "Şifre güncellenemedi. Lütfen tekrar deneyin."),
        );
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/giris?reset=success");
      }, 1200);
    } catch (_err) {
      setError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-content-wrapper">
      <div className="signup-card">
        <h1 className="auth-title">Yeni Şifre Belirle</h1>
        <p className="auth-subtitle">
          Hesabınız için yeni bir şifre oluşturun.
        </p>

        {checking ? (
          <div className="auth-feedback" role="status">
            Oturum doğrulanıyor...
          </div>
        ) : !canUpdatePassword ? (
          <div className="auth-feedback auth-feedback--error" role="alert">
            Şifre yenileme bağlantısı geçersiz veya süresi dolmuş olabilir. Lütfen tekrar şifre sıfırlama isteği oluşturun.
          </div>
        ) : success ? (
          <div className="auth-feedback auth-feedback--success" role="status">
            Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error ? (
              <div className="auth-feedback auth-feedback--error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="auth-field">
              <label htmlFor="new-password" className="auth-label">
                Yeni Şifre
              </label>
              <input
                id="new-password"
                type="password"
                className="auth-input"
                placeholder="En az 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="confirm-password" className="auth-label">
                Yeni Şifre (Tekrar)
              </label>
              <input
                id="confirm-password"
                type="password"
                className="auth-input"
                placeholder="Şifrenizi tekrar girin"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-primary-button" disabled={loading}>
              {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </button>
          </form>
        )}

        <p className="auth-bottom-text">
          <Link href="/sifremi-unuttum" className="auth-link">
            Şifre sıfırlama ekranına dön
          </Link>
        </p>
      </div>
    </div>
  );
}
