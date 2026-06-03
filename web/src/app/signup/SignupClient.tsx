"use client";
import React, { useState } from "react";
import Link from "next/link";
import { HeaderBrandLogo } from "@/components/layout/header.client";
import { Button } from "@/components/ui";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ComponentType } from "react";
import { SignupBirthDatePicker } from "@/components/signup/SignupBirthDatePicker";

const supabase = createSupabaseBrowserClient();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type InstructorFormData = {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string;
  password: string;
  nationalId: string;
  reference: string;
  acceptTerms: boolean;
};

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

function SignupPasswordToggle({
  showPassword,
  onToggle,
}: {
  showPassword: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="auth-input-icon"
      onClick={onToggle}
      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
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
  );
}

export default function SignupClient() {
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
  const [isInstructorSubmitting, setIsInstructorSubmitting] = useState(false);
  const [instructorFormData, setInstructorFormData] = useState<InstructorFormData>({
    firstName: "",
    lastName: "",
    email: "",
    birthDate: "",
    password: "",
    nationalId: "",
    reference: "",
    acceptTerms: false,
  });
  const [instructorErrors, setInstructorErrors] = useState<Partial<Record<keyof InstructorFormData, string>>>(
    {},
  );
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

      const { error } = await supabase.auth.signUp({
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

  const clearInstructorError = (field: keyof InstructorFormData) => {
    setInstructorErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleInstructorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setInstructorFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    clearInstructorError(name as keyof InstructorFormData);
  };

  const handleInstructorNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    setInstructorFormData((prev) => ({
      ...prev,
      nationalId: digits,
    }));
    clearInstructorError("nationalId");
  };

  const validateInstructorForm = (): Partial<Record<keyof InstructorFormData, string>> => {
    const errors: Partial<Record<keyof InstructorFormData, string>> = {};
    const firstName = instructorFormData.firstName.trim();
    const lastName = instructorFormData.lastName.trim();
    const email = instructorFormData.email.trim();
    const password = instructorFormData.password;
    const nationalId = instructorFormData.nationalId.trim();

    if (!firstName) errors.firstName = "Ad alanı zorunludur.";
    if (!lastName) errors.lastName = "Soyad alanı zorunludur.";

    if (!instructorFormData.birthDate) {
      errors.birthDate = "Doğum tarihinizi girmeden devam edemezsiniz.";
    }

    if (!email) {
      errors.email = "E-posta adresi zorunludur.";
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Geçerli bir e-posta adresi girin.";
    }

    if (!password) {
      errors.password = "Şifre zorunludur.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
    }

    if (!nationalId) {
      errors.nationalId = "TC kimlik numarası zorunludur.";
    } else if (nationalId.length !== 11) {
      errors.nationalId = "TC kimlik numarası 11 haneli olmalıdır.";
    } else if (nationalId.startsWith("0")) {
      errors.nationalId = "TC kimlik numarası 0 ile başlayamaz.";
    }

    return errors;
  };

  const handleInstructorSubmit = async () => {
    if (!instructorFormData.acceptTerms) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Devam etmek için koşulları kabul etmelisiniz.",
      });
      return;
    }

    const errors = validateInstructorForm();
    if (Object.keys(errors).length > 0) {
      setInstructorErrors(errors);
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik veya hatalı bilgi",
        message: "Lütfen bireysel eğitmen alanındaki zorunlu alanları kontrol edin.",
      });
      return;
    }

    setInstructorErrors({});

    const firstName = instructorFormData.firstName.trim();
    const lastName = instructorFormData.lastName.trim();
    const email = instructorFormData.email.trim();
    const password = instructorFormData.password;

    setIsInstructorSubmitting(true);

    try {
      const { data: emailExists, error: emailCheckError } = await supabase.rpc(
        "check_email_exists",
        { p_email: email.toLowerCase() },
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
        setIsInstructorSubmitting(false);
        return;
      }

      const metadata = {
        user_type: "instructor",
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        birth_date: instructorFormData.birthDate,
        tc_identity_no: instructorFormData.nationalId,
        reference: instructorFormData.reference.trim() || null,
      };

      const { error } = await supabase.auth.signUp({
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
          message: "Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.",
        });
        setIsInstructorSubmitting(false);
        return;
      }

      setModalState({
        isOpen: true,
        type: "success",
        title: "Kayıt başarılı",
        message:
          "Bireysel eğitmen hesabınız oluşturuldu. Lütfen e-postanızı onayladıktan sonra giriş yapın.",
      });
      setIsInstructorSubmitting(false);
    } catch (err) {
      console.error("INSTRUCTOR SIGNUP ERROR:", err);
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.",
      });
      setIsInstructorSubmitting(false);
    }
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
                  <SignupBirthDatePicker
                    id="signup-birthdate"
                    value={formData.birthDate}
                    onChange={(iso) =>
                      setFormData((prev) => ({
                        ...prev,
                        birthDate: iso,
                      }))
                    }
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-password" className="signup-label">
                    Şifre
                  </label>
                  <div className="auth-input-with-icon">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="signup-password"
                      name="password"
                      className="signup-input"
                      style={{ paddingRight: 44 }}
                      placeholder="En az 8 karakter"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                    <SignupPasswordToggle
                      showPassword={showPassword}
                      onToggle={() => setShowPassword((prev) => !prev)}
                    />
                  </div>
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
                  <div className="auth-input-with-icon">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="signup-password-kurumsal"
                      name="password"
                      className="signup-input"
                      style={{ paddingRight: 44 }}
                      placeholder="En az 8 karakter"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                    <SignupPasswordToggle
                      showPassword={showPassword}
                      onToggle={() => setShowPassword((prev) => !prev)}
                    />
                  </div>
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

            {activeTab === "bireysel" ? (
              <>
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
                    </Link>{" "}
                    kabul etmiş olursunuz.
                  </span>
                </label>

                <button type="submit" className="signup-primary-button" disabled={loading}>
                  {loading ? "Hesabınız oluşturuluyor..." : "Hesap Oluştur"}
                </button>
              </>
            ) : (
              <>
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
                    </Link>{" "}
                    kabul etmiş olursunuz.
                  </span>
                </label>

                <button type="submit" className="signup-primary-button" disabled={loading}>
                  {loading ? "Hesabınız oluşturuluyor..." : "Hesap Oluştur"}
                </button>
              </>
            )}
          </form>

          {activeTab === "kurumsal" ? (
            <section
              className="signup-instructor-section"
              aria-labelledby="signup-instructor-heading"
            >
                  <h2 id="signup-instructor-heading" className="signup-instructor-heading">
                    Bireysel Eğitmen misiniz?
                  </h2>
                  <p className="signup-instructor-description">
                    Kurum hesabı yerine bireysel eğitmen hesabı oluşturmak için aşağıdaki bilgileri
                    doldurun.
                  </p>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-firstname" className="signup-label">
                      Ad
                    </label>
                    <input
                      type="text"
                      id="signup-instructor-firstname"
                      name="firstName"
                      className={`signup-input${instructorErrors.firstName ? " signup-input--error" : ""}`}
                      placeholder="Adınızı girin"
                      value={instructorFormData.firstName}
                      onChange={handleInstructorChange}
                      autoComplete="given-name"
                    />
                    {instructorErrors.firstName ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.firstName}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-lastname" className="signup-label">
                      Soyad
                    </label>
                    <input
                      type="text"
                      id="signup-instructor-lastname"
                      name="lastName"
                      className={`signup-input${instructorErrors.lastName ? " signup-input--error" : ""}`}
                      placeholder="Soyadınızı girin"
                      value={instructorFormData.lastName}
                      onChange={handleInstructorChange}
                      autoComplete="family-name"
                    />
                    {instructorErrors.lastName ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.lastName}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-email" className="signup-label">
                      E-posta
                    </label>
                    <input
                      type="email"
                      id="signup-instructor-email"
                      name="email"
                      className={`signup-input${instructorErrors.email ? " signup-input--error" : ""}`}
                      placeholder="egitmen@adresiniz.com"
                      value={instructorFormData.email}
                      onChange={handleInstructorChange}
                      autoComplete="email"
                    />
                    {instructorErrors.email ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.email}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-birthdate" className="signup-label">
                      Doğum Tarihi
                    </label>
                    <SignupBirthDatePicker
                      id="signup-instructor-birthdate"
                      value={instructorFormData.birthDate}
                      onChange={(iso) => {
                        setInstructorFormData((prev) => ({
                          ...prev,
                          birthDate: iso,
                        }));
                        clearInstructorError("birthDate");
                      }}
                    />
                    {instructorErrors.birthDate ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.birthDate}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-password" className="signup-label">
                      Şifre
                    </label>
                    <div className="auth-input-with-icon">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="signup-instructor-password"
                        name="password"
                        className={`signup-input${instructorErrors.password ? " signup-input--error" : ""}`}
                        style={{ paddingRight: 44 }}
                        placeholder="En az 8 karakter"
                        value={instructorFormData.password}
                        onChange={handleInstructorChange}
                        autoComplete="new-password"
                      />
                      <SignupPasswordToggle
                        showPassword={showPassword}
                        onToggle={() => setShowPassword((prev) => !prev)}
                      />
                    </div>
                    {instructorErrors.password ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.password}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-national-id" className="signup-label">
                      TC Kimlik No
                    </label>
                    <input
                      type="text"
                      id="signup-instructor-national-id"
                      name="nationalId"
                      className={`signup-input${instructorErrors.nationalId ? " signup-input--error" : ""}`}
                      placeholder="TC kimlik numaranızı girin"
                      value={instructorFormData.nationalId}
                      onChange={handleInstructorNationalIdChange}
                      inputMode="numeric"
                      maxLength={11}
                      autoComplete="off"
                    />
                    {instructorErrors.nationalId ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.nationalId}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-reference" className="signup-label">
                      Referansınız
                    </label>
                    <input
                      type="text"
                      id="signup-instructor-reference"
                      name="reference"
                      className="signup-input"
                      placeholder="Referans kişi veya kurumu yazın"
                      value={instructorFormData.reference}
                      onChange={handleInstructorChange}
                    />
                  </div>

                  <label className="signup-checkbox">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      checked={instructorFormData.acceptTerms}
                      onChange={handleInstructorChange}
                    />
                    <span>
                      Kayıt olarak{" "}
                      <Link href="/terms" className="signup-link-inline">
                        Kullanım Koşullarımızı
                      </Link>{" "}
                      ve{" "}
                      <Link href="/privacy" className="signup-link-inline">
                        Gizlilik Politikamızı
                      </Link>{" "}
                      kabul etmiş olursunuz.
                    </span>
                  </label>

              <button
                type="button"
                className="signup-primary-button"
                onClick={handleInstructorSubmit}
                disabled={isInstructorSubmitting}
              >
                {isInstructorSubmitting ? "Hesabınız oluşturuluyor..." : "Bireysel Eğitmen Hesabı Oluştur"}
              </button>
            </section>
          ) : null}

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

