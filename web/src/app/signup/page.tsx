"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import Footer from "@/components/layout/Footer";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";

export default function SignupPage() {
  const [activeTab, setActiveTab] = useState<"bireysel" | "kurumsal">("bireysel");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    // Bireysel fields
    fullName: "",
    // Kurumsal fields
    companyName: "",
    reference: "",
    // Common fields
    email: "",
    password: "",
    acceptTerms: false,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Signup logic will be added later
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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
        <div className="signup-card">
          <h1 className="signup-title">Hesap Oluşturun</h1>
          <p className="signup-subtitle">
            Aramıza katılın ve öğrenme yolculuğunuza başlayın.
          </p>

          <div className="signup-tabs">
            <button
              type="button"
              className={`signup-tab ${activeTab === "bireysel" ? "signup-tab-active" : ""}`}
              onClick={() => setActiveTab("bireysel")}
            >
              Bireysel
            </button>
            <button
              type="button"
              className={`signup-tab ${activeTab === "kurumsal" ? "signup-tab-active" : ""}`}
              onClick={() => setActiveTab("kurumsal")}
            >
              Kurumsal
            </button>
          </div>

          <form className="signup-form" onSubmit={handleSubmit}>
            {activeTab === "bireysel" ? (
              <>
                <div className="signup-field">
                  <label htmlFor="signup-fullname" className="signup-label">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    id="signup-fullname"
                    name="fullName"
                    className="signup-input"
                    placeholder="Adınızı ve soyadınızı girin"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-email" className="signup-label">
                    E-posta Adresi
                  </label>
                  <input
                    type="email"
                    id="signup-email"
                    name="email"
                    className="signup-input"
                    placeholder="eposta@adresiniz.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-password" className="signup-label">
                    Şifre
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="signup-password"
                    name="password"
                    className="signup-input"
                    placeholder="En az 8 karakter"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="signup-field">
                  <label htmlFor="signup-company" className="signup-label">
                    Kurum Adınız
                  </label>
                  <input
                    type="text"
                    id="signup-company"
                    name="companyName"
                    className="signup-input"
                    placeholder="Kurum adını girin"
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-email-kurumsal" className="signup-label">
                    E-posta Adresi
                  </label>
                  <input
                    type="email"
                    id="signup-email-kurumsal"
                    name="email"
                    className="signup-input"
                    placeholder="kurum@adresiniz.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-password-kurumsal" className="signup-label">
                    Şifre
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="signup-password-kurumsal"
                    name="password"
                    className="signup-input"
                    placeholder="En az 8 karakter"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-reference" className="signup-label">
                    Referansınız
                  </label>
                  <input
                    type="text"
                    id="signup-reference"
                    name="reference"
                    className="signup-input"
                    placeholder="Referans kişiyi veya kurumu yazın"
                    value={formData.reference}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <label className="signup-checkbox">
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleChange}
                required
              />
              <span>
                Kayıt olarak{" "}
                <Link href="/terms" className="signup-link-inline">
                  Kullanım Koşullarımızı
                </Link>{" "}
                ve{" "}
                <Link href="/privacy" className="signup-link-inline">
                  Gizlilik Politikamızı
                </Link>
                {" "}kabul etmiş olursunuz.
              </span>
            </label>

            <button type="submit" className="signup-primary-button">
              Hesap Oluştur
            </button>
          </form>

          <div className="signup-divider">
            <span>veya şunlarla devam et</span>
          </div>

          <div className="signup-social-buttons">
            <button type="button" className="signup-social-button signup-social-google">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            <button type="button" className="signup-social-button signup-social-apple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </button>
          </div>

          <p className="signup-bottom-text">
            Zaten bir hesabınız var mı?{" "}
            <Link href="/login" className="signup-link">
              Giriş Yapın
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}
