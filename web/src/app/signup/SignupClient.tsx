"use client";
import React, { useState } from "react";
import Link from "next/link";
import { HeaderBrandLogo } from "@/components/layout/header.client";
import { Button } from "@/components/ui";
import Footer from "@/components/layout/Footer";
import AuthModal from "@/components/AuthModal";
import {
  ClipboardList,
  FileText,
  Grid2x2,
  ImagePlus,
  MapPinned,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ComponentType } from "react";

const supabase = createSupabaseBrowserClient();

type SignupFeatureItem = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const INDIVIDUAL_FEATURES: SignupFeatureItem[] = [
  {
    title: "Haritada Ara",
    description: "Konumunuza uygun kurumları harita üzerinden bulun.",
    icon: MapPinned,
  },
  {
    title: "Kritere Gore Listeleme",
    description: "Kriterlerinize gore hizli ve detayli filtreleme yapin.",
    icon: ClipboardList,
  },
  {
    title: "Akilli Asistan",
    description: "AI destekli oneriler ile dogru kurumlari kesfedin.",
    icon: Sparkles,
  },
  {
    title: "Karsilastirma Tablosu",
    description: "Kurumlari yan yana karsilastirin.",
    icon: Grid2x2,
  },
];

const CORPORATE_FEATURES: SignupFeatureItem[] = [
  {
    title: "Detayli Kurum Sayfasi",
    description: "Kurumunuzu detayli tanitin.",
    icon: FileText,
  },
  {
    title: "Fotograf / Video Ekleme",
    description: "Kurumunuza ait fotograf ve videolar ekleyin.",
    icon: ImagePlus,
  },
  {
    title: "SEO Avantajlari",
    description: "Merkezden.com sayesinde Google gorunurlugunuzu artirin.",
    icon: Search,
  },
  {
    title: "Duyuru / Etkinlik Paylasma",
    description: "Duyuru ve etkinliklerinizi yayinlayin.",
    icon: Megaphone,
  },
];

function SignupFeatureCard({
  item,
  accent,
}: {
  item: SignupFeatureItem;
  accent: "purple" | "orange";
}) {
  const Icon = item.icon;

  return (
    <article className={`signup-feature-card signup-feature-card--${accent}`}>
      <span className={`signup-feature-icon-wrap signup-feature-icon-wrap--${accent}`} aria-hidden>
        <Icon className="signup-feature-icon" />
      </span>
      <h3 className="signup-feature-title">{item.title}</h3>
      <p className="signup-feature-description">{item.description}</p>
    </article>
  );
}

export default function SignupClient() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"bireysel" | "kurumsal">("bireysel");
  const isIndividualTab = activeTab === "bireysel";
  const activeFeatures = isIndividualTab ? INDIVIDUAL_FEATURES : CORPORATE_FEATURES;
  const activeFeatureAccent: "purple" | "orange" = isIndividualTab ? "purple" : "orange";
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    companyName: "",
    reference: "",
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

    if (!formData.acceptTerms) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Devam etmek için koşulları kabul etmelisiniz.",
      });
      return;
    }

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
    const selectedTab = activeTab;
    const userType: "individual" | "institution" =
      selectedTab === "bireysel" ? "individual" : "institution";

    try {
      const { data: emailExists, error: emailCheckError } = await supabase.rpc(
        "check_email_exists",
        { p_email: email.trim().toLowerCase() }
      );

      if (emailCheckError) {
      }

      if (emailExists === true) {
        setModalState({
          isOpen: true,
          type: "email-exists",
          title: "Hesabınız zaten mevcut",
          message: "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.",
        });
        setLoading(false);
        return;
      }

      const metadata: Record<string, any> = {
        user_type: userType,
        company_name: companyName || null,
        institution_name: userType === "institution" ? (companyName || null) : null,
        reference: reference || null,
      };

      if (selectedTab === "bireysel") {
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

  return (
    <div className="page-container">
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className="header-top-row navbar signup-header-row">
            <div className="header-brand">
              <HeaderBrandLogo />
            </div>
            <div className="header-actions signup-header-actions">
              <Link href="/login">
                <Button className="button-primary btn-gradient-primary" variant="default">
                  GİRİŞ YAP
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="auth-content-wrapper">
        <div className="signup-layout signup-layout--with-features">
          <aside className="signup-feature-column signup-feature-column--left">
            {activeFeatures.slice(0, 2).map((item) => (
              <SignupFeatureCard key={item.title} item={item} accent={activeFeatureAccent} />
            ))}
          </aside>

          <div className="signup-form-center">
            <div className="signup-card">
          <h1 className="signup-title">Hesap Oluşturun</h1>

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
            <div className="signup-tab-content" key={activeTab}>
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
            </div>

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

          <p className="signup-bottom-text">
            Zaten bir hesabınız var mı?{" "}
            <Link href="/login" className="signup-link">
              Giriş Yapın
            </Link>
          </p>
            </div>
          </div>

          <aside className="signup-feature-column signup-feature-column--right">
            {activeFeatures.slice(2).map((item) => (
              <SignupFeatureCard key={item.title} item={item} accent={activeFeatureAccent} />
            ))}
          </aside>
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
            window.location.href = "/";
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

