"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import MekoChromaVideo from '@/components/MekoChromaVideo';
import '@/styles/main.scss';
import '@/styles/pages/auth.scss';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || 'Giriş yapılırken bir hata oluştu.');
        return;
      }

      window.location.href = '/';
    } catch (err) {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const authError = searchParams.get('error');
  const resetStatus = searchParams.get('reset');
  const displayError = error || (authError === 'auth_callback_error' ? 'Kimlik doğrulama hatası. Lütfen tekrar deneyin.' : null);
  const displaySuccess = resetStatus === 'success'
    ? 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.'
    : null;

  return (
    <div className="login-page-content">
      <div className="auth-content-wrapper">
        <div className="auth-main-container">
          <div className="auth-layout">
            <div className="auth-visual">
                <MekoChromaVideo
                  className="auth-visual-video"
                  src="/gifs/meko-giris.mp4"
                  ariaLabel="Giriş görseli"
                  threshold={18}
                />
            </div>

            <div className="auth-form-panel">
              <div className="auth-card">
                <h1 className="auth-title">Giriş Yap</h1>
                <p className="auth-subtitle">
                  Hesabınıza giriş yapın ve öğrenme yolculuğunuza devam edin.
                </p>

                <form className="auth-form" onSubmit={handleSubmit}>
                  {displaySuccess && (
                    <div className="auth-feedback auth-feedback--success" role="status">
                      {displaySuccess}
                    </div>
                  )}
                  {displayError && (
                    <div className="auth-feedback auth-feedback--error" role="alert">
                      {displayError}
                    </div>
                  )}

                  <div className="auth-field">
                    <label htmlFor="login-email" className="auth-label">
                      E-posta Adresi
                    </label>
                    <input
                      type="email"
                      id="login-email"
                      name="email"
                      className="auth-input"
                      placeholder="eposta@adresiniz.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="login-password" className="auth-label">
                      Şifre
                    </label>
                    <div className="auth-input-with-icon">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="login-password"
                        name="password"
                        className="auth-input"
                        placeholder="Şifrenizi girin"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="auth-input-icon"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <Link href="/forgot-password" className="auth-link-small">
                      Şifremi unuttum
                    </Link>
                  </div>

                  <button
                    type="submit"
                    className="auth-primary-button"
                    disabled={loading}
                  >
                    {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                  </button>
                </form>

                <p className="auth-bottom-text">
                  Hesabınız yok mu?{' '}
                  <Link href="/signup" className="auth-link">
                    Kayıt olun
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginClient() {
  return (
    <Suspense fallback={
      <div className="login-page-content">
        <div className="auth-content-wrapper">
          <div className="auth-main-container">
            <div className="auth-layout">
              <div className="auth-form-panel">
                <div className="auth-card">
                  <h1 className="auth-title">Giriş Yap</h1>
                  <p className="auth-subtitle">Yükleniyor...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

