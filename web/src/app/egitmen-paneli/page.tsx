"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Shapes,
  Images,
  Megaphone,
  Inbox,
  Settings,
  LogOut,
  FileText,
  CloudUpload,
  Image as ImageIcon,
  Plus,
  GraduationCap,
  Building2,
  Tags,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Clock,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  resolveUserTypeFromUsersClient,
  type AppUserType,
} from "@/lib/auth/authBrowserClient";
import {
  EMPTY_INSTRUCTOR_PROFILE_FORM,
  INSTRUCTOR_PROFILE_CITY,
  INSTRUCTOR_SUBHEADING_MAX_LENGTH,
  instructorDisplayNameFromRow,
  instructorProfileFormsEqual,
  loadInstructorRowForAuthUserClient,
  mapInstructorRowToFormState,
  updateInstructorProfileForAuthUserClient,
  type InstructorProfileFormState,
  type InstructorProfileRow,
} from "@/lib/instructorProfileClient";
import { ANKARA_DISTRICTS } from "@/constants/districts";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { SignupBirthDatePicker } from "@/components/signup/SignupBirthDatePicker";
import { Button, Input } from "@/components/ui";
import { WorkingHoursTimePicker } from "@/app/panel/WorkingHoursTimePicker";
import { EgitmenFormSelect } from "./EgitmenFormSelect";
import { InstructorMediaTab } from "./InstructorMediaTab";
import "@/styles/main.scss";
import "@/styles/pages/egitmen-panel.scss";

type InstructorPanelTabId =
  | "overview"
  | "profile"
  | "features"
  | "media"
  | "announcements"
  | "applications"
  | "settings";

const INSTRUCTOR_PANEL_TABS: { id: InstructorPanelTabId; label: string }[] = [
  { id: "overview", label: "Genel Bakış" },
  { id: "profile", label: "Eğitmen Profili" },
  { id: "features", label: "Eğitmen Özellikleri" },
  { id: "media", label: "Fotoğraflar / CV" },
  { id: "announcements", label: "Duyurular" },
  { id: "applications", label: "Başvurular / İletişim Talepleri" },
  { id: "settings", label: "Ayarlar" },
];

const INSTRUCTOR_OVERVIEW_LOAD_ERROR =
  "Eğitmen bilgileriniz yüklenirken bir hata oluştu.";

const INSTRUCTOR_OVERVIEW_COMPLETENESS_KEYS = [
  "phone",
  "city",
  "district",
  "address",
  "title",
  "branch",
  "education_level",
  "experience_years",
  "subheading",
  "bio",
  "about",
  "working_hours",
  "profile_picture",
  "cv_url",
] as const;

type InstructorOverviewCompletenessKey = (typeof INSTRUCTOR_OVERVIEW_COMPLETENESS_KEYS)[number];

type InstructorOverviewMissingFieldId = InstructorOverviewCompletenessKey;

type InstructorOverviewMissingField = {
  id: InstructorOverviewMissingFieldId;
  label: string;
  tab: InstructorPanelTabId;
};

const INSTRUCTOR_OVERVIEW_FIELD_META: Record<
  InstructorOverviewCompletenessKey,
  { label: string; tab: InstructorPanelTabId }
> = {
  phone: { label: "Telefon", tab: "profile" },
  city: { label: "Şehir", tab: "profile" },
  district: { label: "İlçe", tab: "profile" },
  address: { label: "Adres", tab: "profile" },
  title: { label: "Ünvan", tab: "profile" },
  branch: { label: "Branş", tab: "profile" },
  education_level: { label: "Eğitim Seviyesi", tab: "profile" },
  experience_years: { label: "Deneyim Yılı", tab: "profile" },
  subheading: { label: "Kısa Tanıtım", tab: "profile" },
  bio: { label: "Kısa Biyografi", tab: "profile" },
  about: { label: "Hakkında", tab: "profile" },
  working_hours: { label: "Çalışma Saatleri", tab: "profile" },
  profile_picture: { label: "Profil Fotoğrafı", tab: "media" },
  cv_url: { label: "CV", tab: "media" },
};

const INSTRUCTOR_OVERVIEW_MISSING_FIELD_ICON_CLASS =
  "egitmen-panel-overview-missing-info-mini-icon-svg";

function isInstructorOverviewFieldFilled(
  key: InstructorOverviewCompletenessKey,
  row: InstructorProfileRow | null,
  form: InstructorProfileFormState,
): boolean {
  if (!row) return false;
  switch (key) {
    case "phone":
      return Boolean(form.phone.trim());
    case "city":
      return Boolean(form.city.trim());
    case "district":
      return Boolean(form.district.trim());
    case "address":
      return Boolean(form.address.trim());
    case "title":
      return Boolean(form.title.trim());
    case "branch":
      return Boolean(form.branch.trim());
    case "education_level":
      return Boolean(form.education_level.trim());
    case "experience_years": {
      const exp = row.experience_years;
      if (exp != null && Number.isFinite(Number(exp))) return true;
      return Boolean(form.experience_years.trim());
    }
    case "subheading":
      return Boolean(form.subheading.trim());
    case "bio":
      return Boolean(form.bio.trim());
    case "about":
      return Boolean(form.about.trim());
    case "working_hours":
      return Boolean(form.working_hours_start.trim() && form.working_hours_end.trim());
    case "profile_picture":
      return Boolean(String(row.profile_picture ?? "").trim());
    case "cv_url":
      return Boolean(String(row.cv_url ?? "").trim());
    default:
      return false;
  }
}

function renderInstructorOverviewMissingFieldIcon(id: InstructorOverviewMissingFieldId) {
  const c = INSTRUCTOR_OVERVIEW_MISSING_FIELD_ICON_CLASS;
  switch (id) {
    case "phone":
      return <Phone className={c} aria-hidden />;
    case "city":
    case "district":
    case "address":
      return <MapPin className={c} aria-hidden />;
    case "title":
      return <User className={c} aria-hidden />;
    case "branch":
      return <Tags className={c} aria-hidden />;
    case "education_level":
    case "experience_years":
      return <GraduationCap className={c} aria-hidden />;
    case "subheading":
    case "bio":
    case "about":
    case "cv_url":
      return <FileText className={c} aria-hidden />;
    case "working_hours":
      return <Clock className={c} aria-hidden />;
    case "profile_picture":
      return <ImageIcon className={c} aria-hidden />;
    default:
      return <FileText className={c} aria-hidden />;
  }
}

const MOCK_EXPERTISE_AREAS = [
  "Matematik",
  "Fizik",
  "İngilizce",
  "Müzik",
  "Resim",
  "Yazılım",
  "Robotik",
  "Satranç",
];

const MOCK_ANNOUNCEMENTS = [
  {
    id: "1",
    title: "Yaz dönemi birebir ders programı",
    description: "Temmuz–Ağustos için online ve yüz yüze birebir ders slotları açılmıştır.",
    date: "12.05.2026",
  },
  {
    id: "2",
    title: "Ücretsiz deneme dersi",
    description: "Yeni öğrenciler için 45 dakikalık ücretsiz tanışma dersi.",
    date: "01.05.2026",
  },
];

const MOCK_APPLICATIONS = [
  {
    id: "1",
    fullName: "Ayşe Yılmaz",
    email: "ayse@ornek.com",
    phone: "0532 000 00 01",
    message: "Çocuğum için haftada 2 saat matematik dersi almak istiyorum.",
    date: "18.05.2026",
    status: "Yeni",
  },
  {
    id: "2",
    fullName: "Mehmet Kaya",
    email: "mehmet@ornek.com",
    phone: "0533 000 00 02",
    message: "Online İngilizce dersi fiyat bilgisi alabilir miyim?",
    date: "15.05.2026",
    status: "Okundu",
  },
  {
    id: "3",
    fullName: "Zeynep Demir",
    email: "zeynep@ornek.com",
    phone: "0534 000 00 03",
    message: "Grup dersi için yaş aralığı ve program hakkında bilgi rica ederim.",
    date: "10.05.2026",
    status: "Yanıtlandı",
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanInstructorPhoneInput(value: string): string {
  return value.replace(/[^\d\s+()-]/g, "");
}

function isValidInstructorPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isValidInstructorWebsite(website: string): boolean {
  const trimmed = website.trim();
  if (!trimmed) return true;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return Boolean(url.hostname) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

const INSTRUCTOR_PROFILE_SUCCESS_MESSAGE = "Eğitmen profiliniz başarıyla güncellendi.";
const INSTRUCTOR_PROFILE_ERROR_MESSAGE = "Eğitmen profili güncellenirken bir hata oluştu.";

export default function InstructorPanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userType, setUserType] = useState<AppUserType | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [instructorName, setInstructorName] = useState("Eğitmen");
  const [activeTab, setActiveTab] = useState<InstructorPanelTabId>("overview");

  const [instructorRowId, setInstructorRowId] = useState<number | null>(null);
  const [instructorRow, setInstructorRow] = useState<InstructorProfileRow | null>(null);
  const [profileForm, setProfileForm] = useState<InstructorProfileFormState>(
    EMPTY_INSTRUCTOR_PROFILE_FORM,
  );
  const [profileInitialForm, setProfileInitialForm] = useState<InstructorProfileFormState>(
    EMPTY_INSTRUCTOR_PROFILE_FORM,
  );
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<
    Partial<Record<keyof InstructorProfileFormState, string>>
  >({});
  const [showProfileSuccessPopup, setShowProfileSuccessPopup] = useState(false);

  const [serviceTypes, setServiceTypes] = useState<string[]>(["Online", "Bireysel"]);
  const [lessonTypes, setLessonTypes] = useState<string[]>(["Birebir Ders"]);
  const [priceRange, setPriceRange] = useState("1000-5000 TL");
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>(["Matematik"]);
  const [ageGroups, setAgeGroups] = useState<string[]>(["Çocuk", "Genç"]);

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementDescription, setAnnouncementDescription] = useState("");
  const [announcements, setAnnouncements] = useState(MOCK_ANNOUNCEMENTS);

  const [settingsEmail, setSettingsEmail] = useState("egitmen@ornek.com");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsPasswordConfirm, setSettingsPasswordConfirm] = useState("");
  const [profileVisible, setProfileVisible] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setIsAuthReady(true);
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || user !== null) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) setUser({ id: session.user.id, email: session.user.email });
      else router.replace("/login");
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, router]);

  useEffect(() => {
    if (!user?.id) {
      setRoleLoaded(false);
      setUserType(null);
      return;
    }
    let cancelled = false;
    setRoleLoaded(false);
    resolveUserTypeFromUsersClient(user.id).then((type) => {
      if (!cancelled) {
        setUserType(type);
        setRoleLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || userType !== "instructor") {
      setInstructorName("Eğitmen");
      setInstructorRowId(null);
      setInstructorRow(null);
      setProfileForm(EMPTY_INSTRUCTOR_PROFILE_FORM);
      setProfileInitialForm(EMPTY_INSTRUCTOR_PROFILE_FORM);
      setProfileLoadError(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileLoadError(null);
    const supabase = createSupabaseBrowserClient();

    loadInstructorRowForAuthUserClient(user.id, supabase).then(
      ({ row, error }) => {
        if (cancelled) return;
        setProfileLoading(false);
        if (error) {
          setProfileLoadError(INSTRUCTOR_OVERVIEW_LOAD_ERROR);
          setInstructorRowId(null);
          setInstructorRow(null);
          return;
        }
        if (!row) {
          setProfileLoadError("Eğitmen profili bulunamadı.");
          setInstructorRowId(null);
          setInstructorRow(null);
          return;
        }
        const loadedForm = mapInstructorRowToFormState(row);
        setInstructorRowId(row.id);
        setInstructorRow(row);
        setProfileForm(loadedForm);
        setProfileInitialForm(loadedForm);
        setInstructorName(instructorDisplayNameFromRow(row));
        setProfileLoadError(null);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!showProfileSuccessPopup) return;
    const timer = window.setTimeout(() => setShowProfileSuccessPopup(false), 3000);
    return () => window.clearTimeout(timer);
  }, [showProfileSuccessPopup]);

  useEffect(() => {
    if (user?.email) setSettingsEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!isAuthReady || !user || !roleLoaded) return;
    if (userType !== "instructor") {
      router.replace("/");
    }
  }, [isAuthReady, user, roleLoaded, userType, router]);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const validateInstructorProfileForm = (): Partial<
    Record<keyof InstructorProfileFormState, string>
  > => {
    const errors: Partial<Record<keyof InstructorProfileFormState, string>> = {};
    const name = profileForm.name.trim();
    const surname = profileForm.surname.trim();
    const email = profileForm.email.trim();
    const tc = profileForm.tc_identity_no.trim();
    const exp = profileForm.experience_years.trim();

    if (!name) errors.name = "Ad alanı zorunludur.";
    if (!surname) errors.surname = "Soyad alanı zorunludur.";
    if (!email) {
      errors.email = "E-posta adresi zorunludur.";
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Geçerli bir e-posta adresi girin.";
    }
    if (!tc) {
      errors.tc_identity_no = "TC kimlik numarası zorunludur.";
    } else if (tc.length !== 11) {
      errors.tc_identity_no = "TC kimlik numarası 11 haneli olmalıdır.";
    } else if (tc.startsWith("0")) {
      errors.tc_identity_no = "TC kimlik numarası 0 ile başlayamaz.";
    }
    if (!profileForm.birth_date.trim()) {
      errors.birth_date = "Doğum tarihi zorunludur.";
    }
    if (exp && !Number.isFinite(Number(exp))) {
      errors.experience_years = "Deneyim yılı sayısal olmalıdır.";
    }

    const subheading = profileForm.subheading.trim();
    if (subheading.length > INSTRUCTOR_SUBHEADING_MAX_LENGTH) {
      errors.subheading = "Kısa tanıtım en fazla 100 karakter olabilir.";
    }

    if (!isValidInstructorPhone(profileForm.phone)) {
      errors.phone = "Geçerli bir telefon numarası girin.";
    }

    if (!isValidInstructorWebsite(profileForm.website)) {
      errors.website = "Geçerli bir web sitesi adresi girin.";
    }

    return errors;
  };

  const normalizeProfileFormForSave = (
    form: InstructorProfileFormState,
  ): InstructorProfileFormState => ({
    ...form,
    city: INSTRUCTOR_PROFILE_CITY,
    subheading: form.subheading.slice(0, INSTRUCTOR_SUBHEADING_MAX_LENGTH),
    phone: cleanInstructorPhoneInput(form.phone),
  });

  const handleProfileSave = async () => {
    if (!user?.id || !instructorRowId) {
      setProfileSaveError(INSTRUCTOR_PROFILE_ERROR_MESSAGE);
      return;
    }

    const errors = validateInstructorProfileForm();
    if (Object.keys(errors).length > 0) {
      setProfileFieldErrors(errors);
      setProfileSaveError("Lütfen zorunlu alanları kontrol edin.");
      return;
    }

    setProfileFieldErrors({});
    setProfileSaveError(null);
    setProfileSaving(true);

    try {
      const { row: data, error } = await updateInstructorProfileForAuthUserClient(
        user.id,
        instructorRowId,
        normalizeProfileFormForSave(profileForm),
      );

      if (error || !data) {
        console.error("[instructor-panel] profile save error:", error);
        setProfileSaveError(INSTRUCTOR_PROFILE_ERROR_MESSAGE);
        return;
      }

      const nextForm = mapInstructorRowToFormState(data);
      setProfileForm(nextForm);
      setProfileInitialForm(nextForm);
      setInstructorRow(data);
      setInstructorName(instructorDisplayNameFromRow(data));
      setShowProfileSuccessPopup(true);
    } catch (err) {
      console.error("[instructor-panel] profile save error:", err);
      setProfileSaveError(INSTRUCTOR_PROFILE_ERROR_MESSAGE);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfileFieldChange = (
    field: keyof InstructorProfileFormState,
    value: string,
  ) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    setProfileFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleTcIdentityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    handleProfileFieldChange("tc_identity_no", digits);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleProfileFieldChange("phone", cleanInstructorPhoneInput(e.target.value));
  };

  const handleSubheadingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleProfileFieldChange(
      "subheading",
      e.target.value.slice(0, INSTRUCTOR_SUBHEADING_MAX_LENGTH),
    );
  };

  const districtSelectOptions = useMemo(() => {
    const current = profileForm.district.trim();
    if (current && !ANKARA_DISTRICTS.includes(current)) {
      return [current, ...ANKARA_DISTRICTS];
    }
    return ANKARA_DISTRICTS;
  }, [profileForm.district]);

  const handleFeaturesSave = () => {
    console.log("[instructor-panel] features save (mock)", {
      serviceTypes,
      lessonTypes,
      priceRange,
      expertiseAreas,
      ageGroups,
    });
  };

  const toggleInArray = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleAddAnnouncement = () => {
    const title = announcementTitle.trim();
    const description = announcementDescription.trim();
    if (!title || !description) return;
    const next = {
      id: String(Date.now()),
      title,
      description,
      date: new Date().toLocaleDateString("tr-TR"),
    };
    setAnnouncements((prev) => [next, ...prev]);
    setAnnouncementTitle("");
    setAnnouncementDescription("");
    console.log("[instructor-panel] announcement add (mock)", next);
  };

  const handleSettingsSave = () => {
    console.log("[instructor-panel] settings save (mock)", {
      settingsEmail,
      profileVisible,
      passwordChanged: Boolean(settingsPassword),
    });
  };

  const handlePassiveAccount = () => {
    console.log("[instructor-panel] passive account (mock)");
  };

  const handleMockFileSelect = useCallback((label: string) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) console.log(`[instructor-panel] ${label} selected (mock):`, file.name);
    };
  }, []);

  const sidebarIcons: Record<InstructorPanelTabId, React.ReactNode> = {
    overview: <LayoutDashboard className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    profile: <User className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    features: <Shapes className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    media: <Images className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    announcements: <Megaphone className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    applications: <Inbox className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    settings: <Settings className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
  };

  const activeTabConfig =
    INSTRUCTOR_PANEL_TABS.find((t) => t.id === activeTab) ?? INSTRUCTOR_PANEL_TABS[0];

  const overviewMissingFields = useMemo((): InstructorOverviewMissingField[] => {
    if (!instructorRow) return [];
    return INSTRUCTOR_OVERVIEW_COMPLETENESS_KEYS.filter(
      (key) => !isInstructorOverviewFieldFilled(key, instructorRow, profileForm),
    ).map((key) => ({
      id: key,
      label: INSTRUCTOR_OVERVIEW_FIELD_META[key].label,
      tab: INSTRUCTOR_OVERVIEW_FIELD_META[key].tab,
    }));
  }, [instructorRow, profileForm]);

  const overviewMediaCount = useMemo(() => {
    if (!instructorRow) return 0;
    let count = 0;
    if (String(instructorRow.profile_picture ?? "").trim()) count += 1;
    if (String(instructorRow.cv_url ?? "").trim()) count += 1;
    return count;
  }, [instructorRow]);

  const overviewHasCv = Boolean(String(instructorRow?.cv_url ?? "").trim());
  const overviewBranchLabel = profileForm.branch.trim() || "Belirtilmedi";
  const overviewCvStatusLabel = overviewHasCv ? "Yüklendi" : "Eksik";

  const handleOverviewTabSelect = useCallback((tab: InstructorPanelTabId) => {
    setActiveTab(tab);
  }, []);

  const isProfileFormDirty = useMemo(
    () => !instructorProfileFormsEqual(profileForm, profileInitialForm),
    [profileForm, profileInitialForm],
  );

  if (!isAuthReady || (user && !roleLoaded)) {
    return (
      <div className="egitmen-panel-page">
        <HeaderClientWrapper />
        <div className="egitmen-panel-page-loading">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (userType !== "instructor") return null;

  const isOverview = activeTab === "overview";
  const isProfile = activeTab === "profile";
  const isFeatures = activeTab === "features";
  const isMedia = activeTab === "media";
  const isAnnouncements = activeTab === "announcements";
  const isApplications = activeTab === "applications";
  const isSettings = activeTab === "settings";

  return (
    <div className="egitmen-panel-page">
      <HeaderClientWrapper />
      <div className="egitmen-panel-page-container">
        <aside className="egitmen-panel-sidebar">
          <div className="egitmen-panel-sidebar-content">
            <div className="egitmen-panel-sidebar-profile">
              <div className="egitmen-panel-sidebar-avatar-wrap">
                <div className="egitmen-panel-sidebar-avatar">
                  <GraduationCap className="egitmen-panel-sidebar-avatar-icon" aria-hidden />
                </div>
              </div>
              <h2 className="egitmen-panel-sidebar-name">{instructorName}</h2>
              <p className="egitmen-panel-sidebar-role">Eğitmen Hesabı</p>
            </div>
            <nav className="egitmen-panel-sidebar-nav" aria-label="Eğitmen paneli menüsü">
              {INSTRUCTOR_PANEL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`egitmen-panel-sidebar-nav-item ${activeTab === tab.id ? "egitmen-panel-sidebar-nav-item--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? "true" : undefined}
                >
                  {sidebarIcons[tab.id]}
                  <span>{tab.label}</span>
                </button>
              ))}
              <button
                type="button"
                className="egitmen-panel-sidebar-nav-item egitmen-panel-sidebar-nav-item--logout"
                onClick={() => void handleLogout()}
              >
                <LogOut className="egitmen-panel-sidebar-nav-icon" aria-hidden />
                <span>Çıkış Yap</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="egitmen-panel-page-main">
          <section
            className={
              isOverview
                ? "egitmen-panel-main-card egitmen-panel-overview-card"
                : isProfile
                  ? "egitmen-panel-main-card egitmen-panel-profile-card"
                  : "egitmen-panel-main-card"
            }
            aria-labelledby={isOverview ? "instructor-overview-title" : "instructor-card-title"}
          >
            {isOverview ? (
              <>
                <div className="egitmen-panel-overview-header">
                  <h2 id="instructor-overview-title" className="egitmen-panel-overview-title">
                    Genel Bakış
                  </h2>
                  <p className="egitmen-panel-overview-subtitle">
                    Eğitmen profilinizin özeti ve panel kullanım rehberi.
                  </p>
                </div>
                <div className="egitmen-panel-overview-content">
                  {profileLoading ? (
                    <p className="egitmen-panel-form-loading">Eğitmen bilgileriniz yükleniyor…</p>
                  ) : profileLoadError ? (
                    <p className="egitmen-panel-form-error" role="alert">
                      {profileLoadError}
                    </p>
                  ) : !instructorRow ? (
                    <p className="egitmen-panel-form-error" role="alert">
                      Eğitmen profili bulunamadı.
                    </p>
                  ) : (
                    <>
                  <div className="egitmen-panel-overview-cards">
                    <div className="egitmen-panel-overview-media-status-card">
                      <div className="egitmen-panel-overview-media-status-body">
                        <span className="egitmen-panel-overview-media-status-label">MEDYA DURUMU</span>
                        <h3 className="egitmen-panel-overview-media-status-heading">
                          Toplam Medya Sayısı
                        </h3>
                        <p className="egitmen-panel-overview-media-status-desc">
                          Yüklenen fotoğraf/CV durumu.
                        </p>
                      </div>
                      <div className="egitmen-panel-overview-media-status-count" aria-live="polite">
                        <span className="egitmen-panel-overview-media-status-count-value">
                          {overviewMediaCount}
                        </span>
                      </div>
                    </div>
                    <div className="egitmen-panel-overview-missing-info-card">
                      <span className="egitmen-panel-overview-missing-info-label">EKSİK BİLGİLER</span>
                      <h3 className="egitmen-panel-overview-missing-info-heading">
                        Eksik Bilgiler Uyarısı
                      </h3>
                      {overviewMissingFields.length === 0 ? (
                        <p className="egitmen-panel-overview-missing-info-ok">
                          Profil bilgileriniz tamamlanmış görünüyor.
                        </p>
                      ) : (
                        <div
                          className="egitmen-panel-overview-missing-info-scroll"
                          role="list"
                          aria-label="Eksik alanlar"
                        >
                          {overviewMissingFields.map((field) => (
                            <div
                              key={field.id}
                              className="egitmen-panel-overview-missing-info-mini"
                              role="listitem"
                            >
                              <div
                                className="egitmen-panel-overview-missing-info-mini-icon"
                                aria-hidden
                              >
                                {renderInstructorOverviewMissingFieldIcon(field.id)}
                              </div>
                              <div className="egitmen-panel-overview-missing-info-mini-body">
                                <span className="egitmen-panel-overview-missing-info-mini-title">
                                  {field.label}
                                </span>
                                <button
                                  type="button"
                                  className="egitmen-panel-overview-missing-info-mini-action"
                                  onClick={() => handleOverviewTabSelect(field.tab)}
                                >
                                  Şimdi Düzenle
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="egitmen-panel-overview-summary-grid"
                    aria-label="Profil özeti"
                  >
                    <div className="egitmen-panel-overview-summary-card">
                      <span className="egitmen-panel-overview-summary-label">Branş</span>
                      <p className="egitmen-panel-overview-summary-value">{overviewBranchLabel}</p>
                    </div>
                    <div className="egitmen-panel-overview-summary-card">
                      <span className="egitmen-panel-overview-summary-label">CV Durumu</span>
                      <p className="egitmen-panel-overview-summary-value">{overviewCvStatusLabel}</p>
                    </div>
                  </div>
                  <div className="egitmen-panel-overview-announcements egitmen-panel-overview-welcome-card">
                    <h3 className="egitmen-panel-overview-announcements-title">Hoş Geldiniz</h3>
                    <div className="egitmen-panel-overview-welcome-body">
                      <p className="egitmen-panel-overview-welcome-greeting">
                        Merhaba, <strong>{instructorName}</strong>
                      </p>
                      <p>
                        Bu panel üzerinden eğitmen profilinize ait tüm bilgileri tek bir yerden
                        yönetebilirsiniz.{" "}
                      </p>
                      <p className="egitmen-panel-overview-welcome-row">
                        <span className="egitmen-panel-overview-welcome-row-icon" aria-hidden>
                          <Building2 className="egitmen-panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="egitmen-panel-overview-welcome-row-text">
                          <strong>Eğitmen Profili</strong> sekmesinden ad, soyad, iletişim bilgileri,
                          uzmanlık alanı ve tanıtım metni gibi temel bilgilerinizi eksiksiz
                          doldurmanız önemlidir.
                        </span>
                      </p>
                      <p className="egitmen-panel-overview-welcome-row">
                        <span className="egitmen-panel-overview-welcome-row-icon" aria-hidden>
                          <Tags className="egitmen-panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="egitmen-panel-overview-welcome-row-text">
                          <strong>Eğitmen Özellikleri</strong> bölümünde seçeceğiniz branş, ders türleri,
                          hizmet şekli ve diğer eğitmen özellikleri profil sayfanızda ziyaretçilere
                          gösterilir. Aynı zamanda bu bilgiler filtreleme alanlarında da kullanılacağı
                          için, profilinizin daha kolay bulunması ve öne çıkması adına tüm alanları
                          doğru ve eksiksiz doldurmanızı öneririz.
                        </span>
                      </p>
                      <p className="egitmen-panel-overview-welcome-row">
                        <span className="egitmen-panel-overview-welcome-row-icon" aria-hidden>
                          <Images className="egitmen-panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="egitmen-panel-overview-welcome-row-text">
                          <strong>Medya Yönetimi</strong> alanından yüklediğiniz fotoğraflar ve CV
                          dosyanız eğitmen profilinizde listelenir ve sizi öğrencilere daha güçlü
                          şekilde tanıtmanıza yardımcı olur.
                        </span>
                      </p>
                      <p className="egitmen-panel-overview-welcome-row">
                        <span className="egitmen-panel-overview-welcome-row-icon" aria-hidden>
                          <Megaphone className="egitmen-panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="egitmen-panel-overview-welcome-row-text">
                          <strong>Duyurular</strong> bölümünde ders programı, ücretsiz deneme dersi,
                          grup dersi kayıtları veya bilgilendirme içerikleri gibi paylaşmak istediğiniz
                          duyuruları yayınlayabilirsiniz. Her duyuru için aktiflik durumunu
                          belirleyebilir, süresi geçen duyurularınızı pasif hale getirseniz bile
                          ziyaretçiler bunları süresi doldu bilgisiyle görmeye devam edebilir.
                        </span>
                      </p>
                      <p>
                        Eğitmen profilinizin daha güçlü görünmesi için bilgilerinizi düzenli olarak
                        güncel tutmanızı öneririz.
                      </p>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="egitmen-panel-main-card-header">
                  <div className="egitmen-panel-main-card-header-left">
                    {isProfile ? <User className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isFeatures ? <Shapes className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isMedia ? <Images className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isAnnouncements ? <Megaphone className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isApplications ? <Inbox className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isSettings ? <Settings className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    <h2 id="instructor-card-title" className="egitmen-panel-main-card-title">
                      {activeTabConfig.label}
                    </h2>
                  </div>
                  {isProfile && isProfileFormDirty ? (
                    <Button
                      type="button"
                      variant="default"
                      className="egitmen-panel-save-btn"
                      onClick={() => void handleProfileSave()}
                      disabled={profileSaving || profileLoading || !instructorRowId}
                    >
                      {profileSaving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                    </Button>
                  ) : null}
                  {isFeatures ? (
                    <Button
                      type="button"
                      variant="default"
                      className="egitmen-panel-save-btn"
                      onClick={handleFeaturesSave}
                    >
                      Kaydet
                    </Button>
                  ) : null}
                </div>

                {isProfile ? (
                  <div className="egitmen-panel-card-content">
                    {profileLoadError ? (
                      <p className="egitmen-panel-save-message egitmen-panel-save-message--error" role="alert">
                        {profileLoadError}
                      </p>
                    ) : null}
                    {profileSaveError ? (
                      <p className="egitmen-panel-save-message egitmen-panel-save-message--error" role="alert">
                        {profileSaveError}
                      </p>
                    ) : null}
                    {profileLoading ? (
                      <p className="egitmen-panel-form-loading">Profil yükleniyor…</p>
                    ) : (
                      <div className="egitmen-panel-form">
                        <section className="egitmen-panel-form-section">
                          <h3 className="egitmen-panel-form-section-title">Kişisel Bilgiler</h3>
                          <div className="egitmen-panel-form-row">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Ad</label>
                              <Input
                                className="egitmen-panel-form-input"
                                value={profileForm.name}
                                onChange={(e) => handleProfileFieldChange("name", e.target.value)}
                              />
                              {profileFieldErrors.name ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.name}
                                </span>
                              ) : null}
                            </div>
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Soyad</label>
                              <Input
                                className="egitmen-panel-form-input"
                                value={profileForm.surname}
                                onChange={(e) => handleProfileFieldChange("surname", e.target.value)}
                              />
                              {profileFieldErrors.surname ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.surname}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">E-posta</label>
                              <Input
                                type="email"
                                className="egitmen-panel-form-input"
                                value={profileForm.email}
                                onChange={(e) => handleProfileFieldChange("email", e.target.value)}
                              />
                              {profileFieldErrors.email ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.email}
                                </span>
                              ) : null}
                            </div>
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Telefon</label>
                              <Input
                                type="tel"
                                inputMode="tel"
                                className="egitmen-panel-form-input"
                                value={profileForm.phone}
                                onChange={handlePhoneChange}
                              />
                              {profileFieldErrors.phone ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.phone}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">TC Kimlik No</label>
                              <Input
                                inputMode="numeric"
                                className="egitmen-panel-form-input"
                                value={profileForm.tc_identity_no}
                                onChange={handleTcIdentityChange}
                                maxLength={11}
                              />
                              {profileFieldErrors.tc_identity_no ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.tc_identity_no}
                                </span>
                              ) : null}
                            </div>
                            <div className="egitmen-panel-form-field egitmen-panel-form-field--birth-date">
                              <label className="egitmen-panel-form-label" htmlFor="egitmen-profile-birth-date">
                                Doğum Tarihi
                              </label>
                              <SignupBirthDatePicker
                                id="egitmen-profile-birth-date"
                                value={profileForm.birth_date}
                                onChange={(isoDate) =>
                                  handleProfileFieldChange("birth_date", isoDate)
                                }
                              />
                              {profileFieldErrors.birth_date ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.birth_date}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Referans</label>
                              <Input
                                className="egitmen-panel-form-input"
                                value={profileForm.reference}
                                onChange={(e) =>
                                  handleProfileFieldChange("reference", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </section>

                        <section className="egitmen-panel-form-section">
                          <h3 className="egitmen-panel-form-section-title">Eğitmen Bilgileri</h3>
                          <div className="egitmen-panel-form-row">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Ünvan</label>
                              <Input
                                className="egitmen-panel-form-input"
                                value={profileForm.title}
                                onChange={(e) => handleProfileFieldChange("title", e.target.value)}
                              />
                            </div>
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Branş</label>
                              <Input
                                className="egitmen-panel-form-input"
                                value={profileForm.branch}
                                onChange={(e) => handleProfileFieldChange("branch", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Deneyim Yılı</label>
                              <Input
                                type="number"
                                min={0}
                                className="egitmen-panel-form-input"
                                value={profileForm.experience_years}
                                onChange={(e) =>
                                  handleProfileFieldChange("experience_years", e.target.value)
                                }
                              />
                              {profileFieldErrors.experience_years ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.experience_years}
                                </span>
                              ) : null}
                            </div>
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Eğitim Seviyesi</label>
                              <Input
                                className="egitmen-panel-form-input"
                                value={profileForm.education_level}
                                onChange={(e) =>
                                  handleProfileFieldChange("education_level", e.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Kısa Tanıtım</label>
                              <Input
                                className="egitmen-panel-form-input"
                                value={profileForm.subheading}
                                onChange={handleSubheadingChange}
                                maxLength={INSTRUCTOR_SUBHEADING_MAX_LENGTH}
                                placeholder="Profilinizde görünecek kısa tanıtım metni."
                              />
                              <span className="egitmen-panel-form-char-count" aria-live="polite">
                                {profileForm.subheading.length}/{INSTRUCTOR_SUBHEADING_MAX_LENGTH}
                              </span>
                              {profileFieldErrors.subheading ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.subheading}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Kısa Biyografi</label>
                              <textarea
                                className="egitmen-panel-form-textarea egitmen-panel-form-textarea--compact"
                                rows={3}
                                value={profileForm.bio}
                                onChange={(e) => handleProfileFieldChange("bio", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">
                                Hakkında / Detaylı Açıklama
                              </label>
                              <textarea
                                className="egitmen-panel-form-textarea"
                                rows={4}
                                value={profileForm.about}
                                onChange={(e) => handleProfileFieldChange("about", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Web Sitesi</label>
                              <Input
                                type="text"
                                inputMode="url"
                                className="egitmen-panel-form-input"
                                value={profileForm.website}
                                onChange={(e) => handleProfileFieldChange("website", e.target.value)}
                                placeholder="ornek.com veya https://ornek.com"
                              />
                              {profileFieldErrors.website ? (
                                <span className="egitmen-panel-form-error" role="alert">
                                  {profileFieldErrors.website}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </section>

                        <section className="egitmen-panel-form-section">
                          <h3 className="egitmen-panel-form-section-title">Konum ve İletişim</h3>
                          <div className="egitmen-panel-form-row">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Şehir</label>
                              <Input
                                className="egitmen-panel-form-input egitmen-panel-form-input--readonly"
                                value={INSTRUCTOR_PROFILE_CITY}
                                disabled
                                readOnly
                                aria-readonly="true"
                              />
                            </div>
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label" htmlFor="egitmen-profile-district">
                                İlçe
                              </label>
                              <EgitmenFormSelect
                                id="egitmen-profile-district"
                                value={profileForm.district}
                                onChange={(next) => handleProfileFieldChange("district", next)}
                                options={districtSelectOptions}
                                placeholder="İlçe seçin"
                                ariaLabel="İlçe seçin"
                              />
                            </div>
                          </div>
                          <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                            <div className="egitmen-panel-form-field">
                              <label className="egitmen-panel-form-label">Adres</label>
                              <textarea
                                className="egitmen-panel-form-textarea egitmen-panel-form-textarea--compact"
                                rows={2}
                                value={profileForm.address}
                                onChange={(e) => handleProfileFieldChange("address", e.target.value)}
                              />
                            </div>
                          </div>
                        </section>

                        <section className="egitmen-panel-form-section">
                          <h3 className="egitmen-panel-form-section-title">Çalışma Saatleri</h3>
                          <div className="egitmen-panel-form-row">
                            <div className="egitmen-panel-form-field">
                              <label
                                className="egitmen-panel-form-label"
                                htmlFor="egitmen-working-hours-start"
                              >
                                Çalışma Saati Başlangıç
                              </label>
                              <WorkingHoursTimePicker
                                id="egitmen-working-hours-start"
                                value={profileForm.working_hours_start}
                                onChange={(next) =>
                                  handleProfileFieldChange("working_hours_start", next)
                                }
                                ariaLabel="Çalışma saati başlangıç"
                                placeholder="--:--"
                              />
                            </div>
                            <div className="egitmen-panel-form-field">
                              <label
                                className="egitmen-panel-form-label"
                                htmlFor="egitmen-working-hours-end"
                              >
                                Çalışma Saati Bitiş
                              </label>
                              <WorkingHoursTimePicker
                                id="egitmen-working-hours-end"
                                value={profileForm.working_hours_end}
                                onChange={(next) =>
                                  handleProfileFieldChange("working_hours_end", next)
                                }
                                ariaLabel="Çalışma saati bitiş"
                                placeholder="--:--"
                              />
                            </div>
                          </div>
                        </section>
                      </div>
                    )}
                  </div>
                ) : null}

                {isFeatures ? (
                  <div className="egitmen-panel-tab-content">
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Hizmet Tipi</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["Online", "Yüz yüze", "Bireysel", "Grup"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={serviceTypes.includes(opt)}
                              onChange={() => toggleInArray(opt, serviceTypes, setServiceTypes)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Ders Türü</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["Birebir Ders", "Grup Dersi", "Online Eğitim", "Atölye"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={lessonTypes.includes(opt)}
                              onChange={() => toggleInArray(opt, lessonTypes, setLessonTypes)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Fiyat Aralığı</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["0-1000 TL", "1000-5000 TL", "5000-10000 TL", "10000 TL+"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="radio"
                              name="price-range"
                              checked={priceRange === opt}
                              onChange={() => setPriceRange(opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Uzmanlık Alanları</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {MOCK_EXPERTISE_AREAS.map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={expertiseAreas.includes(opt)}
                              onChange={() => toggleInArray(opt, expertiseAreas, setExpertiseAreas)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Yaş Grubu</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["Çocuk", "Genç", "Yetişkin"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={ageGroups.includes(opt)}
                              onChange={() => toggleInArray(opt, ageGroups, setAgeGroups)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {isMedia ? (
                  instructorRow && user?.id ? (
                    <InstructorMediaTab
                      authUserId={user.id}
                      instructorRow={instructorRow}
                      onInstructorRowChange={setInstructorRow}
                    />
                  ) : profileLoading ? (
                    <p className="egitmen-panel-form-loading">Eğitmen bilgileri yükleniyor…</p>
                  ) : (
                    <p className="egitmen-panel-form-error" role="alert">
                      {profileLoadError ?? "Eğitmen profili bulunamadı."}
                    </p>
                  )
                ) : null}

                {isAnnouncements ? (
                  <div className="egitmen-panel-tab-content">
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Yeni Duyuru</h3>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Duyuru Başlığı</label>
                        <Input
                          className="egitmen-panel-form-input"
                          value={announcementTitle}
                          onChange={(e) => setAnnouncementTitle(e.target.value)}
                        />
                      </div>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Açıklama</label>
                        <textarea
                          className="egitmen-panel-form-textarea"
                          rows={4}
                          value={announcementDescription}
                          onChange={(e) => setAnnouncementDescription(e.target.value)}
                        />
                      </div>
                      <div className="egitmen-panel-media-upload-card egitmen-panel-announcement-upload">
                        <label className="egitmen-panel-dropzone">
                          <input type="file" accept="image/*" onChange={handleMockFileSelect("announcement-image")} />
                          <div className="egitmen-panel-dropzone-inner">
                            <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
                            <p className="egitmen-panel-dropzone-title">Duyuru görseli (isteğe bağlı)</p>
                          </div>
                        </label>
                      </div>
                      <div className="egitmen-panel-form-actions">
                      <Button
                        type="button"
                        variant="default"
                        className="egitmen-panel-add-btn"
                        onClick={handleAddAnnouncement}
                      >
                        <Plus className="egitmen-panel-add-btn-icon" aria-hidden />
                        Duyuru Ekle
                      </Button>
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Duyurularım</h3>
                      <div className="egitmen-panel-announcement-list">
                      {announcements.map((item) => (
                        <article
                          key={item.id}
                          className="egitmen-panel-announcement-item"
                        >
                          <div className="egitmen-panel-announcement-item-body">
                            <span className="egitmen-panel-announcement-item-title">{item.title}</span>
                            <p className="egitmen-panel-announcement-item-desc">{item.description}</p>
                            <span className="egitmen-panel-badge">{item.date}</span>
                          </div>
                        </article>
                      ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {isApplications ? (
                  <div className="egitmen-panel-table-content">
                    <div className="egitmen-panel-table-wrap">
                      <table className="egitmen-panel-table">
                        <thead>
                          <tr>
                            <th className="egitmen-panel-th">Ad Soyad</th>
                            <th className="egitmen-panel-th">E-posta</th>
                            <th className="egitmen-panel-th">Telefon</th>
                            <th className="egitmen-panel-th">Mesaj</th>
                            <th className="egitmen-panel-th">Tarih</th>
                            <th className="egitmen-panel-th">Durum</th>
                            <th className="egitmen-panel-th egitmen-panel-th--actions">İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_APPLICATIONS.map((row) => (
                            <tr key={row.id} className="egitmen-panel-tr">
                              <td className="egitmen-panel-td egitmen-panel-td--title">{row.fullName}</td>
                              <td className="egitmen-panel-td">{row.email}</td>
                              <td className="egitmen-panel-td">{row.phone}</td>
                              <td className="egitmen-panel-td egitmen-panel-td--desc">
                                <span className="egitmen-panel-desc-clamp">{row.message}</span>
                              </td>
                              <td className="egitmen-panel-td">{row.date}</td>
                              <td className="egitmen-panel-td">
                                <span className="egitmen-panel-badge">{row.status}</span>
                              </td>
                              <td className="egitmen-panel-td egitmen-panel-td--actions">
                                <Button
                                  type="button"
                                  variant="default"
                                  className="egitmen-panel-table-action-btn"
                                  onClick={() =>
                                    console.log("[instructor-panel] application detail (mock)", row.id)
                                  }
                                >
                                  Detay
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {isSettings ? (
                  <div className="egitmen-panel-tab-content">
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Hesap</h3>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Hesap E-postası</label>
                        <Input
                          type="email"
                          className="egitmen-panel-form-input"
                          value={settingsEmail}
                          onChange={(e) => setSettingsEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Şifre Değiştir</h3>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Yeni Şifre</label>
                        <Input
                          type="password"
                          className="egitmen-panel-form-input"
                          value={settingsPassword}
                          onChange={(e) => setSettingsPassword(e.target.value)}
                        />
                      </div>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Yeni Şifre (Tekrar)</label>
                        <Input
                          type="password"
                          className="egitmen-panel-form-input"
                          value={settingsPasswordConfirm}
                          onChange={(e) => setSettingsPasswordConfirm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Profil Görünürlüğü</h3>
                      <label className="egitmen-panel-option-check">
                        <input
                          type="checkbox"
                          checked={profileVisible}
                          onChange={(e) => setProfileVisible(e.target.checked)}
                        />
                        <span>Profilim arama sonuçlarında görünsün</span>
                      </label>
                    </div>
                    <div className="egitmen-panel-settings-actions">
                      <Button
                        type="button"
                        variant="default"
                        className="egitmen-panel-save-btn"
                        onClick={handleSettingsSave}
                      >
                        Ayarları Kaydet
                      </Button>
                      <Button type="button" variant="outline" onClick={handlePassiveAccount}>
                        Hesabı Pasife Al
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>

      {showProfileSuccessPopup ? (
        <div className="egitmen-panel-profile-success-overlay" role="presentation">
          <div
            className="egitmen-panel-profile-success-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="egitmen-profile-success-title"
            aria-describedby="egitmen-profile-success-desc"
          >
            <span className="egitmen-panel-profile-success-popup-badge" aria-hidden>
              <CheckCircle size={28} strokeWidth={2} />
            </span>
            <span id="egitmen-profile-success-title" className="egitmen-panel-profile-success-popup-label">
              Onaylandı
            </span>
            <p id="egitmen-profile-success-desc" className="egitmen-panel-profile-success-popup-text">
              {INSTRUCTOR_PROFILE_SUCCESS_MESSAGE}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
