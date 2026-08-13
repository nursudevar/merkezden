"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { HeaderBrandLogo } from "@/components/layout/header.client";
import { Button } from "@/components/ui";
import AuthModal from "@/components/AuthModal";
import {
  CORPORATE_SIGNUP_FEATURES,
  INDIVIDUAL_SIGNUP_FEATURES,
  INSTRUCTOR_SIGNUP_FEATURES,
  type SignupFeatureItem,
} from "@/lib/signupFeatureCards";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthErrorMessageTr } from "@/lib/auth/authBrowserClient";
import { SignupBirthDatePicker } from "@/components/signup/SignupBirthDatePicker";
import { SignupCategorySelect } from "@/components/signup/SignupCategorySelect";

const supabase = createSupabaseBrowserClient();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const APPROVAL_SIGNUP_SUCCESS_MESSAGE =
  "Kayıt başvurunuz alınmıştır. E-posta doğrulamasından sonra hesabınız oluşturulacak, admin onayı sonrası platformda görünür hale gelecektir.";
const INDIVIDUAL_PHONE_PLACEHOLDER = "Üyelik Doğrulama Kodu için gereklidir";

type SignupCategoryOption = {
  id: number;
  name: string;
};

type InstructorFormData = {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string;
  password: string;
  /** TC (11) veya Vergi Kimlik (10) — DB: instructors.identity_or_tax_number */
  nationalId: string;
  reference: string;
  categoryId: string;
  acceptTerms: boolean;
};

type SignupTab = "individual" | "institution" | "instructor";

type IndividualSignupFormData = {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  /** Görüntü: `+90 555 123 45 67` — DB: `normalizeTurkishMobilePhone` */
  phone: string;
  password: string;
  reference: string;
  acceptTerms: boolean;
};

type InstitutionSignupFormData = {
  companyName: string;
  categoryId: string;
  taxNumber: string;
  reference: string;
  email: string;
  password: string;
  acceptTerms: boolean;
};

/** Paste/yazım girdilerinden TR ulusal 10 haneyi çıkarır (ülke kodu / baştaki 0 temizlenir). */
function extractTurkishMobileNationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Yazarken gösterim: `+90 555 123 45 67` */
function formatTurkishMobileDisplay(raw: string): string {
  const national = extractTurkishMobileNationalDigits(raw);
  if (!national) return "+90";
  const parts = [
    national.slice(0, 3),
    national.slice(3, 6),
    national.slice(6, 8),
    national.slice(8, 10),
  ].filter((part) => part.length > 0);
  return `+90 ${parts.join(" ")}`;
}

/** DB değeri: `+905551234567` — eksik/geçersizse null */
function normalizeTurkishMobilePhone(raw: string): string | null {
  const national = extractTurkishMobileNationalDigits(raw);
  if (national.length !== 10 || !national.startsWith("5")) return null;
  return `+90${national}`;
}

function isValidTurkishMobilePhone(raw: string): boolean {
  return normalizeTurkishMobilePhone(raw) !== null;
}

function digitsOnlyMax(value: string, maxLen: number): string {
  return value.replace(/\D/g, "").slice(0, maxLen);
}

function isValidInstitutionTaxNumber(value: string): boolean {
  return /^\d{10}$/.test(value.trim());
}

function isValidInstructorIdentityOrTaxNumber(value: string): boolean {
  return /^\d{10}$/.test(value.trim()) || /^\d{11}$/.test(value.trim());
}

function SignupFeatureCard({
  item,
  accent,
}: {
  item: SignupFeatureItem;
  accent: "purple" | "orange" | "navy";
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
  const [activeTab, setActiveTab] = useState<SignupTab>("individual");
  const activeFeatures =
    activeTab === "individual"
      ? INDIVIDUAL_SIGNUP_FEATURES
      : activeTab === "instructor"
        ? INSTRUCTOR_SIGNUP_FEATURES
        : CORPORATE_SIGNUP_FEATURES;
  const activeFeatureAccent: "purple" | "orange" | "navy" =
    activeTab === "individual" ? "navy" : activeTab === "instructor" ? "purple" : "orange";
  const isIndividualTab = activeTab === "individual";
  const [showPassword, setShowPassword] = useState(false);
  const [individualFormData, setIndividualFormData] = useState<IndividualSignupFormData>({
    firstName: "",
    lastName: "",
    birthDate: "",
    email: "",
    phone: "+90",
    password: "",
    reference: "",
    acceptTerms: false,
  });
  const [institutionFormData, setInstitutionFormData] = useState<InstitutionSignupFormData>({
    companyName: "",
    categoryId: "",
    taxNumber: "",
    reference: "",
    email: "",
    password: "",
    acceptTerms: false,
  });
  const [institutionCategories, setInstitutionCategories] = useState<SignupCategoryOption[]>([]);
  const [institutionCategoriesLoading, setInstitutionCategoriesLoading] = useState(false);
  const [institutionCategoriesError, setInstitutionCategoriesError] = useState<string | null>(null);
  const [institutionErrors, setInstitutionErrors] = useState<
    Partial<Record<keyof InstitutionSignupFormData, string>>
  >({});

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
    categoryId: "",
    acceptTerms: false,
  });
  const [instructorCategories, setInstructorCategories] = useState<SignupCategoryOption[]>([]);
  const [instructorCategoriesLoading, setInstructorCategoriesLoading] = useState(false);
  const [instructorCategoriesError, setInstructorCategoriesError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    setInstitutionCategoriesLoading(true);
    setInstitutionCategoriesError(null);

    void (async () => {
      const { data, error } = await supabase
        .from("institution_categories")
        .select("id, name, slug, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        setInstitutionCategories([]);
        setInstitutionCategoriesError("Kategoriler yüklenirken bir hata oluştu.");
        setInstitutionCategoriesLoading(false);
        return;
      }

      const rows =
        (data as Array<{ id: number; name: string | null }> | null)?.map((row) => ({
          id: row.id,
          name: (row.name ?? "").trim(),
        })) ?? [];

      setInstitutionCategories(rows.filter((row) => row.name.length > 0));
      setInstitutionCategoriesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInstructorCategoriesLoading(true);
    setInstructorCategoriesError(null);

    void (async () => {
      const { data, error } = await supabase
        .from("instructor_categories")
        .select("id, name, slug, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        setInstructorCategories([]);
        setInstructorCategoriesError("Kategoriler yüklenirken bir hata oluştu.");
        setInstructorCategoriesLoading(false);
        return;
      }

      const rows =
        (data as Array<{ id: number; name: string | null }> | null)?.map((row) => ({
          id: row.id,
          name: (row.name ?? "").trim(),
        })) ?? [];

      setInstructorCategories(rows.filter((row) => row.name.length > 0));
      setInstructorCategoriesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const selectedTab = activeTab;
    if (selectedTab === "instructor") return;

    const activeFormData =
      selectedTab === "individual" ? individualFormData : institutionFormData;

    if (!activeFormData.acceptTerms) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Devam etmek için koşulları kabul etmelisiniz.",
      });
      return;
    }

    if (activeFormData.password.length < MIN_PASSWORD_LENGTH) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik şifre",
        message: `Şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`,
      });
      return;
    }

    if (selectedTab === "individual" && !individualFormData.birthDate) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik bilgi",
        message: "Doğum tarihinizi girmeden devam edemezsiniz.",
      });
      return;
    }

    const normalizedIndividualPhone =
      selectedTab === "individual"
        ? normalizeTurkishMobilePhone(individualFormData.phone)
        : null;

    if (selectedTab === "individual" && !normalizedIndividualPhone) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik bilgi",
        message: "Geçerli bir cep telefonu numarası girmeden devam edemezsiniz.",
      });
      return;
    }

    if (selectedTab === "institution") {
      const parsedCategoryId = Number(institutionFormData.categoryId.trim());
      const taxNumber = institutionFormData.taxNumber.trim();
      const nextInstitutionErrors: Partial<Record<keyof InstitutionSignupFormData, string>> = {};

      if (!Number.isFinite(parsedCategoryId) || parsedCategoryId <= 0) {
        nextInstitutionErrors.categoryId = "Lütfen bir kategori seçin.";
      }
      if (!isValidInstitutionTaxNumber(taxNumber)) {
        nextInstitutionErrors.taxNumber = "Vergi kimlik numarası 10 haneli olmalıdır.";
      }

      if (Object.keys(nextInstitutionErrors).length > 0) {
        setInstitutionErrors(nextInstitutionErrors);
        setModalState({
          isOpen: true,
          type: "error",
          title: "Eksik bilgi",
          message: nextInstitutionErrors.taxNumber
            ? nextInstitutionErrors.taxNumber
            : "Devam etmek için bir kategori seçmelisiniz.",
        });
        return;
      }
      setInstitutionErrors({});
    }

    setLoading(true);

    const { email, password } = activeFormData;
    const userType: "individual" | "institution" =
      selectedTab === "individual" ? "individual" : "institution";
    const companyName =
      selectedTab === "institution" ? institutionFormData.companyName : "";
    const reference =
      selectedTab === "individual"
        ? individualFormData.reference.trim()
        : selectedTab === "institution"
          ? institutionFormData.reference.trim()
          : "";

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

      const metadata: Record<string, string | number | null> = {
        user_type: userType,
        company_name: companyName || null,
        institution_name: userType === "institution" ? (companyName || null) : null,
        reference: reference || null,
      };

      if (selectedTab === "individual") {
        metadata.first_name = individualFormData.firstName;
        metadata.last_name = individualFormData.lastName;
        metadata.full_name = `${individualFormData.firstName} ${individualFormData.lastName}`.trim();
        metadata.birth_date = individualFormData.birthDate;
        metadata.phone = normalizedIndividualPhone;
      } else {
        metadata.full_name = companyName;
        metadata.category_id = Number(institutionFormData.categoryId.trim());
        metadata.tax_number = institutionFormData.taxNumber.trim();
        metadata.is_approved = null;
        metadata.approved_by = null;
        metadata.approved_at = null;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
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
          message: getAuthErrorMessageTr(
            error,
            "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.",
          ),
        });
        setLoading(false);
        return;
      }

      // Bireysel: trigger/metadata + varsa doğrudan individual_profiles.phone / reference
      if (selectedTab === "individual" && normalizedIndividualPhone && signUpData.user?.id) {
        const { data: userRow } = await supabase
          .from("users")
          .select("id")
          .eq("auth_user_id", signUpData.user.id)
          .maybeSingle();

        if (userRow?.id) {
          const { error: phoneUpdateError } = await supabase
            .from("individual_profiles")
            .update({
              phone: normalizedIndividualPhone,
              reference: individualFormData.reference.trim() || null,
            })
            .eq("user_id", userRow.id);

          if (phoneUpdateError) {
            console.warn(
              "[SignupClient] individual_profiles.phone update",
              phoneUpdateError,
            );
          }
        }
      }

      // Kurum: metadata (trigger) + varsa doğrudan institutions.tax_number / reference
      if (selectedTab === "institution" && signUpData.user?.id) {
        const { error: taxUpdateError } = await supabase
          .from("institutions")
          .update({
            tax_number: institutionFormData.taxNumber.trim(),
            reference: institutionFormData.reference.trim() || null,
          })
          .eq("owner_auth_id", signUpData.user.id);

        if (taxUpdateError) {
          console.warn("[SignupClient] institutions.tax_number update", taxUpdateError);
        }
      }

      setModalState({
        isOpen: true,
        type: "success",
        title: "Kayıt başarılı",
        message:
          selectedTab === "institution"
            ? APPROVAL_SIGNUP_SUCCESS_MESSAGE
            : "Hesap onay maili e-posta adresinize iletilmiştir. Lütfen mail kutunuzu kontrol edin.",
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
    const { name, value, type } = e.target;
    const nextValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    if (activeTab === "individual") {
      setIndividualFormData((prev) => ({
        ...prev,
        [name]: nextValue,
      }));
      return;
    }

    if (activeTab === "institution") {
      setInstitutionFormData((prev) => ({
        ...prev,
        [name]: nextValue,
      }));
    }
  };

  const handleIndividualPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIndividualFormData((prev) => ({
      ...prev,
      phone: formatTurkishMobileDisplay(e.target.value),
    }));
  };

  const handleIndividualPhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setIndividualFormData((prev) => ({
      ...prev,
      phone: formatTurkishMobileDisplay(pasted),
    }));
  };

  const handleInstitutionCategoryChange = (categoryId: string) => {
    setInstitutionFormData((prev) => ({ ...prev, categoryId }));
    setInstitutionErrors((prev) => {
      if (!prev.categoryId) return prev;
      const next = { ...prev };
      delete next.categoryId;
      return next;
    });
  };

  const handleInstitutionTaxNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = digitsOnlyMax(e.target.value, 10);
    setInstitutionFormData((prev) => ({ ...prev, taxNumber: digits }));
    setInstitutionErrors((prev) => {
      if (!prev.taxNumber) return prev;
      const next = { ...prev };
      delete next.taxNumber;
      return next;
    });
  };

  const handleInstitutionTaxNumberPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = digitsOnlyMax(e.clipboardData.getData("text"), 10);
    setInstitutionFormData((prev) => ({ ...prev, taxNumber: digits }));
    setInstitutionErrors((prev) => {
      if (!prev.taxNumber) return prev;
      const next = { ...prev };
      delete next.taxNumber;
      return next;
    });
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
    const { name, value, type } = e.target;
    setInstructorFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
    clearInstructorError(name as keyof InstructorFormData);
  };

  const handleInstructorCategoryChange = (categoryId: string) => {
    setInstructorFormData((prev) => ({ ...prev, categoryId }));
    clearInstructorError("categoryId");
  };

  const handleInstructorNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = digitsOnlyMax(e.target.value, 11);
    setInstructorFormData((prev) => ({
      ...prev,
      nationalId: digits,
    }));
    clearInstructorError("nationalId");
  };

  const handleInstructorNationalIdPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = digitsOnlyMax(e.clipboardData.getData("text"), 11);
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
      errors.nationalId = "TC kimlik / vergi kimlik numarası zorunludur.";
    } else if (!isValidInstructorIdentityOrTaxNumber(nationalId)) {
      errors.nationalId = "TC kimlik numarası 11, vergi kimlik numarası 10 haneli olmalıdır.";
    }

    const parsedCategoryId = Number(instructorFormData.categoryId.trim());
    if (!Number.isFinite(parsedCategoryId) || parsedCategoryId <= 0) {
      errors.categoryId = "Lütfen bir kategori seçin.";
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

      const identityOrTaxNumber = instructorFormData.nationalId.trim();
      const metadata = {
        user_type: "instructor",
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        birth_date: instructorFormData.birthDate,
        identity_or_tax_number: identityOrTaxNumber,
        // Mevcut trigger uyumu: yalnızca 11 haneli TC için tc_identity_no doldur
        tc_identity_no: identityOrTaxNumber.length === 11 ? identityOrTaxNumber : null,
        reference: instructorFormData.reference.trim() || null,
        category_id: Number(instructorFormData.categoryId.trim()),
        is_approved: null,
        approved_by: null,
        approved_at: null,
      };

      const { data: signUpData, error } = await supabase.auth.signUp({
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

      // Eğitmen: metadata (trigger) + varsa doğrudan instructors.identity_or_tax_number / reference
      if (signUpData.user?.id) {
        const { error: identityUpdateError } = await supabase
          .from("instructors")
          .update({
            identity_or_tax_number: identityOrTaxNumber,
            reference: instructorFormData.reference.trim() || null,
          })
          .eq("owner_auth_id", signUpData.user.id);

        if (identityUpdateError) {
          console.warn(
            "[SignupClient] instructors.identity_or_tax_number update",
            identityUpdateError,
          );
        }
      }

      setModalState({
        isOpen: true,
        type: "success",
        title: "Kayıt başarılı",
        message: APPROVAL_SIGNUP_SUCCESS_MESSAGE,
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
              <Link href="/giris">
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
            {activeFeatures.slice(0, 3).map((item) => (
              <SignupFeatureCard key={item.title} item={item} accent={activeFeatureAccent} />
            ))}
          </aside>

          <div className="signup-form-center">
            <div className="signup-card">
          <h1 className="signup-title">Hesap Oluşturun</h1>

          <div className="signup-tabs">
            <button
              type="button"
              className={`signup-tab ${activeTab === "individual" ? "signup-tab-active" : ""}`}
              onClick={() => setActiveTab("individual")}
            >
              Bireysel
            </button>
            <button
              type="button"
              className={`signup-tab ${activeTab === "institution" ? "signup-tab-active" : ""}`}
              onClick={() => setActiveTab("institution")}
            >
              Kurumsal
            </button>
            <button
              type="button"
              className={`signup-tab ${activeTab === "instructor" ? "signup-tab-active" : ""}`}
              onClick={() => setActiveTab("instructor")}
            >
              Eğitmen
            </button>
          </div>

          {activeTab === "instructor" ? (
            <form
              className="signup-form signup-instructor-section signup-instructor-section--standalone"
              onSubmit={(e) => {
                e.preventDefault();
                void handleInstructorSubmit();
              }}
            >
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
                  TC Kimlik / Vergi Kimlik Numarası
                </label>
                <input
                  type="text"
                  id="signup-instructor-national-id"
                  name="nationalId"
                  className={`signup-input${instructorErrors.nationalId ? " signup-input--error" : ""}`}
                  placeholder="10 veya 11 haneli numara"
                  value={instructorFormData.nationalId}
                  onChange={handleInstructorNationalIdChange}
                  onPaste={handleInstructorNationalIdPaste}
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
                <label htmlFor="signup-instructor-category" className="signup-label">
                  Kategori
                </label>
                <SignupCategorySelect
                  id="signup-instructor-category"
                  value={instructorFormData.categoryId}
                  onChange={handleInstructorCategoryChange}
                  options={instructorCategories}
                  placeholder={
                    instructorCategoriesLoading ? "Kategoriler yükleniyor…" : "Kategori seçin"
                  }
                  disabled={instructorCategoriesLoading}
                  hasError={Boolean(instructorErrors.categoryId)}
                />
                {instructorCategoriesError ? (
                  <p className="signup-field-error" role="alert">
                    {instructorCategoriesError}
                  </p>
                ) : null}
                {instructorErrors.categoryId ? (
                  <p className="signup-field-error" role="alert">
                    {instructorErrors.categoryId}
                  </p>
                ) : null}
              </div>

              <div className="signup-field">
                <label htmlFor="signup-instructor-reference" className="signup-label">
                  Referans
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

              <button type="submit" className="signup-primary-button" disabled={isInstructorSubmitting}>
                {isInstructorSubmitting ? "Hesabınız oluşturuluyor..." : "Eğitmen Hesabı Oluştur"}
              </button>
            </form>
          ) : (
          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="signup-tab-content" key={activeTab}>
              {activeTab === "individual" ? (
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
                    value={individualFormData.firstName}
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
                    value={individualFormData.lastName}
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
                    value={individualFormData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-phone" className="signup-label">
                    Telefon
                  </label>
                  <div className="signup-phone-control">
                    <span className="signup-phone-prefix" aria-hidden="true">
                      +90
                    </span>
                    <input
                      type="tel"
                      id="signup-phone"
                      name="phone"
                      className="signup-phone-national-input"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder={INDIVIDUAL_PHONE_PLACEHOLDER}
                      value={
                        extractTurkishMobileNationalDigits(individualFormData.phone).length > 0
                          ? individualFormData.phone.replace(/^\+90\s?/, "")
                          : ""
                      }
                      onChange={handleIndividualPhoneChange}
                      onPaste={handleIndividualPhonePaste}
                      required
                      aria-invalid={
                        individualFormData.phone !== "+90" &&
                        !isValidTurkishMobilePhone(individualFormData.phone)
                      }
                    />
                  </div>
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-birthdate" className="signup-label">
                    Doğum Tarihi
                  </label>
                  <SignupBirthDatePicker
                    id="signup-birthdate"
                    value={individualFormData.birthDate}
                    onChange={(iso) =>
                      setIndividualFormData((prev) => ({
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
                      value={individualFormData.password}
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
                  <label htmlFor="signup-individual-reference" className="signup-label">
                    Referans
                  </label>
                  <input
                    type="text"
                    id="signup-individual-reference"
                    name="reference"
                    className="signup-input"
                    placeholder="Referans kişi veya kurumu yazın"
                    value={individualFormData.reference}
                    onChange={handleChange}
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
                    value={institutionFormData.companyName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-institution-category" className="signup-label">
                    Kategori
                  </label>
                  <SignupCategorySelect
                    id="signup-institution-category"
                    value={institutionFormData.categoryId}
                    onChange={handleInstitutionCategoryChange}
                    options={institutionCategories}
                    placeholder={
                      institutionCategoriesLoading ? "Kategoriler yükleniyor…" : "Kategori seçin"
                    }
                    disabled={institutionCategoriesLoading}
                    hasError={Boolean(institutionErrors.categoryId)}
                  />
                  {institutionCategoriesError ? (
                    <p className="signup-field-error" role="alert">
                      {institutionCategoriesError}
                    </p>
                  ) : null}
                  {institutionErrors.categoryId ? (
                    <p className="signup-field-error" role="alert">
                      {institutionErrors.categoryId}
                    </p>
                  ) : null}
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-tax-number" className="signup-label">
                    Vergi Kimlik Numarası
                  </label>
                  <input
                    type="text"
                    id="signup-tax-number"
                    name="taxNumber"
                    className={`signup-input${institutionErrors.taxNumber ? " signup-input--error" : ""}`}
                    placeholder="10 haneli vergi kimlik numarası"
                    value={institutionFormData.taxNumber}
                    onChange={handleInstitutionTaxNumberChange}
                    onPaste={handleInstitutionTaxNumberPaste}
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="off"
                    required
                  />
                  {institutionErrors.taxNumber ? (
                    <p className="signup-field-error" role="alert">
                      {institutionErrors.taxNumber}
                    </p>
                  ) : null}
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
                    value={institutionFormData.email}
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
                      value={institutionFormData.password}
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
                    Referans
                  </label>
                  <input
                    type="text"
                    id="signup-reference"
                    name="reference"
                    className="signup-input"
                    placeholder="Referans kişiyi veya kurumu yazın"
                    value={institutionFormData.reference}
                    onChange={handleChange}
                  />
                </div>
                </>
              )}
            </div>

            {activeTab === "individual" ? (
              <>
                <label className="signup-checkbox">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={individualFormData.acceptTerms}
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
                    checked={institutionFormData.acceptTerms}
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
          )}

          <p className="signup-bottom-text">
            Zaten bir hesabınız var mı?{" "}
            <Link href="/giris" className="signup-link">
              Giriş Yapın
            </Link>
          </p>
            </div>
          </div>

          <aside className="signup-feature-column signup-feature-column--right">
            {activeFeatures.slice(3).map((item) => (
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

