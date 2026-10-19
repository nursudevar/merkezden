"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui";
import { HomeSectionLoadError } from "@/components/home/HomeSectionLoadError";
import GalleryMediaViewer, { useGalleryModalEffects } from "@/components/gallery/GalleryMediaViewer";
import {
  MapPin,
  Heart,
  CheckCircle2,
  BookOpen,
  Phone,
  Globe,
  X,
  ArrowLeft,
  Play,
  Megaphone,
  CalendarDays,
  ImageOff,
  Layers,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import { formatWorkingHoursRange } from "@/lib/institutionHelpers";
import { formatInstitutionPriceRangeDisplay } from "@/lib/institutionPriceRangeFilter";
import { FeatureHighlightsPublicSection } from "@/components/features/FeatureHighlightsPublicSection";
import {
  fetchInstitutionHighlightRowsClient,
  resolvePublicHighlightItems,
  type PublicHighlightDisplayItem,
} from "@/lib/featureHighlightsPublic";
import { getAnnouncementTagBadgeClassName } from "@/lib/announcementTags";
import {
  loadInstitutionExtraBranchesClient,
  mapLoadedExtraBranchesForPublicProfile,
  type PublicInstitutionExtraBranch,
} from "@/lib/institutionExtraBranches";
import {
  mapPublicInstitutionFeatures,
  type AcademicFeatureLine,
  type InstitutionFeatureChoiceRow,
  type InstitutionFeatureDefinitionRow,
  type InstitutionFeatureEntryChoiceRow,
  type InstitutionFeatureEntryRow,
  type InstitutionFeatureGroupRow,
  type PublicFeatureGroupSection,
} from "@/lib/institutionPublicFeatures";
import ShareButton from "./ShareButton";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import {
  buildLocationAdMaps,
  formatAnnouncementLocationLabel,
  lookupLocationAds,
} from "@/lib/turkiyeLocationsClient";
import {
  getHighSchoolTypeLabel,
  LISE_INSTITUTION_TYPE_ID,
  OKUL_CATEGORY_SLUG,
} from "@/lib/schoolInstitutionTypes";
import { STUDENT_AGE_RANGE_LABEL } from "@/lib/studentAgeRangeFeature";
import CategoryBreadcrumb from "@/components/category/CategoryBreadcrumb";
import { InstitutionCompareToggleButton } from "@/components/compare/InstitutionCompareToggleButton";
import LoginModal from "@/components/LoginModal";
import { AppNoticeBar } from "@/components/AppNoticeBar";
import { useListingFavorites } from "@/hooks/useListingFavorites";
import { SELF_FAVORITE_MESSAGE } from "@/lib/favorites/favoritesClient";
import { getCategoryHref, getCategoryIcon, getCategoryLogoSrc } from "@/lib/categoryHelpers";
import { toLocationIdString } from "@/lib/turkiyeLocationsClient";

function getFeatureGroupAnchorId(
  sectionId: number,
  index: number,
  sections: ReadonlyArray<{ id: number }>,
): string {
  const isDuplicate = sections.some(
    (section, sectionIndex) => section.id === sectionId && sectionIndex !== index,
  );
  return isDuplicate ? `feature-group-${sectionId}-${index}` : `feature-group-${sectionId}`;
}

type DbInstitutionRow = {
  id: number;
  slug: string | null;
  institution_name: string | null;
  type: string | null;
  high_school_type?: string | null;
  category_id?: number | null;
  category: {
    name: string | null;
    slug?: string | null;
  } | Array<{ name: string | null; slug?: string | null }> | null;
  institution_type: {
    id?: number | null;
    name: string | null;
    category: { name: string | null; slug?: string | null } | null;
  } | Array<{
    id?: number | null;
    name: string | null;
    category: { name: string | null; slug?: string | null } | null;
  }> | null;
  city: string | null;
  district: string | null;
  address: string | null;
  official_phone: string | null;
  website: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  subheading: string | null;
  about: string | null;
  logo: string | null;
  is_approved: boolean | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  min_fiyat?: number | null;
  max_fiyat?: number | null;
  il_id?: number | null;
  ilce_id?: number | null;
  mahalle_id?: number | null;
};

type InstitutionMediaImageRow = {
  id: number | string;
  media_type: string | null;
  file_url: string | null;
  file_path: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

const OWN_PENDING_PROFILE_TITLE = "Profiliniz Henüz Yayında Değil";
const OWN_PENDING_PROFILE_MESSAGE =
  "Hesabınız yönetici onayını bekliyor. Onaylandığında profiliniz yayımlanacak ve diğer kullanıcılar tarafından görüntülenebilecektir.";

async function isOwnPendingInstitutionProfile(slug: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const authUid = sessionData.session?.user?.id;
  if (!authUid) return false;

  const { data, error } = await supabase
    .from("institutions")
    .select("id, slug, is_approved")
    .eq("owner_auth_id", authUid)
    .maybeSingle();

  if (error || !data || data.is_approved !== null) return false;
  return String(data.slug ?? "").trim() === String(slug ?? "").trim();
}

function serializeSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return null;
  const record = err as Record<string, unknown>;
  return {
    message: String(record.message ?? ""),
    details: String(record.details ?? ""),
    hint: String(record.hint ?? ""),
    code: String(record.code ?? ""),
  };
}

function isUnauthorizedSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const record = err as Record<string, unknown>;
  const code = String(record.code ?? "");
  const message = String(record.message ?? "").toLowerCase();
  return (
    code === "401" ||
    code === "42501" ||
    message.includes("unauthorized") ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

function formatAcademicFeatureLineValue(line: AcademicFeatureLine | undefined): string {
  if (!line) return "";
  if (Array.isArray(line.value)) {
    return line.value.map((item) => item.trim()).filter(Boolean).join(", ");
  }
  return String(line.value ?? "").trim();
}

const COMMON_GENERAL_INFO_LABELS = [
  "Kurum Türü",
  "Hizmet Tipi",
  "Eğitim Dili",
  STUDENT_AGE_RANGE_LABEL,
  "Sınıf Mevcudu",
] as const;

function buildInstitutionGeneralInfoRows(args: {
  categoryName: string;
  isOkulCategory: boolean;
  schoolLevelLabel: string;
  institutionTypeId: number | null;
  highSchoolLabel: string;
  academicLines: AcademicFeatureLine[];
  workingHoursText: string;
  monthlyPriceText: string;
}): Array<{ label: string; value: string }> {
  const commonLabels = new Set<string>(COMMON_GENERAL_INFO_LABELS);
  const lineByLabel = new Map<string, AcademicFeatureLine>();
  args.academicLines.forEach((line) => {
    if (!lineByLabel.has(line.label)) lineByLabel.set(line.label, line);
  });

  const orderOf = (label: string) => {
    const order = lineByLabel.get(label)?.displayOrder;
    return typeof order === "number" && Number.isFinite(order) ? order : 9999;
  };

  const trailingOrder = 1_000_000;
  const ageLine = lineByLabel.get(STUDENT_AGE_RANGE_LABEL);
  const classSizeLine = lineByLabel.get("Sınıf Mevcudu");
  const hoursOrder =
    ageLine && typeof ageLine.displayOrder === "number"
      ? ageLine.displayOrder + 0.5
      : trailingOrder;
  const priceOrder =
    classSizeLine && typeof classSizeLine.displayOrder === "number"
      ? classSizeLine.displayOrder + 0.5
      : trailingOrder + 1;

  const structuralRows: Array<{ label: string; value: string }> = [];
  const pushStructural = (label: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    structuralRows.push({ label, value: trimmed });
  };

  pushStructural("Kategori", args.categoryName);
  if (args.isOkulCategory) {
    pushStructural("Alt Kategori", args.schoolLevelLabel);
    if (args.institutionTypeId === LISE_INSTITUTION_TYPE_ID) {
      pushStructural("Lise Türü", args.highSchoolLabel);
    }
  }

  const featureRows: Array<{ label: string; value: string; order: number }> = [];
  const usedLabels = new Set(structuralRows.map((row) => row.label));
  const pushFeature = (label: string, value: string, order: number) => {
    const trimmed = value.trim();
    if (!trimmed || usedLabels.has(label)) return;
    usedLabels.add(label);
    featureRows.push({ label, value: trimmed, order });
  };

  COMMON_GENERAL_INFO_LABELS.forEach((label) => {
    pushFeature(label, formatAcademicFeatureLineValue(lineByLabel.get(label)), orderOf(label));
  });
  pushFeature("Eğitim Saatleri", args.workingHoursText, hoursOrder);
  pushFeature("Aylık Fiyat Aralığı", args.monthlyPriceText, priceOrder);

  args.academicLines.forEach((line) => {
    if (commonLabels.has(line.label)) return;
    pushFeature(
      line.label,
      formatAcademicFeatureLineValue(line),
      typeof line.displayOrder === "number" && Number.isFinite(line.displayOrder)
        ? line.displayOrder
        : 9999,
    );
  });

  featureRows.sort((left, right) => left.order - right.order);

  return [
    ...structuralRows,
    ...featureRows.map(({ label, value }) => ({ label, value })),
  ];
}

export default function DbInstitutionDetailClient({ slug }: { slug: string }) {
  const {
    user,
    showLoginModal,
    setShowLoginModal,
    favoriteIds,
    favoritesEnabled,
    favoritesError,
    setFavoritesError,
    favoriteActionLoadingIds,
    handleFavoriteToggle,
  } = useListingFavorites();
  const [row, setRow] = useState<DbInstitutionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownPendingApproval, setOwnPendingApproval] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [mediaItems, setMediaItems] = useState<
    Array<{
      id: string;
      mediaType: "photo" | "video";
      url: string;
    }>
  >([]);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "photo" | "video">("all");
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [publicFeatureSections, setPublicFeatureSections] = useState<PublicFeatureGroupSection[]>([]);
  const [highlightItems, setHighlightItems] = useState<PublicHighlightDisplayItem[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const [publicExtraBranches, setPublicExtraBranches] = useState<PublicInstitutionExtraBranch[]>(
    [],
  );
  const [extraBranchesLoadFailed, setExtraBranchesLoadFailed] = useState(false);
  const [extraBranchesChecking, setExtraBranchesChecking] = useState(false);
  const [extraBranchesRetryCount, setExtraBranchesRetryCount] = useState(0);
  const extraBranchesRetryLockRef = useRef(false);
  const [featuresLoadFailed, setFeaturesLoadFailed] = useState(false);
  const [featuresChecking, setFeaturesChecking] = useState(false);
  const [featuresRetryCount, setFeaturesRetryCount] = useState(0);
  const featuresRetryLockRef = useRef(false);
  const [institutionAnnouncements, setInstitutionAnnouncements] = useState<
    AnnouncementDetailItem[]
  >([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsLoaded, setAnnouncementsLoaded] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementDetailItem | null>(null);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      setLoading(true);
      setError(null);
      setOwnPendingApproval(false);

      const { data, error: qErr } = await supabase
        .from("institutions")
        .select(
          "id, slug, institution_name, type, high_school_type, category_id, city, district, address, official_phone, website, facebook_url, instagram_url, x_url, linkedin_url, subheading, about, logo, is_approved, working_hours_start, working_hours_end, min_fiyat, max_fiyat, il_id, ilce_id, mahalle_id, category:institution_categories(name, slug), institution_type:institution_types(id, name, category:institution_categories(name, slug))"
        )
        .eq("slug", slug)
        .eq("is_approved", true)
        .maybeSingle();

      if (cancelled) return;

      if (qErr) {
        console.error("[institutions][detail][db-query-error]", qErr);
        setRow(null);
        setError("Kurum kaydı yüklenirken bir hata oluştu.");
        setLoading(false);
        return;
      }

      const r = (data as DbInstitutionRow | null) ?? null;
      if (!r) {
        const ownPending = await isOwnPendingInstitutionProfile(slug);
        if (cancelled) return;
        setRow(null);
        if (ownPending) {
          setOwnPendingApproval(true);
        } else {
          setError("Kurum kaydı bulunamadı.");
        }
        setLoading(false);
        return;
      }

      setRow(r);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    setShowAllAnnouncements(false);
  }, [slug]);

  const scrollToSection = useCallback((sectionId: string) => {
    if (typeof window === "undefined") return;
    programmaticScrollRef.current = true;
    const releaseProgrammaticScroll = () => {
      programmaticScrollRef.current = false;
    };
    window.addEventListener("scrollend", releaseProgrammaticScroll, { once: true });
    window.setTimeout(releaseProgrammaticScroll, 900);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else releaseProgrammaticScroll();
      });
    });
  }, []);

  const handleAnchorTabClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      event.preventDefault();
      setActiveTab(sectionId);
      scrollToSection(sectionId);
    },
    [scrollToSection],
  );

  useEffect(() => {
    if (!row?.id) return;
    if (announcementsLoaded) return;

    let cancelled = false;
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: qErr } = await supabase
        .from("announcements")
        .select(
          "id, title, content, announcement_image_url, link_url, announcement_tag, created_at, il_id, ilce_id, institution:institutions(institution_name)"
        )
        .eq("institution_id", row.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (qErr) {
        console.error("[institution][announcements] load error", qErr);
        setAnnouncementsError("Duyurular yüklenemedi.");
        setInstitutionAnnouncements([]);
        setAnnouncementsLoading(false);
        setAnnouncementsLoaded(true);
        return;
      }

      const rows = (data ?? []) as Array<{
        id: string | number;
        title: string | null;
        content: string | null;
        announcement_image_url: string | null;
        link_url: string | null;
        announcement_tag: string | null;
        created_at: string | null;
        il_id?: number | null;
        ilce_id?: number | null;
        institution:
          | { institution_name: string | null }
          | Array<{ institution_name: string | null }>
          | null;
      }>;

      const locationMaps = await buildLocationAdMaps(rows);
      if (cancelled) return;

      const mapped: AnnouncementDetailItem[] = rows
        .map((r) => {
          const inst = Array.isArray(r.institution)
            ? r.institution[0] ?? null
            : r.institution ?? null;
          const title = String(r.title ?? "").trim();
          if (!title) return null;
          const { ilAd, ilceAd } = lookupLocationAds(r.il_id, r.ilce_id, locationMaps);
          return {
            id: String(r.id),
            title,
            content: String(r.content ?? "").trim(),
            imageUrl: r.announcement_image_url
              ? String(r.announcement_image_url).trim() || null
              : null,
            createdAt: r.created_at ? String(r.created_at) : null,
            institutionName: String(inst?.institution_name ?? "").trim(),
            linkUrl: r.link_url ? String(r.link_url).trim() || null : null,
            announcementTag: r.announcement_tag
              ? String(r.announcement_tag).trim() || null
              : null,
            locationLabel: formatAnnouncementLocationLabel(ilAd, ilceAd) || null,
          } as AnnouncementDetailItem;
        })
        .filter((item): item is AnnouncementDetailItem => item !== null);

      setInstitutionAnnouncements(mapped);
      setAnnouncementsLoading(false);
      setAnnouncementsLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id, announcementsLoaded]);

  const formatAnnouncementDateTr = useCallback((iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const buildAnnouncementExcerpt = useCallback((text: string, maxLen: number) => {
    const t = String(text ?? "").trim().replace(/\s+/g, " ");
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
  }, []);

  const logoUrl = useMemo(() => {
    const supabase = createSupabaseBrowserClient();
    const rawLogoPath = (row?.logo ?? "").trim();
    if (!rawLogoPath) {
      return "";
    }

    return resolveInstitutionLogoPublicUrl(supabase, rawLogoPath);
  }, [row?.logo]);

  const name = (row?.institution_name ?? "Kurum").trim();
  const institutionNumericId =
    typeof row?.id === "number" && Number.isInteger(row.id) && row.id > 0 ? row.id : null;
  const institutionSlug = String(row?.slug ?? "").trim();
  const isInstitutionFavorite =
    institutionNumericId != null && favoriteIds.has(institutionNumericId);
  const isFavoriteActionLoading =
    institutionNumericId != null && favoriteActionLoadingIds.has(institutionNumericId);
  const hasLocation = Boolean(row?.city || row?.district);
  const location = [row?.city, row?.district].filter(Boolean).join(", ");
  const institutionTypeRow = Array.isArray(row?.institution_type)
    ? row?.institution_type[0] ?? null
    : row?.institution_type ?? null;
  const institutionCategoryRow = Array.isArray(row?.category)
    ? row?.category[0] ?? null
    : row?.category ?? null;
  const categoryName = (institutionCategoryRow?.name ?? "").trim();
  const institutionCategorySlug = (institutionCategoryRow?.slug ?? "").trim();
  const categoryLogoSrc = categoryName
    ? getCategoryLogoSrc(categoryName, institutionCategorySlug)
    : null;
  const CategoryIcon = getCategoryIcon(categoryName, institutionCategorySlug);
  const isOkulCategory = institutionCategorySlug === OKUL_CATEGORY_SLUG;
  const categoryListingHref = getCategoryHref(categoryName, institutionCategorySlug) ?? "";
  const schoolLevelLabel = (institutionTypeRow?.name ?? "").trim();
  const institutionTypeId =
    typeof institutionTypeRow?.id === "number" && Number.isInteger(institutionTypeRow.id)
      ? institutionTypeRow.id
      : null;
  const highSchoolLabel = getHighSchoolTypeLabel(row?.high_school_type);
  const institutionTypeText = isOkulCategory
    ? [schoolLevelLabel, highSchoolLabel].filter(Boolean).join(" · ")
    : "";
  const subheading = (row?.subheading ?? "").trim();
  const about = (row?.about ?? "").trim();
  const address = (row?.address ?? "").trim();
  const phone = (row?.official_phone ?? "").trim();
  const website = (row?.website ?? "").trim();
  const socialLinks = [
    { label: "Facebook", value: String(row?.facebook_url ?? "").trim() },
    { label: "Instagram", value: String(row?.instagram_url ?? "").trim() },
    { label: "X", value: String(row?.x_url ?? "").trim() },
    { label: "Linkedin", value: String(row?.linkedin_url ?? "").trim() },
  ].filter((item) => item.value);
  const emptyText = "Henüz içerik girilmedi.";
  const workingHoursText = formatWorkingHoursRange(row?.working_hours_start, row?.working_hours_end);
  const hasLogo = Boolean((row?.logo ?? "").trim()) && Boolean(logoUrl) && !logoLoadFailed;
  const photoMediaItems = useMemo(
    () => mediaItems.filter((item) => item.mediaType === "photo"),
    [mediaItems]
  );
  const galleryImages = useMemo(
    () => photoMediaItems.map((item) => item.url),
    [photoMediaItems]
  );
  const filteredModalItems = useMemo(() => {
    if (galleryFilter === "photo") return mediaItems.filter((item) => item.mediaType === "photo");
    if (galleryFilter === "video") return mediaItems.filter((item) => item.mediaType === "video");
    return mediaItems;
  }, [galleryFilter, mediaItems]);
  const isViewerMode =
    activeViewerIndex !== null &&
    activeViewerIndex >= 0 &&
    activeViewerIndex < filteredModalItems.length;
  const [academicLines, setAcademicLines] = useState<AcademicFeatureLine[]>([]);
  const showPublicExtraBranches = !isOkulCategory && publicExtraBranches.length > 0;
  const hasGallery = mediaItems.length > 0;
  const featureNavSections = useMemo(
    () => publicFeatureSections.filter((section) => section.badges.length > 0),
    [publicFeatureSections],
  );
  const hasFeatureSections = featureNavSections.length > 0;
  const hasContactBar = Boolean(address || phone || website || socialLinks.length > 0);
  const galleryThumbImages = galleryImages.slice(1, 5);
  const monthlyPriceText = formatInstitutionPriceRangeDisplay(row?.min_fiyat, row?.max_fiyat);
  const generalInfoRows = buildInstitutionGeneralInfoRows({
    categoryName,
    isOkulCategory,
    schoolLevelLabel,
    institutionTypeId,
    highSchoolLabel,
    academicLines,
    workingHoursText: workingHoursText ?? "",
    monthlyPriceText: monthlyPriceText ?? "",
  });
  const hasGeneralInfo = generalInfoRows.length > 0;
  const topRowClassName = [
    "institution-top-row",
    !hasGallery && hasGeneralInfo ? "institution-top-row--no-gallery" : "",
    hasGallery && !hasGeneralInfo ? "institution-top-row--no-facts" : "",
    !hasGallery && !hasGeneralInfo ? "institution-top-row--card-only" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const hasAnnouncementsTab =
    Boolean(announcementsError) || institutionAnnouncements.length > 0;
  const hasAbout = Boolean(about);
  const navTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string; icon: "overview" | "feature" | "branches" | "announcements" }> = [];
    if (hasAbout) tabs.push({ id: "overview", label: "Genel Bakış", icon: "overview" });
    featureNavSections.forEach((section, index) => {
      tabs.push({
        id: getFeatureGroupAnchorId(section.id, index, featureNavSections),
        label: section.name,
        icon: "feature",
      });
    });
    if (showPublicExtraBranches) {
      tabs.push({ id: "extra-branches", label: "Ek Branşlar", icon: "branches" });
    }
    if (hasAnnouncementsTab) {
      tabs.push({ id: "announcements", label: "Duyurular", icon: "announcements" });
    }
    return tabs;
  }, [featureNavSections, hasAbout, showPublicExtraBranches, hasAnnouncementsTab]);
  const hasAnyNavTab = navTabs.length > 0;

  useEffect(() => {
    if (navTabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab(navTabs[0]?.id ?? "overview");
  }, [activeTab, navTabs]);

  useEffect(() => {
    if (navTabs.length === 0) return;

    const updateActiveFromScroll = () => {
      if (programmaticScrollRef.current) return;
      const sticky = document.querySelector(".institution-tabs-sticky");
      const offset = Math.max(
        100,
        (sticky instanceof HTMLElement ? sticky.getBoundingClientRect().height : 0) + 12,
      );
      const band = offset + 24;
      const sectionInBand = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top <= band && rect.bottom > offset;
      };
      setActiveTab((current) => {
        if (sectionInBand(current)) return current;
        let next = navTabs[0]?.id ?? "overview";
        for (const tab of navTabs) {
          if (sectionInBand(tab.id)) next = tab.id;
        }
        return next;
      });
    };

    updateActiveFromScroll();
    window.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    window.addEventListener("resize", updateActiveFromScroll);
    return () => {
      window.removeEventListener("scroll", updateActiveFromScroll);
      window.removeEventListener("resize", updateActiveFromScroll);
    };
  }, [navTabs]);

  useEffect(() => {
    const list = tabsListRef.current;
    if (!list) return;
    const tab = list.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeTab)}"]`);
    if (!tab) return;
    const padding = 16;
    const tabLeft = tab.offsetLeft;
    const tabRight = tabLeft + tab.offsetWidth;
    const viewLeft = list.scrollLeft;
    const viewRight = viewLeft + list.clientWidth;
    if (tabLeft < viewLeft + padding) {
      list.scrollTo({ left: Math.max(0, tabLeft - padding), behavior: "smooth" });
    } else if (tabRight > viewRight - padding) {
      list.scrollTo({ left: tabRight - list.clientWidth + padding, behavior: "smooth" });
    }
  }, [activeTab, navTabs]);

  useEffect(() => {
    if (!row?.id || isOkulCategory) {
      setPublicExtraBranches([]);
      setExtraBranchesLoadFailed(false);
      setExtraBranchesChecking(false);
      extraBranchesRetryLockRef.current = false;
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      try {
        const loaded = await loadInstitutionExtraBranchesClient(supabase, Number(row.id));
        if (cancelled) return;
        setPublicExtraBranches(
          mapLoadedExtraBranchesForPublicProfile(loaded, {
            mainCategorySlug: institutionCategorySlug,
          }),
        );
        setExtraBranchesLoadFailed(false);
      } catch (err) {
        if (cancelled) return;
        if (isUnauthorizedSupabaseError(err)) {
          setPublicExtraBranches([]);
          setExtraBranchesLoadFailed(false);
          return;
        }
        console.error("[institutions][detail][extra-branches][load-error]", err);
        setPublicExtraBranches([]);
        setExtraBranchesLoadFailed(true);
      } finally {
        if (!cancelled) {
          setExtraBranchesChecking(false);
          extraBranchesRetryLockRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id, institutionCategorySlug, isOkulCategory, extraBranchesRetryCount]);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [row?.logo]);

  useEffect(() => {
    if (!row?.id) {
      setMediaItems([]);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const { data, error: mediaError } = await supabase
        .from("institution_media")
        .select("id, media_type, file_url, file_path, mime_type, file_name, sort_order, created_at")
        .eq("institution_id", Number(row.id))
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (mediaError) {
        console.error("[institutions][detail][gallery][query-error]", mediaError);
        setMediaItems([]);
        return;
      }

      const mediaRows = (data as InstitutionMediaImageRow[] | null) ?? [];
      const mappedItems = mediaRows
        .map((item) => {
          const normalizedMediaType = String(item.media_type ?? "").toLowerCase();
          const mediaType: "photo" | "video" =
            normalizedMediaType === "video" || (item.mime_type ?? "").toLowerCase().startsWith("video/")
              ? "video"
              : "photo";
          const rawUrl = (item.file_url ?? "").trim();
          if (rawUrl) {
            return {
              id: String(item.id),
              mediaType,
              url: rawUrl,
            };
          }

          const rawPath = (item.file_path ?? "").trim().replace(/^\/+/, "");
          if (!rawPath) return null;
          const resolvedUrl =
            supabase.storage.from("institution-media").getPublicUrl(rawPath).data.publicUrl || "";
          if (!resolvedUrl) return null;
          return {
            id: String(item.id),
            mediaType,
            url: resolvedUrl,
          };
        })
        .filter((item): item is { id: string; mediaType: "photo" | "video"; url: string } => Boolean(item?.url));

      setMediaItems(mappedItems);
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id]);

  useEffect(() => {
    if (!row?.id) {
      setPublicFeatureSections([]);
      setHighlightItems([]);
      setAcademicLines([]);
      setFeaturesLoadFailed(false);
      setFeaturesChecking(false);
      featuresRetryLockRef.current = false;
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const institutionId = Number(row.id);
    const selectedCategorySlug = institutionCategorySlug;

    (async () => {
      const [
        { data: groupsData, error: groupsError },
        { data: definitionsData, error: definitionsError },
        { data: choicesData, error: choicesError },
        { data: entriesData, error: entriesError },
      ] = await Promise.all([
        supabase
          .from("institution_feature_groups")
          .select("id, name, display_order, is_active, category_slug")
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true }),
        supabase
          .from("institution_feature_definitions")
          .select("id, group_id, name, slug, input_type, unit, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true }),
        supabase
          .from("institution_feature_choices")
          .select("id, feature_definition_id, name, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true }),
        supabase
          .from("institution_feature_entries")
          .select("id, feature_definition_id, boolean_answer, text_answer, number_answer, selected_choice_id")
          .eq("institution_id", institutionId),
      ]);

      if (cancelled) return;

      if (groupsError || definitionsError || choicesError || entriesError) {
        if (
          isUnauthorizedSupabaseError(groupsError) ||
          isUnauthorizedSupabaseError(definitionsError) ||
          isUnauthorizedSupabaseError(choicesError) ||
          isUnauthorizedSupabaseError(entriesError)
        ) {
          setPublicFeatureSections([]);
          setAcademicLines([]);
          setFeaturesLoadFailed(false);
          setFeaturesChecking(false);
          featuresRetryLockRef.current = false;
          return;
        }

        console.warn("[institutions][detail][features][query-warning]", {
          groupsError: serializeSupabaseError(groupsError),
          definitionsError: serializeSupabaseError(definitionsError),
          choicesError: serializeSupabaseError(choicesError),
          entriesError: serializeSupabaseError(entriesError),
        });
        setPublicFeatureSections([]);
        setAcademicLines([]);
        setFeaturesLoadFailed(true);
        setFeaturesChecking(false);
        featuresRetryLockRef.current = false;
        return;
      }

      const entries = (entriesData as InstitutionFeatureEntryRow[] | null) ?? [];
      const entryIds = entries.map((entry) => entry.id);
      let entryChoices: InstitutionFeatureEntryChoiceRow[] = [];

      if (entryIds.length > 0) {
        const { data: entryChoicesData, error: entryChoicesError } = await supabase
          .from("institution_feature_entry_choices")
          .select("institution_feature_entry_id, choice_id")
          .in("institution_feature_entry_id", entryIds);

        if (!cancelled && entryChoicesError) {
          if (isUnauthorizedSupabaseError(entryChoicesError)) {
            setPublicFeatureSections([]);
            setAcademicLines([]);
            return;
          }
          console.warn(
            "[institutions][detail][features][entry-choices-warning]",
            serializeSupabaseError(entryChoicesError)
          );
        }
        entryChoices = (entryChoicesData as InstitutionFeatureEntryChoiceRow[] | null) ?? [];
      }

      if (cancelled) return;

      const groups = (groupsData as InstitutionFeatureGroupRow[] | null) ?? [];
      const definitions = (definitionsData as InstitutionFeatureDefinitionRow[] | null) ?? [];
      const choices = (choicesData as InstitutionFeatureChoiceRow[] | null) ?? [];

      const mapped = mapPublicInstitutionFeatures({
        groups,
        definitions,
        choices,
        entries,
        entryChoices,
        categorySlug: selectedCategorySlug,
      });
      const highlightRows = await fetchInstitutionHighlightRowsClient(institutionId, supabase);
      if (cancelled) return;
      setHighlightItems(
        resolvePublicHighlightItems({
          rows: highlightRows,
          definitions,
          choices,
          entries,
          entryChoices,
          entity: "institution",
          minFiyat: row.min_fiyat,
          maxFiyat: row.max_fiyat,
          workingHoursStart: row.working_hours_start,
          workingHoursEnd: row.working_hours_end,
        }),
      );
      setPublicFeatureSections(mapped.badgeSections);
      setAcademicLines(mapped.academicLines);
      setFeaturesLoadFailed(false);
      setFeaturesChecking(false);
      featuresRetryLockRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id, institutionCategorySlug, featuresRetryCount]);

  const closeGalleryModal = useCallback(() => {
    setIsGalleryModalOpen(false);
  }, []);

  useGalleryModalEffects(isGalleryModalOpen, closeGalleryModal);

  useEffect(() => {
    if (!isGalleryModalOpen) {
      setGalleryFilter("all");
      setActiveViewerIndex(null);
    }
  }, [isGalleryModalOpen]);

  useEffect(() => {
    if (activeViewerIndex === null) return;
    if (filteredModalItems.length === 0) {
      setActiveViewerIndex(null);
      return;
    }
    if (activeViewerIndex >= filteredModalItems.length) {
      setActiveViewerIndex(0);
    }
  }, [activeViewerIndex, filteredModalItems]);

  if (loading) {
    return (
      <div className="institution-detail-page">
        <div className="institution-detail-container">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (ownPendingApproval) {
    return (
      <div className="institution-detail-page">
        <div className="institution-detail-container">
          <h1 className="institution-name">{OWN_PENDING_PROFILE_TITLE}</h1>
          <p className="institution-description">{OWN_PENDING_PROFILE_MESSAGE}</p>
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="institution-detail-page">
        <div className="institution-detail-container">
          <h1 className="institution-name">Kurum Detay Sayfası</h1>
          <p>{error || "Kurum kaydı bulunamadı."}</p>
        </div>
      </div>
    );
  }

  const visibleAnnouncements = showAllAnnouncements
    ? institutionAnnouncements
    : institutionAnnouncements.slice(0, 2);
  const canToggleAnnouncements = institutionAnnouncements.length > 2;

  const renderAnnouncementArticle = (item: AnnouncementDetailItem) => {
    const trimmedLink = (item.linkUrl ?? "").trim();
    const hasLink = trimmedLink.length > 0;
    const absoluteLink = hasLink
      ? /^https?:\/\//i.test(trimmedLink)
        ? trimmedLink
        : `https://${trimmedLink}`
      : null;
    const linkLabel = hasLink
      ? trimmedLink.replace(/^https?:\/\//i, "").replace(/^www\./i, "")
      : "";

    return (
      <article
        key={item.id}
        className="institution-announcement-item"
        role="button"
        tabIndex={0}
        onClick={() => setActiveAnnouncement(item)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveAnnouncement(item);
          }
        }}
        aria-label={`${item.title} duyurusunu aç`}
      >
        <div
          className={`institution-announcement-thumb${
            item.imageUrl ? "" : " institution-announcement-thumb--empty"
          }`}
          aria-hidden
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              fill
              className="institution-announcement-thumb-image"
              sizes="72px"
              unoptimized
            />
          ) : (
            <ImageOff
              className="institution-announcement-thumb-icon"
              size={28}
              strokeWidth={1.25}
            />
          )}
        </div>
        <div className="institution-announcement-body">
          {name ? (
            <div className="institution-announcement-kicker">
              {name.toLocaleUpperCase("tr-TR")}
            </div>
          ) : null}
          {(() => {
            const tag = String(item.announcementTag ?? "").trim();
            const tagClass = getAnnouncementTagBadgeClassName(tag);
            if (!tag || !tagClass) return null;
            return <span className={tagClass}>{tag}</span>;
          })()}
          <h3 className="institution-announcement-title">{item.title}</h3>
          <p className="institution-announcement-desc">
            {item.content ? buildAnnouncementExcerpt(item.content, 220) : ""}
          </p>
          <div className="institution-announcement-meta">
            {item.createdAt ? (
              <span className="institution-announcement-meta-item">
                <CalendarDays className="institution-announcement-meta-icon" size={14} />
                <span>{formatAnnouncementDateTr(item.createdAt)}</span>
              </span>
            ) : null}
            {item.locationLabel ? (
              <span className="institution-announcement-meta-item">
                <MapPin className="institution-announcement-meta-icon" size={14} />
                <span>{item.locationLabel}</span>
              </span>
            ) : null}
            {hasLink && absoluteLink ? (
              <a
                href={absoluteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="institution-announcement-meta-item institution-announcement-meta-link"
                onClick={(event) => event.stopPropagation()}
              >
                <Globe className="institution-announcement-meta-icon" size={14} />
                <span>{linkLabel}</span>
              </a>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  const renderAnnouncementBody = (items: AnnouncementDetailItem[]) => {
    if (announcementsLoading) {
      return <div className="institution-features-empty">Duyurular yükleniyor...</div>;
    }
    if (announcementsError) {
      return <div className="institution-features-empty">{announcementsError}</div>;
    }
    if (items.length === 0) return null;
    return (
      <div className="institution-announcements-list institution-announcements-list--grid">
        {items.map((item) => renderAnnouncementArticle(item))}
      </div>
    );
  };

  return (
    <>
    <div className="institution-detail-page">
      <div className="institution-detail-container">
        <CategoryBreadcrumb
          variant="institution"
          categoryLabel={categoryName}
          categoryHref={categoryListingHref || undefined}
          listingPathname={categoryListingHref}
          location={{
            ilId: toLocationIdString(row.il_id),
            ilceId: toLocationIdString(row.ilce_id),
            mahalleId: toLocationIdString(row.mahalle_id),
          }}
          currentLabel={name}
        />

        <div className={topRowClassName}>
          <Card className="institution-profile-card">
            <CardContent className="institution-profile-card-content">
              <ShareButton slug={institutionSlug} />
              <div className="institution-profile-main">
                {hasLogo ? (
                  <div className="institution-logo-section">
                    <div className="institution-logo-wrapper">
                      <Image
                        src={logoUrl}
                        alt={name}
                        width={140}
                        height={140}
                        className="institution-logo"
                        unoptimized
                        onError={() => setLogoLoadFailed(true)}
                      />
                    </div>
                  </div>
                ) : null}
                <div className="institution-info">
                  <h1 className="institution-name">{name}</h1>
                  {subheading ? <p className="institution-description">{subheading}</p> : null}
                  {categoryName || row.is_approved === true ? (
                    <div className="institution-profile-badges">
                      {categoryName ? (
                        <div className="institution-profile-category-badge">
                          {categoryLogoSrc ? (
                            <Image
                              src={categoryLogoSrc}
                              alt=""
                              width={22}
                              height={22}
                              className="institution-profile-category-badge-icon"
                            />
                          ) : (
                            <CategoryIcon
                              className="institution-profile-category-badge-glyph"
                              size={16}
                              aria-hidden
                            />
                          )}
                          <span>{categoryName}</span>
                        </div>
                      ) : null}
                      {row.is_approved === true ? (
                        <div className="institution-meta-item institution-meta-verified institution-meta-badge institution-meta-badge--verified">
                          <CheckCircle2 size={18} />
                          <span>Onaylı Kurum</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {hasLocation || institutionTypeText ? (
                    <div className="institution-meta">
                      {hasLocation ? (
                        <div className="institution-meta-item">
                          <MapPin size={18} />
                          <span>{location}</span>
                        </div>
                      ) : null}
                      {institutionTypeText ? (
                        <div className="institution-meta-item">
                          <span className="institution-meta-badge">{institutionTypeText}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {institutionNumericId != null && institutionSlug ? (
                <div className="institution-profile-actions">
                  <button
                    type="button"
                    className={`institution-profile-action${
                      isInstitutionFavorite ? " institution-profile-action--active" : ""
                    }`}
                    aria-label={isInstitutionFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                    disabled={isFavoriteActionLoading || (Boolean(user) && !favoritesEnabled)}
                    onClick={(event) => {
                      void handleFavoriteToggle(institutionNumericId, event);
                    }}
                  >
                    <Heart
                      className={
                        isInstitutionFavorite
                          ? "heart-favorite-icon heart-favorite-icon--active"
                          : "heart-favorite-icon"
                      }
                      aria-hidden
                    />
                    <span>{isInstitutionFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}</span>
                  </button>
                  <InstitutionCompareToggleButton
                    labeled
                    className="institution-compare-toggle--profile"
                    item={{
                      id: institutionNumericId,
                      name,
                      slug: institutionSlug,
                      imageUrl: hasLogo ? logoUrl : undefined,
                    }}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {hasGallery ? (
            <section id="gallery" className="institution-top-gallery">
              <Card className="institution-top-gallery-card">
                <CardContent className="institution-top-gallery-content">
                  <div className="institution-top-gallery-header">
                    <h2 className="institution-top-gallery-title">Kurum Galerisi</h2>
                    <button
                      type="button"
                      className="institution-section-link institution-gallery-view-all-btn"
                      onClick={() => setIsGalleryModalOpen(true)}
                    >
                      tümünü gör
                    </button>
                  </div>
                  {galleryImages.length > 0 ? (
                    <div className="institution-top-gallery-media">
                      {galleryImages[0] ? (
                        <div
                          className="institution-top-gallery-main"
                          onClick={() => {
                            if (!galleryImages[0]) return;
                            setIsGalleryModalOpen(true);
                          }}
                        >
                          <Image
                            src={galleryImages[0]}
                            alt={`${name} galeri görseli`}
                            fill
                            className="institution-gallery-image"
                            sizes="(max-width: 1024px) 100vw, 48vw"
                            unoptimized
                          />
                        </div>
                      ) : null}
                      {galleryThumbImages.length > 0 ? (
                        <div className="institution-top-gallery-thumbs">
                          {galleryThumbImages.map((imageUrl, thumbIndex) => (
                            <div
                              key={`${imageUrl}-${thumbIndex}`}
                              className="institution-top-gallery-thumb"
                              onClick={() => setIsGalleryModalOpen(true)}
                            >
                              <Image
                                src={imageUrl}
                                alt={`${name} galeri görseli`}
                                fill
                                className="institution-gallery-image"
                                sizes="(max-width: 1024px) 25vw, 12vw"
                                unoptimized
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {hasGeneralInfo ? (
            <Card className="institution-overview-card">
              <CardContent className="institution-overview-card-content">
                <h2 className="institution-overview-title">Genel Bilgiler</h2>
                <dl className="institution-overview-list">
                  {generalInfoRows.map((infoRow) => (
                    <div key={infoRow.label} className="institution-overview-row">
                      <dt className="institution-overview-label">{infoRow.label}</dt>
                      <dd className="institution-overview-value">{infoRow.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <FeatureHighlightsPublicSection items={highlightItems} />

        {hasContactBar ? (
          <div className="institution-contact-bar">
            {address ? (
              <div className="institution-contact-bar-item institution-contact-bar-item--address">
                <span className="institution-contact-bar-icon" aria-hidden>
                  <MapPin size={16} />
                </span>
                <div className="institution-contact-bar-copy">
                  <div className="institution-contact-bar-label">ADRES</div>
                  <div className="institution-contact-bar-value">{address}</div>
                </div>
              </div>
            ) : null}
            {phone ? (
              <div className="institution-contact-bar-item institution-contact-bar-item--phone">
                <span className="institution-contact-bar-icon" aria-hidden>
                  <Phone size={16} />
                </span>
                <div className="institution-contact-bar-copy">
                  <div className="institution-contact-bar-label">TELEFON</div>
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    className="institution-contact-bar-value institution-contact-bar-link"
                  >
                    {phone}
                  </a>
                </div>
              </div>
            ) : null}
            {website ? (
              <div className="institution-contact-bar-item institution-contact-bar-item--website">
                <span className="institution-contact-bar-icon" aria-hidden>
                  <Globe size={16} />
                </span>
                <div className="institution-contact-bar-copy">
                  <div className="institution-contact-bar-label">WEB SİTESİ</div>
                  <a
                    href={website.startsWith("http") ? website : `https://${website}`}
                    className="institution-contact-bar-value institution-contact-bar-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {website}
                  </a>
                </div>
              </div>
            ) : null}
            {socialLinks.length > 0 ? (
              <div className="institution-contact-bar-social">
                {socialLinks.map((item) => {
                  const SocialIcon =
                    item.label === "Facebook"
                      ? Facebook
                      : item.label === "Instagram"
                        ? Instagram
                        : item.label === "Linkedin"
                          ? Linkedin
                          : Twitter;
                  return (
                    <a
                      key={item.label}
                      href={item.value.startsWith("http") ? item.value : `https://${item.value}`}
                      className="institution-contact-bar-social-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                    >
                      <SocialIcon size={16} />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasAnyNavTab ? (
        <div className="institution-tabs-sticky">
          <div className="institution-tabs-list institution-nav-scroll" ref={tabsListRef}>
            {navTabs.map((tab) => {
              const iconSrc =
                tab.icon === "overview"
                  ? "/images/about.png"
                  : tab.icon === "announcements"
                    ? "/images/duyurular.png"
                    : tab.icon === "feature"
                      ? "/images/feature.png"
                      : null;
              return (
                <a
                  key={tab.id}
                  href={`#${tab.id}`}
                  data-tab-id={tab.id}
                  className={`institution-tab-item${activeTab === tab.id ? " institution-tab-active" : ""}`}
                  onClick={(event) => handleAnchorTabClick(event, tab.id)}
                >
                  {iconSrc ? (
                    <img src={iconSrc} alt="" width={20} height={20} className="institution-tab-icon" />
                  ) : (
                    <Layers size={20} />
                  )}
                  <span>{tab.label}</span>
                </a>
              );
            })}
          </div>
        </div>
        ) : null}

        {about ? (
          <section id="overview" className="institution-section">
            <Card className="institution-section-card">
              <CardContent>
                <h2 className="institution-overview-card-title">
                  <BookOpen size={20} aria-hidden="true" />
                  Hakkımızda
                </h2>
                <div className="institution-about-text">
                  {about.split("\n\n").map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        {featuresLoadFailed ? (
          <section id="features" className="institution-section">
            <h2 className="institution-section-title">Kurum Özellikleri</h2>
            <HomeSectionLoadError
              message="Kurum özellikleri yüklenemedi."
              loading={featuresChecking}
              onRetry={() => {
                if (featuresRetryLockRef.current || featuresChecking) return;
                featuresRetryLockRef.current = true;
                setFeaturesChecking(true);
                setFeaturesRetryCount((count) => count + 1);
              }}
            />
          </section>
        ) : hasFeatureSections ? (
        <section id="features" className="institution-section">
          <h2 className="institution-section-title">Kurum Özellikleri</h2>
          <div className="institution-feature-groups-grid">
            {featureNavSections.map((section, index) => {
              const anchorId = getFeatureGroupAnchorId(section.id, index, featureNavSections);
              const isFullWidthCard =
                featureNavSections.length % 2 === 1 && index === featureNavSections.length - 1;
              const listColumnClass =
                section.badges.length < 2
                  ? ""
                  : isFullWidthCard
                    ? " institution-feature-group-card-list--four-columns"
                    : " institution-feature-group-card-list--two-columns";
              return (
              <article
                key={anchorId}
                id={anchorId}
                className={`institution-feature-group-card${
                  isFullWidthCard ? " institution-feature-group-card--full" : ""
                }`}
              >
                <h3 className="institution-feature-group-card-title">{section.name}</h3>
                <ul
                  className={`institution-feature-group-card-list${listColumnClass}`}
                >
                  {section.badges.map((badge) => (
                    <li key={`${section.id}-${badge}`} className="institution-feature-group-card-item">
                      <CheckCircle2
                        size={16}
                        className="institution-feature-group-card-check"
                        aria-hidden
                      />
                      <span className="institution-feature-group-card-text">{badge}</span>
                    </li>
                  ))}
                </ul>
              </article>
              );
            })}
          </div>
        </section>
        ) : null}

        {extraBranchesLoadFailed ? (
          <section id="extra-branches" className="institution-section">
            <h2 className="institution-section-title">Ek Branşlar</h2>
            <HomeSectionLoadError
              message="Ek branşlar yüklenemedi."
              loading={extraBranchesChecking}
              onRetry={() => {
                if (extraBranchesRetryLockRef.current || extraBranchesChecking) return;
                extraBranchesRetryLockRef.current = true;
                setExtraBranchesChecking(true);
                setExtraBranchesRetryCount((count) => count + 1);
              }}
            />
          </section>
        ) : null}

        {showPublicExtraBranches ? (
          <section id="extra-branches" className="institution-section">
            <h2 className="institution-section-title">Ek Branşlar</h2>
            <div className="institution-feature-groups-grid">
              {publicExtraBranches.map((branch, index) => {
                const isFullWidthCard =
                  publicExtraBranches.length % 2 === 1 && index === publicExtraBranches.length - 1;
                const listColumnClass =
                  branch.selectedTypeNames.length < 2
                    ? ""
                    : isFullWidthCard
                      ? " institution-feature-group-card-list--four-columns"
                      : " institution-feature-group-card-list--two-columns";
                return (
                <article
                  key={branch.categoryId}
                  className={`institution-feature-group-card${
                    isFullWidthCard ? " institution-feature-group-card--full" : ""
                  }`}
                >
                  <h3 className="institution-feature-group-card-title">{branch.categoryName}</h3>
                  {branch.selectedTypeNames.length > 0 ? (
                    <ul
                      className={`institution-feature-group-card-list${listColumnClass}`}
                    >
                      {branch.selectedTypeNames.map((typeName) => (
                        <li
                          key={`${branch.categoryId}-${typeName}`}
                          className="institution-feature-group-card-item"
                        >
                          <CheckCircle2
                            size={16}
                            className="institution-feature-group-card-check"
                            aria-hidden
                          />
                          <span className="institution-feature-group-card-text">{typeName}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
                );
              })}
            </div>
          </section>
        ) : null}
        {hasAnnouncementsTab ? (
          <section
            id="announcements"
            className="institution-section"
            aria-label="Kurum duyuruları"
          >
            <h2 className="institution-section-title">
              <Megaphone size={20} aria-hidden="true" />
              Duyurular
            </h2>
            <Card className="institution-section-card">
              <CardContent>
                {renderAnnouncementBody(visibleAnnouncements)}
                {canToggleAnnouncements ? (
                  <button
                    type="button"
                    className="institution-announcements-toggle"
                    aria-expanded={showAllAnnouncements}
                    onClick={() => {
                      if (showAllAnnouncements) {
                        setShowAllAnnouncements(false);
                        scrollToSection("announcements");
                        return;
                      }
                      setShowAllAnnouncements(true);
                    }}
                  >
                    {showAllAnnouncements ? "Daha Az Göster" : "Daha Fazla Gör"}
                  </button>
                ) : null}
              </CardContent>
            </Card>
          </section>
        ) : null}

        <AnnouncementDetailModal
          isOpen={Boolean(activeAnnouncement)}
          onClose={() => setActiveAnnouncement(null)}
          announcement={activeAnnouncement}
        />

        {isGalleryModalOpen ? (
          <div
            className="institution-gallery-modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeGalleryModal();
              }
            }}
          >
            <div
              className={`institution-gallery-modal${isViewerMode ? " institution-gallery-modal--viewer" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="institution-gallery-modal-title"
            >
              <div className="institution-gallery-modal-header">
                <div>
                  <h3 id="institution-gallery-modal-title" className="institution-gallery-modal-title">Kurum Galerisi</h3>
                  <p className="institution-gallery-modal-subtitle">
                    Kurumunuza ait yüklenen medya içeriklerini görüntüleyin.
                  </p>
                </div>
                <div className="institution-gallery-modal-header-actions">
                  {isViewerMode ? (
                    <>
                      <button
                        type="button"
                        className="institution-gallery-viewer-back"
                        onClick={() => setActiveViewerIndex(null)}
                      >
                        <ArrowLeft size={16} />
                        Galeriye dön
                      </button>
                      <span className="institution-gallery-viewer-counter">
                        {activeViewerIndex + 1} / {filteredModalItems.length}
                      </span>
                    </>
                  ) : (
                    <div className="institution-gallery-modal-filters" role="tablist" aria-label="Galeri filtreleri">
                      <button
                        type="button"
                        className={`institution-gallery-modal-filter ${galleryFilter === "all" ? "institution-gallery-modal-filter--active" : ""}`}
                        onClick={() => setGalleryFilter("all")}
                      >
                        Tümü
                      </button>
                      <button
                        type="button"
                        className={`institution-gallery-modal-filter ${galleryFilter === "photo" ? "institution-gallery-modal-filter--active" : ""}`}
                        onClick={() => setGalleryFilter("photo")}
                      >
                        Fotoğraf
                      </button>
                      <button
                        type="button"
                        className={`institution-gallery-modal-filter ${galleryFilter === "video" ? "institution-gallery-modal-filter--active" : ""}`}
                        onClick={() => setGalleryFilter("video")}
                      >
                        Video
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="institution-gallery-modal-close"
                    aria-label="Galeri modalını kapat"
                    onClick={closeGalleryModal}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              {filteredModalItems.length > 0 ? (
                isViewerMode && activeViewerIndex !== null ? (
                  <GalleryMediaViewer
                    items={filteredModalItems.map((item, index) => ({
                      id: item.id,
                      url: item.url,
                      mediaType: item.mediaType,
                      alt: `${name} galeri görseli ${index + 1}`,
                    }))}
                    activeIndex={activeViewerIndex}
                    onIndexChange={setActiveViewerIndex}
                  />
                ) : (
                  <div className="institution-gallery-modal-grid">
                    {filteredModalItems.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`institution-gallery-modal-item institution-gallery-modal-item--${item.mediaType}`}
                        onClick={() => setActiveViewerIndex(index)}
                      >
                        {item.mediaType === "video" ? (
                          <>
                            <video
                              className="institution-gallery-modal-video"
                              src={item.url}
                              preload="metadata"
                              muted
                            />
                            <div className="institution-gallery-modal-video-overlay" aria-hidden>
                              <Play size={46}  />
                            </div>
                          </>
                        ) : (
                          <Image
                            src={item.url}
                            alt={`${name} galeri görseli ${index + 1}`}
                            fill
                            className="institution-gallery-image"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="institution-gallery-modal-empty">{emptyText}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
    <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    <AppNoticeBar
      message={favoritesError}
      onDismiss={() => setFavoritesError(null)}
      variant={favoritesError === SELF_FAVORITE_MESSAGE ? "warning" : "error"}
    />
    </>
  );
}

