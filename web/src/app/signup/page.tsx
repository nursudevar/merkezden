"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import Footer from "@/components/layout/Footer";
import AuthModal from "@/components/AuthModal";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";



export default function SignupPage() {

  const router = useRouter(); 


  const [activeTab, setActiveTab] = useState<"bireysel" | "kurumsal">("bireysel");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    // Bireysel fields
    firstName: "",
    lastName: "",
    birthDate: "",
    // Kurumsal fields
    companyName: "",
    reference: "",
    // Common fields
    email: "",
    password: "",
    acceptTerms: false,
  });

  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "email-exists";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    // 1) Checkbox Control
    if (!formData.acceptTerms) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Devam etmek için koşulları kabul etmelisiniz.",
      });
      return;
    }
  
    // 2) Password length validation
    const MIN_PASSWORD_LENGTH = 8;
    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik şifre",
        message: `Şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`,
      });
      return;
    }
  
    // 3) Birth date validation (only for individual users)
    if (activeTab === "bireysel" && !formData.birthDate) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik bilgi",
        message: "Doğum tarihinizi girmeden devam edemezsiniz.",
      });
      return;
    }
  
    setLoading(true);
  
    const { email, password, firstName, lastName, companyName, reference, birthDate } = formData;
    const userType = activeTab === "bireysel" ? "individual" : "institution";
  
    try {
      // 4) ÖNCE AUTH.USERS ÜZERİNDEN EMAIL VAR MI DİYE RPC İLE KONTROL ET
      const { data: emailExists, error: emailCheckError } = await supabase.rpc(
        "check_email_exists",
        { p_email: email.trim().toLowerCase() }
      );
  
      if (emailCheckError) {
        console.error("EMAIL CHECK ERROR:", emailCheckError);
        // Burada "Hata oluştu" modali gösterebiliriz, ama email-exists dememeliyiz
      }
  
      if (emailExists === true) {
        // Bu email zaten auth.users içinde var → signup çağırma, direkt uyar
        setModalState({
          isOpen: true,
          type: "email-exists",
          title: "Hesabınız zaten mevcut",
          message: "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.",
        });
        setLoading(false);
        return;
      }
  
      // 5) Email sistemde yoksa, normal signup akışına devam et
      const metadata: Record<string, any> = {
        user_type: userType,
        company_name: companyName || null,
        reference: reference || null,
      };
  
      if (activeTab === "bireysel") {
        metadata.first_name = firstName;
        metadata.last_name = lastName;
        metadata.full_name = `${firstName} ${lastName}`.trim();
        metadata.birth_date = birthDate;
      } else {
        metadata.full_name = companyName;
      }
  
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });
  
      console.log("SIGNUP DATA:", data);
      console.log("SIGNUP ERROR:", JSON.stringify(error, null, 2));
  
      // 6) signUp SONRASI HATA VARSA → GENEL HATA MODALİ
      if (error) {
        setModalState({
          isOpen: true,
          type: "error",
          title: "Kayıt başarısız",
          message: error.message || "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.",
        });
        setLoading(false);
        return;
      }
  
      // 7) HİÇ HATA YOKSA: BAŞARILI KAYIT
      setModalState({
        isOpen: true,
        type: "success",
        title: "Kayıt başarılı",
        message:
          "Hesap onay maili e-posta adresinize iletilmiştir. Lütfen mail kutunuzu kontrol edin.",
      });
      setLoading(false);
    } catch (err) {
      console.error("UNEXPECTED SIGNUP ERROR:", err);
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
      });
      setLoading(false);
    }
  };
  
  
  

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };


  // Google Signup
  const handleGoogleSignup = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });

    if (error) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: error.message || "Google ile giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.",
      });
      return;
    }

    console.log("Google OAuth start:", data);
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
              <Button className="button-primary btn-gradient-primary" variant="default">
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
                  <label htmlFor="signup-firstname" className="signup-label">
                    Ad
                  </label>
                  <input
                    type="text"
                    id="signup-firstname"
                    name="firstName"
                    className="signup-input"
                    placeholder="Adınızı girin"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-lastname" className="signup-label">
                    Soyad
                  </label>
                  <input
                    type="text"
                    id="signup-lastname"
                    name="lastName"
                    className="signup-input"
                    placeholder="Soyadınızı girin"
                    value={formData.lastName}
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
                  <label htmlFor="signup-birthdate" className="signup-label">
                    Doğum Tarihi
                  </label>
                  <input
                    type="date"
                    id="signup-birthdate"
                    name="birthDate"
                    className="signup-input"
                    value={formData.birthDate}
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

            <button type="submit" className="signup-primary-button" disabled={loading}>
              {loading ? "Hesabınız oluşturuluyor..." : "Hesap Oluştur"}
            </button>
          </form>

          <div className="signup-divider">
            <span>veya şunlarla devam et</span>
          </div>

          <div className="signup-social-buttons">
            <button type="button" className="signup-social-button signup-social-google" onClick={handleGoogleSignup}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            <button type="button" className="signup-social-button signup-social-apple" onClick={() => alert("Apple ile giriş yakında eklenecek 😊")}>
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

      <AuthModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        primaryButtonText={
          modalState.type === "success"
            ? "Giriş yap"
            : modalState.type === "email-exists"
            ? "Giriş yap"
            : "Tamam"
        }
        primaryButtonAction={() => {
          if (modalState.type === "success" || modalState.type === "email-exists") {
            router.push("/login");
          }
        }}
        secondaryButtonText={
          modalState.type === "success" || modalState.type === "email-exists"
            ? "Kapat"
            : undefined
        }
        secondaryButtonAction={undefined}
      />
    </div>
  );
}
