"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CloudUpload } from "lucide-react";
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
import { UniversitySelect } from "@/components/university/UniversitySelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import {
  fetchIlcelerByIlId,
  fetchIller,
  fetchMahallelerByIlceId,
  parseLocationId,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";
import {
  INSTRUCTOR_DIPLOMA_MAX_BYTES,
  INSTRUCTOR_MEDIA_DIPLOMA_ERROR,
  INSTRUCTOR_MEDIA_DIPLOMA_SIZE_ERROR,
  isValidInstructorDiplomaFile,
} from "@/lib/instructorMediaClient";

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
  phone: string;
  password: string;
  reference: string;
  categoryId: string;
  /** TC Kimlik No (11 hane) — DB: instructors.identity_or_tax_number */
  nationalId: string;
  ilId: string;
  ilceId: string;
  school: string;
  department: string;
  branch: string;
  informationAccuracyConfirmed: boolean;
  acceptTerms: boolean;
};

type InstructorFormErrorKey = keyof InstructorFormData | "diplomaFile";

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
  authorizedFullName: string;
  authorizedRole: string;
  /** 1. adım yetkili cep — DB: authorized_person_phone */
  phone: string;
  email: string;
  password: string;
  reference: string;
  /** 2. adım — DB: institutions.institution_name */
  companyName: string;
  /** 2. adım hukuki yapı — DB: institutions.legal_structure (type / institution_type_id değil) */
  legalStructure: string;
  /** 2. adım — DB: institutions.category_id */
  categoryId: string;
  /** 2. adım — DB: institutions.tax_office */
  taxOffice: string;
  /** 2. adım VKN/TCKN — DB: institutions.tax_number */
  taxNumber: string;
  /** 2. adım kurum telefonu — DB: institutions.official_phone (yetkili cep ile aynı veri değil) */
  officialPhone: string;
  /** 2. adım — DB: institutions.il_id */
  ilId: string;
  /** 2. adım — DB: institutions.ilce_id */
  ilceId: string;
  /** 2. adım — DB: institutions.mahalle_id */
  mahalleId: string;
  acceptTerms: boolean;
};

type InstitutionDocumentFileKey = "taxCertificateFile" | "tradeRegistryFile" | "authorizationFile";
type InstitutionFormErrorKey = keyof InstitutionSignupFormData | InstitutionDocumentFileKey;

const INSTITUTION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const INSTITUTION_DOCUMENT_ALLOWED_MIMES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const INSTITUTION_DOCUMENT_TYPE_ERROR =
  "Lütfen PDF, JPG, JPEG veya PNG formatında bir belge yükleyin.";
const INSTITUTION_DOCUMENT_SIZE_ERROR = "Belge en fazla 10MB olabilir.";

function isValidInstitutionVerificationFile(file: File): boolean {
  if (INSTITUTION_DOCUMENT_ALLOWED_MIMES.has(file.type) || file.type === "image/jpg") {
    return true;
  }
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png")
  );
}

function getInstitutionDocumentFileError(
  file: File | null,
  requiredMessage: string | null,
): string | undefined {
  if (!file) {
    return requiredMessage ?? undefined;
  }
  if (!isValidInstitutionVerificationFile(file)) {
    return INSTITUTION_DOCUMENT_TYPE_ERROR;
  }
  if (file.size > INSTITUTION_DOCUMENT_MAX_BYTES) {
    return INSTITUTION_DOCUMENT_SIZE_ERROR;
  }
  return undefined;
}

const INSTITUTION_AUTHORIZED_ROLE_OPTIONS = [
  { value: "kurum-sahibi-kurucu", label: "Kurum Sahibi / Kurucu" },
  { value: "kurum-muduru", label: "Kurum Müdürü" },
  { value: "pazarlama-kurumsal-iletisim", label: "Pazarlama / Kurumsal İletişim" },
  { value: "yonetici-asistan-diger", label: "Yönetici Asistan / Diğer" },
] as const;

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
  return /^\d{10}$/.test(value.trim()) || /^\d{11}$/.test(value.trim());
}

function getInstitutionStepOneErrors(
  data: InstitutionSignupFormData,
): Partial<Record<InstitutionFormErrorKey, string>> {
  const errors: Partial<Record<InstitutionFormErrorKey, string>> = {};
  const authorizedFullName = data.authorizedFullName.trim();
  const email = data.email.trim();
  const password = data.password;
  const authorizedRole = data.authorizedRole.trim();
  const isKnownRole = INSTITUTION_AUTHORIZED_ROLE_OPTIONS.some(
    (option) => option.value === authorizedRole,
  );

  if (!authorizedFullName) {
    errors.authorizedFullName = "Yetkili ad soyad zorunludur.";
  }
  if (!isKnownRole) {
    errors.authorizedRole = "Lütfen yetkili görevi seçin.";
  }
  if (!data.phone || data.phone === "+90") {
    errors.phone = "Telefon alanı zorunludur.";
  } else if (!isValidTurkishMobilePhone(data.phone)) {
    errors.phone = "Geçerli bir Türkiye telefon numarası girin.";
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

  return errors;
}

function getInstitutionStepTwoErrors(
  data: InstitutionSignupFormData,
  categories: SignupCategoryOption[],
): Partial<Record<InstitutionFormErrorKey, string>> {
  const errors: Partial<Record<InstitutionFormErrorKey, string>> = {};
  const selectedCategoryId = Number(data.categoryId.trim());

  if (!data.companyName.trim()) {
    errors.companyName = "Kurum adı zorunludur.";
  }
  if (!data.legalStructure.trim()) {
    errors.legalStructure = "Kurum tipi zorunludur.";
  }
  if (!Number.isInteger(selectedCategoryId) || selectedCategoryId <= 0) {
    errors.categoryId = "Lütfen bir kategori seçin.";
  } else if (!categories.some((category) => category.id === selectedCategoryId)) {
    errors.categoryId = "Lütfen bir kategori seçin.";
  }
  if (!data.taxOffice.trim()) {
    errors.taxOffice = "Vergi dairesi zorunludur.";
  }
  if (!data.taxNumber.trim()) {
    errors.taxNumber = "VKN / TCKN zorunludur.";
  } else if (!isValidInstitutionTaxNumber(data.taxNumber)) {
    errors.taxNumber = "10 haneli VKN veya 11 haneli TCKN girin.";
  }
  if (!data.officialPhone || data.officialPhone === "+90") {
    errors.officialPhone = "Kurum telefon numarası zorunludur.";
  } else if (!isValidTurkishMobilePhone(data.officialPhone)) {
    errors.officialPhone = "Geçerli bir Türkiye telefon numarası girin.";
  }
  if (parseLocationId(data.ilId) == null) {
    errors.ilId = "Lütfen il seçin.";
  }
  if (parseLocationId(data.ilceId) == null) {
    errors.ilceId = "Lütfen ilçe seçin.";
  }
  if (parseLocationId(data.mahalleId) == null) {
    errors.mahalleId = "Lütfen mahalle seçin.";
  }

  return errors;
}

function getInstitutionDocumentErrors(files: {
  taxCertificateFile: File | null;
  tradeRegistryFile: File | null;
  authorizationFile: File | null;
}): Partial<Record<InstitutionFormErrorKey, string>> {
  const errors: Partial<Record<InstitutionFormErrorKey, string>> = {};
  const taxCertificateError = getInstitutionDocumentFileError(
    files.taxCertificateFile,
    "Vergi levhası yüklemeniz zorunludur.",
  );
  if (taxCertificateError) errors.taxCertificateFile = taxCertificateError;

  const tradeRegistryError = getInstitutionDocumentFileError(
    files.tradeRegistryFile,
    "Sicil gazetesi yüklemeniz zorunludur.",
  );
  if (tradeRegistryError) errors.tradeRegistryFile = tradeRegistryError;

  const authorizationError = getInstitutionDocumentFileError(files.authorizationFile, null);
  if (authorizationError) errors.authorizationFile = authorizationError;

  return errors;
}

function isValidInstructorTcIdentityNumber(value: string): boolean {
  return /^\d{11}$/.test(value.trim());
}

function toSignupLogText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function logInstructorSignup(params: {
  step: string;
  error?: unknown;
  message?: string;
  details?: string;
  hint?: string;
}) {
  const err =
    params.error && typeof params.error === "object"
      ? (params.error as {
          code?: unknown;
          message?: unknown;
          details?: unknown;
          hint?: unknown;
        })
      : null;
  const line = [
    `step=${params.step}`,
    `code=${toSignupLogText(err?.code ?? "")}`,
    `message=${toSignupLogText(params.message ?? err?.message ?? "")}`,
    `details=${toSignupLogText(params.details ?? err?.details ?? "")}`,
    `hint=${toSignupLogText(params.hint ?? err?.hint ?? "")}`,
  ].join(" | ");
  if (params.error) {
    console.error(`[SignupClient] instructor signup | ${line}`);
    return;
  }
  console.warn(`[SignupClient] instructor signup | ${line}`);
}

function logInstitutionSignup(params: {
  step: string;
  error?: unknown;
  message?: string;
  details?: string;
  hint?: string;
}) {
  const err =
    params.error && typeof params.error === "object"
      ? (params.error as {
          code?: unknown;
          message?: unknown;
          details?: unknown;
          hint?: unknown;
        })
      : null;
  const line = [
    `step=${params.step}`,
    `code=${toSignupLogText(err?.code ?? "")}`,
    `message=${toSignupLogText(params.message ?? err?.message ?? "")}`,
    `details=${toSignupLogText(params.details ?? err?.details ?? "")}`,
    `hint=${toSignupLogText(params.hint ?? err?.hint ?? "")}`,
  ].join(" | ");
  if (params.error) {
    console.error(`[SignupClient] institution signup | ${line}`);
    return;
  }
  console.warn(`[SignupClient] institution signup | ${line}`);
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

function SignupDocumentDropzone({
  id,
  label,
  file,
  error,
  subtitle,
  onChange,
}: {
  id: string;
  label: string;
  file: File | null;
  error?: string;
  subtitle: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="signup-field">
      <span className="signup-label" id={`${id}-label`}>
        {label}
      </span>
      <label
        htmlFor={id}
        className={`signup-dropzone${error ? " signup-dropzone--error" : ""}${file ? " signup-dropzone--selected" : ""}`}
      >
        <input
          type="file"
          id={id}
          className="signup-dropzone-input"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={onChange}
          aria-labelledby={`${id}-label`}
          aria-invalid={error ? true : undefined}
        />
        <div className="signup-dropzone-inner">
          <CloudUpload className="signup-dropzone-icon" aria-hidden />
          <p className="signup-dropzone-title">{file ? file.name : "Belgenizi yükleyin"}</p>
          <p className="signup-dropzone-subtitle">{subtitle}</p>
        </div>
      </label>
      {error ? (
        <p className="signup-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
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
    authorizedFullName: "",
    authorizedRole: "",
    phone: "+90",
    email: "",
    password: "",
    reference: "",
    companyName: "",
    legalStructure: "",
    categoryId: "",
    taxOffice: "",
    taxNumber: "",
    officialPhone: "+90",
    ilId: "",
    ilceId: "",
    mahalleId: "",
    acceptTerms: false,
  });
  const [institutionDetailsOpen, setInstitutionDetailsOpen] = useState(false);
  const [institutionCategories, setInstitutionCategories] = useState<SignupCategoryOption[]>([]);
  const [institutionCategoriesLoading, setInstitutionCategoriesLoading] = useState(false);
  const [institutionCategoriesError, setInstitutionCategoriesError] = useState<string | null>(null);
  const [institutionIller, setInstitutionIller] = useState<TurkiyeLocationOption[]>([]);
  const [institutionIlceler, setInstitutionIlceler] = useState<TurkiyeLocationOption[]>([]);
  const [institutionMahalleler, setInstitutionMahalleler] = useState<TurkiyeLocationOption[]>([]);
  const [institutionLocationsError, setInstitutionLocationsError] = useState<string | null>(null);
  const [taxCertificateFile, setTaxCertificateFile] = useState<File | null>(null);
  const [tradeRegistryFile, setTradeRegistryFile] = useState<File | null>(null);
  const [authorizationFile, setAuthorizationFile] = useState<File | null>(null);
  const [isInstitutionSubmitting, setIsInstitutionSubmitting] = useState(false);
  const [institutionErrors, setInstitutionErrors] = useState<
    Partial<Record<InstitutionFormErrorKey, string>>
  >({});

  const [loading, setLoading] = useState(false);
  const [isInstructorSubmitting, setIsInstructorSubmitting] = useState(false);
  const [instructorFormData, setInstructorFormData] = useState<InstructorFormData>({
    firstName: "",
    lastName: "",
    email: "",
    birthDate: "",
    phone: "+90",
    password: "",
    reference: "",
    categoryId: "",
    nationalId: "",
    ilId: "",
    ilceId: "",
    school: "",
    department: "",
    branch: "",
    informationAccuracyConfirmed: false,
    acceptTerms: false,
  });
  const [instructorDetailsOpen, setInstructorDetailsOpen] = useState(false);
  const [instructorDiplomaFile, setInstructorDiplomaFile] = useState<File | null>(null);
  const [instructorIller, setInstructorIller] = useState<TurkiyeLocationOption[]>([]);
  const [instructorIlceler, setInstructorIlceler] = useState<TurkiyeLocationOption[]>([]);
  const [instructorLocationsError, setInstructorLocationsError] = useState<string | null>(null);
  const [instructorCategories, setInstructorCategories] = useState<SignupCategoryOption[]>([]);
  const [instructorCategoriesLoading, setInstructorCategoriesLoading] = useState(false);
  const [instructorCategoriesError, setInstructorCategoriesError] = useState<string | null>(null);
  const [instructorErrors, setInstructorErrors] = useState<Partial<Record<InstructorFormErrorKey, string>>>(
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

  useEffect(() => {
    if (!instructorDetailsOpen) return;
    let cancelled = false;
    setInstructorLocationsError(null);

    void fetchIller()
      .then((rows) => {
        if (cancelled) return;
        setInstructorIller(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setInstructorIller([]);
        setInstructorLocationsError("İller yüklenirken bir hata oluştu.");
      });

    return () => {
      cancelled = true;
    };
  }, [instructorDetailsOpen]);

  useEffect(() => {
    const selectedIlId = parseLocationId(instructorFormData.ilId);
    if (selectedIlId == null) {
      setInstructorIlceler([]);
      return;
    }

    let cancelled = false;
    void fetchIlcelerByIlId(selectedIlId)
      .then((rows) => {
        if (cancelled) return;
        setInstructorIlceler(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setInstructorIlceler([]);
        setInstructorLocationsError("İlçeler yüklenirken bir hata oluştu.");
      });

    return () => {
      cancelled = true;
    };
  }, [instructorFormData.ilId]);

  useEffect(() => {
    if (!institutionDetailsOpen) return;
    let cancelled = false;
    setInstitutionLocationsError(null);

    void fetchIller()
      .then((rows) => {
        if (cancelled) return;
        setInstitutionIller(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setInstitutionIller([]);
        setInstitutionLocationsError("İller yüklenirken bir hata oluştu.");
      });

    return () => {
      cancelled = true;
    };
  }, [institutionDetailsOpen]);

  useEffect(() => {
    const selectedIlId = parseLocationId(institutionFormData.ilId);
    if (selectedIlId == null) {
      setInstitutionIlceler([]);
      return;
    }

    let cancelled = false;
    void fetchIlcelerByIlId(selectedIlId)
      .then((rows) => {
        if (cancelled) return;
        setInstitutionIlceler(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setInstitutionIlceler([]);
        setInstitutionLocationsError("İlçeler yüklenirken bir hata oluştu.");
      });

    return () => {
      cancelled = true;
    };
  }, [institutionFormData.ilId]);

  useEffect(() => {
    const selectedIlceId = parseLocationId(institutionFormData.ilceId);
    if (selectedIlceId == null) {
      setInstitutionMahalleler([]);
      return;
    }

    let cancelled = false;
    void fetchMahallelerByIlceId(selectedIlceId)
      .then((rows) => {
        if (cancelled) return;
        setInstitutionMahalleler(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setInstitutionMahalleler([]);
        setInstitutionLocationsError("Mahalleler yüklenirken bir hata oluştu.");
      });

    return () => {
      cancelled = true;
    };
  }, [institutionFormData.ilceId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const selectedTab = activeTab;
    if (selectedTab === "instructor") return;
    if (selectedTab === "institution") {
      if (!institutionDetailsOpen) {
        handleInstitutionContinue();
      } else {
        handleInstitutionSubmit();
      }
      return;
    }

    if (!individualFormData.acceptTerms) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Devam etmek için koşulları kabul etmelisiniz.",
      });
      return;
    }

    if (individualFormData.password.length < MIN_PASSWORD_LENGTH) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik şifre",
        message: `Şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`,
      });
      return;
    }

    if (!individualFormData.birthDate) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik bilgi",
        message: "Doğum tarihinizi girmeden devam edemezsiniz.",
      });
      return;
    }

    const normalizedIndividualPhone = normalizeTurkishMobilePhone(individualFormData.phone);

    if (!normalizedIndividualPhone) {
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik bilgi",
        message: "Geçerli bir cep telefonu numarası girmeden devam edemezsiniz.",
      });
      return;
    }

    setLoading(true);

    const { email, password } = individualFormData;
    const reference = individualFormData.reference.trim();

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
        user_type: "individual",
        company_name: null,
        institution_name: null,
        reference: reference || null,
        first_name: individualFormData.firstName,
        last_name: individualFormData.lastName,
        full_name: `${individualFormData.firstName} ${individualFormData.lastName}`.trim(),
        birth_date: individualFormData.birthDate,
        phone: normalizedIndividualPhone,
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
          message: getAuthErrorMessageTr(
            error,
            "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.",
          ),
        });
        setLoading(false);
        return;
      }

      if (normalizedIndividualPhone && signUpData.user?.id) {
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

      setModalState({
        isOpen: true,
        type: "success",
        title: "Kayıt başarılı",
        message: "Hesap onay maili e-posta adresinize iletilmiştir. Lütfen mail kutunuzu kontrol edin.",
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
      setInstitutionErrors((prev) => {
        if (!prev[name as keyof InstitutionSignupFormData]) return prev;
        const next = { ...prev };
        delete next[name as keyof InstitutionSignupFormData];
        return next;
      });
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

  const handleInstitutionPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInstitutionFormData((prev) => ({
      ...prev,
      phone: formatTurkishMobileDisplay(e.target.value),
    }));
    setInstitutionErrors((prev) => {
      if (!prev.phone) return prev;
      const next = { ...prev };
      delete next.phone;
      return next;
    });
  };

  const handleInstitutionPhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setInstitutionFormData((prev) => ({
      ...prev,
      phone: formatTurkishMobileDisplay(pasted),
    }));
    setInstitutionErrors((prev) => {
      if (!prev.phone) return prev;
      const next = { ...prev };
      delete next.phone;
      return next;
    });
  };

  const handleInstitutionOfficialPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInstitutionFormData((prev) => ({
      ...prev,
      officialPhone: formatTurkishMobileDisplay(e.target.value),
    }));
    setInstitutionErrors((prev) => {
      if (!prev.officialPhone) return prev;
      const next = { ...prev };
      delete next.officialPhone;
      return next;
    });
  };

  const handleInstitutionOfficialPhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setInstitutionFormData((prev) => ({
      ...prev,
      officialPhone: formatTurkishMobileDisplay(pasted),
    }));
    setInstitutionErrors((prev) => {
      if (!prev.officialPhone) return prev;
      const next = { ...prev };
      delete next.officialPhone;
      return next;
    });
  };

  const handleInstitutionRoleChange = (authorizedRole: string) => {
    setInstitutionFormData((prev) => ({ ...prev, authorizedRole }));
    setInstitutionErrors((prev) => {
      if (!prev.authorizedRole) return prev;
      const next = { ...prev };
      delete next.authorizedRole;
      return next;
    });
  };

  const handleInstitutionContinue = () => {
    const errors = getInstitutionStepOneErrors(institutionFormData);

    if (Object.keys(errors).length > 0) {
      setInstitutionErrors(errors);
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik veya hatalı bilgi",
        message: "Lütfen kurumsal kayıt formundaki zorunlu alanları kontrol edin.",
      });
      return;
    }

    setInstitutionErrors({});
    setInstitutionDetailsOpen(true);
  };

  const handleInstitutionSubmit = async () => {
    if (isInstitutionSubmitting) return;
    const errors: Partial<Record<InstitutionFormErrorKey, string>> = {
      ...getInstitutionStepOneErrors(institutionFormData),
      ...getInstitutionStepTwoErrors(institutionFormData, institutionCategories),
      ...getInstitutionDocumentErrors({
        taxCertificateFile,
        tradeRegistryFile,
        authorizationFile,
      }),
    };

    if (!institutionFormData.acceptTerms) {
      errors.acceptTerms = "Devam etmek için koşulları kabul etmelisiniz.";
    }

    if (Object.keys(errors).length > 0) {
      setInstitutionErrors(errors);
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik veya hatalı bilgi",
        message: "Lütfen kurumsal kayıt formundaki zorunlu alanları kontrol edin.",
      });
      return;
    }

    if (!taxCertificateFile || !tradeRegistryFile) {
      return;
    }

    setInstitutionErrors({});
    setIsInstitutionSubmitting(true);

    try {
      const completeForm = new FormData();
      completeForm.set("authorizedPersonName", institutionFormData.authorizedFullName.trim());
      completeForm.set("authorizedPersonRole", institutionFormData.authorizedRole.trim());
      completeForm.set("authorizedPersonPhone", institutionFormData.phone);
      completeForm.set("email", institutionFormData.email.trim());
      completeForm.set("password", institutionFormData.password);
      completeForm.set("reference", institutionFormData.reference.trim());
      completeForm.set("institutionName", institutionFormData.companyName.trim());
      completeForm.set("legalStructure", institutionFormData.legalStructure.trim());
      completeForm.set("categoryId", institutionFormData.categoryId.trim());
      completeForm.set("taxOffice", institutionFormData.taxOffice.trim());
      completeForm.set("taxNumber", institutionFormData.taxNumber.trim());
      completeForm.set("officialPhone", institutionFormData.officialPhone);
      completeForm.set("ilId", institutionFormData.ilId);
      completeForm.set("ilceId", institutionFormData.ilceId);
      completeForm.set("mahalleId", institutionFormData.mahalleId);
      completeForm.set("acceptTerms", "true");
      completeForm.set("taxCertificateFile", taxCertificateFile);
      completeForm.set("tradeRegistryFile", tradeRegistryFile);
      if (authorizationFile) {
        completeForm.set("authorizationFile", authorizationFile);
      }

      logInstitutionSignup({
        step: "institution_signup_request",
        message: "sending institution signup request",
        details: `hasTaxCertificate=${Boolean(taxCertificateFile)};hasTradeRegistry=${Boolean(tradeRegistryFile)};hasAuthorization=${Boolean(authorizationFile)}`,
        hint: "auth signup, institution lookup, and storage upload happen on the server",
      });

      const signupResponse = await fetch("/api/signup/institution", {
        method: "POST",
        body: completeForm,
      });

      let signupPayload: {
        error?: string;
        code?: string;
        ok?: boolean;
        step?: string;
        field?: string;
      } | null = null;
      try {
        signupPayload = (await signupResponse.json()) as {
          error?: string;
          code?: string;
          ok?: boolean;
          step?: string;
          field?: string;
        };
      } catch {
        signupPayload = null;
      }

      logInstitutionSignup({
        step: "signup_api_response",
        message: signupResponse.ok ? "institution signup api returned" : "institution signup api failed",
        details: `httpStatus=${signupResponse.status};ok=${signupResponse.ok};payloadOk=${signupPayload?.ok === true};serverStep=${signupPayload?.step ?? ""};field=${signupPayload?.field ?? ""};code=${signupPayload?.code ?? ""};hasError=${Boolean(signupPayload?.error)}`,
      });

      if (signupPayload?.code === "email-exists" || signupResponse.status === 409) {
        logInstitutionSignup({
          step: "email_duplicate_check",
          message: signupPayload?.error || "email already registered",
          details: `serverStep=${signupPayload?.step ?? ""};field=${signupPayload?.field ?? ""};code=${signupPayload?.code ?? ""};httpStatus=${signupResponse.status}`,
        });
        setModalState({
          isOpen: true,
          type: "email-exists",
          title: "Hesabınız zaten mevcut",
          message: "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.",
        });
        setIsInstitutionSubmitting(false);
        return;
      }

      if (!signupResponse.ok || signupPayload?.ok !== true) {
        logInstitutionSignup({
          step: "final_error",
          error: { code: signupPayload?.code, message: signupPayload?.error },
          message: signupPayload?.error || "institution signup request failed",
          details: `serverStep=${signupPayload?.step ?? ""};field=${signupPayload?.field ?? ""};httpStatus=${signupResponse.status}`,
          hint: "success is only shown after server completes auth, documents, and institution update",
        });
        setModalState({
          isOpen: true,
          type: "error",
          title: "Kayıt başarısız",
          message: "Kurumsal hesap oluşturulurken bir hata oluştu.",
        });
        setIsInstitutionSubmitting(false);
        return;
      }

      logInstitutionSignup({
        step: "final_success",
        message: "institution signup succeeded",
        details: `httpStatus=${signupResponse.status};payloadOk=true`,
      });

      setModalState({
        isOpen: true,
        type: "success",
        title: "Kayıt başarılı",
        message: APPROVAL_SIGNUP_SUCCESS_MESSAGE,
      });
      setIsInstitutionSubmitting(false);
    } catch (err) {
      logInstitutionSignup({
        step: "unexpected_error",
        error: err,
        message: err instanceof Error ? err.message : "unexpected institution signup error",
        details: "catch block",
      });
      setModalState({
        isOpen: true,
        type: "error",
        title: "Kayıt başarısız",
        message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
      });
      setIsInstitutionSubmitting(false);
    }
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
    const digits = digitsOnlyMax(e.target.value, 11);
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
    const digits = digitsOnlyMax(e.clipboardData.getData("text"), 11);
    setInstitutionFormData((prev) => ({ ...prev, taxNumber: digits }));
    setInstitutionErrors((prev) => {
      if (!prev.taxNumber) return prev;
      const next = { ...prev };
      delete next.taxNumber;
      return next;
    });
  };

  const handleInstitutionIlChange = (ilId: string) => {
    setInstitutionFormData((prev) => ({
      ...prev,
      ilId,
      ilceId: "",
      mahalleId: "",
    }));
    setInstitutionErrors((prev) => {
      const next = { ...prev };
      delete next.ilId;
      delete next.ilceId;
      delete next.mahalleId;
      return next;
    });
  };

  const handleInstitutionIlceChange = (ilceId: string) => {
    setInstitutionFormData((prev) => ({
      ...prev,
      ilceId,
      mahalleId: "",
    }));
    setInstitutionErrors((prev) => {
      const next = { ...prev };
      delete next.ilceId;
      delete next.mahalleId;
      return next;
    });
  };

  const handleInstitutionMahalleChange = (mahalleId: string) => {
    setInstitutionFormData((prev) => ({ ...prev, mahalleId }));
    setInstitutionErrors((prev) => {
      if (!prev.mahalleId) return prev;
      const next = { ...prev };
      delete next.mahalleId;
      return next;
    });
  };

  const handleInstitutionDocumentChange =
    (
      key: InstitutionDocumentFileKey,
      setter: React.Dispatch<React.SetStateAction<File | null>>,
    ) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (!file) {
        setter(null);
        return;
      }
      if (!isValidInstitutionVerificationFile(file)) {
        setter(null);
        e.target.value = "";
        setInstitutionErrors((prev) => ({ ...prev, [key]: INSTITUTION_DOCUMENT_TYPE_ERROR }));
        return;
      }
      if (file.size > INSTITUTION_DOCUMENT_MAX_BYTES) {
        setter(null);
        e.target.value = "";
        setInstitutionErrors((prev) => ({ ...prev, [key]: INSTITUTION_DOCUMENT_SIZE_ERROR }));
        return;
      }
      setter(file);
      setInstitutionErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

  const clearInstructorError = (field: InstructorFormErrorKey) => {
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
    clearInstructorError(name as InstructorFormErrorKey);
  };

  const handleInstructorPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInstructorFormData((prev) => ({
      ...prev,
      phone: formatTurkishMobileDisplay(e.target.value),
    }));
    clearInstructorError("phone");
  };

  const handleInstructorPhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setInstructorFormData((prev) => ({
      ...prev,
      phone: formatTurkishMobileDisplay(pasted),
    }));
    clearInstructorError("phone");
  };

  const handleInstructorCategoryChange = (categoryId: string) => {
    setInstructorFormData((prev) => ({ ...prev, categoryId }));
    clearInstructorError("categoryId");
  };

  const handleInstructorIlChange = (ilId: string) => {
    setInstructorFormData((prev) => ({
      ...prev,
      ilId,
      ilceId: "",
    }));
    clearInstructorError("ilId");
    clearInstructorError("ilceId");
  };

  const handleInstructorIlceChange = (ilceId: string) => {
    setInstructorFormData((prev) => ({ ...prev, ilceId }));
    clearInstructorError("ilceId");
  };

  const handleInstructorSchoolChange = (school: string) => {
    setInstructorFormData((prev) => ({ ...prev, school }));
    clearInstructorError("school");
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

  const handleInstructorDiplomaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setInstructorDiplomaFile(null);
      return;
    }
    if (!isValidInstructorDiplomaFile(file)) {
      setInstructorDiplomaFile(null);
      e.target.value = "";
      setInstructorErrors((prev) => ({ ...prev, diplomaFile: INSTRUCTOR_MEDIA_DIPLOMA_ERROR }));
      return;
    }
    if (file.size > INSTRUCTOR_DIPLOMA_MAX_BYTES) {
      setInstructorDiplomaFile(null);
      e.target.value = "";
      setInstructorErrors((prev) => ({ ...prev, diplomaFile: INSTRUCTOR_MEDIA_DIPLOMA_SIZE_ERROR }));
      return;
    }
    setInstructorDiplomaFile(file);
    clearInstructorError("diplomaFile");
  };

  const validateInstructorStepOne = (): Partial<Record<InstructorFormErrorKey, string>> => {
    const errors: Partial<Record<InstructorFormErrorKey, string>> = {};
    const firstName = instructorFormData.firstName.trim();
    const lastName = instructorFormData.lastName.trim();
    const email = instructorFormData.email.trim();
    const password = instructorFormData.password;

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

    if (!instructorFormData.phone || instructorFormData.phone === "+90") {
      errors.phone = "Telefon alanı zorunludur.";
    } else if (!isValidTurkishMobilePhone(instructorFormData.phone)) {
      errors.phone = "Geçerli bir Türkiye telefon numarası girin.";
    }

    if (!password) {
      errors.password = "Şifre zorunludur.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
    }

    const parsedCategoryId = Number(instructorFormData.categoryId.trim());
    if (!Number.isFinite(parsedCategoryId) || parsedCategoryId <= 0) {
      errors.categoryId = "Lütfen bir kategori seçin.";
    }

    return errors;
  };

  const validateInstructorStepTwo = (): Partial<Record<InstructorFormErrorKey, string>> => {
    const errors: Partial<Record<InstructorFormErrorKey, string>> = {};
    const nationalId = instructorFormData.nationalId.trim();

    if (!nationalId) {
      errors.nationalId = "TC kimlik numarası zorunludur.";
    } else if (!isValidInstructorTcIdentityNumber(nationalId)) {
      errors.nationalId = "TC kimlik numarası 11 haneli olmalıdır.";
    }

    if (!parseLocationId(instructorFormData.ilId)) {
      errors.ilId = "Lütfen il seçin.";
    }
    if (!parseLocationId(instructorFormData.ilceId)) {
      errors.ilceId = "Lütfen ilçe seçin.";
    }
    if (!instructorFormData.school.trim()) {
      errors.school = "Mezun olunan okul zorunludur.";
    }
    if (!instructorFormData.department.trim()) {
      errors.department = "Bölüm alanı zorunludur.";
    }
    if (!instructorFormData.branch.trim()) {
      errors.branch = "Branş alanı zorunludur.";
    }
    if (!instructorDiplomaFile) {
      errors.diplomaFile = "Diploma / belge yüklemeniz zorunludur.";
    } else if (!isValidInstructorDiplomaFile(instructorDiplomaFile)) {
      errors.diplomaFile = INSTRUCTOR_MEDIA_DIPLOMA_ERROR;
    } else if (instructorDiplomaFile.size > INSTRUCTOR_DIPLOMA_MAX_BYTES) {
      errors.diplomaFile = INSTRUCTOR_MEDIA_DIPLOMA_SIZE_ERROR;
    }
    if (!instructorFormData.informationAccuracyConfirmed) {
      errors.informationAccuracyConfirmed =
        "Bilgilerin doğruluğunu onaylamadan kayıt oluşturamazsınız.";
    }

    return errors;
  };

  const handleInstructorContinue = () => {
    const errors = validateInstructorStepOne();
    if (Object.keys(errors).length > 0) {
      setInstructorErrors(errors);
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik veya hatalı bilgi",
        message: "Lütfen eğitmen kayıt formundaki zorunlu alanları kontrol edin.",
      });
      return;
    }

    setInstructorErrors({});
    setInstructorDetailsOpen(true);
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

    const errors = {
      ...validateInstructorStepOne(),
      ...validateInstructorStepTwo(),
    };
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

    if (!instructorFormData.informationAccuracyConfirmed || !instructorDiplomaFile) {
      const nextErrors: Partial<Record<InstructorFormErrorKey, string>> = {};
      if (!instructorDiplomaFile) {
        nextErrors.diplomaFile = "Diploma / belge yüklemeniz zorunludur.";
      }
      if (!instructorFormData.informationAccuracyConfirmed) {
        nextErrors.informationAccuracyConfirmed =
          "Bilgilerin doğruluğunu onaylamadan kayıt oluşturamazsınız.";
      }
      setInstructorErrors((prev) => ({ ...prev, ...nextErrors }));
      setModalState({
        isOpen: true,
        type: "error",
        title: "Eksik veya hatalı bilgi",
        message: "Lütfen bireysel eğitmen alanındaki zorunlu alanları kontrol edin.",
      });
      return;
    }

    setInstructorErrors({});

    const diplomaFile = instructorDiplomaFile;

    setIsInstructorSubmitting(true);

    try {
      const completeForm = new FormData();
      completeForm.set("firstName", instructorFormData.firstName.trim());
      completeForm.set("lastName", instructorFormData.lastName.trim());
      completeForm.set("email", instructorFormData.email.trim());
      completeForm.set("password", instructorFormData.password);
      completeForm.set("birthDate", instructorFormData.birthDate);
      completeForm.set("phone", instructorFormData.phone);
      completeForm.set("categoryId", instructorFormData.categoryId.trim());
      completeForm.set("reference", instructorFormData.reference.trim());
      completeForm.set("identityOrTaxNumber", instructorFormData.nationalId.trim());
      completeForm.set("ilId", instructorFormData.ilId);
      completeForm.set("ilceId", instructorFormData.ilceId);
      completeForm.set("school", instructorFormData.school.trim());
      completeForm.set("department", instructorFormData.department.trim());
      completeForm.set("branch", instructorFormData.branch.trim());
      completeForm.set("informationAccuracyConfirmed", "true");
      completeForm.set("acceptTerms", "true");
      completeForm.set("diploma", diplomaFile);

      logInstructorSignup({
        step: "instructor_details_update",
        message: "sending instructor signup request",
        details: `hasDiplomaFile=${Boolean(diplomaFile)};diplomaSize=${diplomaFile.size};hasReference=${Boolean(instructorFormData.reference.trim())}`,
        hint: "auth signup and instructor id lookup happen on the server",
      });

      const signupResponse = await fetch("/api/signup/instructor", {
        method: "POST",
        body: completeForm,
      });

      let signupPayload: { error?: string; code?: string; ok?: boolean } | null = null;
      try {
        signupPayload = (await signupResponse.json()) as {
          error?: string;
          code?: string;
          ok?: boolean;
        };
      } catch {
        signupPayload = null;
      }

      logInstructorSignup({
        step: "signup_api_response",
        message: signupResponse.ok ? "instructor signup api returned" : "instructor signup api failed",
        details: `httpStatus=${signupResponse.status};ok=${signupResponse.ok};payloadOk=${signupPayload?.ok === true};hasError=${Boolean(signupPayload?.error)}`,
      });

      if (signupPayload?.code === "email-exists" || signupResponse.status === 409) {
        logInstructorSignup({
          step: "email_exists_check",
          message: "email already registered",
          details: `httpStatus=${signupResponse.status}`,
        });
        setModalState({
          isOpen: true,
          type: "email-exists",
          title: "Hesabınız zaten mevcut",
          message: "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.",
        });
        setIsInstructorSubmitting(false);
        return;
      }

      if (!signupResponse.ok || signupPayload?.ok !== true) {
        logInstructorSignup({
          step: "final_error",
          error: signupPayload,
          message: signupPayload?.error || "instructor signup request failed",
          details: `httpStatus=${signupResponse.status}`,
          hint: "success is only shown after server completes auth, diploma, and instructor update",
        });
        setModalState({
          isOpen: true,
          type: "error",
          title: "Kayıt başarısız",
          message:
            signupPayload?.error || "Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.",
        });
        setIsInstructorSubmitting(false);
        return;
      }

      logInstructorSignup({
        step: "final_success",
        message: "instructor signup succeeded",
      });

      setModalState({
        isOpen: true,
        type: "success",
        title: "Kayıt başarılı",
        message: APPROVAL_SIGNUP_SUCCESS_MESSAGE,
      });
      setIsInstructorSubmitting(false);
    } catch (err) {
      logInstructorSignup({
        step: "unexpected_error",
        error: err,
        message: err instanceof Error ? err.message : "unexpected instructor signup error",
        details: "catch block",
      });
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
                if (!instructorDetailsOpen) {
                  handleInstructorContinue();
                  return;
                }
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
                <label htmlFor="signup-instructor-phone" className="signup-label">
                  Telefon
                </label>
                <div
                  className={`signup-phone-control${instructorErrors.phone ? " signup-phone-control--error" : ""}`}
                >
                  <span className="signup-phone-prefix" aria-hidden="true">
                    +90
                  </span>
                  <input
                    type="tel"
                    id="signup-instructor-phone"
                    name="phone"
                    className="signup-phone-national-input"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="5XX XXX XX XX"
                    value={
                      extractTurkishMobileNationalDigits(instructorFormData.phone).length > 0
                        ? instructorFormData.phone.replace(/^\+90\s?/, "")
                        : ""
                    }
                    onChange={handleInstructorPhoneChange}
                    onPaste={handleInstructorPhonePaste}
                    aria-invalid={Boolean(instructorErrors.phone)}
                  />
                </div>
                {instructorErrors.phone ? (
                  <p className="signup-field-error" role="alert">
                    {instructorErrors.phone}
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

              {!instructorDetailsOpen ? (
                <button
                  type="button"
                  className="signup-primary-button"
                  onClick={handleInstructorContinue}
                >
                  Devam Et
                </button>
              ) : (
                <div className="signup-instructor-details">
                  <h2 className="signup-instructor-details-title">Eğitmen Bilgileri</h2>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-national-id" className="signup-label">
                      TC Kimlik No
                    </label>
                    <input
                      type="text"
                      id="signup-instructor-national-id"
                      name="nationalId"
                      className={`signup-input${instructorErrors.nationalId ? " signup-input--error" : ""}`}
                      placeholder="11 haneli TC kimlik numarası"
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
                    <label htmlFor="signup-instructor-il" className="signup-label">
                      İl
                    </label>
                    <SignupCategorySelect
                      id="signup-instructor-il"
                      value={instructorFormData.ilId}
                      onChange={handleInstructorIlChange}
                      options={instructorIller.map((il) => ({ id: il.id, name: il.ad }))}
                      placeholder="İl seçin"
                      hasError={Boolean(instructorErrors.ilId)}
                    />
                    {instructorLocationsError ? (
                      <p className="signup-field-error" role="alert">
                        {instructorLocationsError}
                      </p>
                    ) : null}
                    {instructorErrors.ilId ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.ilId}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-ilce" className="signup-label">
                      İlçe
                    </label>
                    <SignupCategorySelect
                      id="signup-instructor-ilce"
                      value={instructorFormData.ilceId}
                      onChange={handleInstructorIlceChange}
                      options={instructorIlceler.map((ilce) => ({ id: ilce.id, name: ilce.ad }))}
                      placeholder={instructorFormData.ilId ? "İlçe seçin" : "Önce il seçin"}
                      disabled={!instructorFormData.ilId}
                      hasError={Boolean(instructorErrors.ilceId)}
                    />
                    {instructorErrors.ilceId ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.ilceId}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-school" className="signup-label">
                      Mezun Olunan Okul
                    </label>
                    <UniversitySelect
                      id="signup-instructor-school"
                      variant="signup"
                      value={instructorFormData.school}
                      onChange={handleInstructorSchoolChange}
                      placeholder="Üniversite seçin"
                      hasError={Boolean(instructorErrors.school)}
                      ariaLabel="Mezun olunan okul"
                    />
                    {instructorErrors.school ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.school}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-department" className="signup-label">
                      Bölüm
                    </label>
                    <input
                      type="text"
                      id="signup-instructor-department"
                      name="department"
                      className={`signup-input${instructorErrors.department ? " signup-input--error" : ""}`}
                      placeholder="Bölümünüzü yazın"
                      value={instructorFormData.department}
                      onChange={handleInstructorChange}
                    />
                    {instructorErrors.department ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.department}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-instructor-branch" className="signup-label">
                      Branş
                    </label>
                    <input
                      type="text"
                      id="signup-instructor-branch"
                      name="branch"
                      className={`signup-input${instructorErrors.branch ? " signup-input--error" : ""}`}
                      placeholder="Branşınızı yazın"
                      value={instructorFormData.branch}
                      onChange={handleInstructorChange}
                    />
                    {instructorErrors.branch ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.branch}
                      </p>
                    ) : null}
                  </div>

                  <div className="signup-field">
                    <span className="signup-label" id="signup-instructor-diploma-label">
                      Diploma / Belge
                    </span>
                    <label
                      htmlFor="signup-instructor-diploma"
                      className={`signup-dropzone${instructorErrors.diplomaFile ? " signup-dropzone--error" : ""}${instructorDiplomaFile ? " signup-dropzone--selected" : ""}`}
                    >
                      <input
                        type="file"
                        id="signup-instructor-diploma"
                        className="signup-dropzone-input"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={handleInstructorDiplomaChange}
                        aria-labelledby="signup-instructor-diploma-label"
                        aria-invalid={instructorErrors.diplomaFile ? true : undefined}
                      />
                      <div className="signup-dropzone-inner">
                        <CloudUpload className="signup-dropzone-icon" aria-hidden />
                        <p className="signup-dropzone-title">
                          {instructorDiplomaFile
                            ? instructorDiplomaFile.name
                            : "Diploma / belgenizi yükleyin"}
                        </p>
                        <p className="signup-dropzone-subtitle">
                          PDF, JPG, JPEG veya PNG (maks. 10MB)
                        </p>
                      </div>
                    </label>
                    {instructorErrors.diplomaFile ? (
                      <p className="signup-field-error" role="alert">
                        {instructorErrors.diplomaFile}
                      </p>
                    ) : null}
                  </div>

                  <label className="signup-checkbox">
                    <input
                      type="checkbox"
                      name="informationAccuracyConfirmed"
                      checked={instructorFormData.informationAccuracyConfirmed}
                      onChange={handleInstructorChange}
                    />
                    <span>Girdiğim bilgilerin doğru ve tarafıma ait olduğunu onaylıyorum.</span>
                  </label>
                  {instructorErrors.informationAccuracyConfirmed ? (
                    <p className="signup-field-error" role="alert">
                      {instructorErrors.informationAccuracyConfirmed}
                    </p>
                  ) : null}

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
                </div>
              )}
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
                  <label htmlFor="signup-institution-authorized-name" className="signup-label">
                    Yetkili Ad Soyad
                  </label>
                  <input
                    type="text"
                    id="signup-institution-authorized-name"
                    name="authorizedFullName"
                    className={`signup-input${institutionErrors.authorizedFullName ? " signup-input--error" : ""}`}
                    placeholder="Yetkili ad ve soyadını girin"
                    value={institutionFormData.authorizedFullName}
                    onChange={handleChange}
                    autoComplete="name"
                  />
                  {institutionErrors.authorizedFullName ? (
                    <p className="signup-field-error" role="alert">
                      {institutionErrors.authorizedFullName}
                    </p>
                  ) : null}
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-institution-role" className="signup-label">
                    Yetkili Ünvanı / Görevi
                  </label>
                  <Select
                    value={institutionFormData.authorizedRole}
                    onValueChange={handleInstitutionRoleChange}
                  >
                    <SelectTrigger
                      id="signup-institution-role"
                      className={`signup-category-select-trigger${institutionErrors.authorizedRole ? " signup-category-select-trigger--error" : ""}`}
                      aria-label="Yetkili görevi seçin"
                    >
                      <SelectValue placeholder="Yetkili görevi seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="signup-category-select-content"
                      position="popper"
                      side="bottom"
                      sideOffset={6}
                      align="start"
                    >
                      {INSTITUTION_AUTHORIZED_ROLE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="signup-category-select-item"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {institutionErrors.authorizedRole ? (
                    <p className="signup-field-error" role="alert">
                      {institutionErrors.authorizedRole}
                    </p>
                  ) : null}
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-institution-phone" className="signup-label">
                    Yetkili Cep Telefon Numarası
                  </label>
                  <div
                    className={`signup-phone-control${institutionErrors.phone ? " signup-phone-control--error" : ""}`}
                  >
                    <span className="signup-phone-prefix" aria-hidden="true">
                      +90
                    </span>
                    <input
                      type="tel"
                      id="signup-institution-phone"
                      name="phone"
                      className="signup-phone-national-input"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="5XX XXX XX XX"
                      value={
                        extractTurkishMobileNationalDigits(institutionFormData.phone).length > 0
                          ? institutionFormData.phone.replace(/^\+90\s?/, "")
                          : ""
                      }
                      onChange={handleInstitutionPhoneChange}
                      onPaste={handleInstitutionPhonePaste}
                      aria-invalid={Boolean(institutionErrors.phone)}
                    />
                  </div>
                  {institutionErrors.phone ? (
                    <p className="signup-field-error" role="alert">
                      {institutionErrors.phone}
                    </p>
                  ) : null}
                </div>

                <div className="signup-field">
                  <label htmlFor="signup-email-kurumsal" className="signup-label">
                    Kurumsal / Yetkili E-posta Adresi
                  </label>
                  <input
                    type="email"
                    id="signup-email-kurumsal"
                    name="email"
                    className={`signup-input${institutionErrors.email ? " signup-input--error" : ""}`}
                    placeholder="kurum@adresiniz.com"
                    value={institutionFormData.email}
                    onChange={handleChange}
                  />
                  {institutionErrors.email ? (
                    <p className="signup-field-error" role="alert">
                      {institutionErrors.email}
                    </p>
                  ) : null}
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
                      className={`signup-input${institutionErrors.password ? " signup-input--error" : ""}`}
                      style={{ paddingRight: 44 }}
                      placeholder="En az 8 karakter"
                      value={institutionFormData.password}
                      onChange={handleChange}
                    />
                    <SignupPasswordToggle
                      showPassword={showPassword}
                      onToggle={() => setShowPassword((prev) => !prev)}
                    />
                  </div>
                  {institutionErrors.password ? (
                    <p className="signup-field-error" role="alert">
                      {institutionErrors.password}
                    </p>
                  ) : null}
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

                {institutionDetailsOpen ? (
                  <>
                  <div className="signup-instructor-details">
                    <h2 className="signup-instructor-details-title">Kurum Bilgileri</h2>

                    <div className="signup-field">
                      <label htmlFor="signup-institution-name" className="signup-label">
                        Kurum Adı
                      </label>
                      <input
                        type="text"
                        id="signup-institution-name"
                        name="companyName"
                        className={`signup-input${institutionErrors.companyName ? " signup-input--error" : ""}`}
                        placeholder="Kurum adını girin"
                        value={institutionFormData.companyName}
                        onChange={handleChange}
                      />
                      {institutionErrors.companyName ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.companyName}
                        </p>
                      ) : null}
                    </div>

                    <div className="signup-field">
                      <label htmlFor="signup-institution-legal-structure" className="signup-label">
                        Kurum Tipi
                      </label>
                      <input
                        type="text"
                        id="signup-institution-legal-structure"
                        name="legalStructure"
                        className={`signup-input${institutionErrors.legalStructure ? " signup-input--error" : ""}`}
                        placeholder="Limited, A.Ş. vb."
                        value={institutionFormData.legalStructure}
                        onChange={handleChange}
                      />
                      {institutionErrors.legalStructure ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.legalStructure}
                        </p>
                      ) : null}
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
                      <label htmlFor="signup-institution-tax-office" className="signup-label">
                        Vergi Dairesi
                      </label>
                      <input
                        type="text"
                        id="signup-institution-tax-office"
                        name="taxOffice"
                        className={`signup-input${institutionErrors.taxOffice ? " signup-input--error" : ""}`}
                        placeholder="Vergi dairesini girin"
                        value={institutionFormData.taxOffice}
                        onChange={handleChange}
                      />
                      {institutionErrors.taxOffice ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.taxOffice}
                        </p>
                      ) : null}
                    </div>

                    <div className="signup-field">
                      <label htmlFor="signup-institution-tax-number" className="signup-label">
                        VKN / TCKN
                      </label>
                      <input
                        type="text"
                        id="signup-institution-tax-number"
                        name="taxNumber"
                        className={`signup-input${institutionErrors.taxNumber ? " signup-input--error" : ""}`}
                        placeholder="10 haneli VKN veya 11 haneli TCKN"
                        value={institutionFormData.taxNumber}
                        onChange={handleInstitutionTaxNumberChange}
                        onPaste={handleInstitutionTaxNumberPaste}
                        inputMode="numeric"
                        maxLength={11}
                        autoComplete="off"
                      />
                      {institutionErrors.taxNumber ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.taxNumber}
                        </p>
                      ) : null}
                    </div>

                    <div className="signup-field">
                      <label htmlFor="signup-institution-official-phone" className="signup-label">
                        Kurum Telefon Numarası
                      </label>
                      <div
                        className={`signup-phone-control${institutionErrors.officialPhone ? " signup-phone-control--error" : ""}`}
                      >
                        <span className="signup-phone-prefix" aria-hidden="true">
                          +90
                        </span>
                        <input
                          type="tel"
                          id="signup-institution-official-phone"
                          name="officialPhone"
                          className="signup-phone-national-input"
                          inputMode="numeric"
                          autoComplete="tel"
                          placeholder="5XX XXX XX XX"
                          value={
                            extractTurkishMobileNationalDigits(institutionFormData.officialPhone).length > 0
                              ? institutionFormData.officialPhone.replace(/^\+90\s?/, "")
                              : ""
                          }
                          onChange={handleInstitutionOfficialPhoneChange}
                          onPaste={handleInstitutionOfficialPhonePaste}
                          aria-invalid={Boolean(institutionErrors.officialPhone)}
                        />
                      </div>
                      {institutionErrors.officialPhone ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.officialPhone}
                        </p>
                      ) : null}
                    </div>

                    <div className="signup-field">
                      <label htmlFor="signup-institution-il" className="signup-label">
                        İl
                      </label>
                      <SignupCategorySelect
                        id="signup-institution-il"
                        value={institutionFormData.ilId}
                        onChange={handleInstitutionIlChange}
                        options={institutionIller.map((il) => ({ id: il.id, name: il.ad }))}
                        placeholder="İl seçin"
                        hasError={Boolean(institutionErrors.ilId)}
                      />
                      {institutionLocationsError ? (
                        <p className="signup-field-error" role="alert">
                          {institutionLocationsError}
                        </p>
                      ) : null}
                      {institutionErrors.ilId ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.ilId}
                        </p>
                      ) : null}
                    </div>

                    <div className="signup-field">
                      <label htmlFor="signup-institution-ilce" className="signup-label">
                        İlçe
                      </label>
                      <SignupCategorySelect
                        id="signup-institution-ilce"
                        value={institutionFormData.ilceId}
                        onChange={handleInstitutionIlceChange}
                        options={institutionIlceler.map((ilce) => ({ id: ilce.id, name: ilce.ad }))}
                        placeholder={institutionFormData.ilId ? "İlçe seçin" : "Önce il seçin"}
                        disabled={!institutionFormData.ilId}
                        hasError={Boolean(institutionErrors.ilceId)}
                      />
                      {institutionErrors.ilceId ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.ilceId}
                        </p>
                      ) : null}
                    </div>

                    <div className="signup-field">
                      <label htmlFor="signup-institution-mahalle" className="signup-label">
                        Mahalle
                      </label>
                      <SignupCategorySelect
                        id="signup-institution-mahalle"
                        value={institutionFormData.mahalleId}
                        onChange={handleInstitutionMahalleChange}
                        options={institutionMahalleler.map((mahalle) => ({
                          id: mahalle.id,
                          name: mahalle.ad,
                        }))}
                        placeholder={institutionFormData.ilceId ? "Mahalle seçin" : "Önce ilçe seçin"}
                        disabled={!institutionFormData.ilceId}
                        hasError={Boolean(institutionErrors.mahalleId)}
                      />
                      {institutionErrors.mahalleId ? (
                        <p className="signup-field-error" role="alert">
                          {institutionErrors.mahalleId}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="signup-instructor-details">
                    <h2 className="signup-instructor-details-title">Yüklenecek Belgeler</h2>

                    <SignupDocumentDropzone
                      id="signup-institution-tax-certificate"
                      label="Vergi Levhası"
                      file={taxCertificateFile}
                      error={institutionErrors.taxCertificateFile}
                      subtitle="PDF, JPG, JPEG veya PNG (maks. 10MB)"
                      onChange={handleInstitutionDocumentChange(
                        "taxCertificateFile",
                        setTaxCertificateFile,
                      )}
                    />

                    <SignupDocumentDropzone
                      id="signup-institution-trade-registry"
                      label="Sicil Gazetesi"
                      file={tradeRegistryFile}
                      error={institutionErrors.tradeRegistryFile}
                      subtitle="PDF, JPG, JPEG veya PNG (maks. 10MB)"
                      onChange={handleInstitutionDocumentChange(
                        "tradeRegistryFile",
                        setTradeRegistryFile,
                      )}
                    />

                    <SignupDocumentDropzone
                      id="signup-institution-authorization"
                      label="Yetki Belgesi"
                      file={authorizationFile}
                      error={institutionErrors.authorizationFile}
                      subtitle="Yalnızca yetkili kişi adına işlem yapılıyorsa ekleyin. PDF, JPG, JPEG veya PNG (maks. 10MB)"
                      onChange={handleInstitutionDocumentChange(
                        "authorizationFile",
                        setAuthorizationFile,
                      )}
                    />
                  </div>
                </>
                ) : null}
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
                {institutionErrors.acceptTerms ? (
                  <p className="signup-field-error" role="alert">
                    {institutionErrors.acceptTerms}
                  </p>
                ) : null}

                {!institutionDetailsOpen ? (
                  <button
                    type="button"
                    className="signup-primary-button"
                    onClick={handleInstitutionContinue}
                  >
                    Devam Et
                  </button>
                ) : (
                  <button
                    type="button"
                    className="signup-primary-button"
                    onClick={() => {
                      void handleInstitutionSubmit();
                    }}
                    disabled={isInstitutionSubmitting}
                  >
                    {isInstitutionSubmitting ? "Hesabınız oluşturuluyor..." : "Onayla ve Gönder"}
                  </button>
                )}
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

