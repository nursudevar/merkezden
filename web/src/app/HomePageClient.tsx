"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ExpandableChat, ExpandableChatHeader, ExpandableChatBody, ExpandableChatFooter } from "@/components/ui";
import { Search as SearchIcon, Wifi, Users, MapPin, Building2, Landmark, UserRound, SlidersHorizontal, PawPrint } from "lucide-react";
import { HomeAnnouncementsMarquee } from "@/components/announcements/HomeAnnouncementsMarquee";
import { HomeBlogSection } from "@/components/blog/HomeBlogSection";
import { HomeFeaturedInstitutionsList } from "@/components/featured/HomeFeaturedInstitutionsList";
import { HomeIndividualInstructorsSection } from "@/components/featured/HomeIndividualInstructorsSection";
import { HomeDrivingSchoolsSection } from "@/components/featured/HomeDrivingSchoolsSection";
import { HomePurpleFeaturedMarquee } from "@/components/featured/HomePurpleFeaturedMarquee";
import { HomeMainCategoryCard } from "@/components/home/HomeMainCategoryCard";
import { HomeHeroSearchBanner } from "@/components/home/HomeHeroSearchBanner";
import { HeaderWithSearch } from "@/components/layout/header.client";
import SearchResults from "@/components/SearchResults";
import LoginModal from "@/components/LoginModal";
import { AppNoticeBar } from "@/components/AppNoticeBar";
import MekoChromaVideo from "@/components/MekoChromaVideo";
import { InstitutionMapSearchSection } from "@/components/map/InstitutionMapSearchSection";
import { useAllInstitutionMapMarkers } from "@/hooks/useAllInstitutionMapMarkers";
import { useClientMounted } from "@/hooks/useClientMounted";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FavoritesError,
  getMyFavoriteInstitutionIds,
  getMyFavoriteInstructorIds,
  NOT_INDIVIDUAL_FAVORITES_MESSAGE,
  toggleFavorite,
  toggleInstructorFavorite,
} from "@/lib/favorites/favoritesClient";
import { getCategoryHref, HOME_MAIN_CATEGORY_ORDER } from "@/lib/categoryHelpers";
import { ANKARA_DISTRICTS } from "@/constants/districts";
import type { User } from "@supabase/supabase-js";
import { PriceRangeSliderFilter, type PriceRangeSliderValue } from "@/components/filters/PriceRangeSliderFilter";
import { AgeRangeSliderFilter } from "@/components/filters/AgeRangeSliderFilter";
import {
  INSTITUTION_PRICE_FILTER_MAX,
  INSTITUTION_PRICE_FILTER_MIN,
} from "@/lib/institutionPriceRangeFilter";
import {
  isStudentAgeFilterTextActive,
  type StudentAgeFilterTextPayload,
} from "@/lib/institutionStudentAgeFilter";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";

const serviceOptions = [
  { value: "face", label: "Yüz Yüze", icon: MapPin },
  { value: "online", label: "Online", icon: Wifi },
  { value: "individual", label: "Bireysel", icon: UserRound },
  { value: "group", label: "Grup", icon: Users },
];

const HOME_HEADER_SEARCH_TYPEWRITER_PLACEHOLDERS = [
  "Meko AI ile istediğin kurumu Ara",
  "Okul, bölge veya özellik adını yazarak ara",
  "Ankara Çankaya'da kreş arıyorum",
] as const;

const schoolStatusOptions = [
  { value: "private", label: "Özel", icon: Building2 },
  { value: "public", label: "Devlet", icon: Landmark },
];

/**
 * Sol filtre paneli ana kategori başlıkları + DB'deki `institution_categories` kayıtlarına
 * normalize edilmiş eşleşme anahtarları. Subcategory listeleri runtime'da DB'den (institution_types) çekilir.
 */
const sidebarCategoryGroups: ReadonlyArray<{
  id: string;
  title: string;
  icon: string;
  headerClassName: string;
  /** institution_categories.name ile normalize-eşleşme için kabul edilen anahtarlar */
  matchKeys: ReadonlyArray<string>;
}> = [
  { id: "school", title: "Okul", icon: "🏫", headerClassName: "category-header-school", matchKeys: ["okul"] },
  { id: "exam", title: "Kurs & Sınava Hazırlık", icon: "📚", headerClassName: "category-header-exam", matchKeys: ["kurs sinava hazirlik", "sinava hazirlik", "kurs ve sinava hazirlik", "kurs", "sinav"] },
  { id: "sport", title: "Spor", icon: "⚽", headerClassName: "category-header-sport", matchKeys: ["spor"] },
  { id: "art", title: "Sanat", icon: "🎨", headerClassName: "category-header-art", matchKeys: ["sanat"] },
  { id: "language", title: "Yabancı Dil", icon: "🌍", headerClassName: "category-header-language", matchKeys: ["yabanci dil", "yabanci diller"] },
  { id: "personal-dev", title: "Kişisel Gelişim", icon: "✨", headerClassName: "category-header-personal-dev", matchKeys: ["kisisel gelisim"] },
  { id: "professional", title: "Mesleki Eğitim", icon: "🎯", headerClassName: "category-header-professional", matchKeys: ["mesleki egitim"] },
  { id: "special", title: "Özel Eğitim", icon: "🧩", headerClassName: "category-header-special", matchKeys: ["ozel egitim"] },
];

/** Ana sayfa sol panel kategori accordion — sabit alt öğe etiketleri (gösterim sırası korunur) */
type HomeSidebarCategoryDisplayEntry = string | { label: string; match?: string };

const HOME_SIDEBAR_CATEGORY_DISPLAY_ITEMS: Readonly<
  Record<string, readonly HomeSidebarCategoryDisplayEntry[]>
> = {
  school: [
    { label: "Anaokul/Kreş", match: "Anaokulu/Kreş" },
    "İlkokul",
    "Ortaokul",
    "Lise",
    "Oyun Grubu",
  ],
  exam: ["KPSS", "YKS", "LGS", "Matematik", "Fizik", "TOEFL"],
  sport: ["Futbol", "Voleybol", "Basketbol", "Fitness", "Pilates", "Binicilik"],
  art: ["Resim", "Dans", "El Sanatları", "Bale", "Piyano", "Drama"],
  language: ["İngilizce", "Almanca", "Fransızca", "Rusça", "Çince", "İspanyolca"],
  "personal-dev": [
    "Beden Dili",
    "Diksiyon",
    "Zaman Yönetimi",
    "Öfke Kontrolü",
    "Etkin Yazarlık",
    "Hızlı Okuma",
  ],
  professional: [
    "Pastacılık",
    "Yazılım",
    "Aşçılık",
    "Muhasebe",
    "Makyaj",
    "Yoga Eğitmenliği",
  ],
  special: [
    "Oyun Terapisi",
    "Kekemelik",
    "Otizm",
    "Disleksi",
    "Ergoterapi",
    "Hiperaktivite",
  ],
};

const HOME_SIDEBAR_CATEGORY_VISIBLE_COUNT = 6;

function resolveHomeSidebarDisplayEntry(
  entry: HomeSidebarCategoryDisplayEntry,
): { label: string; matchName: string } {
  if (typeof entry === "string") {
    return { label: entry, matchName: entry };
  }
  return {
    label: entry.label,
    matchName: entry.match ?? entry.label,
  };
}

type SidebarCategoryRow = {
  kind: "sub";
  item: MainCategorySubcategory;
  label: string;
};

function buildSidebarCategoryRows(
  groupId: string,
  subcategories: MainCategorySubcategory[],
): SidebarCategoryRow[] {
  const rawEntries = HOME_SIDEBAR_CATEGORY_DISPLAY_ITEMS[groupId] ?? [];
  const visibleCount = groupId === "school" ? 5 : HOME_SIDEBAR_CATEGORY_VISIBLE_COUNT;
  const entries = rawEntries.slice(0, visibleCount).map(resolveHomeSidebarDisplayEntry);

  return entries.map(({ label, matchName }) => {
    const matchedSub = findSubcategoryForDisplayName(subcategories, matchName);
    return {
      kind: "sub" as const,
      label,
      item: matchedSub ?? { id: -1, name: label },
    };
  });
}

function findSubcategoryForDisplayName(
  subcategories: MainCategorySubcategory[],
  displayName: string,
): MainCategorySubcategory | null {
  const displayKey = normalizeCategoryKey(displayName);
  const displayCompact = displayKey.replace(/\s+/g, "");

  for (const sub of subcategories) {
    const subKey = normalizeCategoryKey(sub.name);
    if (subKey === displayKey) return sub;
    if (subKey.replace(/\s+/g, "") === displayCompact) return sub;
  }

  if (displayKey.length >= 3) {
    for (const sub of subcategories) {
      const subKey = normalizeCategoryKey(sub.name);
      if (subKey.includes(displayKey) || displayKey.includes(subKey)) return sub;
    }
  }

  const slashParts = displayName
    .split(/[/]/)
    .map((part) => normalizeCategoryKey(part.trim()))
    .filter((part) => part.length >= 3);
  if (slashParts.length > 1) {
    for (const sub of subcategories) {
      const subKey = normalizeCategoryKey(sub.name);
      if (slashParts.some((part) => subKey.includes(part))) return sub;
    }
  }

  return null;
}

type CategoryRow = {
  id: number;
  name: string | null;
  slug?: string | null;
  is_active?: boolean | null;
};

type CategoryTypeRow = {
  id: number;
  name: string | null;
  category_id: number;
  is_active?: boolean | null;
};

type MainCategorySubcategory = {
  /** institution_types.id — sonraki adımda kategori filtreleme için kullanılacak */
  id: number;
  name: string;
};

type MainCategoryCard = {
  id: number;
  name: string;
  slug: string;
  subcategories: MainCategorySubcategory[];
};

type AuthErrorModalState = {
  title: string;
  message: string;
} | null;

/** Sol filtre paneli — Türkçe karakter farklarını yok sayan eşleşme anahtarı */
function normalizeCategoryKey(value: string): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getMainCategoryLogoSrc(name: string, slug: string): string | null {
  const key = normalizeCategoryKey(`${name} ${slug}`);
  if (key.includes("okul")) return "/images/okul-logo.png";
  if (key.includes("kurs") || key.includes("sinav")) return "/images/kurs-logo.png";
  if (key.includes("spor")) return "/images/spor-logo.png";
  if (key.includes("sanat")) return "/images/sanat-logo.png";
  if (key.includes("yabanci dil")) return "/images/yabanci-dil-logo.png";
  if (key.includes("kisisel gelisim")) return "/images/kisisel-gelisim-logo.png";
  if (key.includes("mesleki egitim")) return "/images/mesleki-egitim-logo.png";
  if (key.includes("ozel egitim")) return "/images/ozel-egitim-logo.png";
  return null;
}

function isDriverCourseCategory(name: string, slug: string): boolean {
  return normalizeCategoryKey(`${name} ${slug}`).includes("surucu kursu");
}

/** Sol panelde seçilen alt kurum tipleri + «Tümü» ile seçilen ana kategorilerden türetilen `institution_types.id` listesi (OR). */
function computeSidebarSelectedInstitutionTypeIds(
  selectedKeys: Set<string>,
  selectedAllGroups: Set<string>,
  mainCategoryCards: MainCategoryCard[]
): number[] {
  const idSet = new Set<number>();
  for (const key of selectedKeys) {
    for (const g of sidebarCategoryGroups) {
      const prefix = `${g.id}-`;
      if (!key.startsWith(prefix)) continue;
      const suffix = key.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      const n = Number(suffix);
      if (Number.isFinite(n)) idSet.add(n);
      break;
    }
  }
  for (const groupId of selectedAllGroups) {
    const group = sidebarCategoryGroups.find((g) => g.id === groupId);
    if (!group) continue;
    const matchedCard = mainCategoryCards.find((card) => {
      const nameKey = normalizeCategoryKey(card.name);
      const slugKey = normalizeCategoryKey(card.slug);
      return group.matchKeys.some((k) => k === nameKey || k === slugKey);
    });
    for (const sub of matchedCard?.subcategories ?? []) {
      idSet.add(sub.id);
    }
  }
  return Array.from(idSet);
}

const PATILI_DOSTLAR_PAGE_HREF = "/patili-dostlar";

const HOME_PATILI_DOSTLAR_FEATURED = {
  title: "Pet Kuaför",
  description: "Patili dostunuz için bakım ve tımar hizmetleri yakında burada listelenecek.",
  imageUrl: "/images/pet_kuafor.png",
};

const HOME_PATILI_DOSTLAR_SIDE_CARDS = [
  {
    id: "kopek-egitimi",
    title: "Köpek Eğitimi",
    description: "Profesyonel köpek eğitimi seçeneklerini keşfedin.",
    imageUrl: "/images/kopek_egitimi.png",
  },
  {
    id: "pet-otel-kres",
    title: "Pet Otel / Kreş",
    description: "Güvenilir pet otel ve kreş hizmetleri yakında burada.",
    imageUrl: "/images/pet_otel.png",
  },
] as const;

const ALL_DISTRICTS_VALUE = "__all__";

function HomeCategoryAccordionPlaceholder({
  openCategoryId,
  mainCategoryCards,
}: {
  openCategoryId: string;
  mainCategoryCards: MainCategoryCard[];
}) {
  return (
    <div className="category-accordion" aria-hidden>
      {sidebarCategoryGroups.map((group) => {
        const matchedCard = mainCategoryCards.find((card) => {
          const nameKey = normalizeCategoryKey(card.name);
          const slugKey = normalizeCategoryKey(card.slug);
          return group.matchKeys.some((k) => k === nameKey || k === slugKey);
        });
        const subcategories = matchedCard?.subcategories ?? [];
        const rows = buildSidebarCategoryRows(group.id, subcategories);
        const isOpen = group.id === openCategoryId;
        const categoryLogoSrc = matchedCard
          ? getMainCategoryLogoSrc(matchedCard.name, matchedCard.slug)
          : getMainCategoryLogoSrc(group.title, group.id);

        return (
          <div key={group.id} className="category-accordion-item">
            <div
              className="category-accordion-trigger"
              data-state={isOpen ? "open" : "closed"}
            >
              <span className="category-accordion-trigger-main">
                {categoryLogoSrc ? (
                  <img
                    src={categoryLogoSrc}
                    alt=""
                    className="category-accordion-trigger-icon"
                    aria-hidden
                  />
                ) : null}
                <span>{group.title}</span>
              </span>
            </div>
            {isOpen ? (
              <div className="category-accordion-content" data-state="open">
                <div className="category-accordion-options">
                  {rows.map((row) => (
                    <div
                      key={`${group.id}-${row.label}`}
                      className="category-option"
                    >
                      {row.label}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function HomePageClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoriteInstructorIds, setFavoriteInstructorIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [authErrorModal, setAuthErrorModal] = useState<AuthErrorModalState>(null);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [favoriteInstructorActionLoadingIds, setFavoriteInstructorActionLoadingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const districts = ANKARA_DISTRICTS;
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRangeSliderValue>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string>(() => sidebarCategoryGroups[0]?.id ?? "");
  const [selectedCategoryItems, setSelectedCategoryItems] = useState<Set<string>>(new Set());
  /** Ana kategori «Tümü»: ilgili `institution_categories` altındaki tüm `institution_types.id` (OR). */
  const [selectedCategoryAllGroups, setSelectedCategoryAllGroups] = useState<Set<string>>(() => new Set());
  /** Sadece mobil/tablet (<1024px) için sol filtre panelinin açık/kapalı durumu. Desktop'ta etkisiz. */
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  /**
   * Mobil/tablet (<1024px) için filtre değişiminin ardından «Arama Sonuçları» bölümüne yumuşak kaydırır.
   * SSR güvenlidir; sadece kullanıcı tetikli filtre handler'larından çağırılmalı (initial render etkilenmez).
   * Hedef: filtre aktifken render edilen `<section class="search-results-section">`.
   */
  const scrollToResultsOnMobile = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(".search-results-section");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<Set<"face" | "online" | "individual" | "group">>(
    () => new Set()
  );
  const [selectedSchoolStatuses, setSelectedSchoolStatuses] = useState<Set<"private" | "public">>(() => new Set());
  const [selectedAgeRange, setSelectedAgeRange] = useState<StudentAgeFilterTextPayload | null>(null);
  const [mainCategoryCards, setMainCategoryCards] = useState<MainCategoryCard[]>([]);
  const mapMarkersSectionRef = useRef<HTMLDivElement>(null);
  const [loadHomeMapMarkers, setLoadHomeMapMarkers] = useState(false);
  const { markers: institutionMapMarkers, loading: institutionMapLoading } = useAllInstitutionMapMarkers({
    enabled: loadHomeMapMarkers,
    deferUntilIdle: true,
  });
  const isClientMounted = useClientMounted();

  useEffect(() => {
    if (loadHomeMapMarkers) return;
    const section = mapMarkersSectionRef.current;
    if (!section) return;

    if (typeof IntersectionObserver === "undefined") {
      setLoadHomeMapMarkers(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadHomeMapMarkers(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [loadHomeMapMarkers]);

  const sidebarInstitutionTypeIds = useMemo(
    () => computeSidebarSelectedInstitutionTypeIds(selectedCategoryItems, selectedCategoryAllGroups, mainCategoryCards),
    [selectedCategoryItems, selectedCategoryAllGroups, mainCategoryCards]
  );

  const showDefaultHomeContent = useMemo(
    () =>
      !(
        (query && query.trim().length > 0) ||
        selectedDistrict ||
        selectedSchoolStatuses.size > 0 ||
        isStudentAgeFilterTextActive(selectedAgeRange) ||
        selectedServiceTypes.size > 0 ||
        selectedPriceRange != null ||
        sidebarInstitutionTypeIds.length > 0
      ),
    [
      query,
      selectedDistrict,
      selectedSchoolStatuses,
      selectedAgeRange,
      selectedServiceTypes,
      selectedPriceRange,
      sidebarInstitutionTypeIds,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");
    if (!error && !errorCode && !errorDescription) return;

    const isExpiredLoginLink =
      errorCode === "otp_expired" ||
      String(errorDescription ?? "").includes("Email link is invalid or has expired");

    setAuthErrorModal(
      isExpiredLoginLink
        ? {
            title: "Giriş Bağlantısı Geçersiz",
            message:
              "Giriş bağlantınızın süresi dolmuş veya bağlantı geçersiz. Lütfen tekrar giriş yapmayı deneyin.",
          }
        : {
            title: "Giriş İşlemi Başarısız",
            message: "Giriş işlemi sırasında bir sorun oluştu. Lütfen tekrar deneyin.",
          },
    );

    params.delete("error");
    params.delete("error_code");
    params.delete("error_description");
    const nextQuery = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname || "/"}${nextQuery ? `?${nextQuery}` : ""}`,
    );
  }, []);

  const handleFavoriteToggle = async (institutionId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      setFavoritesError(NOT_INDIVIDUAL_FAVORITES_MESSAGE);
      return;
    }
    if (favoriteActionLoadingIds.has(institutionId)) return;

    const wasFavorited = favoriteIds.has(institutionId);
    setFavoritesError(null);
    setFavoriteActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(institutionId);
      return next;
    });
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(institutionId);
      else next.add(institutionId);
      return next;
    });

    try {
      const res = await toggleFavorite(institutionId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (res.isFavorited) next.add(institutionId);
        else next.delete(institutionId);
        return next;
      });
    } catch (err) {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(institutionId);
        else next.delete(institutionId);
        return next;
      });
      const msg =
        err instanceof FavoritesError
          ? err.message
          : "Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      setFavoritesError(msg);
    } finally {
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(institutionId);
        return next;
      });
    }
  };

  const handleInstructorFavoriteToggle = async (instructorId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      setFavoritesError(NOT_INDIVIDUAL_FAVORITES_MESSAGE);
      return;
    }
    if (favoriteInstructorActionLoadingIds.has(instructorId)) return;

    const wasFavorited = favoriteInstructorIds.has(instructorId);
    setFavoritesError(null);
    setFavoriteInstructorActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(instructorId);
      return next;
    });
    setFavoriteInstructorIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(instructorId);
      else next.add(instructorId);
      return next;
    });

    try {
      const res = await toggleInstructorFavorite(instructorId);
      setFavoriteInstructorIds((prev) => {
        const next = new Set(prev);
        if (res.isFavorited) next.add(instructorId);
        else next.delete(instructorId);
        return next;
      });
    } catch (err) {
      setFavoriteInstructorIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(instructorId);
        else next.delete(instructorId);
        return next;
      });
      const msg =
        err instanceof FavoritesError
          ? err.message
          : "Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      setFavoritesError(msg);
    } finally {
      setFavoriteInstructorActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(instructorId);
        return next;
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setIsAuthReady(true);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady || !user) {
      setFavoriteIds(new Set());
      setFavoriteInstructorIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoritesError(null);
      setFavoriteActionLoadingIds(new Set());
      setFavoriteInstructorActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    setFavoritesError(null);
    (async () => {
      try {
        const [ids, instructorIds] = await Promise.all([
          getMyFavoriteInstitutionIds(),
          getMyFavoriteInstructorIds(),
        ]);
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
        setFavoriteInstructorIds(new Set(instructorIds));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === "NOT_INDIVIDUAL") {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
          setFavoriteInstructorIds(new Set());
        } else {
          const msg =
            err instanceof FavoritesError ? err.message : "Favoriler yüklenemedi. Lütfen tekrar deneyin.";
          setFavoritesError(msg);
          setFavoritesEnabled(false);
        }
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!selectedDistrict) {
      setNeighborhoods([]);
      setSelectedNeighborhood("");
    }
  }, [selectedDistrict]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [categoryRes, typeRes] = await Promise.all([
        supabase
          .from("institution_categories")
          .select("id, name, slug, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("institution_types")
          .select("id, name, category_id, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (cancelled || categoryRes.error || typeRes.error) return;

      const categories = ((categoryRes.data ?? []) as CategoryRow[])
        .map((category) => {
          const name = String(category.name ?? "").trim();
          const slug = String(category.slug ?? "").trim();
          if (!name) return null;
          return {
            id: category.id,
            name,
            slug,
          };
        })
        .filter((category): category is { id: number; name: string; slug: string } => Boolean(category))
        .filter((category) => {
          const normalizedName = category.name.toLocaleLowerCase("tr-TR");
          const normalizedSlug = category.slug.toLocaleLowerCase("tr-TR");
          return normalizedName !== "patili dostlar" && normalizedSlug !== "patili-dostlar";
        });

      const types = (typeRes.data ?? []) as CategoryTypeRow[];

      const cards: MainCategoryCard[] = categories.map((category) => {
        const subcategories: MainCategorySubcategory[] = types
          .filter((type) => type.category_id === category.id)
          .map((type) => {
            const id = Number(type.id);
            const name = String(type.name ?? "").trim();
            if (!Number.isFinite(id) || !name) return null;
            return { id, name };
          })
          .filter((item): item is MainCategorySubcategory => Boolean(item));

        return {
          id: category.id,
          name: category.name,
          slug: category.slug,
          subcategories,
        };
      });

      const orderMap = new Map(
        HOME_MAIN_CATEGORY_ORDER.map((label, index) => [normalizeCategoryKey(label), index]),
      );

      const orderedCards = [...cards].sort((a, b) => {
        const aIndex = orderMap.get(normalizeCategoryKey(a.name));
        const bIndex = orderMap.get(normalizeCategoryKey(b.name));

        if (aIndex != null && bIndex != null) return aIndex - bIndex;
        if (aIndex != null) return -1;
        if (bIndex != null) return 1;
        return 0;
      });

      setMainCategoryCards(orderedCards);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleHeaderSearchChange = (value: string) => {
    setQuery(value);
    scrollToResultsOnMobile();
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    scrollToResultsOnMobile();
  };

  return (
    <div className="page-container">
      <HeaderWithSearch 
        searchValue={query}
        onSearchChange={handleHeaderSearchChange}
        searchTypewriterPlaceholders={HOME_HEADER_SEARCH_TYPEWRITER_PLACEHOLDERS}
        showSearchButton={false}
      />

      <div className={`main-layout home-main-layout${isMobileFilterOpen ? " is-mobile-filter-open" : ""}`}>
        <aside className="filter-sidebar" id="home-filter-sidebar">
          <Card className="filter-sidebar-card">
            <CardHeader className="filter-sidebar-header">
              <div className="filter-sidebar-header-content">
                <img src="/images/filter.svg" alt="Filtre" className="filter-sidebar-header-icon" />
                <CardTitle className="filter-sidebar-header-title">Filtreler</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="filter-sidebar-content">
              <div ref={mapMarkersSectionRef}>
                <InstitutionMapSearchSection
                  markers={institutionMapMarkers}
                  loading={institutionMapLoading}
                  showSeparatorAfter
                />
              </div>
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/search.svg" 
                    alt="Ara" 
                    width={20} 
                    height={20}
                  />
                  <span>Aranacak Kelime</span>
                </div>
                <div className="search-container">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Hizmet adı, kategori..."
                    className="search-field"
                  />
                  <Button className="search-button">
                    <SearchIcon className="icon-md" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/map.svg" 
                    alt="Konum" 
                    width={20} 
                    height={20}
                  />
                  <span>Konum</span>
                </div>
                <div className="filter-section-inputs">
                  {isClientMounted ? (
                    <>
                  <Select value="ankara" disabled>
                    <SelectTrigger className="location-input">
                      <SelectValue placeholder="Şehir Seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content home-location-dropdown"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <SelectItem value="ankara" className="select-item">
                        Ankara
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedDistrict || ALL_DISTRICTS_VALUE}
                    onValueChange={(value) =>
                      handleDistrictChange(value === ALL_DISTRICTS_VALUE ? "" : value)
                    }
                  >
                    <SelectTrigger className="location-input">
                      <SelectValue placeholder="İlçe Seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content home-location-dropdown"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <SelectItem value={ALL_DISTRICTS_VALUE} className="select-item">
                        Tüm İlçeler
                      </SelectItem>
                      {districts.map((district) => (
                        <SelectItem key={district} value={district} className="select-item">
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedNeighborhood || undefined}
                    onValueChange={setSelectedNeighborhood}
                    disabled={neighborhoods.length === 0}
                  >
                    <SelectTrigger className="location-input">
                      <SelectValue placeholder="Mahalle Seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content home-location-dropdown"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      {neighborhoods.map((neighborhood) => (
                        <SelectItem key={neighborhood} value={neighborhood} className="select-item">
                          {neighborhood}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                    </>
                  ) : (
                    <>
                      <div className="location-input select-trigger-default" aria-hidden>
                        Ankara
                      </div>
                      <div className="location-input select-trigger-default" aria-hidden>
                        {selectedDistrict || "Tüm İlçeler"}
                      </div>
                      <div className="location-input select-trigger-default" aria-hidden>
                        {selectedNeighborhood || "Mahalle Seçin"}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/identification.svg" 
                    alt="Öğrenci Yaşı" 
                    width={20} 
                    height={20}
                  />
                  <span>Öğrenci Yaşı</span>
                </div>
                <AgeRangeSliderFilter
                  value={selectedAgeRange}
                  onChange={(nextRange) => {
                    setSelectedAgeRange(nextRange);
                    scrollToResultsOnMobile();
                  }}
                />
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/services.svg" 
                    alt="Hizmet Tipi" 
                    width={20} 
                    height={20}
                  />
                  <span>Hizmet Tipi</span>
                </div>
                <div className="education-type-pills">
                  {serviceOptions.map((option) => {
                    const Icon = option.icon;
                    const v = option.value as "face" | "online" | "individual" | "group";
                    const isSelected = selectedServiceTypes.has(v);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`education-type-pill ${isSelected ? 'education-type-pill--selected' : ''}`}
                        onClick={() => {
                          setSelectedServiceTypes((prev) => {
                            const next = new Set(prev);
                            if (next.has(v)) next.delete(v);
                            else next.add(v);
                            return next;
                          });
                          scrollToResultsOnMobile();
                        }}
                      >
                        <Icon className="education-type-pill-icon" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/services.svg" 
                    alt="Kurum türü" 
                    width={20} 
                    height={20}
                  />
                  <span>Kurum Türü</span>
                </div>
                <div className="education-type-pills">
                  {schoolStatusOptions.map((option) => {
                    const Icon = option.icon;
                    const v = option.value as "private" | "public";
                    const isSelected = selectedSchoolStatuses.has(v);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`education-type-pill ${isSelected ? 'education-type-pill--selected' : ''}`}
                        onClick={() => {
                          setSelectedSchoolStatuses((prev) => {
                            const next = new Set(prev);
                            if (next.has(v)) next.delete(v);
                            else next.add(v);
                            return next;
                          });
                          scrollToResultsOnMobile();
                        }}
                      >
                        <Icon className="education-type-pill-icon" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator />
              <div className="price-filter">
                <div className="price-filter-title">
                  <Image 
                    src="/images/banknotes.svg" 
                    alt="Fiyat" 
                    width={20} 
                    height={20}
                  />
                  <span>Aylık Fiyat Aralığı</span>
                </div>
                <PriceRangeSliderFilter
                  value={selectedPriceRange}
                  onChange={(nextRange) => {
                    setSelectedPriceRange(nextRange);
                    scrollToResultsOnMobile();
                  }}
                />
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/categories.svg" 
                    alt="Kategori" 
                    width={20} 
                    height={20}
                  />
                  <span>Kategori</span>
                </div>
                {isClientMounted ? (
                <Accordion type="single" value={openCategoryId} onValueChange={(v) => setOpenCategoryId(v ?? "")} collapsible>
                  {sidebarCategoryGroups.map((group) => {
                    const matchedCard = mainCategoryCards.find((card) => {
                      const nameKey = normalizeCategoryKey(card.name);
                      const slugKey = normalizeCategoryKey(card.slug);
                      return group.matchKeys.some((k) => k === nameKey || k === slugKey);
                    });
                    const subcategories = matchedCard?.subcategories ?? [];
                    const rows = buildSidebarCategoryRows(group.id, subcategories);
                    const categoryHref = matchedCard
                      ? getCategoryHref(matchedCard.name, matchedCard.slug)
                      : getCategoryHref(group.title, group.id);
                    const categoryLogoSrc = matchedCard
                      ? getMainCategoryLogoSrc(matchedCard.name, matchedCard.slug)
                      : getMainCategoryLogoSrc(group.title, group.id);

                    return (
                      <AccordionItem key={group.id} value={group.id} className="category-accordion-item">
                        <AccordionTrigger className="category-accordion-trigger">
                          <span className="category-accordion-trigger-main">
                            {categoryLogoSrc ? (
                              <img
                                src={categoryLogoSrc}
                                alt=""
                                className="category-accordion-trigger-icon"
                                aria-hidden
                              />
                            ) : null}
                            <span>{group.title}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="category-accordion-content">
                          <div className="category-accordion-options">
                            {rows.map((row) => {
                              const item = row.item;
                              const itemKey = `${group.id}-${item.id}`;
                              const isSelected =
                                item.id > 0 && selectedCategoryItems.has(itemKey);
                              return (
                                <button
                                  key={`${group.id}-${row.label}`}
                                  type="button"
                                  className={`category-option${isSelected ? " category-option-selected" : ""}`}
                                  {...(item.id > 0
                                    ? { "data-institution-type-id": item.id }
                                    : {})}
                                  onClick={() => {
                                    if (item.id <= 0) return;
                                    setSelectedCategoryAllGroups((prev) => {
                                      const next = new Set(prev);
                                      next.delete(group.id);
                                      return next;
                                    });
                                    setSelectedCategoryItems((prev) => {
                                      const next = new Set(prev);
                                      if (isSelected) {
                                        next.delete(itemKey);
                                      } else {
                                        next.add(itemKey);
                                      }
                                      return next;
                                    });
                                    scrollToResultsOnMobile();
                                  }}
                                >
                                  {row.label}
                                </button>
                              );
                            })}
                          </div>
                          {categoryHref ? (
                            <button
                              type="button"
                              className="category-accordion-expand"
                              onClick={() => router.push(categoryHref)}
                            >
                              Daha Fazla Göster
                            </button>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
                ) : (
                  <HomeCategoryAccordionPlaceholder
                    openCategoryId={openCategoryId}
                    mainCategoryCards={mainCategoryCards}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {showDefaultHomeContent && isAuthReady && !user ? (
            <section className="filter-sidebar-cta" aria-label="Hayatın Merkezinde Olun">
              <div className="cta-section cta-section--sidebar">
                <h3 className="cta-section-title">Hayatın Merkezinde Olun!</h3>
                <p className="cta-section-subtitle">
                  İhtiyacınız olan tüm hizmetleri tek platformda bulun. Kaliteli hizmet sağlayıcılarıyla tanışın!
                </p>
                <div className="cta-section-buttons">
                  <button type="button" className="cta-section-button cta-section-button-primary">
                    ÜCRETSİZ ÜYE OLUN
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </aside>

        <main className="main-content">
          <HomeHeroSearchBanner />
          <button
            type="button"
            className={`home-mobile-filter-toggle${isMobileFilterOpen ? " is-open" : ""}`}
            aria-expanded={isMobileFilterOpen}
            aria-controls="home-filter-sidebar"
            onClick={() => setIsMobileFilterOpen((v) => !v)}
          >
            <SlidersHorizontal size={18} aria-hidden />
            <span>Filtrele</span>
          </button>
          {showDefaultHomeContent ? (
            <>
          <section className="home-main-categories">
            <header className="home-main-categories-header">
              <h2 className="home-main-categories-title">Ana Kategoriler</h2>
            </header>
            

            <div className="home-main-categories-slider">
              <div className="categories-scroller home-main-categories-grid">
                {mainCategoryCards.filter((category) => !isDriverCourseCategory(category.name, category.slug)).map((category) => {
                  const categoryHref = getCategoryHref(category.name, category.slug);
                  const categoryLogoSrc = getMainCategoryLogoSrc(category.name, category.slug);
                  return (
                    <HomeMainCategoryCard
                      key={category.id}
                      category={category}
                      categoryHref={categoryHref}
                      categoryLogoSrc={categoryLogoSrc}
                      onCardClick={() => {
                        if (!categoryHref) return;
                        router.push(categoryHref);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          <HomeDrivingSchoolsSection />

          <HomeIndividualInstructorsSection
            onToggleFavorite={handleInstructorFavoriteToggle}
            favoriteInstructorIds={favoriteInstructorIds}
            favoritesEnabled={favoritesEnabled && !favoritesLoading}
            favoriteInstructorActionLoadingIds={favoriteInstructorActionLoadingIds}
            isAuthenticated={Boolean(user)}
          />

          <HomeFeaturedInstitutionsList
            onToggleFavorite={handleFavoriteToggle}
            onToggleInstructorFavorite={handleInstructorFavoriteToggle}
            favoriteIds={favoriteIds}
            favoriteInstructorIds={favoriteInstructorIds}
            favoritesEnabled={favoritesEnabled && !favoritesLoading}
            favoriteActionLoadingIds={favoriteActionLoadingIds}
            favoriteInstructorActionLoadingIds={favoriteInstructorActionLoadingIds}
            isAuthenticated={Boolean(user)}
          />

            </>
          ) : (
            <SearchResults 
              query={query} 
              cityFilter="Ankara"
              districtFilter={selectedDistrict}
              schoolStatusFilters={Array.from(selectedSchoolStatuses)}
              studentAgeRange={selectedAgeRange}
              serviceTypeFilters={Array.from(selectedServiceTypes)}
              priceRangeFilter={
                selectedPriceRange
                  ? {
                      min: selectedPriceRange.min,
                      max: selectedPriceRange.max,
                      defaultMin: INSTITUTION_PRICE_FILTER_MIN,
                      defaultMax: INSTITUTION_PRICE_FILTER_MAX,
                    }
                  : undefined
              }
              institutionTypeIds={sidebarInstitutionTypeIds}
              onClearSearch={() => setQuery("")}
              onClearAllFilters={() => {
                setQuery("");
                setSelectedDistrict("");
                setSelectedNeighborhood("");
                setSelectedSchoolStatuses(new Set());
                setSelectedAgeRange(null);
                setSelectedServiceTypes(new Set());
                setSelectedPriceRange(null);
                setSelectedCategoryItems(new Set());
                setSelectedCategoryAllGroups(new Set());
              }}
              onToggleFavorite={handleFavoriteToggle}
              favoriteIds={favoriteIds}
              favoritesEnabled={favoritesEnabled && !favoritesLoading}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              isAuthenticated={Boolean(user)}
            />
          )}
      </main>
      </div>

      <div className="content-layout">
        <div className="content-layout-inner">
          {showDefaultHomeContent ? (
            <>
              <HomeAnnouncementsMarquee />

              <div className="home-patili-dostlar-row">
                <div className="home-patili-dostlar-meko" aria-hidden>
                  <MekoChromaVideo
                    src="/gifs/meko-pet.mp4"
                    className="home-patili-dostlar-meko-video"
                    ariaLabel="Meko animation"
                    threshold={18}
                  />
                </div>

                <section className="patili-dostlar-section" aria-label="Patili Dostlar">
                  <div className="patili-dostlar-header">
                    <h2 className="patili-dostlar-title">
                      <PawPrint
                        className="patili-dostlar-title-icon"
                        size={24}
                        strokeWidth={2.25}
                        aria-hidden
                      />
                      <span>Patili Dostlar</span>
                    </h2>
                    <Link href={PATILI_DOSTLAR_PAGE_HREF} className="patili-dostlar-view-all">
                      tümünü gör
                    </Link>
                  </div>

                  <div className="patili-dostlar-grid">
                    <Link href={PATILI_DOSTLAR_PAGE_HREF} className="patili-dostlar-feature-card">
                      <div
                        className="patili-dostlar-feature-media"
                        style={{ backgroundImage: `url("${HOME_PATILI_DOSTLAR_FEATURED.imageUrl}")` }}
                      >
                        <div className="patili-dostlar-feature-overlay" />
                        <div className="patili-dostlar-feature-body">
                          <h3 className="patili-dostlar-feature-title">{HOME_PATILI_DOSTLAR_FEATURED.title}</h3>
                          <p className="patili-dostlar-feature-desc">{HOME_PATILI_DOSTLAR_FEATURED.description}</p>
                        </div>
                      </div>
                    </Link>

                    <div className="patili-dostlar-side">
                      {HOME_PATILI_DOSTLAR_SIDE_CARDS.map((item) => (
                        <Link
                          href={PATILI_DOSTLAR_PAGE_HREF}
                          key={item.id}
                          className="patili-dostlar-feature-card patili-dostlar-side-card"
                        >
                          <div
                            className="patili-dostlar-feature-media"
                            style={{ backgroundImage: `url("${item.imageUrl}")` }}
                          >
                            <div className="patili-dostlar-feature-overlay" />
                            <div className="patili-dostlar-feature-body">
                              <h3 className="patili-dostlar-feature-title">{item.title}</h3>
                              <p className="patili-dostlar-feature-desc">{item.description}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : null}

          <section className="purple-featured-section" aria-label="Aramıza Yeni Katılanlar">
            <div className="purple-featured-bg" aria-hidden />
            <div className="purple-featured-inner">
              <div className="purple-featured-heading">
                <span className="purple-featured-kicker">Sizin için özenle seçildi.</span>
                <h2 className="purple-featured-title">Aramıza Yeni Katılanlar</h2>
              </div>

              <HomePurpleFeaturedMarquee />
            </div>
          </section>

          <HomeBlogSection />

        </div>
      </div>
      {authErrorModal ? (
        <div
          className="app-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-auth-error-modal-title"
          onClick={() => setAuthErrorModal(null)}
        >
          <div
            className="app-modal-content app-modal-content--error"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="home-auth-error-modal-title" className="app-modal-title">
              {authErrorModal.title}
            </h2>
            <div className="app-modal-body">
              <p className="app-modal-message">{authErrorModal.message}</p>
            </div>
            <div className="app-modal-footer">
              <Button
                type="button"
                variant="default"
                className="app-modal-btn app-modal-btn--primary"
                onClick={() => setAuthErrorModal(null)}
              >
                Tamam
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <AppNoticeBar
        message={favoritesError}
        onDismiss={() => setFavoritesError(null)}
        variant={favoritesError === NOT_INDIVIDUAL_FAVORITES_MESSAGE ? "warning" : "error"}
      />

      <ExpandableChat
        size="lg"
        position="bottom-right"
        icon={(
          <MekoChromaVideo
            src="/gifs/meko-soru.mp4"
            className="expandable-chat-toggle-video"
            ariaLabel="Meko animation"
            threshold={18}
          />
        )}
      >
        <ExpandableChatHeader>
          <h2 className="expandable-chat-header-title">Meko Asistan</h2>
        </ExpandableChatHeader>
        <ExpandableChatBody>
          <div className="expandable-chat-starter">
            <div className="expandable-chat-starter-avatar" aria-hidden>
              <UserRound size={16} />
            </div>
            <div className="expandable-chat-starter-bubble">
              <p className="expandable-chat-starter-text">
                Sorularınız için bize iletişim sayfamız üzerinden ulaşabilirsiniz!
              </p>
            </div>
          </div>
        </ExpandableChatBody>
        <ExpandableChatFooter>
          <form
            className="expandable-chat-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input
              type="text"
              placeholder="Mesajınızı yazın..."
              className="expandable-chat-input"
              aria-label="Mesaj"
            />
            <Button type="submit" variant="default" className="expandable-chat-send-btn">
              Gönder
            </Button>
          </form>
        </ExpandableChatFooter>
      </ExpandableChat>
    </div>
  );
}
