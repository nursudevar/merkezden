"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Building,
  Megaphone,
  CreditCard,
  Inbox,
  PencilLine,
  Trash2,
  Plus,
  CheckCircle,
  Info,
  Star,
  Upload,
  Loader2,
  X,
  Check,
  Shapes,
  Images,
  Image,
  Film,
  CloudUpload,
  Mail,
  Phone,
  MapPin,
  FileText,
  List,
  Tags,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  loadInstitutionRowForAuthUserClient,
  resolveIsAdminFromUserRolesClient,
  resolveUserTypeFromUsersClient,
} from "@/lib/auth/authBrowserClient";
import {
  institutionTimeToInputHHMM,
  inputHHMMToDbTimeOrNull,
} from "@/lib/institutionWorkingHours";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { InstitutionFeatureSelectionGroupList } from "./InstitutionFeatureSelectionGroupList";
import { WorkingHoursTimePicker } from "./WorkingHoursTimePicker";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import "@/styles/main.scss";
import "@/styles/pages/panel.scss";

type PanelTabId =
  | "overview"
  | "institution-profile"
  | "institutions"
  | "media-management"
  | "announcements"
  | "subscription";

type OverviewMissingFieldId =
  | "institution_name"
  | "phone"
  | "email"
  | "logo"
  | "category"
  | "sub_type"
  | "address"
  | "about";

type OverviewMissingField = {
  id: OverviewMissingFieldId;
  label: string;
  tab: PanelTabId;
};

const PANEL_TABS: { id: PanelTabId; label: string; placeholder: string }[] = [
  { id: "overview", label: "Genel Bakış", placeholder: "Özet metrikler burada görünecek." },
  {
    id: "institution-profile",
    label: "Kurum Profili",
    placeholder: "Kurum profil bilgileri burada yönetilecek.",
  },
  {
    id: "institutions",
    label: "Kurum Özellikleri",
    placeholder: "Kurum özellikleri burada yönetilecek.",
  },
  {
    id: "media-management",
    label: "Medya Yönetimi",
    placeholder: "Görsel ve medya içerikleri burada yönetilecek.",
  },
  {
    id: "announcements",
    label: "Duyurular",
    placeholder: "Duyurular ve içerikler burada yönetilecek.",
  },
  {
    id: "subscription",
    label: "Abonelik",
    placeholder: "Plan ve faturalandırma burada yönetilecek.",
  },
];

type SubscriptionPlan = {
  title: string;
  price: {
    monthly: number;
    yearly: number;
  };
  description: string;
  features: string[];
  ctaText: string;
  isFeatured?: boolean;
};

const OVERVIEW_MISSING_FIELD_ICON_CLASS = "panel-overview-missing-info-mini-icon-svg";

function renderOverviewMissingFieldIcon(id: OverviewMissingFieldId) {
  const c = OVERVIEW_MISSING_FIELD_ICON_CLASS;
  switch (id) {
    case "institution_name":
      return <Building2 className={c} aria-hidden />;
    case "phone":
      return <Phone className={c} aria-hidden />;
    case "email":
      return <Mail className={c} aria-hidden />;
    case "logo":
      return <Image className={c} aria-hidden />;
    case "category":
      return <Tags className={c} aria-hidden />;
    case "sub_type":
      return <List className={c} aria-hidden />;
    case "address":
      return <MapPin className={c} aria-hidden />;
    case "about":
      return <FileText className={c} aria-hidden />;
  }
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    title: "Temel",
    price: { monthly: 1490, yearly: 14304 },
    description: "Yeni başlayan kurumlar için temel görünürlük ve yönetim özellikleri.",
    features: [
      "Kurum profili yayını",
      "Aylık 2 duyuru paylaşımı",
      "Temel istatistik ekranı",
      "E-posta destek",
      "Tek şube yönetimi",
    ],
    ctaText: "Temel Planı Seç",
  },
  {
    title: "Kurumsal",
    price: { monthly: 2490, yearly: 23904 },
    description: "Daha yüksek görünürlük ve gelişmiş içerik yönetimi isteyen kurumlar için.",
    features: [
      "Öne çıkan kurum görünürlüğü",
      "Sınırsız duyuru paylaşımı",
      "Detaylı performans raporları",
      "Öncelikli destek",
      "Çoklu şube yönetimi",
      "Profilde özel rozet",
    ],
    ctaText: "Kurumsal Planı Seç",
    isFeatured: true,
  },
  {
    title: "Premium",
    price: { monthly: 3990, yearly: 38304 },
    description: "Maksimum görünürlük ve kurumsal büyüme odaklı kapsamlı paket.",
    features: [
      "Ana sayfada premium vitrin",
      "Sınırsız duyuru ve kampanya",
      "İleri düzey raporlama",
      "Öncelikli telefon desteği",
      "Sınırsız şube yönetimi",
      "Özel hesap yöneticisi",
      "Reklam alanlarında öncelik",
    ],
    ctaText: "Premium Planı Seç",
  },
];

function AnimatedDigit({ digit, index }: { digit: string; index: number }) {
  return (
    <div className="panel-subscription-digit-wrap">
      <AnimatePresence mode="wait">
        <motion.span
          key={digit}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={{ duration: 0.28, delay: index * 0.04, ease: "easeOut" }}
          className="panel-subscription-digit"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function ScrollingNumber({ value }: { value: number }) {
  const numberString = value.toString();
  return (
    <div className="panel-subscription-scrolling-number">
      {numberString.split("").map((digit, index) => (
        <AnimatedDigit key={`${value}-${index}`} digit={digit} index={index} />
      ))}
    </div>
  );
}

function AnnouncementTableThumbCell({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  const trimmed = (url ?? "").trim();
  if (!trimmed || failed) {
    return (
      <div className="panel-media-thumb panel-media-thumb--fallback" aria-hidden>
        <Image className="panel-media-thumb-icon" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={trimmed}
      alt=""
      className="panel-media-thumb panel-media-thumb--image"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function SubscriptionPricingTable({ plans }: { plans: SubscriptionPlan[] }) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="panel-subscription">
      <div className="panel-subscription-header">
        <h3 className="panel-subscription-title">Kurumunuza Uygun Planı Seçin</h3>
        <p className="panel-subscription-subtitle">
          Tüm planlar kurum profilinizi güçlendirmek ve daha fazla veli/öğrenciye ulaşmanız için tasarlanmıştır.
        </p>
        <div className="panel-subscription-billing-toggle" role="tablist" aria-label="Faturalandırma tipi">
          <button
            type="button"
            className={`panel-subscription-billing-btn ${!isYearly ? "panel-subscription-billing-btn--active" : ""}`}
            onClick={() => setIsYearly(false)}
          >
            Aylık
          </button>
          <button
            type="button"
            className={`panel-subscription-billing-btn ${isYearly ? "panel-subscription-billing-btn--active" : ""}`}
            onClick={() => setIsYearly(true)}
          >
            Yıllık
            <span className="panel-subscription-billing-badge">%20 Tasarruf</span>
          </button>
        </div>
      </div>

      <div className="panel-subscription-grid">
        {plans.map((plan) => {
          const monthlyPrice = isYearly ? Math.round(plan.price.yearly / 12) : plan.price.monthly;
          const yearlySave = plan.price.monthly * 12 - plan.price.yearly;
          return (
            <motion.article
              key={plan.title}
              className={`panel-subscription-card ${plan.isFeatured ? "panel-subscription-card--featured" : ""}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {plan.isFeatured && <span className="panel-subscription-card-badge">En Popüler</span>}
              <div className="panel-subscription-card-head">
                <h4 className="panel-subscription-card-title">{plan.title}</h4>
                <p className="panel-subscription-card-description">{plan.description}</p>
                <div className="panel-subscription-price-row">
                  <span className="panel-subscription-currency">₺</span>
                  <ScrollingNumber value={monthlyPrice} />
                  <span className="panel-subscription-price-suffix">/ ay</span>
                </div>
                <div className="panel-subscription-bill-row">
                  <span>{isYearly ? "Yıllık tahsil edilir" : "Aylık tahsil edilir"}</span>
                  {isYearly && <span className="panel-subscription-save-chip">Yıllık {yearlySave.toLocaleString("tr-TR")} TL avantaj</span>}
                </div>
              </div>

              <ul className="panel-subscription-features">
                {plan.features.map((feature) => (
                  <li key={feature} className="panel-subscription-feature-item">
                    <span className="panel-subscription-feature-icon">
                      <Check size={14} />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                variant={plan.isFeatured ? "default" : "outline"}
                className={`panel-subscription-cta ${plan.isFeatured ? "btn-gradient-primary" : ""}`}
              >
                {plan.ctaText}
              </Button>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function PanelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userType, setUserType] = useState<"individual" | "institution" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTabId>("overview");
  const [institutionName, setInstitutionName] = useState<string>("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoValidationModalMessage, setLogoValidationModalMessage] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingInstitutionProfile, setIsEditingInstitutionProfile] = useState(false);
  const [isSavingInstitutionProfile, setIsSavingInstitutionProfile] = useState(false);
  const [institutionProfileMessage, setInstitutionProfileMessage] = useState<string | null>(null);
  const [showInstitutionProfileSuccessPopup, setShowInstitutionProfileSuccessPopup] = useState(false);
  const [institutionIsVerified, setInstitutionIsVerified] = useState<boolean>(false);
  const [institutionTypeId, setInstitutionTypeId] = useState<string>("");
  const [institutionCategoryId, setInstitutionCategoryId] = useState<string>("");
  const [openInstitutionTypePickerSelect, setOpenInstitutionTypePickerSelect] = useState<
    "category" | "type" | null
  >(null);
  const [institutionCategories, setInstitutionCategories] = useState<
    Array<{ id: number; name: string; display_order: number | null; slug: string | null }>
  >([]);
  const [institutionTypes, setInstitutionTypes] = useState<
    Array<{ id: number; category_id: number; name: string; display_order: number | null }>
  >([]);
  const [institutionTypeLoading, setInstitutionTypeLoading] = useState(false);
  const [institutionTypeError, setInstitutionTypeError] = useState<string | null>(null);
  const [institutionFormData, setInstitutionFormData] = useState({
    institutionName: "",
    email: "",
    phone: "",
    website: "",
    subheading: "",
    city: "",
    district: "",
    workingHoursStart: "",
    workingHoursEnd: "",
    address: "",
    about: "",
    logoUrl: "",
  });
  const [institutionInitialFormData, setInstitutionInitialFormData] = useState({
    institutionName: "",
    email: "",
    phone: "",
    website: "",
    subheading: "",
    city: "",
    district: "",
    workingHoursStart: "",
    workingHoursEnd: "",
    address: "",
    about: "",
    logoUrl: "",
  });

  interface AnnouncementRow {
    id: string;
    title: string;
    content: string;
    preview: string;
    date: string;
    isActive: boolean;
    imageUrl: string | null;
    linkUrl: string | null;
  }

  const [announcementsList, setAnnouncementsList] = useState<AnnouncementRow[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    linkUrl: "",
    isActive: true,
  });
  const [announcementFormErrors, setAnnouncementFormErrors] = useState<{
    title?: string;
    content?: string;
  }>({});
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementImageFile, setAnnouncementImageFile] = useState<File | null>(null);
  const [announcementImageRemovePending, setAnnouncementImageRemovePending] = useState(false);
  const [announcementImageObjectUrl, setAnnouncementImageObjectUrl] = useState<string | null>(null);
  const announcementImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!announcementImageFile) {
      setAnnouncementImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(announcementImageFile);
    setAnnouncementImageObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [announcementImageFile]);

  const editingAnnouncementDbImageUrl = useMemo(() => {
    if (!editingAnnouncementId) return null;
    const raw = announcementsList.find((r) => r.id === editingAnnouncementId)?.imageUrl ?? "";
    const t = raw.trim();
    return t || null;
  }, [editingAnnouncementId, announcementsList]);

  const announcementPreviewSrc = useMemo(() => {
    if (announcementImageObjectUrl) return announcementImageObjectUrl;
    if (announcementImageRemovePending) return null;
    return editingAnnouncementDbImageUrl;
  }, [
    announcementImageObjectUrl,
    announcementImageRemovePending,
    editingAnnouncementDbImageUrl,
  ]);
  const announcementShowImagePreview = Boolean(announcementPreviewSrc);

  // Talepler sekmesi kaldırıldı.

interface InstitutionFeatureGroupRow {
  id: number;
  name: string;
  slug: string | null;
  display_order: number | null;
  is_active: boolean;
  /** Alt özellik alanı: seçilen üst kategori slug'ı ile eşleşir (nullable) */
  category_slug: string | null;
}

interface InstitutionFeatureDefinitionRow {
  id: number;
  group_id: number;
  name: string;
  slug: string | null;
  input_type: "boolean" | "text" | "number" | "single_select" | "multi_select" | string;
  help_text: string | null;
  placeholder: string | null;
  unit: string | null;
  display_order: number | null;
  is_active: boolean;
}

interface InstitutionFeatureChoiceRow {
  id: number;
  feature_definition_id: number;
  name?: string | null;
  label?: string | null;
  value?: string | null;
  display_order?: number | null;
  is_active: boolean;
}

interface InstitutionFeatureEntryRow {
  id: number;
  feature_definition_id: number;
  boolean_answer: boolean | null;
  text_answer: string | null;
  number_answer: number | null;
  selected_choice_id: number | null;
}

interface InstitutionFeatureEntryChoiceRow {
  institution_feature_entry_id: number;
  choice_id: number;
}

type InstitutionMediaRow = {
  id: string | number;
  institution_id: number;
  media_type: "photo" | "video" | string;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  title: string | null;
  created_at?: string | null;
};

interface InstitutionDetailChipItem {
  groupId: number;
  groupName: string;
  featureId: number;
  featureName: string;
  type: "boolean" | "single_select" | "multi_select";
  label: string;
}

interface InstitutionDetailPreparedData {
  items: InstitutionDetailChipItem[];
  grouped: Array<{
    groupId: number;
    groupName: string;
    chips: InstitutionDetailChipItem[];
  }>;
}

  // Talepler sekmesi kaldırıldı.
  const [institutionRecordMissing, setInstitutionRecordMissing] = useState(false);
  const [institutionFeaturesLoading, setInstitutionFeaturesLoading] = useState(false);
  const [institutionFeaturesError, setInstitutionFeaturesError] = useState<string | null>(null);
  const [institutionFeatureGroups, setInstitutionFeatureGroups] = useState<InstitutionFeatureGroupRow[]>([]);
  const [institutionFeatureDefinitions, setInstitutionFeatureDefinitions] = useState<InstitutionFeatureDefinitionRow[]>([]);
  const [institutionFeatureChoices, setInstitutionFeatureChoices] = useState<InstitutionFeatureChoiceRow[]>([]);
  const [institutionFeatureEntries, setInstitutionFeatureEntries] = useState<InstitutionFeatureEntryRow[]>([]);
  const [institutionFeatureEntryChoices, setInstitutionFeatureEntryChoices] = useState<InstitutionFeatureEntryChoiceRow[]>([]);
  const [institutionBooleanFeatureValues, setInstitutionBooleanFeatureValues] = useState<Record<number, boolean>>({});
  const [institutionTextFeatureValues, setInstitutionTextFeatureValues] = useState<Record<number, string>>({});
  const [institutionNumberFeatureValues, setInstitutionNumberFeatureValues] = useState<Record<number, string>>({});
  const [institutionSingleSelectValues, setInstitutionSingleSelectValues] = useState<Record<number, string>>({});
  const [institutionMultiSelectValues, setInstitutionMultiSelectValues] = useState<Record<number, string[]>>({});
  const [institutionFeaturesSaving, setInstitutionFeaturesSaving] = useState(false);
  const [institutionFeaturesSaveMessage, setInstitutionFeaturesSaveMessage] = useState<string | null>(null);
  const [institutionFeaturesSaveToastNonce, setInstitutionFeaturesSaveToastNonce] = useState(0);
  const [openInstitutionSelectId, setOpenInstitutionSelectId] = useState<number | null>(null);

  const [mediaItems, setMediaItems] = useState<InstitutionMediaRow[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaMessage, setMediaMessage] = useState<string | null>(null);
  const [mediaUploadingPhoto, setMediaUploadingPhoto] = useState(false);
  const [mediaUploadingVideo, setMediaUploadingVideo] = useState(false);
  const [mediaDeletingId, setMediaDeletingId] = useState<string | number | null>(null);
  const targetInstitutionIdParam = (searchParams.get("institutionId") ?? "").trim();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ? { id: session.user.id } : null);
      setIsAuthReady(true);
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
      if (!session?.user) {
        setUserType(null);
        setRoleLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes || !Number.isFinite(bytes)) return "—";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  const safeStorageFileName = (name: string) => {
    return name
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");
  };

  const INSTITUTION_MEDIA_PUBLIC_MARKER = "/object/public/institution-media/";

  const tryGetInstitutionMediaPathFromUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const i = url.indexOf(INSTITUTION_MEDIA_PUBLIC_MARKER);
    if (i === -1) return null;
    const path = url.slice(i + INSTITUTION_MEDIA_PUBLIC_MARKER.length).split("?")[0];
    return path.trim() || null;
  };

  const formatAnnouncementDate = (iso: string | null | undefined): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const buildAnnouncementPreview = (text: string, maxLen = 120): string => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen)}…`;
  };

  const mapAnnouncementDbRow = (row: {
    id: string;
    title: string | null;
    content: string | null;
    announcement_image_url: string | null;
    link_url: string | null;
    created_at: string | null;
    is_active: boolean | null;
  }): AnnouncementRow => {
    const content = String(row.content ?? "");
    const linkRaw = row.link_url;
    const linkTrimmed = typeof linkRaw === "string" ? linkRaw.trim() : "";
    return {
      id: row.id,
      title: String(row.title ?? ""),
      content,
      preview: buildAnnouncementPreview(content),
      date: formatAnnouncementDate(row.created_at),
      isActive: row.is_active === true,
      imageUrl: row.announcement_image_url,
      linkUrl: linkTrimmed || null,
    };
  };

  const loadAnnouncements = useCallback(
    async (supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>) => {
      if (!institutionId) {
        setAnnouncementsList([]);
        return;
      }
      const instId = Number(institutionId);
      if (!Number.isFinite(instId)) {
        setAnnouncementsList([]);
        return;
      }
      const supabase = supabaseArg ?? createSupabaseBrowserClient();
      setAnnouncementsLoading(true);
      setAnnouncementsError(null);
      try {
        const { data, error } = await supabase
          .from("announcements")
          .select("id, title, content, announcement_image_url, link_url, created_at, is_active")
          .eq("institution_id", instId)
          .order("created_at", { ascending: false });
        if (error) {
          console.error("Announcements load error:", error);
          setAnnouncementsError("Duyurular yüklenemedi.");
          setAnnouncementsList([]);
          return;
        }
        const rows = (data ?? []) as Array<{
          id: string;
          title: string | null;
          content: string | null;
          announcement_image_url: string | null;
          link_url: string | null;
          created_at: string | null;
          is_active: boolean | null;
        }>;
        setAnnouncementsList(rows.map(mapAnnouncementDbRow));
      } finally {
        setAnnouncementsLoading(false);
      }
    },
    [institutionId]
  );

  const uploadAnnouncementImage = async (
    file: File,
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    instId: number
  ): Promise<{ url: string } | { error: string }> => {
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) return { error: "Görsel en fazla 10MB olabilir." };
    if (!file.type.startsWith("image/")) return { error: "Lütfen geçerli bir görsel seçin." };
    const timestamp = Date.now();
    const cleanName = safeStorageFileName(file.name) || `${timestamp}.jpg`;
    const path = `institutions/${instId}/announcements/${timestamp}-${cleanName}`;
    const { error: uploadError } = await supabase.storage
      .from("institution-media")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) {
      console.error("Announcement image upload error:", uploadError);
      return { error: "Görsel yüklenemedi." };
    }
    const publicUrl = supabase.storage.from("institution-media").getPublicUrl(path).data.publicUrl;
    return { url: publicUrl };
  };

  const loadInstitutionMedia = async (supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>) => {
    if (!institutionId) {
      setMediaItems([]);
      return;
    }
    const instId = Number(institutionId);
    if (!Number.isFinite(instId)) {
      setMediaItems([]);
      return;
    }
    const supabase = supabaseArg ?? createSupabaseBrowserClient();
    setMediaLoading(true);
    try {
      const { data, error } = await supabase
        .from("institution_media")
        .select("id, institution_id, media_type, file_name, file_path, file_url, mime_type, file_size, title, created_at")
        .eq("institution_id", instId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Institution media load error:", error);
        setMediaItems([]);
        return;
      }
      setMediaItems((data as InstitutionMediaRow[] | null) ?? []);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleMediaUpload = async (file: File, mediaType: "photo" | "video") => {
    if (!user?.id || !institutionId) return;
    const instId = Number(institutionId);
    if (!Number.isFinite(instId)) return;

    const maxBytes = mediaType === "photo" ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMediaMessage(mediaType === "photo" ? "Maksimum 10MB fotoğraf yükleyebilirsiniz." : "Maksimum 100MB video yükleyebilirsiniz.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const timestamp = Date.now();
    const folder = mediaType === "photo" ? "photos" : "videos";
    const cleanName = safeStorageFileName(file.name) || `${timestamp}.${mediaType === "photo" ? "jpg" : "mp4"}`;
    const path = `institutions/${instId}/${folder}/${timestamp}-${cleanName}`;

    setMediaMessage(null);
    try {
      const { error: uploadError } = await supabase.storage
        .from("institution-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) {
        console.error("Institution media upload error:", uploadError);
        setMediaMessage("Yükleme sırasında bir hata oluştu.");
        return;
      }

      const publicUrl = supabase.storage.from("institution-media").getPublicUrl(path).data.publicUrl;

      const { error: insertError } = await supabase.from("institution_media").insert({
        institution_id: instId,
        media_type: mediaType,
        file_name: file.name,
        file_path: path,
        file_url: publicUrl,
        mime_type: file.type,
        file_size: file.size,
        title: null,
      });

      if (insertError) {
        console.error("Institution media insert error:", insertError);
        setMediaMessage("Kayıt eklenirken bir hata oluştu.");
        // Storage'da yetim dosya kalmasın
        await supabase.storage.from("institution-media").remove([path]);
        return;
      }

      await loadInstitutionMedia(supabase);
    } catch (e) {
      console.error("Institution media upload unexpected error:", e);
      setMediaMessage("Yükleme sırasında bir hata oluştu.");
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMediaMessage("Lütfen geçerli bir görsel dosyası seçin.");
      return;
    }
    setMediaUploadingPhoto(true);
    await handleMediaUpload(file, "photo");
    setMediaUploadingPhoto(false);
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setMediaMessage("Lütfen geçerli bir video dosyası seçin.");
      return;
    }
    setMediaUploadingVideo(true);
    await handleMediaUpload(file, "video");
    setMediaUploadingVideo(false);
  };

  const handleMediaDelete = async (item: InstitutionMediaRow) => {
    if (!institutionId) return;
    const instId = Number(institutionId);
    if (!Number.isFinite(instId)) return;
    if (!item?.id) return;

    const supabase = createSupabaseBrowserClient();
    setMediaDeletingId(item.id);
    setMediaMessage(null);
    try {
      const filePath = (item.file_path ?? "").trim();
      if (filePath) {
        const { error: removeError } = await supabase.storage.from("institution-media").remove([filePath]);
        if (removeError) {
          console.error("Institution media storage delete error:", removeError);
          setMediaMessage("Dosya silinirken bir hata oluştu.");
          return;
        }
      }

      const { error: deleteError } = await supabase
        .from("institution_media")
        .delete()
        .eq("id", item.id)
        .eq("institution_id", instId);
      if (deleteError) {
        console.error("Institution media row delete error:", deleteError);
        setMediaMessage("Kayıt silinirken bir hata oluştu.");
        return;
      }

      await loadInstitutionMedia(supabase);
    } finally {
      setMediaDeletingId(null);
    }
  };

  useEffect(() => {
    if (!isAuthReady || user !== null) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) setUser({ id: session.user.id });
      else router.replace("/login");
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, router]);

  useEffect(() => {
    if (!user?.id) {
      setRoleLoaded(false);
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    setRoleLoaded(false);
    Promise.all([
      resolveUserTypeFromUsersClient(user.id),
      resolveIsAdminFromUserRolesClient(user.id),
    ]).then(([type, adminFlag]) => {
      if (!cancelled) {
        setUserType(type);
        setIsAdmin(adminFlag);
        setRoleLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || (!isAdmin && userType !== "institution")) return;

    const userId = user.id;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function loadInstitutionProfile() {
      let row: Awaited<ReturnType<typeof loadInstitutionRowForAuthUserClient>>["row"] = null;
      let error: { message: string } | null = null;

      if (isAdmin && targetInstitutionIdParam) {
        const numericId = Number(targetInstitutionIdParam);
        if (!Number.isFinite(numericId) || numericId <= 0) {
          setInstitutionRecordMissing(true);
          setInstitutionId(null);
          setInstitutionName("");
          return;
        }

        const { data: adminRow, error: adminErr } = await supabase
          .from("institutions")
          .select(
            "id, slug, institution_name, official_email, official_phone, website, subheading, city, district, address, about, logo, is_verified, institution_type_id, working_hours_start, working_hours_end"
          )
          .eq("id", numericId)
          .maybeSingle();

        if (adminErr) {
          error = { message: adminErr.message };
        } else {
          row = (adminRow as typeof row) ?? null;
        }
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const authEmail = sessionData?.session?.user?.email ?? null;
        const ownerRes = await loadInstitutionRowForAuthUserClient(userId, supabase, {
          authEmail,
        });
        row = ownerRes.row;
        error = ownerRes.error;
      }

      if (cancelled) return;

      if (error) {
        console.error("Institution profile load error:", error);
        setInstitutionName("");
        return;
      }

      if (!row) {
        setInstitutionRecordMissing(true);
        setInstitutionId(null);
        setInstitutionName("");
        return;
      }
      setInstitutionRecordMissing(false);

      setInstitutionId(String(row.id));
      setInstitutionIsVerified(Boolean(row.is_verified));
      setInstitutionTypeId(
        typeof row.institution_type_id === "number" ? String(row.institution_type_id) : ""
      );

      const logoUrl = row.logo
        ? supabase.storage.from("institution-logos").getPublicUrl(row.logo).data.publicUrl
        : "";

      setInstitutionName(row.institution_name || "");

      setInstitutionFormData({
        institutionName: row.institution_name || "",
        email: row.official_email || "",
        phone: row.official_phone || "",
        website: row.website || "",
        subheading: row.subheading || "",
        city: row.city || "",
        district: row.district || "",
        workingHoursStart: institutionTimeToInputHHMM(row.working_hours_start),
        workingHoursEnd: institutionTimeToInputHHMM(row.working_hours_end),
        address: row.address || "",
        about: row.about || "",
        logoUrl,
      });
      setInstitutionInitialFormData({
        institutionName: row.institution_name || "",
        email: row.official_email || "",
        phone: row.official_phone || "",
        website: row.website || "",
        subheading: row.subheading || "",
        city: row.city || "",
        district: row.district || "",
        workingHoursStart: institutionTimeToInputHHMM(row.working_hours_start),
        workingHoursEnd: institutionTimeToInputHHMM(row.working_hours_end),
        address: row.address || "",
        about: row.about || "",
        logoUrl,
      });
    }

    void loadInstitutionProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id, userType, isAdmin, targetInstitutionIdParam]);

  useEffect(() => {
    if (!institutionId || (!isAdmin && userType !== "institution")) {
      setAnnouncementsList([]);
      setAnnouncementsError(null);
      return;
    }
    void loadAnnouncements();
  }, [institutionId, userType, isAdmin, loadAnnouncements]);

  useEffect(() => {
    if (activeTab !== "institutions" && activeTab !== "overview") return;
    if (!user?.id || (!isAdmin && userType !== "institution")) return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    setInstitutionTypeLoading(true);
    setInstitutionTypeError(null);
    (async () => {
      try {
        const [catsRes, typesRes] = await Promise.all([
          supabase
            .from("institution_categories")
            .select("id, name, slug, display_order, is_active")
            .eq("is_active", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("institution_types")
            .select("id, category_id, name, display_order, is_active")
            .eq("is_active", true)
            .order("display_order", { ascending: true }),
        ]);

        if (cancelled) return;

        if (catsRes.error) throw catsRes.error;
        if (typesRes.error) throw typesRes.error;

        const cats =
          (catsRes.data as
            | Array<{ id: number; name: string | null; slug: string | null; display_order: number | null }>
            | null) ?? [];
        const types =
          (typesRes.data as Array<{ id: number; category_id: number; name: string | null; display_order: number | null }> | null) ??
          [];

        setInstitutionCategories(
          cats
            .map((c) => ({
              id: c.id,
              name: (c.name ?? "").trim(),
              slug: (c.slug ?? "").trim() || null,
              display_order: c.display_order ?? 0,
            }))
            .filter((c) => Boolean(c.name))
        );
        setInstitutionTypes(
          types
            .map((t) => ({
              id: t.id,
              category_id: t.category_id,
              name: (t.name ?? "").trim(),
              display_order: t.display_order ?? 0,
            }))
            .filter((t) => Boolean(t.name))
        );
      } catch (e) {
        console.error("Institution type load error:", e);
        if (!cancelled) setInstitutionTypeError("Kategoriler yüklenirken bir hata oluştu.");
      } finally {
        if (!cancelled) setInstitutionTypeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, user?.id, userType, isAdmin]);

  useEffect(() => {
    if (activeTab !== "institutions" && activeTab !== "overview") return;
    const typeId = Number((institutionTypeId ?? "").trim());
    if (!Number.isFinite(typeId) || !typeId) return;
    if ((institutionCategoryId ?? "").trim()) return;
    const selectedType = institutionTypes.find((t) => t.id === typeId);
    if (!selectedType) return;
    setInstitutionCategoryId(String(selectedType.category_id));
  }, [activeTab, institutionTypeId, institutionCategoryId, institutionTypes]);

  useEffect(() => {
    if (activeTab !== "institutions") return;
    const catId = Number((institutionCategoryId ?? "").trim());
    if (!Number.isFinite(catId) || !catId) return;
    const currentTypeId = Number((institutionTypeId ?? "").trim());
    if (!Number.isFinite(currentTypeId) || !currentTypeId) return;
    const currentType = institutionTypes.find((t) => t.id === currentTypeId);
    if (!currentType || currentType.category_id !== catId) {
      setInstitutionTypeId("");
    }
  }, [activeTab, institutionCategoryId, institutionTypeId, institutionTypes]);

  useEffect(() => {
    if (activeTab !== "institutions") return;
    if (!institutionId) {
      setInstitutionFeatureGroups([]);
      setInstitutionFeatureDefinitions([]);
      setInstitutionFeatureChoices([]);
      setInstitutionFeatureEntries([]);
      setInstitutionFeatureEntryChoices([]);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function loadInstitutionFeatures() {
      setInstitutionFeaturesLoading(true);
      setInstitutionFeaturesError(null);

      try {
        const { data: groupsData, error: groupsError } = await supabase
          .from("institution_feature_groups")
          .select("id, name, slug, display_order, is_active, category_slug")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (groupsError) throw groupsError;
        if (cancelled) return;

        const { data: definitionsData, error: definitionsError } = await supabase
          .from("institution_feature_definitions")
          .select("id, group_id, name, slug, input_type, help_text, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (definitionsError) throw definitionsError;
        if (cancelled) return;

        const { data: choicesData, error: choicesError } = await supabase
          .from("institution_feature_choices")
          .select("id, feature_definition_id, name, is_active")
          .eq("is_active", true)
          .order("id", { ascending: true });
        if (choicesError) throw choicesError;
        if (cancelled) return;

        const { data: entriesData, error: entriesError } = await supabase
          .from("institution_feature_entries")
          .select("id, feature_definition_id, boolean_answer, text_answer, number_answer, selected_choice_id")
          .eq("institution_id", Number(institutionId));
        if (entriesError) throw entriesError;
        if (cancelled) return;

        const entries = (entriesData as InstitutionFeatureEntryRow[] | null) ?? [];
        const entryIds = entries.map((entry) => entry.id);
        let entryChoices: InstitutionFeatureEntryChoiceRow[] = [];

        if (entryIds.length > 0) {
          const { data: entryChoicesData, error: entryChoicesError } = await supabase
            .from("institution_feature_entry_choices")
            .select("institution_feature_entry_id, choice_id")
            .in("institution_feature_entry_id", entryIds);
          if (entryChoicesError) throw entryChoicesError;
          if (cancelled) return;
          entryChoices = (entryChoicesData as InstitutionFeatureEntryChoiceRow[] | null) ?? [];
        }

        setInstitutionFeatureGroups((groupsData as InstitutionFeatureGroupRow[] | null) ?? []);
        setInstitutionFeatureDefinitions((definitionsData as InstitutionFeatureDefinitionRow[] | null) ?? []);
        setInstitutionFeatureChoices((choicesData as InstitutionFeatureChoiceRow[] | null) ?? []);
        setInstitutionFeatureEntries(entries);
        setInstitutionFeatureEntryChoices(entryChoices);

        const definitions = (definitionsData as InstitutionFeatureDefinitionRow[] | null) ?? [];
        const entriesByFeatureId = new Map<number, InstitutionFeatureEntryRow>();
        entries.forEach((entry) => {
          entriesByFeatureId.set(entry.feature_definition_id, entry);
        });
        const nextBooleanValues: Record<number, boolean> = {};
        const nextTextValues: Record<number, string> = {};
        const nextNumberValues: Record<number, string> = {};
        const nextSingleSelectValues: Record<number, string> = {};
        const nextMultiSelectValues: Record<number, string[]> = {};
        const choiceIdsByEntryId = new Map<number, string[]>();
        entryChoices.forEach((row) => {
          const current = choiceIdsByEntryId.get(row.institution_feature_entry_id) ?? [];
          const choiceId = String(row.choice_id);
          if (!current.includes(choiceId)) current.push(choiceId);
          choiceIdsByEntryId.set(row.institution_feature_entry_id, current);
        });
        definitions
          .filter((feature) => feature.input_type === "boolean")
          .forEach((feature) => {
            const entry = entriesByFeatureId.get(feature.id);
            nextBooleanValues[feature.id] = Boolean(entry?.boolean_answer);
          });
        definitions
          .filter((feature) => feature.input_type === "text")
          .forEach((feature) => {
            const entry = entriesByFeatureId.get(feature.id);
            nextTextValues[feature.id] = entry?.text_answer ?? "";
          });
        definitions
          .filter((feature) => feature.input_type === "number")
          .forEach((feature) => {
            const entry = entriesByFeatureId.get(feature.id);
            nextNumberValues[feature.id] =
              typeof entry?.number_answer === "number" ? String(entry.number_answer) : "";
          });
        definitions
          .filter((feature) => feature.input_type === "single_select")
          .forEach((feature) => {
            const entry = entriesByFeatureId.get(feature.id);
            nextSingleSelectValues[feature.id] =
              typeof entry?.selected_choice_id === "number" ? String(entry.selected_choice_id) : "";
          });
        definitions
          .filter((feature) => feature.input_type === "multi_select")
          .forEach((feature) => {
            const entry = entriesByFeatureId.get(feature.id);
            nextMultiSelectValues[feature.id] = entry ? choiceIdsByEntryId.get(entry.id) ?? [] : [];
          });
        setInstitutionBooleanFeatureValues(nextBooleanValues);
        setInstitutionTextFeatureValues(nextTextValues);
        setInstitutionNumberFeatureValues(nextNumberValues);
        setInstitutionSingleSelectValues(nextSingleSelectValues);
        setInstitutionMultiSelectValues(nextMultiSelectValues);

        // Debug log removed to keep UI clean.
      } catch (error) {
        console.error(
          "Institution features load error:",
          error instanceof Error ? error.message : error
        );
        if (cancelled) return;
        setInstitutionFeaturesError("Kurum özellikleri yüklenirken bir hata oluştu.");
      } finally {
        if (!cancelled) setInstitutionFeaturesLoading(false);
      }
    }

    loadInstitutionFeatures();

    return () => {
      cancelled = true;
    };
  }, [institutionId, activeTab]);


  useEffect(() => {
    if (!isAuthReady || !user || !roleLoaded) return;
    if (userType !== "institution" && !isAdmin) {
      router.replace("/");
    }
  }, [isAuthReady, user, roleLoaded, userType, isAdmin, router]);

  useEffect(() => {
    if (!announcementModalOpen && !subscriptionModalOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (announcementModalOpen) {
          setAnnouncementModalOpen(false);
          setEditingAnnouncementId(null);
          setAnnouncementFormErrors({});
          setAnnouncementImageFile(null);
          setAnnouncementImageRemovePending(false);
        }
        if (subscriptionModalOpen) {
          setSubscriptionModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [announcementModalOpen, subscriptionModalOpen]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".panel-institutions-single-select-dropdown")) {
        setOpenInstitutionSelectId(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "media-management" && activeTab !== "overview") return;
    if (!institutionId) {
      setMediaItems([]);
      return;
    }
    void loadInstitutionMedia();
  }, [activeTab, institutionId]);

  const overviewMissingFields = useMemo((): OverviewMissingField[] => {
    const items: OverviewMissingField[] = [];
    if (!(institutionFormData.institutionName ?? "").trim()) {
      items.push({ id: "institution_name", label: "Kurum Adı", tab: "institution-profile" });
    }
    if (!(institutionFormData.phone ?? "").trim()) {
      items.push({ id: "phone", label: "Telefon", tab: "institution-profile" });
    }
    if (!(institutionFormData.email ?? "").trim()) {
      items.push({ id: "email", label: "E-posta", tab: "institution-profile" });
    }
    if (!(institutionFormData.logoUrl ?? "").trim()) {
      items.push({ id: "logo", label: "Logo", tab: "institution-profile" });
    }
    const overviewTypeIdNum = Number((institutionTypeId ?? "").trim());
    const overviewSelectedType =
      Number.isFinite(overviewTypeIdNum) && overviewTypeIdNum > 0
        ? institutionTypes.find((t) => t.id === overviewTypeIdNum)
        : undefined;
    const overviewHasCategory = Boolean(
      (institutionCategoryId ?? "").trim() ||
        (overviewSelectedType ? String(overviewSelectedType.category_id) : "")
    );
    const overviewHasType = Boolean((institutionTypeId ?? "").trim());
    const overviewCanEvaluateCategory =
      institutionTypes.length > 0 || Boolean((institutionCategoryId ?? "").trim());
    if ((!overviewHasType || overviewCanEvaluateCategory) && !overviewHasCategory) {
      items.push({ id: "category", label: "Kategori", tab: "institutions" });
    }
    if (!overviewHasType) {
      items.push({ id: "sub_type", label: "Alt Kategori", tab: "institutions" });
    }
    if (!(institutionFormData.address ?? "").trim()) {
      items.push({ id: "address", label: "Adres", tab: "institution-profile" });
    }
    if (!(institutionFormData.about ?? "").trim()) {
      items.push({ id: "about", label: "Kurum Açıklaması", tab: "institution-profile" });
    }
    return items;
  }, [
    institutionFormData.institutionName,
    institutionFormData.phone,
    institutionFormData.email,
    institutionFormData.logoUrl,
    institutionFormData.address,
    institutionFormData.about,
    institutionTypeId,
    institutionCategoryId,
    institutionTypes,
  ]);

  useEffect(() => {
    if (!showInstitutionProfileSuccessPopup) return;
    const timer = window.setTimeout(() => {
      setShowInstitutionProfileSuccessPopup(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [showInstitutionProfileSuccessPopup]);

  useEffect(() => {
    if (!institutionFeaturesSaveMessage) return;
    const timer = window.setTimeout(() => {
      setInstitutionFeaturesSaveMessage(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [institutionFeaturesSaveMessage, institutionFeaturesSaveToastNonce]);

  if (!isAuthReady || (user && !roleLoaded)) {
    return (
      <div className="panel-page">
        <HeaderClientWrapper />
        <div className="panel-page-loading">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (userType !== "institution" && !isAdmin) return null;

  const activeTabConfig = PANEL_TABS.find((t) => t.id === activeTab) ?? PANEL_TABS[0];

  const sidebarIcons: Record<PanelTabId, React.ReactNode> = {
    overview: <LayoutDashboard className="panel-sidebar-nav-icon" aria-hidden />,
    "institution-profile": <Building2 className="panel-sidebar-nav-icon" aria-hidden />,
    institutions: <Building className="panel-sidebar-nav-icon" aria-hidden />,
    "media-management": <Images className="panel-sidebar-nav-icon" aria-hidden />,
    announcements: <Megaphone className="panel-sidebar-nav-icon" aria-hidden />,
    subscription: <CreditCard className="panel-sidebar-nav-icon" aria-hidden />,
  };

  const handleInstitutionFormChange = (field: keyof typeof institutionFormData, value: string) => {
    setInstitutionFormData((prev) => ({ ...prev, [field]: value }));
  };

  const ALLOWED_LOGO_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
  };
  const LOGO_DIMENSION_RULE_TEXT =
    "Kare (1:1) logo kullanınız.\nÖnerilen ölçüler: 512x512 veya 1024x1024 px.\nİzin verilen aralık: 256x256 - 2048x2048 px.";

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setLogoUploadError(null);
    if (!file) return;
    const ext = ALLOWED_LOGO_TYPES[file.type];
    if (!ext) {
      setLogoUploadError("Sadece PNG, JPG veya WebP yükleyebilirsiniz.");
      return;
    }
    if (!institutionId) {
      setLogoUploadError("Kurum kaydı bulunamadı.");
      return;
    }
    const imageMeta = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const result = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(objectUrl);
        resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
    if (!imageMeta) {
      setLogoValidationModalMessage(LOGO_DIMENSION_RULE_TEXT);
      return;
    }
    if (imageMeta.width !== imageMeta.height) {
      setLogoValidationModalMessage(LOGO_DIMENSION_RULE_TEXT);
      return;
    }
    if (imageMeta.width < 256 || imageMeta.height < 256) {
      setLogoValidationModalMessage(LOGO_DIMENSION_RULE_TEXT);
      return;
    }
    if (imageMeta.width > 2048 || imageMeta.height > 2048) {
      setLogoValidationModalMessage(LOGO_DIMENSION_RULE_TEXT);
      return;
    }
    setLogoUploading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `institutions/${institutionId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("institution-logos")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setLogoUploading(false);
      setLogoUploadError(uploadError.message || "Yükleme başarısız.");
      return;
    }
    const { error: updateError } = await supabase
      .from("institutions")
      .update({ logo: path })
      .eq("id", Number(institutionId));
    if (updateError) {
      setLogoUploading(false);
      setLogoUploadError(updateError.message || "Kayıt güncellenemedi.");
      return;
    }
    const publicUrl = supabase.storage.from("institution-logos").getPublicUrl(path).data.publicUrl;
    setInstitutionFormData((prev) => ({ ...prev, logoUrl: publicUrl }));
    setLogoUploading(false);
  };

  const handleInstitutionProfileSave = async () => {
    if (!user?.id) {
      setInstitutionProfileMessage("Kurum profili kaydedilirken bir hata oluştu.");
      return;
    }
    if (!institutionId || !Number.isFinite(Number(institutionId))) {
      setInstitutionProfileMessage("Kurum kaydı bulunamadı.");
      return;
    }

    const websiteValue = institutionFormData.website.trim();
    if (websiteValue && !/^https?:\/\/.+/i.test(websiteValue)) {
      setInstitutionProfileMessage("Web sitesi alanı http:// veya https:// ile başlamalıdır.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const payload = {
      institution_name: institutionFormData.institutionName.trim(),
      official_phone: institutionFormData.phone.trim(),
      website: websiteValue,
      subheading: institutionFormData.subheading.trim(),
      city: institutionFormData.city.trim(),
      district: institutionFormData.district.trim(),
      working_hours_start: inputHHMMToDbTimeOrNull(institutionFormData.workingHoursStart),
      working_hours_end: inputHHMMToDbTimeOrNull(institutionFormData.workingHoursEnd),
      address: institutionFormData.address.trim(),
      about: institutionFormData.about.trim(),
    };

    setIsSavingInstitutionProfile(true);
    setInstitutionProfileMessage(null);

    try {
      const instNumericId = Number(institutionId);

      const { data, error } = await supabase
        .from("institutions")
        .update(payload)
        .eq("id", instNumericId)
        .select(
          "id, institution_name, official_email, official_phone, website, subheading, city, district, address, about, logo, working_hours_start, working_hours_end"
        )
        .maybeSingle();

      if (error) {
        console.error("Institution profile save error:", error);
        setInstitutionProfileMessage("Kurum profili kaydedilirken bir hata oluştu.");
        return;
      }

      if (!data) {
        console.error("Institution profile save error: no row returned");
        setInstitutionProfileMessage("Kurum profili kaydedilemedi.");
        return;
      }

      const row = data as {
        id: number;
        institution_name?: string | null;
        official_email?: string | null;
        official_phone?: string | null;
        website?: string | null;
        subheading?: string | null;
        city?: string | null;
        district?: string | null;
        address?: string | null;
        about?: string | null;
        logo?: string | null;
        working_hours_start?: string | null;
        working_hours_end?: string | null;
      };

      const logoUrl = row.logo
        ? supabase.storage.from("institution-logos").getPublicUrl(row.logo).data.publicUrl
        : "";

      const nextForm = {
        institutionName: row.institution_name || "",
        email: row.official_email || "",
        phone: row.official_phone || "",
        website: row.website || "",
        subheading: row.subheading || "",
        city: row.city || "",
        district: row.district || "",
        workingHoursStart: institutionTimeToInputHHMM(row.working_hours_start),
        workingHoursEnd: institutionTimeToInputHHMM(row.working_hours_end),
        address: row.address || "",
        about: row.about || "",
        logoUrl,
      };

      setInstitutionFormData(nextForm);
      setInstitutionInitialFormData(nextForm);
      setInstitutionName(nextForm.institutionName);
      setInstitutionProfileMessage(null);
      setShowInstitutionProfileSuccessPopup(true);
      setIsEditingInstitutionProfile(false);
    } finally {
      setIsSavingInstitutionProfile(false);
    }
  };

  const handleInstitutionProfileCancel = () => {
    setInstitutionFormData(institutionInitialFormData);
    setInstitutionProfileMessage(null);
    setIsEditingInstitutionProfile(false);
  };

  const isInstitutionProfileTab = activeTab === "institution-profile";
  const isInstitutionsTab = activeTab === "institutions";
  const isMediaManagementTab = activeTab === "media-management";
  const isAnnouncementsTab = activeTab === "announcements";
  const isSubscriptionTab = activeTab === "subscription";
  const isOverviewTab = activeTab === "overview";

  const overviewMediaCountDisplay =
    !institutionId || !Number.isFinite(Number(institutionId))
      ? "0"
      : mediaLoading && (activeTab === "overview" || activeTab === "media-management")
        ? "…"
        : String(mediaItems.length);

  type InstitutionFeaturesSaveScope = "full" | "upper-and-visible-lower";

  const flashInstitutionFeaturesSaveMessage = (message: string) => {
    setInstitutionFeaturesSaveToastNonce((n) => n + 1);
    setInstitutionFeaturesSaveMessage(message);
  };

  const handleSaveBooleanFeatures = async (saveScope: InstitutionFeaturesSaveScope = "full") => {
    if (!institutionId) {
      flashInstitutionFeaturesSaveMessage("Kurum özellikleri kaydedilirken bir hata oluştu.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    setInstitutionFeaturesSaving(true);
    setInstitutionFeaturesSaveMessage(null);

    try {
      // Kurum tipi seçimi (institutions.institution_type_id)
      const nextTypeId = (institutionTypeId ?? "").trim();
      if (user?.id) {
        const parsedTypeId = nextTypeId ? Number(nextTypeId) : null;
        const selectedTypeName =
          parsedTypeId && Number.isFinite(parsedTypeId)
            ? institutionTypes.find((t) => t.id === parsedTypeId)?.name ?? null
            : null;

        const { error: typeUpdateError } = await supabase
          .from("institutions")
          .update({
            institution_type_id: parsedTypeId,
            ...(selectedTypeName ? { type: selectedTypeName } : {}),
          })
          .eq("id", Number(institutionId));

        if (typeUpdateError) {
          console.error("Institution type save error:", typeUpdateError);
          throw typeUpdateError;
        }
      }

      const upperFeatureIds = new Set<number>();
      for (const { features } of institutionSelectionUpperGroups) {
        for (const f of features) upperFeatureIds.add(f.id);
      }
      const lowerVisibleFeatureIds = new Set<number>();
      for (const { features } of institutionSelectionLowerGroups) {
        for (const f of features) lowerVisibleFeatureIds.add(f.id);
      }
      const saveOnlyFeatureIds: Set<number> | null =
        saveScope === "upper-and-visible-lower"
          ? new Set([...upperFeatureIds, ...lowerVisibleFeatureIds])
          : null;
      const shouldPersistFeature = (featureId: number) =>
        saveOnlyFeatureIds === null || saveOnlyFeatureIds.has(featureId);

      const booleanFeatures = institutionFeatureDefinitions.filter(
        (feature) => feature.input_type === "boolean" && shouldPersistFeature(feature.id)
      );

      for (const feature of booleanFeatures) {
        const value = Boolean(institutionBooleanFeatureValues[feature.id]);
        const existingEntry = institutionFeatureEntries.find(
          (entry) => entry.feature_definition_id === feature.id
        );

        if (existingEntry) {
          const { error } = await supabase
            .from("institution_feature_entries")
            .update({ boolean_answer: value })
            .eq("id", existingEntry.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("institution_feature_entries")
            .insert({
              institution_id: Number(institutionId),
              feature_definition_id: feature.id,
              boolean_answer: value,
            });
          if (error) throw error;
        }
      }

      const textFeatures = institutionFeatureDefinitions.filter(
        (feature) => feature.input_type === "text" && shouldPersistFeature(feature.id)
      );

      for (const feature of textFeatures) {
        const rawValue = institutionTextFeatureValues[feature.id] ?? "";
        const value = rawValue.trim();
        const existingEntry = institutionFeatureEntries.find(
          (entry) => entry.feature_definition_id === feature.id
        );

        if (!value) {
          if (existingEntry) {
            const { error } = await supabase
              .from("institution_feature_entries")
              .delete()
              .eq("id", existingEntry.id);
            if (error) throw error;
          }
          continue;
        }

        if (existingEntry) {
          const { error } = await supabase
            .from("institution_feature_entries")
            .update({ text_answer: value })
            .eq("id", existingEntry.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("institution_feature_entries")
            .insert({
              institution_id: Number(institutionId),
              feature_definition_id: feature.id,
              text_answer: value,
            });
          if (error) throw error;
        }
      }

      const numberFeatures = institutionFeatureDefinitions.filter(
        (feature) => feature.input_type === "number" && shouldPersistFeature(feature.id)
      );

      for (const feature of numberFeatures) {
        const rawValue = (institutionNumberFeatureValues[feature.id] ?? "").trim();
        const existingEntry = institutionFeatureEntries.find(
          (entry) => entry.feature_definition_id === feature.id
        );

        if (!rawValue) {
          if (existingEntry) {
            const { error } = await supabase
              .from("institution_feature_entries")
              .delete()
              .eq("id", existingEntry.id);
            if (error) throw error;
          }
          continue;
        }

        const parsedNumber = Number(rawValue);
        if (!Number.isFinite(parsedNumber)) continue;

        if (existingEntry) {
          const { error } = await supabase
            .from("institution_feature_entries")
            .update({ number_answer: parsedNumber })
            .eq("id", existingEntry.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("institution_feature_entries")
            .insert({
              institution_id: Number(institutionId),
              feature_definition_id: feature.id,
              number_answer: parsedNumber,
            });
          if (error) throw error;
        }
      }

      const singleSelectFeatures = institutionFeatureDefinitions.filter(
        (feature) =>
          (feature.input_type === "single_select" || isSchoolHoursFeature(feature)) &&
          shouldPersistFeature(feature.id)
      );

      for (const feature of singleSelectFeatures) {
        const selectedChoiceIdRaw = (institutionSingleSelectValues[feature.id] ?? "").trim();
        const existingEntry = institutionFeatureEntries.find(
          (entry) => entry.feature_definition_id === feature.id
        );

        if (!selectedChoiceIdRaw) {
          if (existingEntry) {
            const { error } = await supabase
              .from("institution_feature_entries")
              .delete()
              .eq("id", existingEntry.id);
            if (error) throw error;
          }
          continue;
        }

        const selectedChoiceId = Number(selectedChoiceIdRaw);
        if (!Number.isFinite(selectedChoiceId)) continue;

        if (existingEntry) {
          const { error } = await supabase
            .from("institution_feature_entries")
            .update({ selected_choice_id: selectedChoiceId })
            .eq("id", existingEntry.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("institution_feature_entries")
            .insert({
              institution_id: Number(institutionId),
              feature_definition_id: feature.id,
              selected_choice_id: selectedChoiceId,
            });
          if (error) throw error;
        }
      }

      const multiSelectFeatures = institutionFeatureDefinitions.filter(
        (feature) =>
          feature.input_type === "multi_select" &&
          !isSchoolHoursFeature(feature) &&
          shouldPersistFeature(feature.id)
      );

      for (const feature of multiSelectFeatures) {
        const selectedChoiceIdsRaw = institutionMultiSelectValues[feature.id] ?? [];
        const selectedChoiceIds = Array.from(
          new Set(
            selectedChoiceIdsRaw
              .map((choiceId) => Number(choiceId))
              .filter((choiceId) => Number.isFinite(choiceId))
          )
        );
        const existingEntry = institutionFeatureEntries.find(
          (entry) => entry.feature_definition_id === feature.id
        );

        if (selectedChoiceIds.length === 0) {
          if (existingEntry) {
            const { error: clearChoicesError } = await supabase
              .from("institution_feature_entry_choices")
              .delete()
              .eq("institution_feature_entry_id", existingEntry.id);
            if (clearChoicesError) throw clearChoicesError;

            const { error: deleteEntryError } = await supabase
              .from("institution_feature_entries")
              .delete()
              .eq("id", existingEntry.id);
            if (deleteEntryError) throw deleteEntryError;
          }
          continue;
        }

        let entryId = existingEntry?.id ?? null;

        if (!entryId) {
          const { data: insertedEntry, error: insertEntryError } = await supabase
            .from("institution_feature_entries")
            .insert({
              institution_id: Number(institutionId),
              feature_definition_id: feature.id,
            })
            .select("id")
            .single();
          if (insertEntryError) throw insertEntryError;
          entryId = insertedEntry.id;
        }

        const { error: clearOldChoicesError } = await supabase
          .from("institution_feature_entry_choices")
          .delete()
          .eq("institution_feature_entry_id", entryId);
        if (clearOldChoicesError) throw clearOldChoicesError;

        const newChoiceRows = selectedChoiceIds.map((choiceId) => ({
          institution_feature_entry_id: entryId as number,
          choice_id: choiceId,
        }));

        if (newChoiceRows.length > 0) {
          const { error: insertChoicesError } = await supabase
            .from("institution_feature_entry_choices")
            .insert(newChoiceRows);
          if (insertChoicesError) throw insertChoicesError;
        }
      }

      flashInstitutionFeaturesSaveMessage("Kurum özellikleri güncellendi.");

      const persistedFeatureDefinitionIdList = Array.from(
        new Set<number>([
          ...booleanFeatures.map((f) => f.id),
          ...textFeatures.map((f) => f.id),
          ...numberFeatures.map((f) => f.id),
          ...singleSelectFeatures.map((f) => f.id),
          ...multiSelectFeatures.map((f) => f.id),
        ])
      );

      if (activeTab === "institutions") {
        const refreshId = Number(institutionId);
        if (Number.isFinite(refreshId)) {
          if (persistedFeatureDefinitionIdList.length > 0) {
            const persistedIdSet = new Set(persistedFeatureDefinitionIdList);
            const oldEntryIdsToReplace = new Set(
              institutionFeatureEntries
                .filter((e) => persistedIdSet.has(e.feature_definition_id))
                .map((e) => e.id)
            );
            const multiFeatureIdSet = new Set(multiSelectFeatures.map((f) => f.id));

            const [entriesRes, instVerifiedRes] = await Promise.all([
              supabase
                .from("institution_feature_entries")
                .select("id, feature_definition_id, boolean_answer, text_answer, number_answer, selected_choice_id")
                .eq("institution_id", refreshId)
                .in("feature_definition_id", persistedFeatureDefinitionIdList),
              supabase.from("institutions").select("is_verified").eq("id", refreshId).maybeSingle(),
            ]);

            if (!instVerifiedRes.error) {
              setInstitutionIsVerified(Boolean(instVerifiedRes.data?.is_verified));
            }

            if (!entriesRes.error && entriesRes.data) {
              const freshRows = (entriesRes.data as InstitutionFeatureEntryRow[]) ?? [];
              setInstitutionFeatureEntries((prev) => {
                const rest = prev.filter((e) => !persistedIdSet.has(e.feature_definition_id));
                return [...rest, ...freshRows];
              });

              const choiceRelatedEntryIds = freshRows
                .filter((e) => multiFeatureIdSet.has(e.feature_definition_id))
                .map((e) => e.id);

              if (choiceRelatedEntryIds.length > 0) {
                const { data: choiceData, error: choiceErr } = await supabase
                  .from("institution_feature_entry_choices")
                  .select("institution_feature_entry_id, choice_id")
                  .in("institution_feature_entry_id", choiceRelatedEntryIds);
                if (!choiceErr && choiceData) {
                  const choiceRows = choiceData as InstitutionFeatureEntryChoiceRow[];
                  setInstitutionFeatureEntryChoices((prev) => {
                    const pruneIds = new Set([...oldEntryIdsToReplace, ...choiceRelatedEntryIds]);
                    return [...prev.filter((c) => !pruneIds.has(c.institution_feature_entry_id)), ...choiceRows];
                  });
                }
              } else {
                setInstitutionFeatureEntryChoices((prev) =>
                  prev.filter((c) => !oldEntryIdsToReplace.has(c.institution_feature_entry_id))
                );
              }
            }
          } else {
            const { data: instRow, error: instError } = await supabase
              .from("institutions")
              .select("is_verified")
              .eq("id", refreshId)
              .maybeSingle();
            if (!instError) {
              setInstitutionIsVerified(Boolean(instRow?.is_verified));
            }
          }
        }
      }
    } catch (error) {
      console.error("Institution features save error:", error);
      flashInstitutionFeaturesSaveMessage("Kurum özellikleri kaydedilirken bir hata oluştu.");
    } finally {
      setInstitutionFeaturesSaving(false);
    }
  };
  const institutionGroupsWithFeatures = institutionFeatureGroups
    .map((group) => {
      const features = institutionFeatureDefinitions
        .filter((feature) => feature.group_id === group.id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      return { group, features };
    })
    .filter((item) => item.features.length > 0);
  const getDisplayFeatureName = (name: string) => {
    const trimmed = (name ?? "").trim();
    const key = trimmed.toLocaleLowerCase("tr-TR");
    if (key === "engelliye uygun".toLocaleLowerCase("tr-TR")) {
      return "Engellilere Uygun";
    }
    if (key === "fiyat aralığı".toLocaleLowerCase("tr-TR")) {
      return "Aylık Ortalama Fiyat Aralığı";
    }
    return trimmed;
  };

  const isSchoolHoursFeature = (feature: InstitutionFeatureDefinitionRow) =>
    (feature.name ?? "").trim().toLocaleLowerCase("tr-TR") === "okul saatleri";

  const selectionGroups = institutionGroupsWithFeatures
    .map(({ group, features }) => ({
      group,
      features: features.filter(
        (feature) =>
          (feature.input_type === "text" ||
            feature.input_type === "number" ||
          (feature.input_type === "boolean" ||
            feature.input_type === "multi_select" ||
            feature.input_type === "single_select"))
      ),
    }))
    .filter((item) => item.features.length > 0);
  /** Üst kartta yalnızca Kategori (ayrı section) + Başlıca Özellikler grubu; diğer tüm gruplar alt alanda (category_slug). */
  const baslicaOzelliklerGroup = selectionGroups.find(
    ({ group }) => group.name.trim().toLocaleLowerCase("tr-TR") === "başlıca özellikler"
  );
  const okulImkanlariIndex = selectionGroups.findIndex(
    ({ group }) => group.name.trim().toLocaleLowerCase("tr-TR") === "okul imkanları"
  );
  const institutionSelectionUpperGroups = baslicaOzelliklerGroup
    ? [baslicaOzelliklerGroup]
    : okulImkanlariIndex !== -1
      ? selectionGroups.slice(0, okulImkanlariIndex)
      : selectionGroups;
  const institutionSelectionLowerGroupsRaw = baslicaOzelliklerGroup
    ? selectionGroups.filter((item) => item.group.id !== baslicaOzelliklerGroup.group.id)
    : okulImkanlariIndex !== -1
      ? selectionGroups.slice(okulImkanlariIndex)
      : [];
  const selectedInstitutionCategorySlug = (() => {
    const id = (institutionCategoryId ?? "").trim();
    if (!id) return null;
    const cat = institutionCategories.find((c) => String(c.id) === id);
    const slug = (cat?.slug ?? "").trim();
    return slug.length > 0 ? slug : null;
  })();
  const institutionSelectionLowerGroups =
    selectedInstitutionCategorySlug === null
      ? []
      : institutionSelectionLowerGroupsRaw.filter(
          ({ group }) => (group.category_slug ?? "").trim() === selectedInstitutionCategorySlug
        );
  const institutionDetailPreparedData: InstitutionDetailPreparedData = (() => {
    const choiceNameById = new Map<string, string>();
    institutionFeatureChoices.forEach((choice) => {
      const name = (choice.name ?? "").trim();
      if (name) {
        choiceNameById.set(String(choice.id), name);
      }
    });

    const items: InstitutionDetailChipItem[] = [];

    institutionGroupsWithFeatures.forEach(({ group, features }) => {
      features.forEach((feature) => {
        if (feature.input_type === "boolean") {
          if (Boolean(institutionBooleanFeatureValues[feature.id])) {
            items.push({
              groupId: group.id,
              groupName: group.name,
              featureId: feature.id,
              featureName: getDisplayFeatureName(feature.name),
              type: "boolean",
              label: getDisplayFeatureName(feature.name),
            });
          }
          return;
        }

        if (feature.input_type === "single_select") {
          const selectedId = (institutionSingleSelectValues[feature.id] ?? "").trim();
          if (!selectedId) return;
          const selectedName = choiceNameById.get(selectedId);
          if (!selectedName) return;
          items.push({
            groupId: group.id,
            groupName: group.name,
            featureId: feature.id,
            featureName: getDisplayFeatureName(feature.name),
            type: "single_select",
            label: selectedName,
          });
          return;
        }

        if (feature.input_type === "multi_select") {
          const selectedIds = institutionMultiSelectValues[feature.id] ?? [];
          Array.from(new Set(selectedIds)).forEach((choiceId) => {
            const selectedName = choiceNameById.get(choiceId);
            if (!selectedName) return;
            items.push({
              groupId: group.id,
              groupName: group.name,
              featureId: feature.id,
              featureName: getDisplayFeatureName(feature.name),
              type: "multi_select",
              label: selectedName,
            });
          });
        }
      });
    });

    const groupedMap = new Map<number, { groupId: number; groupName: string; chips: InstitutionDetailChipItem[] }>();
    items.forEach((item) => {
      const current = groupedMap.get(item.groupId) ?? {
        groupId: item.groupId,
        groupName: item.groupName,
        chips: [],
      };
      current.chips.push(item);
      groupedMap.set(item.groupId, current);
    });

    return {
      items,
      grouped: Array.from(groupedMap.values()),
    };
  })();

  // Talepler sekmesi kaldırıldı.

  const openNewAnnouncementModal = () => {
    setEditingAnnouncementId(null);
    setAnnouncementForm({ title: "", content: "", linkUrl: "", isActive: true });
    setAnnouncementFormErrors({});
    setAnnouncementImageFile(null);
    setAnnouncementImageRemovePending(false);
    if (announcementImageInputRef.current) announcementImageInputRef.current.value = "";
    setAnnouncementModalOpen(true);
  };

  const openEditAnnouncementModal = (item: AnnouncementRow) => {
    setEditingAnnouncementId(item.id);
    setAnnouncementForm({
      title: item.title,
      content: item.content,
      linkUrl: item.linkUrl ?? "",
      isActive: item.isActive,
    });
    setAnnouncementFormErrors({});
    setAnnouncementImageFile(null);
    setAnnouncementImageRemovePending(false);
    if (announcementImageInputRef.current) announcementImageInputRef.current.value = "";
    setAnnouncementModalOpen(true);
  };

  const closeAnnouncementModal = () => {
    setAnnouncementModalOpen(false);
    setEditingAnnouncementId(null);
    setAnnouncementFormErrors({});
    setAnnouncementImageFile(null);
    setAnnouncementImageRemovePending(false);
    if (announcementImageInputRef.current) announcementImageInputRef.current.value = "";
  };

  const handleAnnouncementFormChange = (
    field: keyof typeof announcementForm,
    value: string | boolean
  ) => {
    setAnnouncementForm((prev) => ({ ...prev, [field]: value }));
    setAnnouncementFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAnnouncementImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAnnouncementImageRemovePending(false);
    setAnnouncementImageFile(file);
  };

  const handleAnnouncementImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAnnouncementImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (announcementSaving) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return;
    setAnnouncementImageRemovePending(false);
    setAnnouncementImageFile(file);
  };

  const handleAnnouncementImagePickClick = () => {
    if (announcementSaving) return;
    announcementImageInputRef.current?.click();
  };

  const handleAnnouncementImageClearOrRemove = () => {
    if (announcementSaving) return;
    if (announcementImageFile) {
      setAnnouncementImageFile(null);
      if (announcementImageInputRef.current) announcementImageInputRef.current.value = "";
      return;
    }
    if (editingAnnouncementDbImageUrl) {
      setAnnouncementImageRemovePending(true);
    }
  };

  const handleAnnouncementSave = async () => {
    const title = announcementForm.title.trim();
    const content = announcementForm.content.trim();
    const link_url = announcementForm.linkUrl.trim() || null;
    const errors: { title?: string; content?: string } = {};
    if (!title) errors.title = "Başlık zorunludur.";
    if (!content) errors.content = "İçerik zorunludur.";
    if (Object.keys(errors).length > 0) {
      setAnnouncementFormErrors(errors);
      return;
    }
    if (!user?.id || !institutionId) {
      setAnnouncementsError("Kurum bilgisi bulunamadı.");
      return;
    }
    const instId = Number(institutionId);
    if (!Number.isFinite(instId)) {
      setAnnouncementsError("Kurum bilgisi bulunamadı.");
      return;
    }
    if (announcementSaving) return;

    const supabase = createSupabaseBrowserClient();
    setAnnouncementSaving(true);
    setAnnouncementsError(null);

    try {
      const existingRow = editingAnnouncementId
        ? announcementsList.find((r) => r.id === editingAnnouncementId)
        : null;

      const is_active = announcementForm.isActive;

      if (editingAnnouncementId) {
        if (announcementImageFile) {
          const up = await uploadAnnouncementImage(announcementImageFile, supabase, instId);
          if ("error" in up) {
            setAnnouncementsError(up.error);
            return;
          }
          const newUrl = up.url;
          const newPath = tryGetInstitutionMediaPathFromUrl(newUrl);

          const { error: updateError } = await supabase
            .from("announcements")
            .update({
              title,
              content,
              link_url,
              is_active,
              announcement_image_url: newUrl,
            })
            .eq("id", editingAnnouncementId)
            .eq("institution_id", instId);

          if (updateError) {
            console.error("Announcement update error:", updateError);
            setAnnouncementsError("Duyuru güncellenemedi.");
            if (newPath) {
              const { error: rollbackErr } = await supabase.storage.from("institution-media").remove([newPath]);
              if (rollbackErr) console.error("Announcement new image rollback error:", rollbackErr);
            }
            return;
          }

          if (existingRow?.imageUrl) {
            const oldPath = tryGetInstitutionMediaPathFromUrl(existingRow.imageUrl);
            if (oldPath && oldPath !== newPath) {
              const { error: removeError } = await supabase.storage.from("institution-media").remove([oldPath]);
              if (removeError) console.error("Announcement old image storage delete error:", removeError);
            }
          }
        } else if (announcementImageRemovePending) {
          const { error: updateError } = await supabase
            .from("announcements")
            .update({
              title,
              content,
              link_url,
              is_active,
              announcement_image_url: null,
            })
            .eq("id", editingAnnouncementId)
            .eq("institution_id", instId);

          if (updateError) {
            console.error("Announcement update error:", updateError);
            setAnnouncementsError("Duyuru güncellenemedi.");
            return;
          }

          if (existingRow?.imageUrl) {
            const oldPath = tryGetInstitutionMediaPathFromUrl(existingRow.imageUrl);
            if (oldPath) {
              const { error: removeError } = await supabase.storage.from("institution-media").remove([oldPath]);
              if (removeError) console.error("Announcement image storage delete error:", removeError);
            }
          }
        } else {
          const { error: updateError } = await supabase
            .from("announcements")
            .update({
              title,
              content,
              link_url,
              is_active,
            })
            .eq("id", editingAnnouncementId)
            .eq("institution_id", instId);

          if (updateError) {
            console.error("Announcement update error:", updateError);
            setAnnouncementsError("Duyuru güncellenemedi.");
            return;
          }
        }
      } else {
        let imageUrl: string | null = null;
        if (announcementImageFile) {
          const up = await uploadAnnouncementImage(announcementImageFile, supabase, instId);
          if ("error" in up) {
            setAnnouncementsError(up.error);
            return;
          }
          imageUrl = up.url;
        }

        const { error: insertError } = await supabase.from("announcements").insert({
          institution_id: instId,
          title,
          content,
          link_url,
          is_active,
          announcement_image_url: imageUrl,
        });

        if (insertError) {
          console.error("Announcement insert error:", insertError);
          setAnnouncementsError("Duyuru kaydedilemedi.");
          if (imageUrl) {
            const p = tryGetInstitutionMediaPathFromUrl(imageUrl);
            if (p) await supabase.storage.from("institution-media").remove([p]);
          }
          return;
        }
      }

      await loadAnnouncements(supabase);
      closeAnnouncementModal();
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleAnnouncementDelete = async (id: string) => {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    if (!institutionId) return;
    const instId = Number(institutionId);
    if (!Number.isFinite(instId)) return;

    const row = announcementsList.find((r) => r.id === id);
    const supabase = createSupabaseBrowserClient();
    setAnnouncementsError(null);

    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("institution_id", instId);

    if (deleteError) {
      console.error("Announcement delete error:", deleteError);
      setAnnouncementsError("Duyuru silinemedi.");
      return;
    }

    if (row?.imageUrl) {
      const path = tryGetInstitutionMediaPathFromUrl(row.imageUrl);
      if (path) {
        const { error: removeError } = await supabase.storage.from("institution-media").remove([path]);
        if (removeError) console.error("Announcement image storage delete error:", removeError);
      }
    }

    await loadAnnouncements(supabase);
  };

  const handleTabSelect = (tabId: PanelTabId) => {
    if (tabId === "subscription") {
      setSubscriptionModalOpen(true);
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <div className="panel-page">
      <HeaderClientWrapper />
      <div className="panel-page-container">
        <header className="panel-page-intro">
          <h1 className="panel-page-title">Yönetim Paneli</h1>
          <p className="panel-page-subtitle">Hesap ve panel ayarlarınızı buradan yönetebilirsiniz.</p>
        </header>
        <aside className="panel-sidebar" aria-label="Panel menüsü">
          <div className="panel-sidebar-content">
            <div className="panel-sidebar-institution">
              <div className="panel-sidebar-institution-avatar-wrap">
                <div className="panel-sidebar-institution-avatar">
                  <Building2 className="panel-sidebar-institution-avatar-icon" aria-hidden />
                </div>
                <button
                  type="button"
                  className="panel-sidebar-institution-avatar-edit"
                  aria-label="Kurum profilini düzenle"
                  onClick={() => setActiveTab("institution-profile")}
                >
                  <PencilLine className="panel-sidebar-institution-avatar-edit-icon" aria-hidden />
                </button>
              </div>
              <h2 className="panel-sidebar-institution-name">{institutionName || "Yükleniyor…"}</h2>
              <p className="panel-sidebar-institution-role">Kurumsal Üye</p>
              {institutionIsVerified ? (
                <span className="panel-sidebar-institution-badge">Doğrulanmış Hesap</span>
              ) : null}
            </div>
            <nav className="panel-sidebar-nav">
              {PANEL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`panel-sidebar-nav-item ${activeTab === tab.id ? "panel-sidebar-nav-item--active" : ""}`}
                  onClick={() => handleTabSelect(tab.id)}
                  aria-current={activeTab === tab.id ? "true" : undefined}
                >
                  {sidebarIcons[tab.id]}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {activeTab === "institutions" ? (
            <div className="panel-sidebar-below-menu">
              <div className="panel-institutions-verification-badge" role="note" aria-label="Kurumsal Doğrulama">
                <div className="panel-institutions-verification-text">
                  <div className="panel-institutions-verification-head">
                    <div className="panel-institutions-verification-icon" aria-hidden>
                      <CheckCircle size={20} />
                    </div>
                    <h4 className="panel-institutions-verification-title">Kurumsal Doğrulama</h4>
                  </div>
                  <p className="panel-institutions-verification-desc">
                    Bu özellikler sayfasında yapacağınız her değişiklik, kurum profilinizde anında yayınlanır ve
                    &quot;Doğrulanmış&quot; etiketiyle gösterilir.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
        <div className="panel-page-main">
          <section
            className={
              isOverviewTab
                ? "panel-main-card panel-overview-card"
                : isInstitutionProfileTab
                  ? "panel-main-card panel-institution-card"
                  : "panel-main-card"
            }
            aria-labelledby={isOverviewTab ? "panel-overview-title" : "panel-card-title"}
          >
            {isOverviewTab ? (
              <>
                <div className="panel-overview-header">
                  <h2 id="panel-overview-title" className="panel-overview-title">
                    Genel Bakış
                  </h2>
                  <p className="panel-overview-subtitle">
                    Kurum özetiniz ve panel kullanım rehberi.
                  </p>
                </div>
                <div className="panel-overview-content">
                  <div className="panel-overview-cards">
                    <div className="panel-overview-media-status-card">
                      <div className="panel-overview-media-status-body">
                        <span className="panel-overview-media-status-label">MEDYA DURUMU</span>
                        <h3 className="panel-overview-media-status-heading">Toplam Medya Sayısı</h3>
                        <p className="panel-overview-media-status-desc">
                          Yüklenen fotoğraf/video adedi.
                        </p>
                      </div>
                      <div className="panel-overview-media-status-count" aria-live="polite">
                        <span className="panel-overview-media-status-count-value">
                          {overviewMediaCountDisplay}
                        </span>
                      </div>
                    </div>
                    <div className="panel-overview-missing-info-card">
                      <span className="panel-overview-missing-info-label">EKSİK BİLGİLER</span>
                      <h3 className="panel-overview-missing-info-heading">Eksik Bilgiler Uyarısı</h3>
                      {overviewMissingFields.length === 0 ? (
                        <p className="panel-overview-missing-info-ok">Eksik önemli bilgi bulunmuyor.</p>
                      ) : (
                        <div
                          className="panel-overview-missing-info-scroll"
                          role="list"
                          aria-label="Eksik alanlar"
                        >
                          {overviewMissingFields.map((field) => (
                            <div
                              key={field.id}
                              className="panel-overview-missing-info-mini"
                              role="listitem"
                            >
                              <div className="panel-overview-missing-info-mini-icon" aria-hidden>
                                {renderOverviewMissingFieldIcon(field.id)}
                              </div>
                              <div className="panel-overview-missing-info-mini-body">
                                <span className="panel-overview-missing-info-mini-title">
                                  {field.label}
                                </span>
                                <button
                                  type="button"
                                  className="panel-overview-missing-info-mini-action"
                                  onClick={() => handleTabSelect(field.tab)}
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
                  <div className="panel-overview-announcements panel-overview-welcome-card">
                    <h3 className="panel-overview-announcements-title">Hoş Geldiniz</h3>
                    <div className="panel-overview-welcome-body">
                      <p>
                        Bu panel üzerinden kurumunuza ait tüm bilgileri tek bir yerden yönetebilirsiniz.{" "}
                      </p>
                      <p className="panel-overview-welcome-row">
                        <span className="panel-overview-welcome-row-icon" aria-hidden>
                          <Building2 className="panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="panel-overview-welcome-row-text">
                          <strong>Kurum Profili</strong> sekmesinden kurum adı, iletişim bilgileri, adres ve açıklama
                          gibi temel bilgilerinizi eksiksiz doldurmanız önemlidir.
                        </span>
                      </p>
                      <p className="panel-overview-welcome-row">
                        <span className="panel-overview-welcome-row-icon" aria-hidden>
                          <Tags className="panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="panel-overview-welcome-row-text">
                          <strong>Kurum Özellikleri</strong> bölümünde seçeceğiniz kategori, alt kategori ve diğer
                          kurum özellikleri, kurum sayfanızda ziyaretçilere gösterilir. Aynı zamanda bu bilgiler
                          filtreleme alanlarında da kullanılacağı için, kurumunuzun daha kolay bulunması ve öne
                          çıkması adına tüm alanları doğru ve eksiksiz doldurmanızı öneririz.
                        </span>
                      </p>
                      <p className="panel-overview-welcome-row">
                        <span className="panel-overview-welcome-row-icon" aria-hidden>
                          <Images className="panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="panel-overview-welcome-row-text">
                          <strong>Medya Yönetimi</strong> alanından yüklediğiniz görseller kurum sayfanızda albüm
                          olarak listelenir ve kurumunuzu daha güçlü şekilde tanıtmanıza yardımcı olur.
                        </span>
                      </p>
                      <p className="panel-overview-welcome-row">
                        <span className="panel-overview-welcome-row-icon" aria-hidden>
                          <Megaphone className="panel-overview-welcome-icon-svg" />
                        </span>
                        <span className="panel-overview-welcome-row-text">
                          <strong>Duyurular</strong> bölümünde ise bursluluk sınavı tarihi, etkinlik, yarışma, kayıt
                          dönemi veya bilgilendirme içerikleri gibi paylaşmak istediğiniz duyuruları
                          yayınlayabilirsiniz. Her duyuru için aktiflik durumunu belirleyebilir, süresi geçen
                          duyurularınızı pasif hale getirseniz bile ziyaretçiler bunları süresi doldu bilgisiyle
                          görmeye devam edebilir.
                        </span>
                      </p>
                      <p>
                        Kurum sayfanızın daha güçlü görünmesi için bilgilerinizi düzenli olarak güncel tutmanızı
                        öneririz.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="panel-main-card-header">
              <div className="panel-main-card-header-left">
                {isAnnouncementsTab ? <Megaphone className="panel-main-card-icon" aria-hidden /> : null}
                {isSubscriptionTab ? <CreditCard className="panel-main-card-icon" aria-hidden /> : null}
                {isInstitutionProfileTab ? <Building2 className="panel-main-card-icon" aria-hidden /> : null}
                {isMediaManagementTab ? <Images className="panel-main-card-icon" aria-hidden /> : null}
                {isInstitutionsTab ? <Building className="panel-main-card-icon" aria-hidden /> : null}
                <h2 id="panel-card-title" className="panel-main-card-title">
                  {isAnnouncementsTab ? "İçerikler & Duyurular" : activeTabConfig.label}
                </h2>
              </div>
              {isInstitutionProfileTab ? (
                isEditingInstitutionProfile ? (
                  <div className="panel-institution-header-actions">
                  <Button
                    type="button"
                    variant="default"
                    className="panel-institution-save-btn"
                    onClick={handleInstitutionProfileSave}
                      disabled={isSavingInstitutionProfile}
                  >
                      {isSavingInstitutionProfile ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                    <button
                      type="button"
                      className="panel-main-card-edit-btn panel-institution-cancel-btn"
                      aria-label="İptal"
                      onClick={handleInstitutionProfileCancel}
                    >
                      <X className="panel-main-card-edit-icon" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="panel-main-card-edit-btn"
                    aria-label="Düzenle"
                    onClick={() => setIsEditingInstitutionProfile(true)}
                  >
                    <PencilLine className="panel-main-card-edit-icon" aria-hidden />
                  </button>
                )
              ) : isAnnouncementsTab ? (
                <Button
                  type="button"
                  variant="default"
                  className="panel-announcements-add-btn"
                  onClick={openNewAnnouncementModal}
                  disabled={!institutionId || announcementSaving}
                >
                  <Plus className="panel-announcements-add-btn-icon" aria-hidden />
                  Yeni Duyuru
                </Button>
              ) : isSubscriptionTab || isInstitutionsTab || isMediaManagementTab ? null : (
                <button
                  type="button"
                  className="panel-main-card-edit-btn"
                  aria-label="Düzenle"
                  onClick={() => {}}
                >
                  <PencilLine className="panel-main-card-edit-icon" aria-hidden />
                </button>
              )}
            </div>
            {isInstitutionProfileTab ? (
              <div className="panel-institution-card-content">
                <div className="panel-institution-form">
                  <div className="panel-institution-form-row-first">
                    <div className="panel-institution-form-logo-wrap">
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        className="panel-institution-form-logo-input"
                        aria-label="Kurum logosu yükle"
                        onChange={handleLogoFileChange}
                      />
                      <div
                        className={`panel-institution-form-logo-box ${logoUploading ? "panel-institution-form-logo-box--uploading" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (logoUploading) return;
                          logoFileInputRef.current?.click();
                        }}
                        onKeyDown={(e) => {
                          if (logoUploading) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            logoFileInputRef.current?.click();
                          }
                        }}
                        aria-label="Kurum logosu yükle"
                      >
                        {logoUploading ? (
                          <>
                            <Loader2 className="panel-institution-form-logo-icon panel-institution-form-logo-spinner" aria-hidden />
                            <span className="panel-institution-form-logo-loading-text">Yükleniyor…</span>
                          </>
                        ) : institutionFormData.logoUrl ? (
                          <img src={institutionFormData.logoUrl} alt="" className="panel-institution-form-logo-img" />
                        ) : (
                          <Upload className="panel-institution-form-logo-icon" aria-hidden />
                        )}
                        <Upload className="panel-institution-form-logo-hover-icon" aria-hidden />
                      </div>
                      <span className="panel-institution-form-label">Kurum Logosu</span>
                      {logoUploadError && (
                        <span className="panel-institution-form-logo-error" role="alert">
                          {logoUploadError}
                        </span>
                      )}
                    </div>
                    <div className="panel-institution-form-first-fields">
                    <div className="panel-institution-form-field">
                        <label className="panel-institution-form-label">Kurum Adı</label>
                      <Input
                        type="text"
                        value={institutionFormData.institutionName}
                        onChange={(e) => handleInstitutionFormChange("institutionName", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                      />
                    </div>
                    <div className="panel-institution-form-field">
                        <label className="panel-institution-form-label">Resmi E-posta</label>
                      <Input
                        type="email"
                        value={institutionFormData.email}
                        onChange={(e) => handleInstitutionFormChange("email", e.target.value)}
                          disabled
                        className="panel-institution-form-input"
                      />
                      </div>
                    </div>
                  </div>
                  <div className="panel-institution-form-row panel-institution-form-row--full">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">ALT BAŞLIK</label>
                      <Input
                        type="text"
                        value={institutionFormData.subheading}
                        onChange={(e) => handleInstitutionFormChange("subheading", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                        placeholder="Kurumunuz hakkında kısa ve bilgilendirici bir alt başlık yazınız."
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">TELEFON</label>
                      <Input
                        type="tel"
                        value={institutionFormData.phone}
                        onChange={(e) => handleInstitutionFormChange("phone", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                      />
                    </div>
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">WEB SİTESİ</label>
                      <Input
                        type="url"
                        value={institutionFormData.website}
                        onChange={(e) => handleInstitutionFormChange("website", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                        placeholder="https://"
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">ŞEHİR</label>
                      <Input
                        type="text"
                        value={institutionFormData.city}
                        onChange={(e) => handleInstitutionFormChange("city", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                      />
                    </div>
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">İLÇE</label>
                      <Input
                        type="text"
                        value={institutionFormData.district}
                        onChange={(e) => handleInstitutionFormChange("district", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row">
                    <div className="panel-institution-form-field">
                      <label
                        className="panel-institution-form-label"
                        htmlFor="panel-working-hours-start"
                      >
                        ÇALIŞMA SAATLERİ - BAŞLANGIÇ
                      </label>
                      <WorkingHoursTimePicker
                        id="panel-working-hours-start"
                        value={institutionFormData.workingHoursStart}
                        onChange={(next) =>
                          handleInstitutionFormChange("workingHoursStart", next)
                        }
                        disabled={!isEditingInstitutionProfile}
                        ariaLabel="Çalışma saatleri başlangıç"
                        placeholder="Başlangıç"
                      />
                    </div>
                    <div className="panel-institution-form-field">
                      <label
                        className="panel-institution-form-label"
                        htmlFor="panel-working-hours-end"
                      >
                        ÇALIŞMA SAATLERİ - BİTİŞ
                      </label>
                      <WorkingHoursTimePicker
                        id="panel-working-hours-end"
                        value={institutionFormData.workingHoursEnd}
                        onChange={(next) =>
                          handleInstitutionFormChange("workingHoursEnd", next)
                        }
                        disabled={!isEditingInstitutionProfile}
                        ariaLabel="Çalışma saatleri bitiş"
                        placeholder="Bitiş"
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row panel-institution-form-row--full">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">ADRES</label>
                      <textarea
                        value={institutionFormData.address}
                        onChange={(e) => handleInstitutionFormChange("address", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-textarea"
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row panel-institution-form-row--full">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">HAKKINDA</label>
                      <textarea
                        value={institutionFormData.about}
                        onChange={(e) => handleInstitutionFormChange("about", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-textarea"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
                {institutionProfileMessage ? (
                  <p className="panel-institutions-save-message">{institutionProfileMessage}</p>
                ) : null}
                {logoValidationModalMessage ? (
                  <div
                    className="panel-logo-validation-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Logo yükleme kuralları"
                  >
                    <div className="panel-logo-validation-modal">
                      <p className="panel-logo-validation-text">
                        {logoValidationModalMessage.split("\n").map((line, idx) => (
                          <span key={`${line}-${idx}`} className="panel-logo-validation-line">
                            {line}
                          </span>
                        ))}
                      </p>
                      <Button
                        type="button"
                        variant="default"
                        className="panel-logo-validation-close-btn"
                        onClick={() => setLogoValidationModalMessage(null)}
                      >
                        Tamam
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : isAnnouncementsTab ? (
              <div className="panel-announcements-content">
                {!institutionId ? (
                  <p className="panel-main-card-placeholder">Kurum kaydı bulunamadı. Duyuruları yönetmek için kurum profilinizin tanımlı olması gerekir.</p>
                ) : (
                  <>
                    {announcementsError ? (
                      <p className="panel-institutions-save-message" role="alert">
                        {announcementsError}
                      </p>
                    ) : null}
                    <div className="panel-announcements-table-wrap">
                      <table className="panel-announcements-table">
                        <thead>
                          <tr>
                            <th className="panel-announcements-th panel-announcements-th-image">Görsel</th>
                            <th className="panel-announcements-th">Başlık</th>
                            <th className="panel-announcements-th">İçerik</th>
                            <th className="panel-announcements-th">Tarih</th>
                            <th className="panel-announcements-th">Aktiflik Durumu</th>
                            <th className="panel-announcements-th panel-announcements-th-actions">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {announcementsLoading ? (
                            <tr className="panel-announcements-tr">
                              <td className="panel-announcements-td" colSpan={6}>
                                Yükleniyor…
                              </td>
                            </tr>
                          ) : announcementsList.length === 0 ? (
                            <tr className="panel-announcements-tr">
                              <td className="panel-announcements-td" colSpan={6}>
                                Henüz duyuru yok. Yeni duyuru eklemek için üstteki düğmeyi kullanın.
                              </td>
                            </tr>
                          ) : (
                            announcementsList.map((row) => (
                              <tr key={row.id} className="panel-announcements-tr">
                                <td className="panel-announcements-td panel-announcements-td-image">
                                  <AnnouncementTableThumbCell url={row.imageUrl} />
                                </td>
                                <td className="panel-announcements-td panel-announcements-td-title">
                                  {row.title}
                                </td>
                                <td className="panel-announcements-td panel-announcements-td-desc">
                                  <span className="panel-announcements-desc-clamp">{row.preview}</span>
                                </td>
                                <td className="panel-announcements-td">{row.date}</td>
                                <td className="panel-announcements-td">
                                  <span
                                    className={
                                      row.isActive
                                        ? "panel-announcements-badge panel-announcements-badge--published"
                                        : "panel-announcements-badge panel-announcements-badge--draft"
                                    }
                                  >
                                    {row.isActive ? "Yayında" : "Aktif Değil"}
                                  </span>
                                </td>
                                <td className="panel-announcements-td panel-announcements-td-actions">
                                  <button
                                    type="button"
                                    className="panel-announcements-action-btn"
                                    aria-label="Düzenle"
                                    onClick={() => openEditAnnouncementModal(row)}
                                    disabled={announcementSaving}
                                  >
                                    <PencilLine className="panel-announcements-action-icon" aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    className="panel-announcements-action-btn"
                                    aria-label="Sil"
                                    onClick={() => handleAnnouncementDelete(row.id)}
                                    disabled={announcementSaving}
                                  >
                                    <Trash2 className="panel-announcements-action-icon" aria-hidden />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : isMediaManagementTab ? (
              <div className="panel-media-management">
                <div className="panel-media-header">
                  <p className="panel-media-desc">
                    Kurumunuza ait görsel ve video içeriklerini buradan yükleyebilir, görüntüleyebilir ve
                    yönetebilirsiniz.
                  </p>
                </div>

                {mediaMessage ? <p className="panel-institutions-save-message">{mediaMessage}</p> : null}

                <div className="panel-media-upload-grid">
                  <div className="panel-media-upload-card">
                    <div className="panel-media-upload-head">
                      <div className="panel-media-upload-head-text">
                        <h4 className="panel-media-upload-title">Fotoğraf Yükle</h4>
                        <p className="panel-media-upload-subtitle">PNG, JPG veya WEBP (Maks 10MB)</p>
                      </div>
                      <div className="panel-media-upload-icon-wrap" aria-hidden>
                        <Image className="panel-media-upload-icon" />
                      </div>
                    </div>
                    <label className="panel-media-dropzone">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handlePhotoFileChange}
                        disabled={mediaUploadingPhoto || mediaUploadingVideo}
                      />
                      <div className="panel-media-dropzone-inner">
                        <CloudUpload className="panel-media-dropzone-icon" aria-hidden />
                        <p className="panel-media-dropzone-title">
                          {mediaUploadingPhoto ? "Yükleniyor..." : "Dosyaları buraya sürükleyin"}
                        </p>
                        <p className="panel-media-dropzone-subtitle">Veya bilgisayarınızdan seçin</p>
                      </div>
                    </label>
                  </div>

                  <div className="panel-media-upload-card">
                    <div className="panel-media-upload-head">
                      <div className="panel-media-upload-head-text">
                        <h4 className="panel-media-upload-title">Video Yükle</h4>
                        <p className="panel-media-upload-subtitle">MP4, MOV veya WebM (Maks 100MB)</p>
                      </div>
                      <div className="panel-media-upload-icon-wrap" aria-hidden>
                        <Film className="panel-media-upload-icon" />
                      </div>
                    </div>
                    <label className="panel-media-dropzone">
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleVideoFileChange}
                        disabled={mediaUploadingPhoto || mediaUploadingVideo}
                      />
                      <div className="panel-media-dropzone-inner">
                        <CloudUpload className="panel-media-dropzone-icon" aria-hidden />
                        <p className="panel-media-dropzone-title">
                          {mediaUploadingVideo ? "Yükleniyor..." : "Video dosyasını sürükleyin"}
                        </p>
                        <p className="panel-media-dropzone-subtitle">Veya bilgisayarınızdan seçin</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="panel-media-list-card">
                  <div className="panel-media-list-head">
                    <h4 className="panel-media-list-title">Medya Listesi</h4>
                    <p className="panel-media-list-subtitle">
                      Yüklediğiniz medya içerikleri burada listelenir.
                    </p>
                  </div>

                  {mediaLoading ? (
                    <div className="panel-media-empty">
                      <p className="panel-media-empty-text">Yükleniyor...</p>
                    </div>
                  ) : mediaItems.length === 0 ? (
                    <div className="panel-media-empty">
                      <p className="panel-media-empty-text">Henüz medya yüklemesi yapılmamıştır.</p>
                  </div>
                ) : (
                    <div className="panel-media-table-wrap">
                      <div className="panel-media-table">
                        <div className="panel-media-row panel-media-row--head">
                          <div className="panel-media-cell panel-media-cell--media">Medya</div>
                          <div className="panel-media-cell panel-media-cell--title">Başlık</div>
                          <div className="panel-media-cell panel-media-cell--type">Medya Türü</div>
                          <div className="panel-media-cell panel-media-cell--size">Boyut</div>
                          <div className="panel-media-cell panel-media-cell--actions">Sil</div>
                          </div>
                        {mediaItems.map((item) => (
                          <div key={item.id} className="panel-media-row">
                            <div className="panel-media-cell panel-media-cell--media">
                              {item.media_type === "photo" && (item.file_url ?? "").trim() ? (
                                <img
                                  src={String(item.file_url)}
                                  alt={String(item.title || item.file_name || "Medya")}
                                  className="panel-media-thumb panel-media-thumb--image"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="panel-media-thumb panel-media-thumb--fallback" aria-hidden>
                                  <Film className="panel-media-thumb-icon" aria-hidden />
                                </div>
                              )}
                            </div>
                            <div className="panel-media-cell panel-media-cell--title">
                              {item.title?.trim() || item.file_name?.trim() || "—"}
                            </div>
                            <div className="panel-media-cell panel-media-cell--type">
                            <span
                                className={`panel-media-badge ${
                                  item.media_type === "video"
                                    ? "panel-media-badge--video"
                                    : "panel-media-badge--image"
                                }`}
                              >
                                {item.media_type === "video" ? "Video" : "Görsel"}
                              </span>
                            </div>
                            <div className="panel-media-cell panel-media-cell--size">
                              {formatBytes(item.file_size)}
                            </div>
                            <div className="panel-media-cell panel-media-cell--actions">
                              <button
                                type="button"
                                className="panel-media-delete-btn"
                                aria-label="Sil"
                                onClick={() => handleMediaDelete(item)}
                                disabled={mediaDeletingId === item.id}
                              >
                                <Trash2 className="panel-media-delete-icon" aria-hidden />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : isInstitutionsTab ? (
              <div className="panel-institutions-content">
                {institutionRecordMissing ? (
                  <div className="panel-institutions-empty">
                    <p className="panel-institutions-empty-text">Bu hesaba bağlı kurum kaydı bulunamadı.</p>
                  </div>
                ) : institutionFeaturesLoading ? (
                  <div className="panel-institutions-empty">
                    <p className="panel-institutions-empty-text">Kurum özellikleri yükleniyor...</p>
                  </div>
                ) : institutionFeaturesError ? (
                  <div className="panel-institutions-empty">
                    <p className="panel-institutions-empty-text">{institutionFeaturesError}</p>
                  </div>
                ) : institutionGroupsWithFeatures.length === 0 ? (
                  <div className="panel-institutions-empty">
                    <p className="panel-institutions-empty-text">Aktif özellik grubu bulunamadı.</p>
                  </div>
                ) : (
                  <div
                    className="panel-institutions-groups"
                    data-detail-chip-count={institutionDetailPreparedData.items.length}
                  >
                    <section className="panel-institutions-section panel-institutions-section--type-picker">
                      <h4 className="panel-institutions-group-title panel-institutions-group-title--academic">
                        <Shapes
                          className="panel-institutions-group-title-icon panel-institutions-group-title-icon--academic"
                          aria-hidden
                        />
                        Kategori / Alt Kategori
                      </h4>
                      {institutionTypeLoading ? (
                        <p className="panel-institutions-empty-text">Kategoriler yükleniyor…</p>
                      ) : institutionTypeError ? (
                        <p className="panel-institutions-empty-text">{institutionTypeError}</p>
                      ) : institutionCategories.length === 0 ? (
                        <p className="panel-institutions-empty-text">Aktif kategori bulunamadı.</p>
                      ) : (
                        <div className="panel-institutions-type-picker-row">
                          <div className="panel-institutions-feature-input-wrap">
                            <p className="panel-institutions-feature-name">Kategori</p>
                            <div className="panel-institutions-single-select-dropdown">
                              <button
                                type="button"
                                className={`panel-institutions-feature-select panel-institutions-feature-select--button ${
                                  openInstitutionTypePickerSelect === "category"
                                    ? "panel-institutions-feature-select--open"
                                    : ""
                                }`}
                                onClick={() =>
                                  setOpenInstitutionTypePickerSelect((prev) =>
                                    prev === "category" ? null : "category"
                                  )
                                }
                                aria-haspopup="listbox"
                                aria-expanded={openInstitutionTypePickerSelect === "category"}
                              >
                                <span
                                  className="panel-institutions-feature-select-label"
                                  title={
                                    institutionCategories.find(
                                      (c) => String(c.id) === (institutionCategoryId ?? "")
                                    )?.name || "Seçiniz"
                                  }
                                >
                                  {institutionCategories.find(
                                    (c) => String(c.id) === (institutionCategoryId ?? "")
                                  )?.name || "Seçiniz"}
                            </span>
                              </button>
                              {openInstitutionTypePickerSelect === "category" && (
                                <div className="panel-institutions-feature-select-menu" role="listbox">
                            <button
                              type="button"
                                    role="option"
                                    aria-selected={(institutionCategoryId ?? "") === ""}
                                    className={`panel-institutions-feature-select-option ${
                                      (institutionCategoryId ?? "") === ""
                                        ? "panel-institutions-feature-select-option--selected"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      setInstitutionCategoryId("");
                                      setInstitutionTypeId("");
                                      setOpenInstitutionTypePickerSelect(null);
                                    }}
                                  >
                                    Seçiniz
                            </button>
                                  {institutionCategories.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      role="option"
                                      aria-selected={(institutionCategoryId ?? "") === String(c.id)}
                                      className={`panel-institutions-feature-select-option ${
                                        (institutionCategoryId ?? "") === String(c.id)
                                          ? "panel-institutions-feature-select-option--selected"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        setInstitutionCategoryId(String(c.id));
                                        setOpenInstitutionTypePickerSelect(null);
                                      }}
                                      title={c.name || undefined}
                                    >
                                      {c.name}
                                    </button>
                                  ))}
                          </div>
                              )}
                        </div>
                            </div>

                          <div
                            className={`panel-institutions-feature-input-wrap ${
                              !(institutionCategoryId ?? "").trim()
                                ? "panel-institutions-type-picker-disabled"
                                : ""
                            }`}
                          >
                            <p className="panel-institutions-feature-name">Alt Kategori</p>
                            <div className="panel-institutions-single-select-dropdown">
                              <button
                                type="button"
                                disabled={!(institutionCategoryId ?? "").trim()}
                                className={`panel-institutions-feature-select panel-institutions-feature-select--button ${
                                  openInstitutionTypePickerSelect === "type"
                                    ? "panel-institutions-feature-select--open"
                                    : ""
                                }`}
                                onClick={() => {
                                  if (!(institutionCategoryId ?? "").trim()) return;
                                  setOpenInstitutionTypePickerSelect((prev) =>
                                    prev === "type" ? null : "type"
                                  );
                                }}
                                aria-haspopup="listbox"
                                aria-expanded={openInstitutionTypePickerSelect === "type"}
                              >
                                <span
                                  className="panel-institutions-feature-select-label"
                                  title={
                                    institutionTypes.find((t) => String(t.id) === (institutionTypeId ?? ""))
                                      ?.name || "Seçiniz"
                                  }
                                >
                                  {institutionTypes.find((t) => String(t.id) === (institutionTypeId ?? ""))
                                    ?.name || "Seçiniz"}
                                </span>
                              </button>
                              {openInstitutionTypePickerSelect === "type" && (
                                <div className="panel-institutions-feature-select-menu" role="listbox">
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={(institutionTypeId ?? "") === ""}
                                    className={`panel-institutions-feature-select-option ${
                                      (institutionTypeId ?? "") === ""
                                        ? "panel-institutions-feature-select-option--selected"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      setInstitutionTypeId("");
                                      setOpenInstitutionTypePickerSelect(null);
                                    }}
                                  >
                                    Seçiniz
                                  </button>
                                  {institutionTypes
                                    .filter((t) => String(t.category_id) === (institutionCategoryId ?? ""))
                                    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                                    .map((t) => (
                                      <button
                                        key={t.id}
                                        type="button"
                                        role="option"
                                        aria-selected={(institutionTypeId ?? "") === String(t.id)}
                                        className={`panel-institutions-feature-select-option ${
                                          (institutionTypeId ?? "") === String(t.id)
                                            ? "panel-institutions-feature-select-option--selected"
                                            : ""
                                        }`}
                                        onClick={() => {
                                          setInstitutionTypeId(String(t.id));
                                          setOpenInstitutionTypePickerSelect(null);
                                        }}
                                        title={t.name || undefined}
                                      >
                                        {t.name}
                                      </button>
                                    ))}
                              </div>
                            )}
                            </div>
                            </div>
                          </div>
                      )}
                    </section>

                    <InstitutionFeatureSelectionGroupList
                      groups={institutionSelectionUpperGroups}
                      getDisplayFeatureName={getDisplayFeatureName}
                      institutionTextFeatureValues={institutionTextFeatureValues}
                      setInstitutionTextFeatureValues={setInstitutionTextFeatureValues}
                      institutionNumberFeatureValues={institutionNumberFeatureValues}
                      setInstitutionNumberFeatureValues={setInstitutionNumberFeatureValues}
                      institutionBooleanFeatureValues={institutionBooleanFeatureValues}
                      setInstitutionBooleanFeatureValues={setInstitutionBooleanFeatureValues}
                      institutionSingleSelectValues={institutionSingleSelectValues}
                      setInstitutionSingleSelectValues={setInstitutionSingleSelectValues}
                      institutionMultiSelectValues={institutionMultiSelectValues}
                      setInstitutionMultiSelectValues={setInstitutionMultiSelectValues}
                      institutionFeatureChoices={institutionFeatureChoices}
                      openInstitutionSelectId={openInstitutionSelectId}
                      setOpenInstitutionSelectId={setOpenInstitutionSelectId}
                    />

                    {institutionSelectionLowerGroups.length === 0 ? (
                      <>
                        <div className="panel-institutions-actions">
                          <Button
                            type="button"
                            variant="default"
                            className="panel-institutions-save-btn"
                            onClick={() => void handleSaveBooleanFeatures("full")}
                            disabled={institutionFeaturesSaving}
                          >
                            {institutionFeaturesSaving ? "Kaydediliyor..." : "Kaydet"}
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <p className="panel-main-card-placeholder">{activeTabConfig.placeholder}</p>
            )}
              </>
            )}
          </section>
        </div>
        {isInstitutionsTab &&
        !institutionRecordMissing &&
        !institutionFeaturesLoading &&
        !institutionFeaturesError &&
        institutionGroupsWithFeatures.length > 0 &&
        institutionSelectionLowerGroups.length > 0 ? (
          <div className="panel-institutions-feature-wide">
            <section className="panel-main-card" aria-label="Kurum özellikleri (devam)">
              <div className="panel-institutions-content">
                <div
                  className="panel-institutions-groups"
                  data-detail-chip-count={institutionDetailPreparedData.items.length}
                >
                  <InstitutionFeatureSelectionGroupList
                    groups={institutionSelectionLowerGroups}
                    getDisplayFeatureName={getDisplayFeatureName}
                    institutionTextFeatureValues={institutionTextFeatureValues}
                    setInstitutionTextFeatureValues={setInstitutionTextFeatureValues}
                    institutionNumberFeatureValues={institutionNumberFeatureValues}
                    setInstitutionNumberFeatureValues={setInstitutionNumberFeatureValues}
                    institutionBooleanFeatureValues={institutionBooleanFeatureValues}
                    setInstitutionBooleanFeatureValues={setInstitutionBooleanFeatureValues}
                    institutionSingleSelectValues={institutionSingleSelectValues}
                    setInstitutionSingleSelectValues={setInstitutionSingleSelectValues}
                    institutionMultiSelectValues={institutionMultiSelectValues}
                    setInstitutionMultiSelectValues={setInstitutionMultiSelectValues}
                    institutionFeatureChoices={institutionFeatureChoices}
                    openInstitutionSelectId={openInstitutionSelectId}
                    setOpenInstitutionSelectId={setOpenInstitutionSelectId}
                  />
                </div>
                <div className="panel-institutions-actions">
                  <Button
                    type="button"
                    variant="default"
                    className="panel-institutions-save-btn"
                    onClick={() => void handleSaveBooleanFeatures("upper-and-visible-lower")}
                    disabled={institutionFeaturesSaving}
                  >
                    {institutionFeaturesSaving ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {showInstitutionProfileSuccessPopup ? (
        <div className="panel-profile-success-overlay" role="presentation">
          <div
            className="panel-profile-success-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="panel-profile-success-title"
            aria-describedby="panel-profile-success-desc"
          >
            <span className="panel-profile-success-popup-badge" aria-hidden>
              <CheckCircle size={28} strokeWidth={2} />
            </span>
            <span id="panel-profile-success-title" className="panel-profile-success-popup-label">
              Onaylandı
            </span>
            <p id="panel-profile-success-desc" className="panel-profile-success-popup-text">
              Bilgileriniz Başarıyla Güncellendi
            </p>
          </div>
        </div>
      ) : null}

      {institutionFeaturesSaveMessage ? (
        <div className="panel-features-save-toast-overlay" role="presentation">
          <div
            className={`panel-features-save-toast-modal${
              institutionFeaturesSaveMessage.toLocaleLowerCase("tr-TR").includes("hata")
                ? " panel-features-save-toast-modal--error"
                : ""
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-describedby="panel-features-save-toast-desc"
          >
            <p id="panel-features-save-toast-desc" className="panel-features-save-toast-text">
              {institutionFeaturesSaveMessage}
            </p>
          </div>
        </div>
      ) : null}

      {subscriptionModalOpen && (
        <div
          className="panel-subscription-modal-overlay"
          onClick={() => setSubscriptionModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="panel-subscription-modal-title"
        >
          <div className="panel-subscription-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="panel-subscription-modal-header">
              <h2 id="panel-subscription-modal-title" className="panel-subscription-modal-title">
                Abonelik
              </h2>
              <button
                type="button"
                className="panel-subscription-modal-close"
                aria-label="Kapat"
                onClick={() => setSubscriptionModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="panel-subscription-modal-body">
              <SubscriptionPricingTable plans={SUBSCRIPTION_PLANS} />
            </div>
          </div>
        </div>
      )}

      {announcementModalOpen && (
        <div
          className="panel-announcement-modal-overlay"
          onClick={closeAnnouncementModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="panel-announcement-modal-title"
        >
          <div className="panel-announcement-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 id="panel-announcement-modal-title" className="panel-announcement-modal-title">
              {editingAnnouncementId ? "Duyuruyu Düzenle" : "Yeni Duyuru"}
            </h2>
            <div className="panel-announcement-modal-body">
              <div className="panel-announcement-modal-form">
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label">BAŞLIK</label>
                  <Input
                    type="text"
                    value={announcementForm.title}
                    onChange={(e) => handleAnnouncementFormChange("title", e.target.value)}
                    className="panel-institution-form-input"
                  />
                  {announcementFormErrors.title && (
                    <span className="panel-announcement-modal-error">{announcementFormErrors.title}</span>
                  )}
                </div>
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label">İÇERİK</label>
                  <textarea
                    value={announcementForm.content}
                    onChange={(e) => handleAnnouncementFormChange("content", e.target.value)}
                    className="panel-institution-form-textarea"
                    rows={4}
                  />
                  {announcementFormErrors.content && (
                    <span className="panel-announcement-modal-error">{announcementFormErrors.content}</span>
                  )}
                </div>
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label" htmlFor="announcement-link-url-input">
                    BAĞLANTI LİNKİ
                  </label>
                  <Input
                    id="announcement-link-url-input"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://"
                    value={announcementForm.linkUrl}
                    onChange={(e) => handleAnnouncementFormChange("linkUrl", e.target.value)}
                    className="panel-institution-form-input"
                    disabled={announcementSaving}
                  />
                </div>
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label" htmlFor="announcement-status-select">
                    DUYURUNUN AKTİFLİK DURUMU
                  </label>
                  <Select
                    value={announcementForm.isActive ? "active" : "inactive"}
                    onValueChange={(v) =>
                      handleAnnouncementFormChange("isActive", v === "active")
                    }
                    disabled={announcementSaving}
                  >
                    <SelectTrigger
                      id="announcement-status-select"
                      className="panel-announcement-status-select"
                      aria-label="Duyuru durumu"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      sideOffset={4}
                      className="select-content panel-announcement-status-dropdown"
                    >
                      <SelectItem value="active" className="select-item">
                        Aktif
                      </SelectItem>
                      <SelectItem value="inactive" className="select-item">
                        Aktif Değil
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="panel-institution-form-field panel-announcement-image-field">
                  <input
                    id="panel-announcement-image-input"
                    ref={announcementImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="panel-announcement-image-file-input"
                    aria-label="Duyuru görseli seç"
                    onChange={handleAnnouncementImageInputChange}
                    disabled={announcementSaving}
                  />
                  <div className="panel-media-upload-card panel-media-upload-card--announcement-modal">
                    <div className="panel-media-upload-head">
                      <div className="panel-media-upload-head-text">
                        <h4 className="panel-media-upload-title">Fotoğraf Yükle</h4>
                        <p className="panel-media-upload-subtitle">PNG, JPG veya WEBP (Maks 10MB)</p>
                      </div>
                      <div className="panel-media-upload-icon-wrap" aria-hidden>
                        <Image className="panel-media-upload-icon" />
                      </div>
                    </div>
                    {announcementShowImagePreview ? (
                      <div
                        className="panel-media-dropzone panel-media-dropzone--announcement-preview"
                        onDragOver={handleAnnouncementImageDragOver}
                        onDrop={handleAnnouncementImageDrop}
                      >
                        <img
                          src={announcementPreviewSrc!}
                          alt=""
                          className="panel-announcement-dropzone-preview-img"
                        />
                        <div className="panel-announcement-image-preview-overlay">
                          <button
                            type="button"
                            className="panel-announcement-image-preview-btn"
                            onClick={handleAnnouncementImagePickClick}
                            disabled={announcementSaving}
                          >
                            Görseli değiştir
                          </button>
                          <button
                            type="button"
                            className="panel-announcement-image-preview-btn panel-announcement-image-preview-btn--muted"
                            onClick={handleAnnouncementImageClearOrRemove}
                            disabled={announcementSaving}
                          >
                            Görseli kaldır
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        className="panel-media-dropzone"
                        htmlFor="panel-announcement-image-input"
                        onDragOver={handleAnnouncementImageDragOver}
                        onDrop={handleAnnouncementImageDrop}
                      >
                        <div className="panel-media-dropzone-inner">
                          <CloudUpload className="panel-media-dropzone-icon" aria-hidden />
                          <p className="panel-media-dropzone-title">
                            {announcementSaving ? "Kaydediliyor…" : "Dosyaları buraya sürükleyin"}
                          </p>
                          <p className="panel-media-dropzone-subtitle">Veya bilgisayarınızdan seçin</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="panel-announcement-modal-footer">
              <Button
                type="button"
                variant="outline"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--cancel"
                onClick={closeAnnouncementModal}
                disabled={announcementSaving}
              >
                İptal
              </Button>
              <Button
                type="button"
                variant="default"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--submit"
                onClick={() => void handleAnnouncementSave()}
                disabled={announcementSaving}
              >
                {announcementSaving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PanelPage() {
  return (
    <Suspense fallback={null}>
      <PanelContent />
    </Suspense>
  );
}
