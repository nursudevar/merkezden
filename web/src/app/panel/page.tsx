"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveUserTypeFromUsersClient } from "@/lib/auth/resolveUserTypeFromUsersClient";
import { resolveInstitutionNameFromUsersClient } from "@/lib/auth/resolveInstitutionNameFromUsersClient";
import HeaderClientWrapper from "@/components/layout/HeaderClientWrapper";
import { Button, Input } from "@/components/ui";
import "@/styles/main.scss";
import "@/styles/pages/panel.scss";

type PanelTabId =
  | "overview"
  | "institution-profile"
  | "institutions"
  | "announcements"
  | "subscription"
  | "requests";

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
    id: "announcements",
    label: "Duyurular",
    placeholder: "Duyurular ve içerikler burada yönetilecek.",
  },
  {
    id: "subscription",
    label: "Abonelik",
    placeholder: "Plan ve faturalandırma burada yönetilecek.",
  },
  { id: "requests", label: "Talepler", placeholder: "Gelen talepler burada listelenecek." },
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

export default function PanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userType, setUserType] = useState<"individual" | "institution" | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTabId>("overview");
  const [institutionName, setInstitutionName] = useState<string>("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingInstitutionProfile, setIsEditingInstitutionProfile] = useState(false);
  const [isSavingInstitutionProfile, setIsSavingInstitutionProfile] = useState(false);
  const [institutionProfileMessage, setInstitutionProfileMessage] = useState<string | null>(null);
  const [institutionIsVerified, setInstitutionIsVerified] = useState<boolean>(false);
  const [institutionTypeId, setInstitutionTypeId] = useState<string>("");
  const [institutionCategoryId, setInstitutionCategoryId] = useState<string>("");
  const [openInstitutionTypePickerSelect, setOpenInstitutionTypePickerSelect] = useState<
    "category" | "type" | null
  >(null);
  const [institutionCategories, setInstitutionCategories] = useState<
    Array<{ id: number; name: string; display_order: number | null }>
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
    city: "",
    district: "",
    address: "",
    about: "",
    logoUrl: "",
  });
  const [institutionInitialFormData, setInstitutionInitialFormData] = useState({
    institutionName: "",
    email: "",
    phone: "",
    website: "",
    city: "",
    district: "",
    address: "",
    about: "",
    logoUrl: "",
  });

  type AnnouncementStatus = "draft" | "published";
  interface AnnouncementRow {
    id: string;
    title: string;
    content: string;
    date: string;
    status: AnnouncementStatus;
  }

  const [announcementsList, setAnnouncementsList] = useState<AnnouncementRow[]>([
    {
      id: "a1",
      title: "Örnek Duyuru",
      content: "Bu duyuru metni örnek olarak gösterilmektedir. İçerik burada yer alır.",
      date: "15.01.2025",
      status: "published",
    },
    {
      id: "a2",
      title: "Taslak Başlık",
      content: "Henüz yayına alınmamış taslak içerik.",
      date: "—",
      status: "draft",
    },
  ]);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    status: "draft" as AnnouncementStatus,
  });
  const [announcementFormErrors, setAnnouncementFormErrors] = useState<{ title?: string; content?: string }>({});

  type RequestStatus = "pending" | "approved" | "rejected";
  type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";
  interface RequestRow {
    id: string;
    type: string;
    institutionName: string;
    createdAt: string;
    status: RequestStatus;
    description: string;
    adminNote: string;
    updatedAt: string;
  }

interface InstitutionFeatureGroupRow {
  id: number;
  name: string;
  slug: string | null;
  display_order: number | null;
  is_active: boolean;
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

  const REQUESTS_MOCK: RequestRow[] = [
    {
      id: "r1",
      type: "Kurum Oluşturma",
      institutionName: "Örnek Kurum A.Ş.",
      createdAt: "10.01.2025",
      status: "approved",
      description: "Yeni kurum kaydı oluşturulması talebi.",
      adminNote: "İnceleme tamamlandı, onaylandı.",
      updatedAt: "12.01.2025",
    },
    {
      id: "r2",
      type: "Profil Güncelleme",
      institutionName: "Demo Eğitim Merkezi",
      createdAt: "05.02.2025",
      status: "pending",
      description: "Kurum iletişim bilgilerinin güncellenmesi.",
      adminNote: "",
      updatedAt: "05.02.2025",
    },
    {
      id: "r3",
      type: "Duyuru Yayınlama",
      institutionName: "Örnek Kurum A.Ş.",
      createdAt: "28.01.2025",
      status: "rejected",
      description: "Duyuru metninin yayına alınması talebi.",
      adminNote: "İçerik kurallara uygun değildir.",
      updatedAt: "30.01.2025",
    },
  ];

  const [requestsList] = useState<RequestRow[]>(REQUESTS_MOCK);
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatusFilter>("all");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
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
  const [openInstitutionSelectId, setOpenInstitutionSelectId] = useState<number | null>(null);

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
    if (!user?.id || userType !== "institution") return;
    let cancelled = false;
    resolveInstitutionNameFromUsersClient(user.id).then((name) => {
      if (!cancelled) setInstitutionName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

 
  useEffect(() => {
    if (!user?.id || userType !== "institution") return;
  
    const userId = user.id;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
  
    async function loadInstitutionProfile() {
      const { data, error } = await supabase
        .from("institutions")
        .select(
          "id, institution_name, official_email, official_phone, website, city, district, address, about, logo, is_verified, institution_type_id"
        )
        .eq("owner_auth_id", userId)
        .maybeSingle();
  
      if (cancelled) return;
  
      if (error) {
        console.error("Institution profile load error:", error);
        return;
      }
  
      const row = data as {
        id: number;
        institution_name?: string | null;
        official_email?: string | null;
        official_phone?: string | null;
        website?: string | null;
        city?: string | null;
        district?: string | null;
        address?: string | null;
        about?: string | null;
        logo?: string | null;
        is_verified?: boolean | null;
        institution_type_id?: number | null;
      } | null;
  
      if (!row) {
        setInstitutionRecordMissing(true);
        setInstitutionId(null);
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
        city: row.city || "",
        district: row.district || "",
        address: row.address || "",
        about: row.about || "",
        logoUrl,
      });
      setInstitutionInitialFormData({
        institutionName: row.institution_name || "",
        email: row.official_email || "",
        phone: row.official_phone || "",
        website: row.website || "",
        city: row.city || "",
        district: row.district || "",
        address: row.address || "",
        about: row.about || "",
        logoUrl,
      });
    }
  
    loadInstitutionProfile();
  
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (activeTab !== "institutions") return;
    if (!user?.id || userType !== "institution") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    setInstitutionTypeLoading(true);
    setInstitutionTypeError(null);
    (async () => {
      try {
        const [catsRes, typesRes] = await Promise.all([
          supabase
            .from("institution_categories")
            .select("id, name, display_order, is_active")
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
          (catsRes.data as Array<{ id: number; name: string | null; display_order: number | null }> | null) ??
          [];
        const types =
          (typesRes.data as Array<{ id: number; category_id: number; name: string | null; display_order: number | null }> | null) ??
          [];

        setInstitutionCategories(
          cats
            .map((c) => ({ id: c.id, name: (c.name ?? "").trim(), display_order: c.display_order ?? 0 }))
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
  }, [activeTab, user?.id, userType]);

  useEffect(() => {
    if (activeTab !== "institutions") return;
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
          .select("id, name, slug, display_order, is_active")
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
    if (userType !== "institution") {
      router.replace("/");
    }
  }, [isAuthReady, user, roleLoaded, userType, router]);

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

  if (userType !== "institution") return null;

  const activeTabConfig = PANEL_TABS.find((t) => t.id === activeTab) ?? PANEL_TABS[0];

  const sidebarIcons: Record<PanelTabId, React.ReactNode> = {
    overview: <LayoutDashboard className="panel-sidebar-nav-icon" aria-hidden />,
    "institution-profile": <Building2 className="panel-sidebar-nav-icon" aria-hidden />,
    institutions: <Building className="panel-sidebar-nav-icon" aria-hidden />,
    announcements: <Megaphone className="panel-sidebar-nav-icon" aria-hidden />,
    subscription: <CreditCard className="panel-sidebar-nav-icon" aria-hidden />,
    requests: <Inbox className="panel-sidebar-nav-icon" aria-hidden />,
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
      .eq("owner_auth_id", user.id);
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
      city: institutionFormData.city.trim(),
      district: institutionFormData.district.trim(),
      address: institutionFormData.address.trim(),
      about: institutionFormData.about.trim(),
    };

    setIsSavingInstitutionProfile(true);
    setInstitutionProfileMessage(null);

    try {
      const { data, error } = await supabase
        .from("institutions")
        .update(payload)
        .eq("owner_auth_id", user.id)
        .select(
          "id, institution_name, official_email, official_phone, website, city, district, address, about, logo"
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
        city?: string | null;
        district?: string | null;
        address?: string | null;
        about?: string | null;
        logo?: string | null;
      };

      const logoUrl = row.logo
        ? supabase.storage.from("institution-logos").getPublicUrl(row.logo).data.publicUrl
        : "";

      const nextForm = {
        institutionName: row.institution_name || "",
        email: row.official_email || "",
        phone: row.official_phone || "",
        website: row.website || "",
        city: row.city || "",
        district: row.district || "",
        address: row.address || "",
        about: row.about || "",
        logoUrl,
      };

      setInstitutionFormData(nextForm);
      setInstitutionInitialFormData(nextForm);
      setInstitutionName(nextForm.institutionName);
      setInstitutionProfileMessage("Kurum profili güncellendi.");
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
  const isAnnouncementsTab = activeTab === "announcements";
  const isRequestsTab = activeTab === "requests";
  const isSubscriptionTab = activeTab === "subscription";
  const isOverviewTab = activeTab === "overview";
  const handleSaveBooleanFeatures = async () => {
    if (!institutionId) {
      setInstitutionFeaturesSaveMessage("Kurum özellikleri kaydedilirken bir hata oluştu.");
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
          .eq("id", Number(institutionId))
          .eq("owner_auth_id", user.id);

        if (typeUpdateError) {
          console.error("Institution type save error:", typeUpdateError);
          throw typeUpdateError;
        }
      }

      const booleanFeatures = institutionFeatureDefinitions.filter(
        (feature) => feature.input_type === "boolean"
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
        (feature) => feature.input_type === "text"
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
        (feature) => feature.input_type === "number"
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
        (feature) => feature.input_type === "single_select" || isSchoolHoursFeature(feature)
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
        (feature) => feature.input_type === "multi_select" && !isSchoolHoursFeature(feature)
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

      setInstitutionFeaturesSaveMessage("Kurum özellikleri güncellendi.");
      if (activeTab === "institutions") {
        const { data: refreshedEntries, error: refreshError } = await supabase
          .from("institution_feature_entries")
          .select("id, feature_definition_id, boolean_answer, text_answer, number_answer, selected_choice_id")
          .eq("institution_id", Number(institutionId));
        if (!refreshError) {
          const refreshed = (refreshedEntries as InstitutionFeatureEntryRow[] | null) ?? [];
          setInstitutionFeatureEntries(refreshed);

          const refreshedEntryIds = refreshed.map((entry) => entry.id);
          if (refreshedEntryIds.length > 0) {
            const { data: refreshedEntryChoices, error: refreshedChoicesError } = await supabase
              .from("institution_feature_entry_choices")
              .select("institution_feature_entry_id, choice_id")
              .in("institution_feature_entry_id", refreshedEntryIds);
            if (!refreshedChoicesError) {
              setInstitutionFeatureEntryChoices(
                (refreshedEntryChoices as InstitutionFeatureEntryChoiceRow[] | null) ?? []
              );
            }
          } else {
            setInstitutionFeatureEntryChoices([]);
          }
        }

        // Trigger ile güncellenen `institutions.is_verified` değerini anlık yansıt.
        const { data: instRow, error: instError } = await supabase
          .from("institutions")
          .select("is_verified")
          .eq("owner_auth_id", user.id)
          .maybeSingle();

        if (instError) {
          console.error("Institution is_verified refresh error:", instError);
        } else {
          setInstitutionIsVerified(Boolean(instRow?.is_verified));
        }
      }
    } catch (error) {
      console.error("Institution features save error:", error);
      setInstitutionFeaturesSaveMessage("Kurum özellikleri kaydedilirken bir hata oluştu.");
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
  const isAcademicGroup = (group: InstitutionFeatureGroupRow) => {
    const key = `${group.slug ?? ""} ${group.name}`.toLocaleLowerCase("tr-TR");
    return key.includes("akademik") && key.includes("imkan");
  };
  const academicGroup = institutionGroupsWithFeatures.find(
    ({ group }) => isAcademicGroup(group)
  );

  const getDisplayFeatureName = (name: string) => {
    const trimmed = (name ?? "").trim();
    if (trimmed.toLocaleLowerCase("tr-TR") === "engelliye uygun".toLocaleLowerCase("tr-TR")) {
      return "Engellilere Uygun";
    }
    return trimmed;
  };

  const hiddenFeatureNames = new Set<string>(
    [
      "Seminer",
      "Yabancı Dil Sınavı",
      "Deneme Sınavı",
      "Veli Bilgilendirme",
      "Veli Toplantısı",
      "Ders Tekrarı/Telafi Dersi",
      "Analiz",
      "Deneme Dersi",
      "Tuvalet Eğitimi",
      "Okul-Aile İşbirliği",
      "Okul Sonrası Kulüp",
      "Organik Beslenme",
      "Hazırlık Sınavı",
      "Birebir Etüt",
      "Mentorluk Programı",
      "Kaynak ve Materyal",
      "Özel Beslenme",
      "Ekolojik Bahçe",
      "Açık Havuz",
      "Açık Spor Salonu",
      "Lojman",
      "Hayvanat Bahçesi",
    ].map((n) => n.toLocaleLowerCase("tr-TR"))
  );

  const isFeatureHidden = (feature: InstitutionFeatureDefinitionRow) => {
    const name = (feature.name ?? "").trim();
    return hiddenFeatureNames.has(name.toLocaleLowerCase("tr-TR"));
  };

  const prioritySchoolFeatureNames = new Set<string>(
    [
      "Özel Eğitim Uygunluğu",
      "Montessori",
      "Waldorf",
      "Oyun Grubu",
      "Dini Eğitim",
    ].map((n) => n.toLocaleLowerCase("tr-TR"))
  );
  const isPrioritySchoolFeature = (feature: InstitutionFeatureDefinitionRow) =>
    prioritySchoolFeatureNames.has((feature.name ?? "").trim().toLocaleLowerCase("tr-TR"));
  const isSchoolHoursFeature = (feature: InstitutionFeatureDefinitionRow) =>
    (feature.name ?? "").trim().toLocaleLowerCase("tr-TR") === "okul saatleri";
  const isAverageClassSizeFeature = (feature: InstitutionFeatureDefinitionRow) =>
    (feature.name ?? "").trim().toLocaleLowerCase("tr-TR") === "ortalama sınıf mevcudu";
  const isSchoolFacilitiesGroup = (group: InstitutionFeatureGroupRow) => {
    const key = `${group.slug ?? ""} ${group.name}`.toLocaleLowerCase("tr-TR");
    return key.includes("okul") && key.includes("imkan");
  };

  const academicFeatures = (academicGroup?.features ?? institutionFeatureDefinitions)
    .filter(
      (feature) =>
        !isFeatureHidden(feature) &&
        !isPrioritySchoolFeature(feature) &&
        (feature.input_type === "text" ||
          feature.input_type === "number" ||
          feature.input_type === "boolean" ||
          feature.input_type === "single_select" ||
          feature.input_type === "multi_select")
    )
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const academicFeaturesFinal = (() => {
    const hoursIdx = academicFeatures.findIndex((f) => isSchoolHoursFeature(f));
    const avgIdx = academicFeatures.findIndex((f) => isAverageClassSizeFeature(f));
    if (hoursIdx < 0 || avgIdx < 0) return academicFeatures;
    if (avgIdx === hoursIdx + 1) return academicFeatures;

    const hours = academicFeatures[hoursIdx];
    const avg = academicFeatures[avgIdx];
    const withoutAvg = academicFeatures.filter((f) => f.id !== avg.id);
    const hoursIdxInNew = withoutAvg.findIndex((f) => f.id === hours.id);
    if (hoursIdxInNew < 0) return academicFeatures;

    const next = [...withoutAvg];
    next.splice(hoursIdxInNew + 1, 0, avg);
    return next;
  })();
  const selectionGroups = institutionGroupsWithFeatures
    .filter(({ group }) => !isAcademicGroup(group))
    .map(({ group, features }) => ({
      group,
      features: features.filter(
        (feature) =>
          !isFeatureHidden(feature) &&
          (feature.input_type === "boolean" ||
            feature.input_type === "multi_select" ||
            feature.input_type === "single_select")
      ),
    }))
    .filter((item) => item.features.length > 0);
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
            featureName: feature.name,
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
              featureName: feature.name,
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

  const OVERVIEW_ANNOUNCEMENTS = [
    {
      id: "o1",
      title: "Sistem Bakım Çalışması Hakkında",
      description: "24 Mayıs 2024 tarihinde saat 02:00 - 04:00 arasında planlı bakım çalışması gerçekleştirilecektir.",
      timeLabel: "2 Saat Önce",
      icon: Megaphone,
      iconBg: "orange",
    },
    {
      id: "o2",
      title: "Yeni Şube Kayıt Özelliği Aktif Edildi",
      description: "Artık panel üzerinden birden fazla şubenizi tek bir hesapla kolayca yönetebilirsiniz.",
      timeLabel: "Dün",
      icon: Info,
      iconBg: "blue",
    },
    {
      id: "o3",
      title: "Aylık Performans Raporu Yayınlandı",
      description: "Nisan ayı kurum içi büyüme ve kullanıcı etkileşim verilerini içeren raporunuz hazır.",
      timeLabel: "2 Gün Önce",
      icon: Star,
      iconBg: "purple",
    },
  ];

  const filteredRequests = requestsList.filter((r) => {
    if (requestStatusFilter === "all") return true;
    return r.status === requestStatusFilter;
  });

  const toggleRequestDetail = (id: string) => {
    setExpandedRequestId((prev) => (prev === id ? null : id));
  };

  const openNewAnnouncementModal = () => {
    setEditingAnnouncementId(null);
    setAnnouncementForm({ title: "", content: "", status: "draft" });
    setAnnouncementFormErrors({});
    setAnnouncementModalOpen(true);
  };

  const openEditAnnouncementModal = (item: AnnouncementRow) => {
    setEditingAnnouncementId(item.id);
    setAnnouncementForm({
      title: item.title,
      content: item.content,
      status: item.status,
    });
    setAnnouncementFormErrors({});
    setAnnouncementModalOpen(true);
  };

  const closeAnnouncementModal = () => {
    setAnnouncementModalOpen(false);
    setEditingAnnouncementId(null);
    setAnnouncementFormErrors({});
  };

  const handleAnnouncementFormChange = (
    field: keyof typeof announcementForm,
    value: string | AnnouncementStatus
  ) => {
    setAnnouncementForm((prev) => ({ ...prev, [field]: value }));
    setAnnouncementFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAnnouncementSave = () => {
    const title = announcementForm.title.trim();
    const content = announcementForm.content.trim();
    const errors: { title?: string; content?: string } = {};
    if (!title) errors.title = "Başlık zorunludur.";
    if (!content) errors.content = "İçerik zorunludur.";
    if (Object.keys(errors).length > 0) {
      setAnnouncementFormErrors(errors);
      return;
    }
    if (editingAnnouncementId) {
      setAnnouncementsList((prev) =>
        prev.map((row) =>
          row.id === editingAnnouncementId
            ? { ...row, title, content, status: announcementForm.status }
            : row
        )
      );
    } else {
      setAnnouncementsList((prev) => [
        {
          id: String(Date.now()),
          title,
          content,
          date: "—",
          status: announcementForm.status,
        },
        ...prev,
      ]);
    }
    closeAnnouncementModal();
  };

  const handleAnnouncementDelete = (id: string) => {
    setAnnouncementsList((prev) => prev.filter((row) => row.id !== id));
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
                    Profil durumunuzu ve duyuruları buradan takip edebilirsiniz.
                  </p>
                </div>
                <div className="panel-overview-content">
                  <div className="panel-overview-cards">
                    <div className="panel-overview-summary-card panel-overview-summary-card--progress">
                      <div className="panel-overview-summary-card-text">
                        <span className="panel-overview-card-label">HESAP DURUMU</span>
                        <h3 className="panel-overview-card-title">Profil Tamamlanma Yüzdesi</h3>
                        <p className="panel-overview-card-desc">
                          Profilinizi %100 yaparak daha fazla özelliğe erişim sağlayın.
                        </p>
                      </div>
                      <div className="panel-overview-progress-wrap">
                        <div className="panel-overview-progress-ring" aria-hidden>
                          <span className="panel-overview-progress-value">85%</span>
                        </div>
                      </div>
                    </div>
                    <div className="panel-overview-summary-card">
                      <span className="panel-overview-card-label">KURUMSAL ONAY</span>
                      <h3 className="panel-overview-card-title">Onay Durumu</h3>
                      <div className="panel-overview-status-row">
                        <span className="panel-overview-status-chip">
                          <span className="panel-overview-status-dot" aria-hidden />
                          YAYINDA
                        </span>
                        <div className="panel-overview-status-icon" aria-hidden>
                          <CheckCircle className="panel-overview-status-check" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="panel-overview-announcements">
                    <div className="panel-overview-announcements-header">
                      <h3 className="panel-overview-announcements-title">Yaklaşan Duyurular</h3>
                      <span className="panel-overview-announcements-pill">SON DUYURULAR</span>
                    </div>
                    <ul className="panel-overview-announcements-list">
                      {OVERVIEW_ANNOUNCEMENTS.map((item) => (
                        <li key={item.id} className="panel-overview-announcements-item">
                          <div className={`panel-overview-announcements-icon panel-overview-announcements-icon--${item.iconBg}`}>
                            <item.icon className="panel-overview-announcements-icon-svg" aria-hidden />
                          </div>
                          <div className="panel-overview-announcements-body">
                            <span className="panel-overview-announcements-item-title">{item.title}</span>
                            <p className="panel-overview-announcements-item-desc">{item.description}</p>
                          </div>
                          <span className="panel-overview-announcements-time">{item.timeLabel}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="panel-overview-announcements-footer">
                      <button type="button" className="panel-overview-announcements-link">
                        Tüm Duyuruları Gör &gt;
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="panel-main-card-header">
              <div className="panel-main-card-header-left">
                {isAnnouncementsTab ? <Megaphone className="panel-main-card-icon" aria-hidden /> : null}
                {isRequestsTab ? <Inbox className="panel-main-card-icon" aria-hidden /> : null}
                {isSubscriptionTab ? <CreditCard className="panel-main-card-icon" aria-hidden /> : null}
                {isInstitutionProfileTab ? <Building2 className="panel-main-card-icon" aria-hidden /> : null}
                <h2 id="panel-card-title" className="panel-main-card-title">
                  {isAnnouncementsTab ? "İçerikler & Duyurular" : isRequestsTab ? "Talepler" : activeTabConfig.label}
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
                >
                  <Plus className="panel-announcements-add-btn-icon" aria-hidden />
                  Yeni Duyuru
                </Button>
              ) : isRequestsTab ? (
                <div className="panel-requests-filter-wrap">
                  <label htmlFor="panel-requests-status-filter" className="panel-requests-filter-label">
                    Durum
                  </label>
                  <select
                    id="panel-requests-status-filter"
                    value={requestStatusFilter}
                    onChange={(e) => setRequestStatusFilter(e.target.value as RequestStatusFilter)}
                    className="panel-requests-filter-select"
                    aria-label="Talep durumu filtrele"
                  >
                    <option value="all">Tümü</option>
                    <option value="pending">Beklemede</option>
                    <option value="approved">Onaylandı</option>
                    <option value="rejected">Reddedildi</option>
                  </select>
                </div>
              ) : isSubscriptionTab ? null : (
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
              </div>
            ) : isAnnouncementsTab ? (
              <div className="panel-announcements-content">
                <div className="panel-announcements-table-wrap">
                  <table className="panel-announcements-table">
                    <thead>
                      <tr>
                        <th className="panel-announcements-th">Başlık</th>
                        <th className="panel-announcements-th">Kısa açıklama</th>
                        <th className="panel-announcements-th">Tarih</th>
                        <th className="panel-announcements-th">Durum</th>
                        <th className="panel-announcements-th panel-announcements-th-actions">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {announcementsList.map((row) => (
                        <tr key={row.id} className="panel-announcements-tr">
                          <td className="panel-announcements-td panel-announcements-td-title">
                            {row.title}
                          </td>
                          <td className="panel-announcements-td panel-announcements-td-desc">
                            <span className="panel-announcements-desc-clamp">{row.content}</span>
                          </td>
                          <td className="panel-announcements-td">{row.date}</td>
                          <td className="panel-announcements-td">
                            <span
                              className={
                                row.status === "published"
                                  ? "panel-announcements-badge panel-announcements-badge--published"
                                  : "panel-announcements-badge panel-announcements-badge--draft"
                              }
                            >
                              {row.status === "published" ? "Yayında" : "Taslak"}
                            </span>
                          </td>
                          <td className="panel-announcements-td panel-announcements-td-actions">
                            <button
                              type="button"
                              className="panel-announcements-action-btn"
                              aria-label="Düzenle"
                              onClick={() => openEditAnnouncementModal(row)}
                            >
                              <PencilLine className="panel-announcements-action-icon" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="panel-announcements-action-btn"
                              aria-label="Sil"
                              onClick={() => handleAnnouncementDelete(row.id)}
                            >
                              <Trash2 className="panel-announcements-action-icon" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : isRequestsTab ? (
              <div className="panel-requests-content">
                {filteredRequests.length === 0 ? (
                  <div className="panel-requests-empty">
                    <p className="panel-requests-empty-text">
                      {requestStatusFilter === "all" ? "Henüz talep bulunmuyor." : "Bu filtrede sonuç yok."}
                    </p>
                  </div>
                ) : (
                  <div className="panel-requests-list">
                    {filteredRequests.map((row) => (
                      <div key={row.id} className="panel-requests-item">
                        <div className="panel-requests-item-row">
                          <div className="panel-requests-item-main">
                            <span className="panel-requests-item-type">{row.type}</span>
                            <span className="panel-requests-item-institution">{row.institutionName}</span>
                            <span className="panel-requests-item-date">{row.createdAt}</span>
                          </div>
                          <div className="panel-requests-item-meta">
                            <span
                              className={
                                row.status === "approved"
                                  ? "panel-requests-badge panel-requests-badge--approved"
                                  : row.status === "rejected"
                                    ? "panel-requests-badge panel-requests-badge--rejected"
                                    : "panel-requests-badge panel-requests-badge--pending"
                              }
                            >
                              {row.status === "approved" ? "Onaylandı" : row.status === "rejected" ? "Reddedildi" : "Beklemede"}
                            </span>
                            <button
                              type="button"
                              className="panel-requests-detail-btn"
                              onClick={() => toggleRequestDetail(row.id)}
                              aria-expanded={expandedRequestId === row.id}
                            >
                              {expandedRequestId === row.id ? "Gizle" : "Detay"}
                            </button>
                          </div>
                        </div>
                        {expandedRequestId === row.id && (
                          <div className="panel-requests-detail">
                            <div className="panel-requests-detail-row">
                              <span className="panel-requests-detail-label">Talep açıklaması</span>
                              <p className="panel-requests-detail-value">{row.description}</p>
                            </div>
                            {(row.status === "approved" || row.status === "rejected") && row.adminNote && (
                              <div className="panel-requests-detail-row">
                                <span className="panel-requests-detail-label">Admin notu</span>
                                <p className="panel-requests-detail-value">{row.adminNote}</p>
                              </div>
                            )}
                            <div className="panel-requests-detail-row">
                              <span className="panel-requests-detail-label">Son güncelleme</span>
                              <p className="panel-requests-detail-value">{row.updatedAt}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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

                    <section className="panel-institutions-group-item panel-institutions-group-item--basic">
                      <h4 className="panel-institutions-group-title panel-institutions-group-title--academic">
                        <Info className="panel-institutions-group-title-icon panel-institutions-group-title-icon--academic" aria-hidden />
                        Akademik İmkanlar
                      </h4>
                      <div className="panel-institutions-features-grid">
                        {academicFeaturesFinal.map((feature) => (
                          <div
                            key={feature.id}
                            className={`panel-institutions-feature-item ${
                              feature.input_type === "text" ||
                              feature.input_type === "multi_select" ||
                              feature.input_type === "boolean"
                                ? "panel-institutions-feature-item--full"
                                : ""
                            }`}
                          >
                            {feature.input_type === "text" ? (
                              <div className="panel-institutions-feature-input-wrap">
                                <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                                {((feature.help_text ?? "").length > 120 || (feature.placeholder ?? "").length > 70) ? (
                                  <textarea
                                    className="panel-institutions-feature-textarea"
                                    value={institutionTextFeatureValues[feature.id] ?? ""}
                                    onChange={(e) =>
                                      setInstitutionTextFeatureValues((prev) => ({
                                        ...prev,
                                        [feature.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={feature.placeholder || "Bilgi giriniz"}
                                    rows={3}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    className="panel-institutions-feature-input"
                                    value={institutionTextFeatureValues[feature.id] ?? ""}
                                    onChange={(e) =>
                                      setInstitutionTextFeatureValues((prev) => ({
                                        ...prev,
                                        [feature.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={feature.placeholder || "Bilgi giriniz"}
                                  />
                                )}
                              </div>
                            ) : feature.input_type === "number" ? (
                              <div className="panel-institutions-feature-input-wrap">
                                <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                                <div className="panel-institutions-feature-number-row">
                                  <input
                                    type="number"
                                    className="panel-institutions-feature-input"
                                    value={institutionNumberFeatureValues[feature.id] ?? ""}
                                    onChange={(e) =>
                                      setInstitutionNumberFeatureValues((prev) => ({
                                        ...prev,
                                        [feature.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={feature.placeholder || "Sayı giriniz"}
                                  />
                                  {feature.unit ? (
                                    <span className="panel-institutions-feature-unit">{feature.unit}</span>
                                  ) : null}
                                </div>
                              </div>
                            ) : feature.input_type === "boolean" ? (
                              <div className="panel-institutions-feature-input-wrap">
                                <label className="panel-institutions-selection-check">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(institutionBooleanFeatureValues[feature.id])}
                                    onChange={(e) =>
                                      setInstitutionBooleanFeatureValues((prev) => ({
                                        ...prev,
                                        [feature.id]: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>{getDisplayFeatureName(feature.name)}</span>
                                </label>
                              </div>
                            ) : feature.input_type === "multi_select" ? (
                              <div className="panel-institutions-feature-input-wrap">
                                <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                                <div className="panel-institutions-feature-multi">
                                  {institutionFeatureChoices
                                    .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                                    .map((choice) => {
                                      const choiceId = String(choice.id);
                                      const selectedValues = institutionMultiSelectValues[feature.id] ?? [];
                                      const isSelected = selectedValues.includes(choiceId);
                                      return (
                                        <button
                                          key={choice.id}
                                          type="button"
                                          className={`panel-institutions-feature-chip ${isSelected ? "is-selected" : ""}`}
                                          onClick={() =>
                                            setInstitutionMultiSelectValues((prev) => {
                                              const current = prev[feature.id] ?? [];
                                              const next = isSelected
                                                ? current.filter((id) => id !== choiceId)
                                                : [...current, choiceId];
                                              return {
                                                ...prev,
                                                [feature.id]: next,
                                              };
                                            })
                                          }
                                        >
                                          <span className="panel-institutions-feature-chip-check" aria-hidden>
                                            {isSelected ? "✓" : ""}
                                          </span>
                                          <span>{choice.name?.trim() || ""}</span>
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            ) : (
                              <div className="panel-institutions-feature-input-wrap">
                                <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                                <div className="panel-institutions-single-select-dropdown">
                                  <button
                                    type="button"
                                    className={`panel-institutions-feature-select panel-institutions-feature-select--button ${openInstitutionSelectId === feature.id ? "panel-institutions-feature-select--open" : ""}`}
                                    onClick={() =>
                                      setOpenInstitutionSelectId((prev) =>
                                        prev === feature.id ? null : feature.id
                                      )
                                    }
                                    aria-haspopup="listbox"
                                    aria-expanded={openInstitutionSelectId === feature.id}
                                  >
                                    <span
                                      className="panel-institutions-feature-select-label"
                                      title={
                                        institutionFeatureChoices.find(
                                          (choice) =>
                                            String(choice.id) === (institutionSingleSelectValues[feature.id] ?? "") &&
                                            choice.feature_definition_id === feature.id &&
                                            choice.is_active
                                        )?.name || feature.placeholder || "Seçiniz"
                                      }
                                    >
                                      {institutionFeatureChoices.find(
                                        (choice) =>
                                          String(choice.id) === (institutionSingleSelectValues[feature.id] ?? "") &&
                                          choice.feature_definition_id === feature.id &&
                                          choice.is_active
                                      )?.name || feature.placeholder || "Seçiniz"}
                                    </span>
                                  </button>
                                  {openInstitutionSelectId === feature.id && (
                                    <div className="panel-institutions-feature-select-menu" role="listbox">
                                      <button
                                        type="button"
                                        role="option"
                                        aria-selected={(institutionSingleSelectValues[feature.id] ?? "") === ""}
                                        className={`panel-institutions-feature-select-option ${(institutionSingleSelectValues[feature.id] ?? "") === "" ? "panel-institutions-feature-select-option--selected" : ""}`}
                                        onClick={() => {
                                          setInstitutionSingleSelectValues((prev) => ({
                                            ...prev,
                                            [feature.id]: "",
                                          }));
                                          setOpenInstitutionSelectId(null);
                                        }}
                                      >
                                        {feature.placeholder || "Seçiniz"}
                                      </button>
                                      {institutionFeatureChoices
                                        .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                                        .map((choice) => (
                                          <button
                                            key={choice.id}
                                            type="button"
                                            role="option"
                                            aria-selected={(institutionSingleSelectValues[feature.id] ?? "") === String(choice.id)}
                                            className={`panel-institutions-feature-select-option ${(institutionSingleSelectValues[feature.id] ?? "") === String(choice.id) ? "panel-institutions-feature-select-option--selected" : ""}`}
                                            onClick={() => {
                                              setInstitutionSingleSelectValues((prev) => ({
                                                ...prev,
                                                [feature.id]: String(choice.id),
                                              }));
                                              setOpenInstitutionSelectId(null);
                                            }}
                                            title={choice.name || undefined}
                                          >
                                            {choice.name?.trim() || ""}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>

                    {selectionGroups.map(({ group, features }) => {
                      const normalizedFeatureName = (name: string | null | undefined) =>
                        String(name ?? "").trim().toLocaleLowerCase("tr-TR");
                      const featureByName = new Map<string, InstitutionFeatureDefinitionRow>();
                      institutionFeatureDefinitions.forEach((feature) => {
                        if (isFeatureHidden(feature)) return;
                        const key = normalizedFeatureName(feature.name);
                        if (key && !featureByName.has(key)) {
                          featureByName.set(key, feature);
                        }
                      });

                      const prioritizedSchoolFeatures = [
                        featureByName.get("özel eğitim uygunluğu"),
                        featureByName.get("montessori"),
                        featureByName.get("waldorf"),
                        featureByName.get("oyun grubu"),
                        featureByName.get("dini eğitim"),
                      ].filter((f): f is InstitutionFeatureDefinitionRow => Boolean(f));

                      const schoolHoursFeature = featureByName.get("okul saatleri") ?? null;
                      const isSchoolGroup = isSchoolFacilitiesGroup(group);
                      const consumedIds = new Set<number>();
                      const visibleFeatures = isSchoolGroup
                        ? [
                            ...prioritizedSchoolFeatures.filter((f) => {
                              if (consumedIds.has(f.id)) return false;
                              consumedIds.add(f.id);
                              return true;
                            }),
                            ...features.filter((feature) => {
                              if (consumedIds.has(feature.id)) return false;
                              if (isPrioritySchoolFeature(feature) || isSchoolHoursFeature(feature)) return false;
                              consumedIds.add(feature.id);
                              return true;
                            }),
                          ]
                        : features.filter(
                            (feature) => !isPrioritySchoolFeature(feature) && !isSchoolHoursFeature(feature)
                          );

                      return (
                      <section key={group.id} className="panel-institutions-group-item">
                        {group.name.toLocaleLowerCase("tr-TR").includes("okul") ? (
                          <h4 className="panel-institutions-group-title panel-institutions-group-title--school">
                            <Building className="panel-institutions-group-title-icon panel-institutions-group-title-icon--school" aria-hidden />
                            {group.name}
                          </h4>
                        ) : (
                          <h4 className="panel-institutions-group-title panel-institutions-group-title--physical">
                            <Building2 className="panel-institutions-group-title-icon panel-institutions-group-title-icon--physical" aria-hidden />
                            {group.name}
                          </h4>
                        )}
                        <div className="panel-institutions-features-grid panel-institutions-features-grid--selection">
                          {visibleFeatures.map((feature) => (
                            <div key={feature.id} className="panel-institutions-selection-item">
                              {feature.input_type === "boolean" ? (
                                <label className="panel-institutions-selection-check">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(institutionBooleanFeatureValues[feature.id])}
                                    onChange={(e) =>
                                      setInstitutionBooleanFeatureValues((prev) => ({
                                        ...prev,
                                        [feature.id]: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>{getDisplayFeatureName(feature.name)}</span>
                                </label>
                              ) : feature.input_type === "single_select" || isSchoolHoursFeature(feature) ? (
                                <div className="panel-institutions-feature-input-wrap">
                                  <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                                  <div className="panel-institutions-single-select-dropdown">
                                    <button
                                      type="button"
                                      className={`panel-institutions-feature-select panel-institutions-feature-select--button ${openInstitutionSelectId === feature.id ? "panel-institutions-feature-select--open" : ""}`}
                                      onClick={() =>
                                        setOpenInstitutionSelectId((prev) =>
                                          prev === feature.id ? null : feature.id
                                        )
                                      }
                                      aria-haspopup="listbox"
                                      aria-expanded={openInstitutionSelectId === feature.id}
                                    >
                                      <span
                                        className="panel-institutions-feature-select-label"
                                        title={
                                          institutionFeatureChoices.find(
                                            (choice) =>
                                              String(choice.id) === (institutionSingleSelectValues[feature.id] ?? "") &&
                                              choice.feature_definition_id === feature.id &&
                                              choice.is_active
                                          )?.name || feature.placeholder || "Seçiniz"
                                        }
                                      >
                                        {institutionFeatureChoices.find(
                                          (choice) =>
                                            String(choice.id) === (institutionSingleSelectValues[feature.id] ?? "") &&
                                            choice.feature_definition_id === feature.id &&
                                            choice.is_active
                                        )?.name || feature.placeholder || "Seçiniz"}
                                      </span>
                                    </button>
                                    {openInstitutionSelectId === feature.id && (
                                      <div className="panel-institutions-feature-select-menu" role="listbox">
                                        <button
                                          type="button"
                                          role="option"
                                          aria-selected={(institutionSingleSelectValues[feature.id] ?? "") === ""}
                                          className={`panel-institutions-feature-select-option ${(institutionSingleSelectValues[feature.id] ?? "") === "" ? "panel-institutions-feature-select-option--selected" : ""}`}
                                          onClick={() => {
                                            setInstitutionSingleSelectValues((prev) => ({
                                              ...prev,
                                              [feature.id]: "",
                                            }));
                                            setOpenInstitutionSelectId(null);
                                          }}
                                        >
                                          {feature.placeholder || "Seçiniz"}
                                        </button>
                                        {institutionFeatureChoices
                                          .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                                          .map((choice) => (
                                            <button
                                              key={choice.id}
                                              type="button"
                                              role="option"
                                              aria-selected={(institutionSingleSelectValues[feature.id] ?? "") === String(choice.id)}
                                              className={`panel-institutions-feature-select-option ${(institutionSingleSelectValues[feature.id] ?? "") === String(choice.id) ? "panel-institutions-feature-select-option--selected" : ""}`}
                                              onClick={() => {
                                                setInstitutionSingleSelectValues((prev) => ({
                                                  ...prev,
                                                  [feature.id]: String(choice.id),
                                                }));
                                                setOpenInstitutionSelectId(null);
                                              }}
                                              title={choice.name || undefined}
                                            >
                                              {choice.name?.trim() || ""}
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="panel-institutions-feature-input-wrap">
                                  <p className="panel-institutions-feature-name">{getDisplayFeatureName(feature.name)}</p>
                                  <div className="panel-institutions-feature-multi">
                                    {institutionFeatureChoices
                                      .filter((choice) => choice.feature_definition_id === feature.id && choice.is_active)
                                      .map((choice) => {
                                        const choiceId = String(choice.id);
                                        const selectedValues = institutionMultiSelectValues[feature.id] ?? [];
                                        const isSelected = selectedValues.includes(choiceId);
                                        return (
                                          <button
                                            key={choice.id}
                                            type="button"
                                            className={`panel-institutions-feature-chip ${isSelected ? "is-selected" : ""}`}
                                            onClick={() =>
                                              setInstitutionMultiSelectValues((prev) => {
                                                const current = prev[feature.id] ?? [];
                                                const next = isSelected
                                                  ? current.filter((id) => id !== choiceId)
                                                  : [...current, choiceId];
                                                return {
                                                  ...prev,
                                                  [feature.id]: next,
                                                };
                                              })
                                            }
                                          >
                                            <span className="panel-institutions-feature-chip-check" aria-hidden>
                                              {isSelected ? "✓" : ""}
                                            </span>
                                            <span>{choice.name?.trim() || ""}</span>
                                          </button>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )})}

                    <div className="panel-institutions-actions">
                      <Button
                        type="button"
                        variant="default"
                        className="panel-institutions-save-btn"
                        onClick={handleSaveBooleanFeatures}
                        disabled={institutionFeaturesSaving}
                      >
                        {institutionFeaturesSaving ? "Kaydediliyor..." : "Kaydet"}
                      </Button>
                    </div>
                    {institutionFeaturesSaveMessage ? (
                      <p className="panel-institutions-save-message">{institutionFeaturesSaveMessage}</p>
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
      </div>

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
                  <label className="panel-institution-form-label">DURUM</label>
                  <select
                    value={announcementForm.status}
                    onChange={(e) =>
                      handleAnnouncementFormChange("status", e.target.value as AnnouncementStatus)
                    }
                    className="panel-announcement-status-select"
                  >
                    <option value="draft">Taslak</option>
                    <option value="published">Yayında</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="panel-announcement-modal-footer">
              <Button
                type="button"
                variant="outline"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--cancel"
                onClick={closeAnnouncementModal}
              >
                İptal
              </Button>
              <Button
                type="button"
                variant="default"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--submit"
                onClick={handleAnnouncementSave}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
