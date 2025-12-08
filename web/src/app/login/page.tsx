"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Login logic will be added later
  };

  return (
    <div className="page-container">
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className="header-brand">
            <Link href="/" className="header-title-link">
              <span className="header-title">MERKEZDEN.COM</span>
            </Link>
            <span className="header-subtitle">HAYATIN MERKEZİ</span>
          </div>
          <div className="header-actions">
            <Link href="/login">
              <Button className="button-primary" variant="default">
                GİRİŞ YAP
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="auth-content-wrapper">
        <div className="auth-main-container">
        <div className="auth-layout">
          <div className="auth-visual">
            <div className="auth-orbit">
              <div className="auth-orbit-circle auth-orbit-circle-outer" />
              <div className="auth-orbit-circle auth-orbit-circle-inner" />
              <div className="auth-orbit-track auth-orbit-track-outer">
                <span className="auth-orbit-dot" />
              </div>
              <div className="auth-orbit-track auth-orbit-track-inner">
                <span className="auth-orbit-dot" />
              </div>
            </div>
          </div>

          <div className="auth-form-panel">
            <div className="auth-card">
            <h1 className="auth-title">Giriş Yapın</h1>
            <p className="auth-subtitle">
              Hesabınıza giriş yaparak öğrenme yolculuğunuza kaldığınız yerden devam edin.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="login-email" className="auth-label">
                  E-posta
                </label>
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  className="auth-input"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="login-password" className="auth-label">
                  Şifre
                </label>
                <div className="auth-input-with-icon">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="login-password"
                    name="password"
                    className="auth-input"
                    placeholder="Şifrenizi girin"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-input-icon"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                        <path d="M2 2l20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="auth-row-between">
                <label className="auth-checkbox">
                  <input type="checkbox" />
                  <span>Beni hatırla</span>
                </label>
                <button type="button" className="auth-link auth-link-small">
                  Şifrenizi mi unuttunuz?
                </button>
              </div>

              <button type="submit" className="auth-primary-button">
                Giriş Yap
              </button>
            </form>

            <div className="auth-divider">
              <span>Veya şununla devam et</span>
            </div>

            <div className="auth-social-row">
              <button type="button" className="auth-social-button auth-social-google">
                <span className="auth-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </span>
                <span>Google</span>
              </button>
              <button type="button" className="auth-social-button auth-social-apple">
                <span className="auth-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </span>
                <span>Apple</span>
              </button>
            </div>

            <p className="auth-bottom-text">
              Hesabınız yoksa{" "}
              <Link href="/signup" className="auth-link">
                üye olun
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

