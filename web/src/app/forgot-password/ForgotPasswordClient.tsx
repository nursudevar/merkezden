"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";

function getPasswordResetRedirectUrl() {
  const envBase = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  const base = envBase || window.location.origin;
  return `${base.replace(/\/+$/, "")}/auth/update-password`;
}

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getPasswordResetRedirectUrl(),
      });

      if (resetError) {
        setError(resetError.message || "Sıfırlama e-postası gönderilemedi. Lütfen tekrar deneyin.");
        return;
      }

      setSent(true);
    } catch (_err) {
      setError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-content-wrapper">
      <div className="signup-card">
        <h1 className="auth-title">Şifremi Unuttum</h1>
        <p className="auth-subtitle">
          E-posta adresinizi girin, size şifre yenileme bağlantısı gönderelim.
        </p>

        {sent ? (
          <div className="auth-feedback auth-feedback--success" role="status">
            Şifre sıfırlama bağlantısı gönderildi. Lütfen e-posta kutunuzu kontrol edin.
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error ? (
              <div className="auth-feedback auth-feedback--error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="auth-field">
              <label htmlFor="forgot-email" className="auth-label">
                E-posta Adresi
              </label>
              <input
                id="forgot-email"
                type="email"
                className="auth-input"
                placeholder="eposta@adresiniz.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button type="submit" className="auth-primary-button" disabled={loading}>
              {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
            </button>
          </form>
        )}

        <p className="auth-bottom-text">
          <Link href="/login" className="auth-link">
            Giriş sayfasına dön
          </Link>
        </p>
      </div>
    </div>
  );
}
