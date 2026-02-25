"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
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

      if (data?.user?.email) {
        console.log(data.user.email);
      }

      window.location.href = '/';
    } catch (err) {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const authError = searchParams.get('error');
  const displayError = error || (authError === 'auth_callback_error' ? 'Kimlik doğrulama hatası. Lütfen tekrar deneyin.' : null);

  return (
    <div className="page-container">
      <div className="auth-content-wrapper">
        <div className="auth-main-container">
          <div className="auth-layout">
            <div className="auth-visual">
              <div className="auth-orbit">
                <div className="auth-orbit-circle auth-orbit-circle-outer"></div>
                <div className="auth-orbit-circle auth-orbit-circle-inner"></div>
                <div className="auth-orbit-track auth-orbit-track-outer">
                  <div className="auth-orbit-dot"></div>
                </div>
                <div className="auth-orbit-track auth-orbit-track-inner">
                  <div className="auth-orbit-dot"></div>
                </div>
              </div>
            </div>

            <div className="auth-form-panel">
              <div className="auth-card">
                <h1 className="auth-title">Giriş Yap</h1>
                <p className="auth-subtitle">
                  Hesabınıza giriş yapın ve öğrenme yolculuğunuza devam edin.
                </p>

                <form className="auth-form" onSubmit={handleSubmit}>
                  {displayError && (
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: '12px',
                      color: '#dc2626',
                      fontSize: '14px',
                      marginBottom: '8px'
                    }}>
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

                <div className="auth-divider">
                  <span>veya</span>
                </div>

                <div className="auth-social-row">
                  <button
                    type="button"
                    className="auth-social-button"
                    onClick={() => {
                    }}
                  >
                    <div className="auth-social-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <span>Google</span>
                  </button>
                  <button
                    type="button"
                    className="auth-social-button"
                    onClick={() => {
                    }}
                  >
                    <div className="auth-social-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <span>Facebook</span>
                  </button>
                </div>

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
      <div className="page-container">
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

