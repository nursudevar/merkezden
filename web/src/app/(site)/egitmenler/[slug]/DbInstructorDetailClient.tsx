"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui";
import { HomeSectionLoadError } from "@/components/home/HomeSectionLoadError";
import GalleryMediaViewer, { useGalleryModalEffects } from "@/components/gallery/GalleryMediaViewer";
import {
  MapPin,
  CheckCircle2,
  BookOpen,
  Globe,
  X,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  CalendarDays,
  ImageOff,
  Layers,
  Heart,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadInstructorRowForAuthUserClient } from "@/lib/instructorProfileClient";
import { institutionTimeToInputHHMM } from "@/lib/institutionHelpers";
import {
  INSTRUCTOR_HIZMET_YERI_LABEL,
  instructorHizmetYeriOptionKey,
} from "@/lib/instructorFeaturesClient";
import {
  fetchPublicInstructorByParamClient,
  formatPublicInstructorDetailLocation,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import {
  buildInstructorProfileSummaryLines,
  fetchPublicInstructorAnnouncementsClient,
  fetchPublicInstructorFeatureDisplayClient,
  fetchPublicInstructorGalleryClient,
  resolvePublicInstructorProfilePictureUrl,
  type PublicInstructorAnnouncementItem,
  type PublicInstructorFeatureLine,
  type PublicInstructorFeatureSection,
} from "@/lib/publicInstructorDetailClient";
import { FeatureHighlightsPublicSection } from "@/components/features/FeatureHighlightsPublicSection";
import type { PublicHighlightDisplayItem } from "@/lib/featureHighlightsPublic";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import InstructorShareButton from "./InstructorShareButton";
import { InstructorCompareToggleButton } from "@/components/compare/InstructorCompareToggleButton";
import { getAnnouncementTagBadgeClassName } from "@/lib/announcementTags";
import CategoryBreadcrumb from "@/components/category/CategoryBreadcrumb";
import { toLocationIdString } from "@/lib/turkiyeLocationsClient";
import ProfileContactRevealButtons from "@/components/profile/ProfileContactRevealButtons";
import LoginModal from "@/components/LoginModal";
import { AppNoticeBar } from "@/components/AppNoticeBar";
import { useListingFavorites } from "@/hooks/useListingFavorites";
import { SELF_FAVORITE_MESSAGE } from "@/lib/favorites/favoritesClient";
import {
  loadInstructorExtraBranchesClient,
  mapLoadedInstructorExtraBranchesForPublicProfile,
  type PublicInstructorExtraBranch,
} from "@/lib/instructorExtraBranches";

type ExtraBranchesLoadStatus = "idle" | "loading" | "ready" | "error";
type PublicNavIcon = "overview" | "feature" | "branches" | "announcements";

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

function formatFeatureLineValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean).join(", ");
  }
  return String(value ?? "").trim();
}

const HIZMET_YERI_OPTION_ORDER = [
  "ogretmenin_evi",
  "ogrencinin_evi",
  "diger_uygulama_yeri",
] as const;

function collapseHizmetYeriRows(
  rows: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  const selected: Array<{ key: (typeof HIZMET_YERI_OPTION_ORDER)[number]; label: string }> = [];
  const rest: Array<{ label: string; value: string }> = [];
  let insertAt = -1;

  for (const row of rows) {
    const key = instructorHizmetYeriOptionKey({ name: row.label });
    if (!key) {
      rest.push(row);
      continue;
    }
    if (insertAt < 0) insertAt = rest.length;
    if (row.value.trim().toLocaleLowerCase("tr-TR") !== "evet") continue;
    selected.push({ key, label: row.label });
  }

  if (selected.length === 0) return rest;

  selected.sort(
    (a, b) => HIZMET_YERI_OPTION_ORDER.indexOf(a.key) - HIZMET_YERI_OPTION_ORDER.indexOf(b.key),
  );
  const combined = {
    label: INSTRUCTOR_HIZMET_YERI_LABEL,
    value: selected.map((item) => item.label).join(", "),
  };
  rest.splice(insertAt < 0 ? rest.length : insertAt, 0, combined);
  return rest;
}

const EMPTY_TEXT = "Henüz içerik girilmedi.";
const OWN_PENDING_PROFILE_TITLE = "Profiliniz Henüz Yayında Değil";
const OWN_PENDING_PROFILE_MESSAGE =
  "Hesabınız yönetici onayını bekliyor. Onaylandığında profiliniz yayımlanacak ve diğer kullanıcılar tarafından görüntülenebilecektir.";

async function isOwnPendingInstructorProfile(param: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const authUid = sessionData.session?.user?.id;
  if (!authUid) return false;

  const { row, error } = await loadInstructorRowForAuthUserClient(authUid, supabase);
  if (error || !row || row.is_approved !== null) return false;

  const trimmed = String(param ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  if (slug && slug === trimmed) return true;
  return /^\d+$/.test(trimmed) && String(row.id) === trimmed;
}

export default function DbInstructorDetailClient({ slugOrId }: { slugOrId: string }) {
  const [row, setRow] = useState<PublicInstructorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownPendingApproval, setOwnPendingApproval] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [highlightItems, setHighlightItems] = useState<PublicHighlightDisplayItem[]>([]);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [extraBranchesRetryCount, setExtraBranchesRetryCount] = useState(0);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "photo" | "video">("all");
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<PublicInstructorAnnouncementItem[]>([]);
  const [profileLines, setProfileLines] = useState<PublicInstructorFeatureLine[]>([]);
  const [academicLines, setAcademicLines] = useState<PublicInstructorFeatureLine[]>([]);
  const [featureSections, setFeatureSections] = useState<PublicInstructorFeatureSection[]>([]);
  const [featuresLoadFailed, setFeaturesLoadFailed] = useState(false);
  const [featuresChecking, setFeaturesChecking] = useState(false);
  const [featuresRetryCount, setFeaturesRetryCount] = useState(0);
  const featuresRetryLockRef = useRef(false);
  const [publicExtraBranches, setPublicExtraBranches] = useState<PublicInstructorExtraBranch[]>([]);
  const [extraBranchesStatus, setExtraBranchesStatus] = useState<ExtraBranchesLoadStatus>("idle");
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [profileGalleryIndex, setProfileGalleryIndex] = useState(0);
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementDetailItem | null>(null);
  const {
    user,
    showLoginModal,
    setShowLoginModal,
    favoriteInstructorIds,
    favoritesEnabled,
    favoritesError,
    setFavoritesError,
    favoriteInstructorActionLoadingIds,
    handleInstructorFavoriteToggle,
  } = useListingFavorites();
  const closeGalleryModal = useCallback(() => {
    setIsGalleryModalOpen(false);
    setActiveViewerIndex(null);
    setGalleryFilter("all");
  }, []);
  useGalleryModalEffects(isGalleryModalOpen, closeGalleryModal);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setOwnPendingApproval(false);
      const { row: instructorRow, error: loadError } = await fetchPublicInstructorByParamClient(slugOrId);
      if (cancelled) return;
      if (instructorRow) {
        setRow(instructorRow);
        setProfileLines(buildInstructorProfileSummaryLines(instructorRow));
        setLoading(false);
        return;
      }
      const ownPending = await isOwnPendingInstructorProfile(slugOrId);
      if (cancelled) return;
      if (ownPending) {
        setRow(null);
        setOwnPendingApproval(true);
        setLoading(false);
        return;
      }
      setRow(null);
      setError(
        loadError
          ? "Eğitmen profili yüklenirken bir hata oluştu."
          : "Eğitmen profili bulunamadı.",
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slugOrId]);

  useEffect(() => {
    if (!row?.id) {
      setGalleryUrls([]);
      setAnnouncements([]);
      setAcademicLines([]);
      setFeatureSections([]);
      setFeaturesLoadFailed(false);
      setHighlightItems([]);
      setFeaturesChecking(false);
      featuresRetryLockRef.current = false;
      return;
    }

    let cancelled = false;
    const instructorId = Number(row.id);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [galleryRes, announcementsRes] = await Promise.all([
        fetchPublicInstructorGalleryClient(instructorId, supabase),
        fetchPublicInstructorAnnouncementsClient(instructorId, supabase),
      ]);

      if (cancelled) return;
      setGalleryUrls(galleryRes.items.map((i) => i.url));
      setAnnouncements(announcementsRes.items);
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id]);

  useEffect(() => {
    if (!row?.id) return;

    let cancelled = false;
    const instructorId = Number(row.id);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const featuresRes = await fetchPublicInstructorFeatureDisplayClient(instructorId, supabase, {
        categorySlug: row.category_slug,
      });
      if (cancelled) return;
      setFeaturesLoadFailed(featuresRes.loadFailed);
      setAcademicLines(featuresRes.loadFailed ? [] : featuresRes.academicLines);
      setFeatureSections(featuresRes.loadFailed ? [] : featuresRes.sections);
      setFeaturesChecking(false);
      setHighlightItems(featuresRes.loadFailed ? [] : featuresRes.highlightItems);
      featuresRetryLockRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id, row?.category_slug, featuresRetryCount]);

  useEffect(() => {
    if (!row?.id) {
      setPublicExtraBranches([]);
      setExtraBranchesStatus("idle");
      return;
    }

    let cancelled = false;
    setExtraBranchesStatus("loading");
    const supabase = createSupabaseBrowserClient();
    const instructorId = Number(row.id);
    const mainCategorySlug = row.category_slug;

    (async () => {
      try {
        const loaded = await loadInstructorExtraBranchesClient(supabase, instructorId);
        if (cancelled) return;
        setPublicExtraBranches(
          mapLoadedInstructorExtraBranchesForPublicProfile(loaded, {
            mainCategorySlug,
          }),
        );
        setExtraBranchesStatus("ready");
      } catch (error) {
        if (cancelled) return;
        console.error("[instructors][detail][extra-branches][load-error]", error);
        setPublicExtraBranches([]);
        setExtraBranchesStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id, row?.category_slug, extraBranchesRetryCount]);

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [row?.profile_picture]);

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

  const displayName = publicInstructorDisplayName(row);
  const shareKey = String(row?.slug ?? "").trim() || String(row?.id ?? slugOrId).trim();

  const photoUrl = useMemo(() => {
    if (!row) return "";
    return resolvePublicInstructorProfilePictureUrl(row.profile_picture);
  }, [row]);

  const location = formatPublicInstructorDetailLocation(row);
  const about = String(row?.about ?? row?.bio ?? "").trim();
  const email = String(row?.email ?? "").trim();
  const phone = String(row?.phone ?? "").trim();
  const website = String(row?.website ?? "").trim();
  const facebookUrl = String(row?.facebook_url ?? "").trim();
  const instagramUrl = String(row?.instagram_url ?? "").trim();
  const xUrl = String(row?.x_url ?? "").trim();
  const linkedinUrl = String(row?.linkedin_url ?? "").trim();
  const toExternalHref = (value: string) =>
    value.startsWith("http") ? value : `https://${value}`;
  const profileSocialLinks = [
    website
      ? { label: "Web Sitesi", href: toExternalHref(website), Icon: Globe }
      : null,
    facebookUrl
      ? { label: "Facebook", href: toExternalHref(facebookUrl), Icon: Facebook }
      : null,
    instagramUrl
      ? { label: "Instagram", href: toExternalHref(instagramUrl), Icon: Instagram }
      : null,
    xUrl ? { label: "X", href: toExternalHref(xUrl), Icon: Twitter } : null,
    linkedinUrl
      ? { label: "LinkedIn", href: toExternalHref(linkedinUrl), Icon: Linkedin }
      : null,
  ].filter((item): item is { label: string; href: string; Icon: typeof Globe } => item != null);
  const categoryName = String(row?.category_name ?? "").trim();
  const hasPhoto = Boolean(photoUrl) && !photoLoadFailed;
  const instructorNumericId =
    typeof row?.id === "number" && Number.isInteger(row.id) && row.id > 0 ? row.id : null;
  const instructorSlug = String(row?.slug ?? "").trim();
  const isInstructorFavorite =
    instructorNumericId != null && favoriteInstructorIds.has(instructorNumericId);
  const isFavoriteActionLoading =
    instructorNumericId != null && favoriteInstructorActionLoadingIds.has(instructorNumericId);

  const mergedAcademicLines = useMemo(() => {
    const seen = new Set<string>();
    const lines: PublicInstructorFeatureLine[] = [];
    for (const line of profileLines) {
      const key = line.label.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
    for (const line of academicLines) {
      const key = line.label.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
    const hourStart = institutionTimeToInputHHMM(row?.working_hours_start);
    const hourEnd = institutionTimeToInputHHMM(row?.working_hours_end);
    if (hourStart && hourEnd) {
      lines.push({
        label: "Müsait Saat Aralığı",
        value: `${hourStart} — ${hourEnd}`,
      });
    }
    return lines;
  }, [academicLines, profileLines, row?.working_hours_end, row?.working_hours_start]);

  const mappedInfoLines = mergedAcademicLines
    .map((line) => ({
      label: line.label,
      value: formatFeatureLineValue(line.value),
    }))
    .filter((line) => line.label && line.value);
  const profileFactLabel = (label: string) => label.trim().toLocaleLowerCase("tr-TR");
  const branchValue =
    mappedInfoLines.find((line) => profileFactLabel(line.label) === "branş")?.value ?? "";
  const schoolValue =
    mappedInfoLines.find((line) => profileFactLabel(line.label) === "mezun olunan okul")?.value ??
    "";
  const generalInfoRows = [
    ...(categoryName ? [{ label: "Kategori", value: categoryName }] : []),
    ...(branchValue ? [{ label: "Branş", value: branchValue }] : []),
    ...(schoolValue ? [{ label: "Üniversite", value: schoolValue }] : []),
    ...collapseHizmetYeriRows(
      mappedInfoLines.filter((line) => {
        const key = profileFactLabel(line.label);
        return key !== "branş" && key !== "mezun olunan okul";
      }),
    ),
  ];
  const hasGeneralInfo = generalInfoRows.length > 0;
  const featureNavSections = useMemo(
    () => featureSections.filter((section) => section.badges.length > 0),
    [featureSections],
  );
  const hasFeatureSections = featureNavSections.length > 0;
  const hasAnnouncements = announcements.length > 0;
  const hasGallery = galleryUrls.length > 0;
  const safeProfileGalleryIndex =
    galleryUrls.length > 0 ? Math.min(profileGalleryIndex, galleryUrls.length - 1) : 0;
  const selectedProfileImage = galleryUrls[safeProfileGalleryIndex] ?? null;
  const galleryThumbImages = galleryUrls.slice(1, 5);
  const filteredGalleryUrls = galleryFilter === "video" ? [] : galleryUrls;
  const showPublicExtraBranches =
    extraBranchesStatus === "ready" && publicExtraBranches.length > 0;
  const topRowClassName = [
    "institution-top-row",
    !hasGallery && hasGeneralInfo ? "institution-top-row--no-gallery" : "",
    hasGallery && !hasGeneralInfo ? "institution-top-row--no-facts" : "",
    !hasGallery && !hasGeneralInfo ? "institution-top-row--card-only" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const hasAbout = Boolean(about);
  const navTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string; icon: PublicNavIcon }> = [];
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
    if (hasAnnouncements) {
      tabs.push({ id: "announcements", label: "Duyurular", icon: "announcements" });
    }
    return tabs;
  }, [featureNavSections, hasAbout, showPublicExtraBranches, hasAnnouncements]);
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
    setShowAllAnnouncements(false);
  }, [slugOrId]);

  const openGalleryModal = useCallback(() => {
    setGalleryFilter("all");
    if (galleryUrls.length === 0) {
      setActiveViewerIndex(null);
      setIsGalleryModalOpen(true);
      return;
    }
    setActiveViewerIndex(safeProfileGalleryIndex);
    setIsGalleryModalOpen(true);
  }, [galleryUrls.length, safeProfileGalleryIndex]);

  const handleGalleryFilterChange = useCallback(
    (nextFilter: "all" | "photo" | "video") => {
      const currentUrl =
        activeViewerIndex !== null ? filteredGalleryUrls[activeViewerIndex] ?? null : null;
      const nextUrls = nextFilter === "video" ? [] : galleryUrls;
      setGalleryFilter(nextFilter);
      if (nextUrls.length === 0) {
        setActiveViewerIndex(null);
        return;
      }
      if (currentUrl) {
        const nextIndex = nextUrls.indexOf(currentUrl);
        setActiveViewerIndex(nextIndex >= 0 ? nextIndex : 0);
        return;
      }
      setActiveViewerIndex(0);
    },
    [activeViewerIndex, filteredGalleryUrls, galleryUrls],
  );

  const showPreviousProfileImage = useCallback(() => {
    if (galleryUrls.length <= 1) return;
    setProfileGalleryIndex((current) => (current - 1 + galleryUrls.length) % galleryUrls.length);
  }, [galleryUrls.length]);

  const showNextProfileImage = useCallback(() => {
    if (galleryUrls.length <= 1) return;
    setProfileGalleryIndex((current) => (current + 1) % galleryUrls.length);
  }, [galleryUrls.length]);

  useEffect(() => {
    if (galleryUrls.length === 0) {
      setProfileGalleryIndex(0);
      return;
    }
    if (profileGalleryIndex >= galleryUrls.length) {
      setProfileGalleryIndex(0);
    }
  }, [galleryUrls.length, profileGalleryIndex]);

  useEffect(() => {
    if (!isGalleryModalOpen) return;
    if (filteredGalleryUrls.length === 0) {
      if (activeViewerIndex !== null) setActiveViewerIndex(null);
      return;
    }
    if (activeViewerIndex === null || activeViewerIndex >= filteredGalleryUrls.length) {
      setActiveViewerIndex(0);
    }
  }, [activeViewerIndex, filteredGalleryUrls, isGalleryModalOpen]);

  const formatAnnouncementDateTr = useCallback((iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  }, []);

  const buildAnnouncementExcerpt = useCallback((text: string, maxLen: number) => {
    const t = String(text ?? "").trim().replace(/\s+/g, " ");
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
  }, []);

  if (loading) {
    return (
      <div className="instructor-detail-page">
        <div className="instructor-detail-container">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (ownPendingApproval) {
    return (
      <div className="instructor-detail-page">
        <div className="instructor-detail-container">
          <h1 className="instructor-name">{OWN_PENDING_PROFILE_TITLE}</h1>
          <p className="instructor-description">{OWN_PENDING_PROFILE_MESSAGE}</p>
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="instructor-detail-page">
        <div className="instructor-detail-container">
          <h1 className="instructor-name">Eğitmen Profili</h1>
          <p>{error || "Eğitmen profili bulunamadı."}</p>
        </div>
      </div>
    );
  }

  const visibleAnnouncements = showAllAnnouncements ? announcements : announcements.slice(0, 2);
  const canToggleAnnouncements = announcements.length > 2;

  const renderAnnouncementArticle = (item: PublicInstructorAnnouncementItem) => {
    const detail: AnnouncementDetailItem = {
      id: item.id,
      title: item.title,
      content: item.content,
      imageUrl: item.imageUrl,
      createdAt: item.createdAt,
      institutionName: displayName,
      linkUrl: item.linkUrl,
      announcementTag: item.announcementTag,
      locationLabel: item.locationLabel,
    };
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
        onClick={() => setActiveAnnouncement(detail)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveAnnouncement(detail);
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
          {displayName ? (
            <div className="institution-announcement-kicker">
              {displayName.toLocaleUpperCase("tr-TR")}
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

  return (
    <>
    <div className="instructor-detail-page">
      <div className="instructor-detail-container">
        <CategoryBreadcrumb
          variant="instructor"
          categoryLabel={categoryName}
          categoryHref="/egitmenler"
          listingPathname="/egitmenler"
          location={{
            ilId: toLocationIdString(row.il_id),
            ilceId: toLocationIdString(row.ilce_id),
            mahalleId: toLocationIdString(row.mahalle_id),
          }}
          currentLabel={displayName}
        />

        <div className={topRowClassName}>
          <Card className="institution-profile-card">
            <CardContent className="institution-profile-card-content">
              <InstructorShareButton slugOrId={shareKey} />
              <div className="institution-profile-main">
                {hasPhoto ? (
                  <div className="institution-logo-section">
                    <div className="institution-logo-wrapper">
                      <Image
                        src={photoUrl}
                        alt={displayName}
                        width={140}
                        height={140}
                        className="institution-logo"
                        unoptimized
                        onError={() => setPhotoLoadFailed(true)}
                      />
                    </div>
                  </div>
                ) : null}
                <div className="institution-info">
                  <h1 className="institution-name">{displayName}</h1>
                  {location ? (
                    <div className="institution-meta">
                      <div className="institution-meta-item">
                        <MapPin size={18} />
                        <span>{location}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              {profileSocialLinks.length > 0 ? (
                <div className="institution-profile-socials" aria-label="Sosyal bağlantılar">
                  {profileSocialLinks.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className="institution-contact-bar-social-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                    >
                      <item.Icon size={16} />
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="institution-profile-actions">
                <ProfileContactRevealButtons phone={phone} email={email} />
                {instructorNumericId != null ? (
                  <button
                    type="button"
                    className={`institution-profile-action${
                      isInstructorFavorite ? " institution-profile-action--active" : ""
                    }`}
                    aria-label={isInstructorFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                    disabled={isFavoriteActionLoading || (Boolean(user) && !favoritesEnabled)}
                    onClick={(event) => {
                      void handleInstructorFavoriteToggle(instructorNumericId, event);
                    }}
                  >
                    <Heart
                      className={
                        isInstructorFavorite
                          ? "heart-favorite-icon heart-favorite-icon--active"
                          : "heart-favorite-icon"
                      }
                      aria-hidden
                    />
                    <span>{isInstructorFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}</span>
                  </button>
                ) : null}
                {instructorNumericId != null && instructorSlug ? (
                  <InstructorCompareToggleButton
                    labeled
                    className="institution-compare-toggle--profile"
                    item={{
                      id: instructorNumericId,
                      name: displayName,
                      slug: instructorSlug,
                      imageUrl: hasPhoto ? photoUrl : undefined,
                    }}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          {hasGallery ? (
            <section id="gallery" className="institution-top-gallery">
              <Card className="institution-top-gallery-card">
                <CardContent className="institution-top-gallery-content">
                  <div className="institution-top-gallery-header">
                    <h2 className="institution-top-gallery-title">Eğitmen Galerisi</h2>
                    <button
                      type="button"
                      className="institution-section-link institution-gallery-view-all-btn"
                      onClick={openGalleryModal}
                    >
                      tümünü gör
                    </button>
                  </div>
                  {selectedProfileImage ? (
                    <div className="institution-top-gallery-media">
                      <div className="institution-top-gallery-main">
                        <Image
                          src={selectedProfileImage}
                          alt={`${displayName} galeri görseli`}
                          fill
                          className="institution-gallery-image"
                          sizes="(max-width: 1024px) 100vw, 48vw"
                          unoptimized
                        />
                        {galleryUrls.length > 1 ? (
                          <>
                            <button
                              type="button"
                              className="institution-top-gallery-nav institution-top-gallery-nav--prev"
                              aria-label="Önceki görsel"
                              onClick={showPreviousProfileImage}
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <button
                              type="button"
                              className="institution-top-gallery-nav institution-top-gallery-nav--next"
                              aria-label="Sonraki görsel"
                              onClick={showNextProfileImage}
                            >
                              <ChevronRight size={20} />
                            </button>
                          </>
                        ) : null}
                      </div>
                      {galleryThumbImages.length > 0 ? (
                        <div className="institution-top-gallery-thumbs">
                          {galleryThumbImages.map((imageUrl, thumbIndex) => {
                            const absoluteIndex = thumbIndex + 1;
                            const isActive = absoluteIndex === safeProfileGalleryIndex;
                            return (
                              <button
                                key={`${imageUrl}-${thumbIndex}`}
                                type="button"
                                className={`institution-top-gallery-thumb${isActive ? " institution-top-gallery-thumb--active" : ""}`}
                                aria-label={`${absoluteIndex + 1}. görsel`}
                                aria-pressed={isActive}
                                onClick={() => setProfileGalleryIndex(absoluteIndex)}
                              >
                                <Image
                                  src={imageUrl}
                                  alt={`${displayName} galeri görseli`}
                                  fill
                                  className="institution-gallery-image"
                                  sizes="(max-width: 1024px) 25vw, 12vw"
                                  unoptimized
                                />
                              </button>
                            );
                          })}
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
            <h2 className="institution-section-title">Eğitmen Özellikleri</h2>
            <HomeSectionLoadError
              message="Eğitmen özellikleri yüklenemedi."
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
            <h2 className="institution-section-title">Eğitmen Özellikleri</h2>
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
                    <ul className={`institution-feature-group-card-list${listColumnClass}`}>
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

        {extraBranchesStatus === "error" ? (
          <section id="extra-branches" className="institution-section">
            <h2 className="institution-section-title">Ek Branşlar</h2>
            <HomeSectionLoadError
              message="Ek branşlar yüklenemedi."
              loading={false}
              onRetry={() => {
                setExtraBranchesStatus("loading");
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
                      <ul className={`institution-feature-group-card-list${listColumnClass}`}>
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

        {hasAnnouncements ? (
          <section id="announcements" className="institution-section" aria-label="Eğitmen duyuruları">
            <h2 className="institution-section-title">
              <Megaphone size={20} aria-hidden="true" />
              Duyurular
            </h2>
            <Card className="institution-section-card">
              <CardContent>
                <div className="institution-announcements-list institution-announcements-list--grid">
                  {visibleAnnouncements.map((item) => renderAnnouncementArticle(item))}
                </div>
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

        {isGalleryModalOpen && hasGallery ? (
          <div
            className="institution-gallery-modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeGalleryModal();
            }}
          >
            <div
              className="institution-gallery-modal institution-gallery-modal--viewer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="instructor-gallery-modal-title"
            >
              <div className="institution-gallery-modal-header">
                <div>
                  <h3 id="instructor-gallery-modal-title" className="institution-gallery-modal-title">
                    Eğitmen Galerisi
                  </h3>
                  <p className="institution-gallery-modal-subtitle">{displayName}</p>
                </div>
                <div className="institution-gallery-modal-header-actions">
                  <div className="institution-gallery-modal-filters" role="tablist" aria-label="Galeri filtreleri">
                    <button
                      type="button"
                      className={`institution-gallery-modal-filter ${galleryFilter === "all" ? "institution-gallery-modal-filter--active" : ""}`}
                      onClick={() => handleGalleryFilterChange("all")}
                    >
                      Tümü
                    </button>
                    <button
                      type="button"
                      className={`institution-gallery-modal-filter ${galleryFilter === "photo" ? "institution-gallery-modal-filter--active" : ""}`}
                      onClick={() => handleGalleryFilterChange("photo")}
                    >
                      Fotoğraf
                    </button>
                    <button
                      type="button"
                      className={`institution-gallery-modal-filter ${galleryFilter === "video" ? "institution-gallery-modal-filter--active" : ""}`}
                      onClick={() => handleGalleryFilterChange("video")}
                    >
                      Video
                    </button>
                  </div>
                  {activeViewerIndex !== null && filteredGalleryUrls.length > 0 ? (
                    <span className="institution-gallery-viewer-counter">
                      {activeViewerIndex + 1} / {filteredGalleryUrls.length}
                    </span>
                  ) : null}
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
              {filteredGalleryUrls.length > 0 && activeViewerIndex !== null ? (
                <GalleryMediaViewer
                  items={filteredGalleryUrls.map((url, index) => ({
                    id: `${url}-${index}`,
                    url,
                    mediaType: "photo" as const,
                    alt: `${displayName} galeri görseli ${index + 1}`,
                  }))}
                  activeIndex={activeViewerIndex}
                  onIndexChange={setActiveViewerIndex}
                />
              ) : (
                <div className="institution-gallery-modal-empty">{EMPTY_TEXT}</div>
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
