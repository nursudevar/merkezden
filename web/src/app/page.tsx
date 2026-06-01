"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator, Slider, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ExpandableChat, ExpandableChatHeader, ExpandableChatBody, ExpandableChatFooter } from "@/components/ui";
import { Search as SearchIcon, Wifi, Users, Check, ChevronLeft, ChevronRight, CalendarDays, MapPin, Star, Heart, Building2, Landmark, UserRound, X, Utensils, ShoppingBag, Car, Briefcase, Palette, PawPrint, SlidersHorizontal, ImageOff } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import BlogCard from "@/components/BlogCard";
import { HomeFeaturedInstitutionsList } from "@/components/featured/HomeFeaturedInstitutionsList";
import { HomeFeaturedInstitutionsMarquee } from "@/components/featured/HomeFeaturedInstitutionsMarquee";
import { HomeIndividualInstructorsSection } from "@/components/featured/HomeIndividualInstructorsSection";
import { HomePurpleFeaturedMarquee } from "@/components/featured/HomePurpleFeaturedMarquee";
import { HomeMainCategoryCard } from "@/components/home/HomeMainCategoryCard";
import { HeaderWithSearch } from "@/components/layout/header.client";
import SearchResults from "@/components/SearchResults";
import LoginModal from "@/components/LoginModal";
import MekoChromaVideo from "@/components/MekoChromaVideo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionLogoUrl";
import { FavoritesError, getMyFavoriteInstitutionIds, toggleFavorite } from "@/lib/favorites/favoritesClient";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import { getCategoryHref } from "@/lib/categoryHelpers";
import { ANKARA_DISTRICTS } from "@/constants/districts";
import type { User } from "@supabase/supabase-js";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";

const InstitutionLocationsMap = dynamic(
  () => import("@/components/map/InstitutionLocationsMap"),
  { ssr: false }
);

/** Ana sayfa sol panel — Fiyat filtresi (TL) */
const PRICE_FILTER_MIN = 0;
const PRICE_FILTER_MAX = 100_000;

const categories = [
  { name: "OKUL", icon: "🏫", items: ["Anaokul", "Kreş", "İlkokul", "Ortaokul", "Lise", "Yaz Okulu"], className: "category-card" },
  { name: "SINAVA HAZIRLIK", icon: "📚", items: ["LGS", "Matematik", "Bilgisayar", "TUS"], className: "category-card" },
  { name: "SPOR", icon: "⚽", items: ["Basketbol", "Tenis", "Pilates", "Yüzme"], className: "category-card" },
  { name: "SANAT", icon: "🎨", items: ["Resim", "Müzik", "Dans", "Tiyatro"], className: "category-card" },
  { name: "YABANCI DİL", icon: "🌍", items: ["İngilizce", "Fransızca", "Almanca", "Çince"], className: "category-card" },
  { name: "KİŞİSEL GELİŞİM", icon: "✨", items: ["Makyaj", "Yaşam Koçluğu", "Organik Tarım"], className: "category-card" },
  { name: "MESLEKİ EĞİTİM", icon: "🎯", items: ["Muhasebe", "Pastacılık", "Grafik Tasarım"], className: "category-card" },
  { name: "ÖZEL EĞİTİM", icon: "🧩", items: ["Oyun Terapisi", "Disleksi", "Duyu Bütünleme"], className: "category-card" },
];

const ageOptions = [
  { value: "child", label: "Çocuk (0-17 yaş)", className: "filter-option filter-option-child" },
  { value: "adult", label: "Yetişkin (18+ yaş)", className: "filter-option filter-option-adult" },
];

const serviceOptions = [
  { value: "face", label: "Yüz Yüze", icon: MapPin },
  { value: "online", label: "Online", icon: Wifi },
  { value: "individual", label: "Bireysel", icon: UserRound },
  { value: "group", label: "Grup", icon: Users },
];

const schoolStatusOptions = [
  { value: "private", label: "Özel", icon: Building2 },
  { value: "public", label: "Devlet", icon: Landmark },
];

const petFilterGroup = {
  id: "pets",
  title: "Patili Dostlar",
  icon: "🐾",
  headerClassName: "category-header-pets",
  items: ["Pet Otel/Kreş", "Köpek Eğitimi", "Pet Kuaför"],
} as const;

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

const blogPosts = [
  {
    title: "Etkili Zaman Yönetimi İçin 5 İpucu",
    excerpt: "Günlük verimliliğinizi artırmak ve hedeflerinize daha hızlı ulaşmak için bu teknikleri uygulayın.",
    imageUrl: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=450&fit=crop",
    slug: "etkili-zaman-yonetimi-ipuclari",
  },
  {
    title: "Liderlik Becerilerinizi Nasıl Geliştirirsiniz?",
    excerpt: "İyi bir lider olmak doğuştan gelen bir yetenek değil, öğrenilebilen bir beceridir. İşte başlangıç noktaları.",
    imageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=450&fit=crop",
    slug: "liderlik-becerileri-gelistirme",
  },
  {
    title: "Çocuğunuz İçin Doğru Okul Nasıl Seçilir?",
    excerpt: "Okul seçimi yaparken dikkat edilmesi gereken kriterler, eğitim kalitesi ve çocuğunuzun gelişimi için önemli faktörler...",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=450&fit=crop",
    slug: "dogru-okul-secimi",
  },
  {
    title: "LGS'ye Hazırlık: Başarı İçin 10 Altın Kural",
    excerpt: "LGS sınavına etkili hazırlık stratejileri, zaman yönetimi ve motivasyon teknikleri ile başarıya giden yol...",
    imageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=450&fit=crop",
    slug: "lgs-hazirlik-altin-kurallar",
  },
  {
    title: "Çocuklarda Spor Alışkanlığı Nasıl Kazandırılır?",
    excerpt: "Çocuğunuzun yaşına uygun spor dalları, fiziksel gelişim ve sosyal beceriler için sporun önemi...",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop",
    slug: "cocuklarda-spor-aliskanligi",
  },
  {
    title: "Sanatın Çocuk Gelişimine Etkisi",
    excerpt: "Resim, müzik ve dans gibi sanat dallarının çocukların yaratıcılık, motor beceri ve duygusal gelişimine katkıları...",
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=450&fit=crop",
    slug: "sanatin-cocuk-gelisimine-etkisi",
  },
];

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

const homeMainCategoryOrder = [
  "OKUL",
  "KURS & SINAVA HAZIRLIK",
  "SPOR",
  "SANAT",
  "YABANCI DİL",
  "KİŞİSEL GELİŞİM",
  "MESLEKİ EĞİTİM",
  "ÖZEL EĞİTİM",
];

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

const PREMIUM_PICKS_PER_PAGE = 5;
const PREMIUM_RANDOM_EXTRA_COUNT = 5;

const HOME_PREMIUM_PICK_NAME_GROUPS: readonly (readonly string[])[] = [
  ["ANKARA ÖZEL TEVFİK FİKRET ANADOLU LİSESİ"],
  ["ANKARA ÜNİVERSİTESİ GELİŞTİRME VAKFI OKULLARI ÖZEL ANADOLU LİSESİ"],
  [
    "İHSAN DOĞRAMACI VAKFI ÖZEL BİLKENT LABORATUAR LİSESİ",
    "İHSAN DOĞRAMACI VAKFI ÖZEL  BİLKENT LABORATUAR LİSESİ",
  ],
  ["İHSAN DOĞRAMACI VAKFI ÖZEL BİLKENT LİSESİ"],
];

type HomeCuratedRow = {
  id: number;
  slug: string | null;
  source: string | null;
  institution_name: string | null;
  city: string | null;
  district: string | null;
  logo: string | null;
};

type PremiumPickItem = {
  id: number;
  name: string;
  imageUrl: string;
  slug: string;
  source: string;
  location: string;
  rating: number | null;
  reviewCount: string | null;
};

function normalizeInstitutionNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Ana sayfa «Duyurular» bölümü için kurum bilgisiyle birleştirilmiş duyuru kaydı. */
type HomeAnnouncement = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string | null;
  institutionName: string;
  institutionCity: string;
};

function formatAnnouncementDateTr(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function buildAnnouncementExcerpt(text: string, maxLen: number): string {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function shufflePremiumPicks<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function buildHomeSchoolLocation(district: string | null, city: string | null): string {
  const d = String(district ?? "").trim();
  const c = String(city ?? "").trim();
  if (d && c) return `${d}, ${c}`;
  return d || c || "Ankara";
}

const premiumPicksMotionVariants = {
  enter: (dir: 1 | -1) => ({
    x: dir * 26,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({
    x: dir * -26,
    opacity: 0,
  }),
};

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(() => new Set());
  const districts = ANKARA_DISTRICTS;
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [priceRange, setPriceRange] = useState<number[]>([PRICE_FILTER_MIN, PRICE_FILTER_MAX]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
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
  const [expandedCategoryCards, setExpandedCategoryCards] = useState<Record<string, boolean>>({});
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<Set<"face" | "online" | "individual" | "group">>(
    () => new Set()
  );
  const [selectedSchoolStatuses, setSelectedSchoolStatuses] = useState<Set<"private" | "public">>(() => new Set());
  const [selectedAgeOptions, setSelectedAgeOptions] = useState<Set<"child" | "adult">>(() => new Set());
  const [premiumPicksPage, setPremiumPicksPage] = useState(0);
  const [premiumPicksSlideDir, setPremiumPicksSlideDir] = useState<1 | -1>(1);
  const [premiumPicks, setPremiumPicks] = useState<PremiumPickItem[]>([]);
  const [homeAnnouncements, setHomeAnnouncements] = useState<HomeAnnouncement[]>([]);
  const [showInstitutionMapModal, setShowInstitutionMapModal] = useState(false);
  const [mainCategoryCards, setMainCategoryCards] = useState<MainCategoryCard[]>([]);
  const reduceMotion = useReducedMotion();

  const sidebarInstitutionTypeIds = useMemo(
    () => computeSidebarSelectedInstitutionTypeIds(selectedCategoryItems, selectedCategoryAllGroups, mainCategoryCards),
    [selectedCategoryItems, selectedCategoryAllGroups, mainCategoryCards]
  );

  const premiumPicksPageCount = Math.max(1, Math.ceil(premiumPicks.length / PREMIUM_PICKS_PER_PAGE));

  useEffect(() => {
    const maxPage = Math.max(0, premiumPicksPageCount - 1);
    setPremiumPicksPage((p) => (p > maxPage ? maxPage : p));
  }, [premiumPicksPageCount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const allQueryNames = Array.from(
        new Set([...HOME_PREMIUM_PICK_NAME_GROUPS].flat() as string[])
      );
      const { data, error } = await supabase
        .from("institutions")
        .select("id, slug, source, institution_name, city, district, logo")
        .in("institution_name", allQueryNames);

      if (cancelled) return;
      if (error) {
        console.error("Home curated schools load error:", error);
        return;
      }

      const rows = (data ?? []) as HomeCuratedRow[];
      const byNorm = new Map<string, HomeCuratedRow>();
      for (const row of rows) {
        const nm = String(row.institution_name ?? "").trim();
        if (nm) byNorm.set(normalizeInstitutionNameKey(nm), row);
      }

      const resolveRow = (aliases: readonly string[]): HomeCuratedRow | null => {
        for (const a of aliases) {
          const r = byNorm.get(normalizeInstitutionNameKey(a));
          if (r) return r;
        }
        return null;
      };

      const toLogoUrl = (rawLogo: string) => resolveInstitutionLogoPublicUrl(supabase, rawLogo);

      const premium: PremiumPickItem[] = [];
      for (const group of HOME_PREMIUM_PICK_NAME_GROUPS) {
        const row = resolveRow(group);
        if (!row) continue;
        const slug = String(row.slug ?? "").trim();
        if (!slug) continue;
        premium.push({
          id: row.id,
          name: String(row.institution_name ?? "").trim() || slug,
          imageUrl: toLogoUrl(String(row.logo ?? "").trim()),
          slug,
          source: String(row.source ?? "").trim(),
          location: buildHomeSchoolLocation(row.district, row.city),
          rating: null,
          reviewCount: null,
        });
      }

      const fixedIds = new Set(premium.map((item) => item.id));
      const { data: randomRows, error: randomError } = await supabase
        .from("institutions")
        .select("id, slug, source, institution_name, city, district, logo")
        .not("institution_name", "is", null)
        .limit(240);

      if (randomError) {
        console.error("Home premium random schools load error:", randomError);
      } else {
        const randomPool: PremiumPickItem[] = [];
        for (const row of (randomRows ?? []) as HomeCuratedRow[]) {
          if (fixedIds.has(row.id)) continue;
          const slug = String(row.slug ?? "").trim();
          if (!slug) continue;
          const name = String(row.institution_name ?? "").trim();
          if (!name) continue;
          randomPool.push({
            id: row.id,
            name,
            imageUrl: toLogoUrl(String(row.logo ?? "").trim()),
            slug,
            source: String(row.source ?? "").trim(),
            location: buildHomeSchoolLocation(row.district, row.city),
            rating: null,
            reviewCount: null,
          });
        }

        const randomExtra = shufflePremiumPicks(randomPool).slice(0, PREMIUM_RANDOM_EXTRA_COUNT);
        premium.push(...randomExtra);
      }

      setPremiumPicks(premium);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFavoriteToggle = async (institutionId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      window.alert("Favoriler yalnızca bireysel hesaplarda kullanılabilir.");
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
      window.alert(msg);
    } finally {
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(institutionId);
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
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoritesError(null);
      setFavoriteActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    setFavoritesError(null);
    (async () => {
      try {
        const ids = await getMyFavoriteInstitutionIds();
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === "NOT_INDIVIDUAL") {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
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
      const { data, error } = await supabase
        .from("announcements")
        .select(
          "id, title, content, announcement_image_url, created_at, institution:institutions(institution_name, city)"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (cancelled) return;
      if (error) {
        console.error("[home][announcements] load error", error);
        setHomeAnnouncements([]);
        return;
      }

      const rows = (data ?? []) as Array<{
        id: string | number;
        title: string | null;
        content: string | null;
        announcement_image_url: string | null;
        created_at: string | null;
        institution:
          | { institution_name: string | null; city: string | null }
          | Array<{ institution_name: string | null; city: string | null }>
          | null;
      }>;

      const mapped: HomeAnnouncement[] = rows
        .map((r) => {
          const inst = Array.isArray(r.institution) ? r.institution[0] ?? null : r.institution ?? null;
          const title = String(r.title ?? "").trim();
          if (!title) return null;
          return {
            id: String(r.id),
            title,
            content: String(r.content ?? "").trim(),
            imageUrl: r.announcement_image_url ? String(r.announcement_image_url).trim() || null : null,
            createdAt: r.created_at ? String(r.created_at) : null,
            institutionName: String(inst?.institution_name ?? "").trim(),
            institutionCity: String(inst?.city ?? "").trim(),
          } as HomeAnnouncement;
        })
        .filter((item): item is HomeAnnouncement => item !== null);

      setHomeAnnouncements(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
        homeMainCategoryOrder.map((label, index) => [normalizeCategoryKey(label), index]),
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

  useEffect(() => {
    if (!showInstitutionMapModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInstitutionMapModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showInstitutionMapModal]);

  const handlePriceInput = (index: number, value: string) => {
    const numeric = Math.max(PRICE_FILTER_MIN, Math.min(PRICE_FILTER_MAX, Number(value) || 0));
    setPriceRange((prev) => {
      const next = [...prev];
      next[index] = numeric;
      if (index === 0 && numeric > next[1]) {
        next[1] = numeric;
      }
      if (index === 1 && numeric < next[0]) {
        next[0] = numeric;
      }
      return next;
    });
    scrollToResultsOnMobile();
  };

  const handleHeaderSearchChange = (value: string) => {
    setQuery(value);
    scrollToResultsOnMobile();
  };

  const handleSliderPriceChange = (next: number[]) => {
    setPriceRange(next);
    scrollToResultsOnMobile();
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    scrollToResultsOnMobile();
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  return (
    <div className="page-container">
      <HeaderWithSearch 
        searchValue={query}
        onSearchChange={handleHeaderSearchChange}
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
              <div className="filter-section filter-section-map">
                <div className="filter-section-map-heading">
                  <div className="filter-section-title filter-section-title--map-row">
                    <Image
                      src="/images/map.svg"
                      alt="Kurum Haritası"
                      width={20}
                      height={20}
                    />
                    <span>Kurum Haritası</span>
                  </div>
                  <button
                    type="button"
                    className="institution-map-detail-link"
                    onClick={() => setShowInstitutionMapModal(true)}
                  >
                    Haritada Ara
                  </button>
                </div>
                <InstitutionLocationsMap key="institution-map-sidebar" />
              </div>
              <Separator />
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
                    alt="Lokasyon" 
                    width={20} 
                    height={20}
                  />
                  <span>Lokasyon</span>
                </div>
                <div className="filter-section-inputs">
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
                  <Select value={selectedDistrict} onValueChange={handleDistrictChange}>
                    <SelectTrigger className="location-input">
                      <SelectValue placeholder="İlçe Seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content home-location-dropdown"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      {districts.map((district) => (
                        <SelectItem key={district} value={district} className="select-item">
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood} disabled={!neighborhoods.length}>
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
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/services.svg" 
                    alt="Okul Durumu" 
                    width={20} 
                    height={20}
                  />
                  <span>Okul Durumu</span>
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
                <div className="filter-section-options">
                  {ageOptions.map((option) => {
                    const v = option.value as "child" | "adult";
                    const isSelected = selectedAgeOptions.has(v);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${option.className} ${isSelected ? 'filter-option--selected' : ''}`}
                        onClick={() => {
                          setSelectedAgeOptions((prev) => {
                            const next = new Set(prev);
                            if (next.has(v)) next.delete(v);
                            else next.add(v);
                            return next;
                          });
                          scrollToResultsOnMobile();
                        }}
                      >
                        <span className={`filter-indicator ${isSelected ? 'filter-indicator--checked' : ''}`}>
                          {isSelected && <Check size={14} />}
                        </span>
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
              <div className="price-filter">
                <div className="price-filter-title">
                  <Image 
                    src="/images/banknotes.svg" 
                    alt="Fiyat" 
                    width={20} 
                    height={20}
                  />
                  <span>Fiyat Filtresi</span>
                </div>
                <div className="price-filter-inputs">
                  <Input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => handlePriceInput(0, e.target.value)}
                    className="price-filter-input"
                  />
                  <span className="price-filter-separator">-</span>
                  <Input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => handlePriceInput(1, e.target.value)}
                    className="price-filter-input"
                  />
                </div>
                <div className="price-filter-slider">
                  <Slider value={priceRange} onValueChange={handleSliderPriceChange} min={PRICE_FILTER_MIN} max={PRICE_FILTER_MAX} step={500} />
                </div>
                <div className="price-filter-labels">
                  <span>0₺</span>
                  <span>50K₺</span>
                  <span>100K₺</span>
                </div>
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
                <Accordion type="single" value={openCategoryId} onValueChange={(v) => setOpenCategoryId(v ?? "")} collapsible>
                  {sidebarCategoryGroups.map((group) => {
                    const matchedCard = mainCategoryCards.find((card) => {
                      const nameKey = normalizeCategoryKey(card.name);
                      const slugKey = normalizeCategoryKey(card.slug);
                      return group.matchKeys.some((k) => k === nameKey || k === slugKey);
                    });
                    const subcategories = matchedCard?.subcategories ?? [];
                    const showAllRow = subcategories.length > 0;
                    type AccordionRow = { kind: "all" } | { kind: "sub"; item: MainCategorySubcategory };
                    const rows: AccordionRow[] = showAllRow
                      ? [{ kind: "all" }, ...subcategories.map((item) => ({ kind: "sub" as const, item }))]
                      : [];
                    const isExpanded = expandedCategories.includes(group.id);
                    const hasMore = rows.length > 4;
                    const itemsToShow = isExpanded ? rows : rows.slice(0, hasMore ? 4 : rows.length);

                    return (
                      <AccordionItem key={group.id} value={group.id} className="category-accordion-item">
                        <AccordionTrigger className="category-accordion-trigger">
                          <span>{group.title}</span>
                        </AccordionTrigger>
                        <AccordionContent className="category-accordion-content">
                          <div className="category-accordion-options">
                            {itemsToShow.map((row) => {
                              if (row.kind === "all") {
                                const allSelected = selectedCategoryAllGroups.has(group.id);
                                return (
                                  <button
                                    key={`${group.id}-__all__`}
                                    type="button"
                                    className={`category-option ${allSelected ? "category-option-selected" : ""}`}
                                    aria-label={`${group.title} — tümü`}
                                    onClick={() => {
                                      const turningOn = !selectedCategoryAllGroups.has(group.id);
                                      setSelectedCategoryAllGroups((prev) => {
                                        const next = new Set(prev);
                                        if (turningOn) next.add(group.id);
                                        else next.delete(group.id);
                                        return next;
                                      });
                                      if (turningOn) {
                                        setSelectedCategoryItems((prev) => {
                                          const next = new Set(prev);
                                          const prefix = `${group.id}-`;
                                          for (const k of prev) {
                                            if (k.startsWith(prefix)) {
                                              const suf = k.slice(prefix.length);
                                              if (/^\d+$/.test(suf)) next.delete(k);
                                            }
                                          }
                                          return next;
                                        });
                                      }
                                      scrollToResultsOnMobile();
                                    }}
                                  >
                                    Tümü
                                  </button>
                                );
                              }
                              const item = row.item;
                              const itemKey = `${group.id}-${item.id}`;
                              const isSelected = selectedCategoryItems.has(itemKey);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`category-option ${isSelected ? "category-option-selected" : ""}`}
                                  data-institution-type-id={item.id}
                                  onClick={() => {
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
                                  {item.name}
                                </button>
                              );
                            })}
                          </div>
                          {hasMore && (
                            <button
                              type="button"
                              className="category-accordion-expand"
                              onClick={() => toggleCategoryExpansion(group.id)}
                            >
                              {isExpanded ? "Daha Az Göster" : "Daha Fazla Göster"}
                            </button>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </CardContent>
          </Card>

          <div className="pet-filter-row">
            <div className="pet-filter-media">
              <MekoChromaVideo
                src="/gifs/meko-pet.mp4"
                className="pet-filter-media-video"
                ariaLabel="Meko animation"
                threshold={18}
              />
            </div>

            <div className="pet-filter-card">
              <div className="pet-filter-header">
                <div className="pet-filter-header-row">
                  <PawPrint className="pet-filter-icon" aria-hidden />
                  <h2 className="pet-filter-title">Patili Dostlar</h2>
                </div>
              </div>
              <div className="pet-filter-main">
                <div className="pet-filter-body">
                  <div className="pet-filter-options">
                    {petFilterGroup.items.map((item) => {
                      const itemKey = `${petFilterGroup.id}-${item}`;
                      const isSelected = selectedCategoryItems.has(itemKey);
                      return (
                        <button
                          key={item}
                          type="button"
                          className={`pet-filter-option ${isSelected ? "pet-filter-option--selected" : ""}`}
                          onClick={() => {
                            setSelectedCategoryItems((prev) => {
                              const next = new Set(prev);
                              if (isSelected) {
                                next.delete(itemKey);
                              } else {
                                next.add(itemKey);
                              }
                              return next;
                            });
                          }}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <section className="hero-search">
            <div className="hero-search-container">
              <img
                src="/images/hero-banner-car.jpg"
                alt="Hero Banner"
                className="hero-search-banner"
              />
              <div className="hero-search-overlay"></div>
              <div className="hero-search-content">
                <h1 className="hero-search-title">
                  <span className="hero-search-title-white">ÇAYYOLU</span>{" "}
                  <span className="hero-search-title-purple">SÜRÜCÜ KURSU</span>
                </h1>
                <p className="hero-search-subtitle">İLETİŞİME GEÇMEYİ UNUTMAYIN!</p>
              </div>
            </div>
          </section>
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
          {(query && query.trim().length > 0) ||
          selectedDistrict ||
          selectedSchoolStatuses.size > 0 ||
          selectedAgeOptions.size > 0 ||
          selectedServiceTypes.size > 0 ||
          priceRange[0] > PRICE_FILTER_MIN ||
          priceRange[1] < PRICE_FILTER_MAX ||
          sidebarInstitutionTypeIds.length > 0 ? (
            <SearchResults 
              query={query} 
              cityFilter="Ankara"
              districtFilter={selectedDistrict}
              schoolStatusFilters={Array.from(selectedSchoolStatuses)}
              studentAgeFilters={Array.from(selectedAgeOptions)}
              serviceTypeFilters={Array.from(selectedServiceTypes)}
              priceRangeFilter={{
                min: priceRange[0],
                max: priceRange[1],
                defaultMin: PRICE_FILTER_MIN,
                defaultMax: PRICE_FILTER_MAX,
              }}
              institutionTypeIds={sidebarInstitutionTypeIds}
              onClearSearch={() => setQuery("")}
              onClearAllFilters={() => {
                setQuery("");
                setSelectedDistrict("");
                setSelectedNeighborhood("");
                setSelectedSchoolStatuses(new Set());
                setSelectedAgeOptions(new Set());
                setSelectedServiceTypes(new Set());
                setPriceRange([PRICE_FILTER_MIN, PRICE_FILTER_MAX]);
                setSelectedCategoryItems(new Set());
                setSelectedCategoryAllGroups(new Set());
              }}
              onToggleFavorite={handleFavoriteToggle}
              favoriteIds={favoriteIds}
              favoritesEnabled={favoritesEnabled && !favoritesLoading}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              isAuthenticated={Boolean(user)}
            />
          ) : (
            <>
          <section className="home-main-categories">
            <header className="home-main-categories-header">
              <h2 className="home-main-categories-title">Ana Kategoriler</h2>
            </header>
            

            <div className="home-main-categories-slider">
              <div className="categories-scroller home-main-categories-grid">
                {mainCategoryCards.map((category) => {
                  const categoryHref = getCategoryHref(category.name, category.slug);
                  const categoryLogoSrc = getMainCategoryLogoSrc(category.name, category.slug);
                  const cardKey = String(category.id);
                  const isExpanded = Boolean(expandedCategoryCards[cardKey]);
                  return (
                    <HomeMainCategoryCard
                      key={category.id}
                      category={category}
                      categoryHref={categoryHref}
                      categoryLogoSrc={categoryLogoSrc}
                      isExpanded={isExpanded}
                      onToggleExpand={() => {
                        setExpandedCategoryCards((prev) => ({
                          ...prev,
                          [cardKey]: !isExpanded,
                        }));
                      }}
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

          <HomeFeaturedInstitutionsList />

          <HomeFeaturedInstitutionsMarquee
            onToggleFavorite={handleFavoriteToggle}
            favoriteIds={favoriteIds}
            favoritesEnabled={favoritesEnabled && !favoritesLoading}
            favoriteActionLoadingIds={favoriteActionLoadingIds}
            isAuthenticated={Boolean(user)}
          />

          <section>
            <div className="cta-section">
              <h3 className="cta-section-title">Hayatın Merkezinde Olun!</h3>
              <p className="cta-section-subtitle">İhtiyacınız olan tüm hizmetleri tek platformda bulun. Kaliteli hizmet sağlayıcılarıyla tanışın!</p>
              <div className="cta-section-buttons">
                <button className="cta-section-button cta-section-button-primary">
                  ÜCRETSİZ ÜYE OLUN
                </button>
                <button className="cta-section-button cta-section-button-secondary">
                  YAKINIMDAKİ HİZMETLERİ GÖSTER
                </button>
              </div>
            </div>
          </section>

          {homeAnnouncements.length > 0 ? (
            <section className="announcements-section" aria-label="Duyurular">
              <div className="announcements-header">
                <h2 className="announcements-title">Duyurular</h2>
                <Link href="/announcements" className="announcements-view-all">
                  tümünü gör
                </Link>
              </div>

              <div className="announcements-grid">
                {(() => {
                  const featured = homeAnnouncements[0];
                  const sideItems = homeAnnouncements.slice(1, 3);
                  const featuredDate = formatAnnouncementDateTr(featured.createdAt);
                  return (
                    <>
                      <Link href="/announcements" className="announcement-featured">
                        <div
                          className={`announcement-featured-media${featured.imageUrl ? "" : " announcement-featured-media--empty"}`}
                          style={
                            featured.imageUrl
                              ? { backgroundImage: `url("${featured.imageUrl}")` }
                              : undefined
                          }
                        >
                          {!featured.imageUrl ? (
                            <div className="announcement-featured-empty-icon" aria-hidden>
                              <ImageOff size={48} strokeWidth={1.25} />
                            </div>
                          ) : null}
                          <span className="announcement-badge">Yeni</span>
                          <div className="announcement-featured-overlay" />
                          <div className="announcement-featured-body">
                            <h3 className="announcement-featured-title">{featured.title}</h3>
                            {featured.content ? (
                              <p className="announcement-featured-desc">
                                {buildAnnouncementExcerpt(featured.content, 160)}
                              </p>
                            ) : null}
                            <div className="announcement-featured-meta">
                              {featuredDate ? (
                                <span className="announcement-meta-item">
                                  <CalendarDays className="announcement-meta-icon" />
                                  {featuredDate}
                                </span>
                              ) : null}
                              {featured.institutionCity ? (
                                <span className="announcement-meta-item">
                                  <MapPin className="announcement-meta-icon" />
                                  {featured.institutionCity}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </Link>

                      {sideItems.length > 0 ? (
                        <div className="announcements-side">
                          {sideItems.map((item) => (
                            <Link
                              href="/announcements"
                              key={item.id}
                              className="announcement-small"
                            >
                              <div
                                className={`announcement-small-thumb${item.imageUrl ? "" : " announcement-small-thumb--empty"}`}
                                style={
                                  item.imageUrl
                                    ? { backgroundImage: `url("${item.imageUrl}")` }
                                    : undefined
                                }
                                aria-hidden
                              >
                                {!item.imageUrl ? (
                                  <ImageOff
                                    className="announcement-small-thumb-icon"
                                    size={22}
                                    strokeWidth={1.25}
                                  />
                                ) : null}
                              </div>
                              <div className="announcement-small-body">
                                {item.institutionName ? (
                                  <div className="announcement-small-kicker">
                                    {item.institutionName.toLocaleUpperCase("tr-TR")}
                                  </div>
                                ) : null}
                                <h4 className="announcement-small-title">{item.title}</h4>
                                {item.content ? (
                                  <p className="announcement-small-desc">
                                    {buildAnnouncementExcerpt(item.content, 110)}
                                  </p>
                                ) : null}
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </section>
          ) : null}

            </>
          )}
      </main>
      </div>
      <div className="content-layout">
        <div className="content-layout-inner">
          <HomeIndividualInstructorsSection />

          <section className="purple-featured-section" aria-label="Hızlı Keşif">
            <div className="purple-featured-bg" aria-hidden />
            <div className="purple-featured-inner">
              <div className="purple-featured-heading">
                <span className="purple-featured-kicker">Sizin için özenle seçildi.</span>
                <h2 className="purple-featured-title">Aramıza Yeni Katılanlar</h2>
              </div>

              <HomePurpleFeaturedMarquee />
            </div>
          </section>

          <section className="premium-picks-section" aria-label="Ankara'nın En İyileri">
            <div className="premium-picks-header">
              <div className="premium-picks-header-text">
                <span className="premium-picks-badge">PREMIUM KEŞİF</span>
                <h2 className="premium-picks-title">Ankara'nın En İyileri</h2>
                <p className="premium-picks-desc">Başkentin en prestijli eğitim kurumlarını keşfedin.</p>
              </div>
              {premiumPicksPageCount > 1 ? (
                <div className="premium-picks-nav" aria-hidden>
                  <button
                    type="button"
                    className="premium-picks-nav-btn premium-picks-nav-btn--prev"
                    aria-label="Önceki"
                    onClick={() => {
                      setPremiumPicksSlideDir(-1);
                      setPremiumPicksPage(
                        (p) => (p - 1 + premiumPicksPageCount) % premiumPicksPageCount
                      );
                    }}
                  >
                    <ChevronLeft className="premium-picks-nav-icon" />
                  </button>
                  <button
                    type="button"
                    className="premium-picks-nav-btn premium-picks-nav-btn--next"
                    aria-label="Sonraki"
                    onClick={() => {
                      setPremiumPicksSlideDir(1);
                      setPremiumPicksPage((p) => (p + 1) % premiumPicksPageCount);
                    }}
                  >
                    <ChevronRight className="premium-picks-nav-icon" />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="premium-picks-cards">
              <AnimatePresence mode="wait" initial={false} custom={premiumPicksSlideDir}>
                <motion.div
                  key={premiumPicksPage}
                  custom={premiumPicksSlideDir}
                  variants={premiumPicksMotionVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.16, ease: [0.4, 0, 0.2, 1] }
                  }
                  className="premium-picks-cards-track"
                >
                  {premiumPicks
                    .slice(
                      premiumPicksPage * PREMIUM_PICKS_PER_PAGE,
                      premiumPicksPage * PREMIUM_PICKS_PER_PAGE + PREMIUM_PICKS_PER_PAGE,
                    )
                    .map((item) => (
                    <Link
                      key={item.id}
                      href={getInstitutionDetailHref({ slug: item.slug, source: item.source })}
                      className="premium-picks-card"
                    >
                      <div
                        className={`premium-picks-card-media${item.imageUrl ? "" : " premium-picks-card-media--empty"}`}
                        style={
                          item.imageUrl
                            ? { backgroundImage: `url("${item.imageUrl}")` }
                            : {
                                backgroundImage: "none",
                                background:
                                  "linear-gradient(to right, #6d5dfc, #7f56d9, #9454ff)",
                              }
                        }
                      >
                        {!item.imageUrl ? (
                          <div className="premium-picks-card-placeholder-zone" aria-hidden>
                            <Building2 className="premium-picks-card-placeholder-svg" strokeWidth={1.25} />
                          </div>
                        ) : null}
                        <span className="premium-picks-card-badge">TOP PICK</span>
                        <div className="premium-picks-card-overlay" />
                        <div className="premium-picks-card-info">
                          <h3 className="premium-picks-card-title">{item.name}</h3>
                          {item.rating != null && item.reviewCount != null ? (
                            <div className="premium-picks-card-rating">
                              <Star className="premium-picks-card-star" fill="currentColor" aria-hidden />
                              <span>{item.rating}</span>
                              <span className="premium-picks-card-reviews">
                                ({item.reviewCount} Değerlendirme)
                              </span>
                            </div>
                          ) : null}
                          <p className="premium-picks-card-location">{item.location}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          <section className="blog-section">
            <div className="blog-section-header">
              <h2 className="blog-section-title">Blog Yazıları</h2>
              <p className="blog-section-subtitle">Uzmanlardan öneriler ve faydalı bilgiler</p>
            </div>
            <div className="blog-section-grid">
              {blogPosts.slice(0, 5).map((post, index) => (
                <BlogCard
                  key={index}
                  title={post.title}
                  excerpt={post.excerpt}
                  imageUrl={post.imageUrl}
                  slug={post.slug}
                />
              ))}
            </div>
            <div className="blog-section-button-wrapper">
              <Link href="/blog">
                <button className="blog-section-button">
                  Daha fazlasını gör
                </button>
              </Link>
            </div>
          </section>

        </div>
      </div>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {showInstitutionMapModal ? (
        <div className="institution-map-modal-root" role="presentation">
          <button
            type="button"
            className="institution-map-modal-backdrop"
            aria-label="Haritayı kapat"
            onClick={() => setShowInstitutionMapModal(false)}
          />
          <div
            className="institution-map-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="institution-map-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="institution-map-modal-header">
              <h2 id="institution-map-modal-title" className="institution-map-modal-title">
                Kurum Haritası
              </h2>
              <button
                type="button"
                className="institution-map-modal-close"
                onClick={() => setShowInstitutionMapModal(false)}
                aria-label="Kapat"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <div className="institution-map-modal-body">
              <InstitutionLocationsMap key="institution-map-modal" variant="modal" />
            </div>
          </div>
        </div>
      ) : null}

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
          <h2 className="expandable-chat-header-title">Bize ulaşın</h2>
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
