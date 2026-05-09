"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator, Slider, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ExpandableChat, ExpandableChatHeader, ExpandableChatBody, ExpandableChatFooter } from "@/components/ui";
import { Search as SearchIcon, Wifi, Users, Check, ChevronLeft, ChevronRight, CalendarDays, MapPin, Star, Heart, Building2, Landmark, UserRound, X, Utensils, ShoppingBag, Car, Briefcase, Palette, PawPrint, Sparkle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import BlogCard from "@/components/BlogCard";
import { HeaderWithSearch } from "@/components/layout/header.client";
import SearchResults from "@/components/SearchResults";
import LoginModal from "@/components/LoginModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FavoritesError, getMyFavoriteInstitutionIds, toggleFavorite } from "@/lib/favorites/favoritesClient";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import { getCategoryHref, getCategoryIcon } from "@/lib/categoryHelpers";
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

type FeaturedInstitution = {
  id: number;
  name: string;
  imageUrl: string;
  slug: string;
  source: string;
  bodyMainCategory: string;
  bodySubCategory: string;
  bodyLocation: string;
};

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

const HOME_PREMIUM_PICK_NAME_GROUPS: readonly (readonly string[])[] = [
  ["ANKARA ÖZEL TEVFİK FİKRET ANADOLU LİSESİ"],
  ["ANKARA ÜNİVERSİTESİ GELİŞTİRME VAKFI OKULLARI ÖZEL ANADOLU LİSESİ"],
  [
    "İHSAN DOĞRAMACI VAKFI ÖZEL BİLKENT LABORATUAR LİSESİ",
    "İHSAN DOĞRAMACI VAKFI ÖZEL  BİLKENT LABORATUAR LİSESİ",
  ],
  ["İHSAN DOĞRAMACI VAKFI ÖZEL BİLKENT LİSESİ"],
];

const HOME_PURPLE_FEATURED_NAME_GROUPS: readonly (readonly string[])[] = [
  ["Deneme"],
  ["İSTEK ÖZEL ANKARA FEN LİSESİ"],
  ["ODTÜ GELİŞTİRME VAKFI ÖZEL LİSESİ"],
  ["ANKARA ÖZEL TEVFİK FİKRET ANADOLU LİSESİ"],
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

type PurpleFeaturedCard = {
  id: string;
  badge: string;
  title: string;
  location: string;
  cta: string;
  imageUrl: string;
  slug: string;
  source: string;
};

function normalizeInstitutionNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function buildHomeSchoolLocation(district: string | null, city: string | null): string {
  const d = String(district ?? "").trim();
  const c = String(city ?? "").trim();
  if (d && c) return `${d}, ${c}`;
  return d || c || "Ankara";
}

function FeaturedInstitutions({
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  isAuthenticated,
}: {
  onToggleFavorite: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds: Set<number>;
  favoritesEnabled: boolean;
  favoriteActionLoadingIds: Set<number>;
  isAuthenticated: boolean;
}) {
  const [shuffledFeaturedInstitutions, setShuffledFeaturedInstitutions] = useState<FeaturedInstitution[]>([]);
  const [brokenFeaturedImageIds, setBrokenFeaturedImageIds] = useState<Set<number>>(() => new Set());
  const [featuredPinnedDeneme, setFeaturedPinnedDeneme] = useState<FeaturedInstitution | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: row, error } = await supabase
        .from("institutions")
        .select("id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))")
        .eq("institution_name", "Deneme")
        .maybeSingle();

      if (cancelled || error || !row) return;

      const r = row as Record<string, unknown>;
      const id = Number(r.id);
      const name = String(r.institution_name ?? "").trim();
      if (!Number.isFinite(id) || !name) return;

      const institutionType = r.institution_type as
        | { name?: string | null; category?: { name?: string | null } | null }
        | undefined;
      const mainCategory = String(institutionType?.category?.name ?? "").trim();
      const subCategory =
        String(institutionType?.name ?? "").trim() || String(r.type ?? "").trim();
      const city = String(r.city ?? "").trim();
      const district = String(r.district ?? "").trim();
      const location = [district, city].filter(Boolean).join(", ");
      const logoPath = String(r.logo ?? "").trim();
      const logoUrl = logoPath
        ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl
        : "";

      setFeaturedPinnedDeneme({
        id,
        name,
        imageUrl: logoUrl,
        slug: String(r.slug ?? "").trim(),
        source: String(r.source ?? "").trim(),
        bodyMainCategory: mainCategory || "Kategori",
        bodySubCategory: subCategory || "Alt kategori belirtilmedi",
        bodyLocation: location || "Konum bilgisi yok",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("institutions")
        .select("id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))")
        .not("institution_name", "is", null)
        .limit(180);

      if (cancelled || error || !data) return;

      const dynamicItems = (data as Array<Record<string, unknown>>)
        .map((row) => {
          const id = Number(row.id);
          const name = String(row.institution_name ?? "").trim();
          if (!Number.isFinite(id) || !name) return null;

          const institutionType = row.institution_type as
            | { name?: string | null; category?: { name?: string | null } | null }
            | undefined;

          const mainCategory = String(institutionType?.category?.name ?? "").trim();
          const subCategory =
            String(institutionType?.name ?? "").trim() || String(row.type ?? "").trim();
          const city = String(row.city ?? "").trim();
          const district = String(row.district ?? "").trim();
          const location = [district, city].filter(Boolean).join(", ");
          const logoPath = String(row.logo ?? "").trim();
          const logoUrl = logoPath
            ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl
            : "";

          return {
            id,
            name,
            imageUrl: logoUrl,
            slug: String(row.slug ?? "").trim(),
            source: String(row.source ?? "").trim(),
            bodyMainCategory: mainCategory || "Kategori",
            bodySubCategory: subCategory || "Alt kategori belirtilmedi",
            bodyLocation: location || "Konum bilgisi yok",
          };
        })
        .filter((item): item is FeaturedInstitution => item !== null);

      if (dynamicItems.length > 0) {
        const shuffled = [...dynamicItems];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setShuffledFeaturedInstitutions(shuffled.slice(0, 8));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="featured-institutions-section">
      <div className="featured-institutions-header">
        <div className="featured-institutions-header-left">
          <h2 className="featured-institutions-title">Öne Çıkanlar</h2>
        </div>
      </div>
      <div className="featured-institutions-slider">
        {(() => {
          const featuredList = featuredPinnedDeneme
            ? [
                featuredPinnedDeneme,
                ...shuffledFeaturedInstitutions.filter((i) => i.id !== featuredPinnedDeneme.id).slice(0, 7),
              ]
            : shuffledFeaturedInstitutions;
          const marqueeList = [...featuredList, ...featuredList];

          return (
            <div className="featured-institutions-scroller">
              {marqueeList.map((institution, index) => {
                const isDuplicate = index >= featuredList.length;
                const key = `${institution.id}-${index}`;
                const isFavorite = favoriteIds.has(institution.id);
                const isActionLoading = favoriteActionLoadingIds.has(institution.id);
                const canRenderImage = Boolean(institution.imageUrl) && !brokenFeaturedImageIds.has(institution.id);
                return (
                  <Link
                    key={key}
                    href={getInstitutionDetailHref({
                      id: institution.id,
                      slug: institution.slug,
                      source: (institution as { source?: string }).source || undefined,
                    })}
                    className="featured-institution-card"
                    aria-label={`${institution.name} detayları`}
                    aria-hidden={isDuplicate}
                    tabIndex={isDuplicate ? -1 : undefined}
                  >
                  <div className="featured-institution-image-wrapper">
                    {canRenderImage ? (
                      <img
                        src={institution.imageUrl}
                        alt={institution.name}
                        className="featured-institution-image"
                        onError={() =>
                          setBrokenFeaturedImageIds((prev) => {
                            const next = new Set(prev);
                            next.add(institution.id);
                            return next;
                          })
                        }
                      />
                    ) : (
                      <div className="featured-institution-placeholder" aria-label="Logo bulunmuyor">
                        <Building2 size={28} />
                      </div>
                    )}
                    <div className="featured-institution-overlay" />
                    <motion.button
                      type="button"
                      aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                      className="featured-institution-favorite"
                      whileTap={{ scale: 0.9 }}
                      disabled={isActionLoading || (isAuthenticated && !favoritesEnabled)}
                      onClick={(e) => {
                        onToggleFavorite(institution.id, e);
                      }}
                    >
                      <motion.div
                        animate={{ scale: isFavorite ? [1, 1.3, 1] : 1 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <Heart
                          className={isFavorite ? "heart-favorite-icon heart-favorite-icon--active" : "heart-favorite-icon"}
                        />
                      </motion.div>
                    </motion.button>
                  </div>
                  <div className="featured-institution-content">
                    <span className="featured-institution-body-category">
                      {institution.bodyMainCategory}
                    </span>
                    <h3 className="featured-institution-name">{institution.name}</h3>
                    <p className="featured-institution-subcategory">
                      {institution.bodySubCategory}
                    </p>
                    <div className="featured-institution-location">
                      <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z" fill="currentColor"/>
                      </svg>
                      <span>{institution.bodyLocation}</span>
                    </div>
                  </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </div>
      <div className="featured-institutions-view-all">
        <Link href="/okullar">
          Tüm Kurumları Görüntüle →
        </Link>
      </div>
    </section>
  );
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
  const [expandedCategoryCards, setExpandedCategoryCards] = useState<Record<string, boolean>>({});
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<Set<"face" | "online" | "individual" | "group">>(
    () => new Set()
  );
  const [selectedSchoolStatuses, setSelectedSchoolStatuses] = useState<Set<"private" | "public">>(() => new Set());
  const [selectedAgeOptions, setSelectedAgeOptions] = useState<Set<"child" | "adult">>(() => new Set());
  const [premiumPicksPage, setPremiumPicksPage] = useState(0);
  const [premiumPicksSlideDir, setPremiumPicksSlideDir] = useState<1 | -1>(1);
  const [premiumPicks, setPremiumPicks] = useState<PremiumPickItem[]>([]);
  const [purpleFeatured, setPurpleFeatured] = useState<PurpleFeaturedCard[]>([]);
  const [showInstitutionMapModal, setShowInstitutionMapModal] = useState(false);
  const [mainCategoryCards, setMainCategoryCards] = useState<MainCategoryCard[]>([]);
  const reduceMotion = useReducedMotion();

  const sidebarInstitutionTypeIds = useMemo(
    () => computeSidebarSelectedInstitutionTypeIds(selectedCategoryItems, selectedCategoryAllGroups, mainCategoryCards),
    [selectedCategoryItems, selectedCategoryAllGroups, mainCategoryCards]
  );

  const premiumPicksPageCount = Math.max(1, Math.ceil(premiumPicks.length / 3));

  useEffect(() => {
    const maxPage = Math.max(0, premiumPicksPageCount - 1);
    setPremiumPicksPage((p) => (p > maxPage ? maxPage : p));
  }, [premiumPicksPageCount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const allQueryNames = Array.from(
        new Set([...HOME_PREMIUM_PICK_NAME_GROUPS, ...HOME_PURPLE_FEATURED_NAME_GROUPS].flat() as string[])
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

      const toLogoUrl = (logoPath: string) =>
        logoPath ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl : "";

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

      const purpleBadges = ["ÖNE ÇIKAN", "POPÜLER", "TAVSİYE"];
      const purple: PurpleFeaturedCard[] = [];
      let bi = 0;
      for (const group of HOME_PURPLE_FEATURED_NAME_GROUPS) {
        const row = resolveRow(group);
        if (!row) continue;
        const slug = String(row.slug ?? "").trim();
        if (!slug) continue;
        purple.push({
          id: `purple-${row.id}`,
          badge: purpleBadges[bi % purpleBadges.length] ?? "ÖNE ÇIKAN",
          title: String(row.institution_name ?? "").trim() || slug,
          location: buildHomeSchoolLocation(row.district, row.city),
          cta: "Detayları Gör",
          imageUrl: toLogoUrl(String(row.logo ?? "").trim()),
          slug,
          source: String(row.source ?? "").trim(),
        });
        bi += 1;
      }

      setPremiumPicks(premium);
      setPurpleFeatured(purple);
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

      setMainCategoryCards(cards);
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
        onSearchChange={setQuery}
        showSearchButton={false}
      />

      <div className="main-layout home-main-layout">
        <aside className="filter-sidebar">
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
                  <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
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
                  <Slider value={priceRange} onValueChange={setPriceRange} min={PRICE_FILTER_MIN} max={PRICE_FILTER_MAX} step={500} />
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
                                    aria-label={`${group.title} — tüm alt kategoriler`}
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
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="pet-filter-media-video"
              >
                <source src="/gifs/meko_pet.mp4" type="video/mp4" />
              </video>
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
                  const Icon = getCategoryIcon(category.name, category.slug);
                  const categoryHref = getCategoryHref(category.name, category.slug);
                  const cardKey = String(category.id);
                  const isExpanded = Boolean(expandedCategoryCards[cardKey]);
                  const hasMoreThanThree = category.subcategories.length > 3;
                  const sortedSubcategories = [...category.subcategories].sort(
                    (a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name, "tr")
                  );
                  const visibleSubcategories = isExpanded ? sortedSubcategories : sortedSubcategories.slice(0, 3);
                  return (
                    <article
                      key={category.id}
                      className={`home-main-category-card ${categoryHref ? "home-main-category-card--clickable" : ""}`}
                      onClick={() => {
                        if (!categoryHref) return;
                        router.push(categoryHref);
                      }}
                    >
                      <span className="home-main-category-card-icon" aria-hidden>
                        <Icon size={15} />
                      </span>
                      <h3 className="home-main-category-card-title">{category.name.toLocaleUpperCase("tr-TR")}</h3>
                      {category.subcategories.length > 0 ? (
                        <div className={`home-main-category-card-list-wrap ${isExpanded ? "is-expanded" : ""}`}>
                        <ul className="home-main-category-card-list">
                          {visibleSubcategories.map((subcategory) => (
                            <li key={`${category.id}-${subcategory.id}`} className="home-main-category-card-item">
                              <Sparkle
                                className="home-main-category-card-item-bullet"
                                size={16}
                                aria-hidden
                                fill="currentColor"
                                stroke="transparent"
                                strokeWidth={0}
                              />
                              <span>{subcategory.name}</span>
                            </li>
                          ))}
                        </ul>
                        </div>
                      ) : null}
                      {hasMoreThanThree ? (
                        <button
                          type="button"
                          className="home-main-category-card-more-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedCategoryCards((prev) => ({
                              ...prev,
                              [cardKey]: !isExpanded,
                            }));
                          }}
                        >
                          {isExpanded ? "Daha Az Göster" : "Daha Fazla Gör"}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <FeaturedInstitutions
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

          <section className="announcements-section" aria-label="Duyurular">
            <div className="announcements-header">
              <h2 className="announcements-title">Duyurular</h2>
              <Link href="/announcements" className="announcements-view-all">
                tümünü gör
              </Link>
            </div>

            <div className="announcements-grid">
              <Link href="/announcements" className="announcement-featured">
                <div
                  className="announcement-featured-media"
                  style={{
                    backgroundImage:
                      'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=700&fit=crop")',
                  }}
                >
                  <span className="announcement-badge">Yeni</span>
                  <div className="announcement-featured-overlay" />
                  <div className="announcement-featured-body">
                    <h3 className="announcement-featured-title">Eğitimde Bahar Dönemi Kayıtları Başladı</h3>
                    <p className="announcement-featured-desc">
                      Yakınınızdaki kurumları karşılaştırın, fiyat ve hizmet detaylarını tek ekranda inceleyin.
                    </p>
                    <div className="announcement-featured-meta">
                      <span className="announcement-meta-item">
                        <CalendarDays className="announcement-meta-icon" />
                        2 Mart 2026
                      </span>
                      <span className="announcement-meta-item">
                        <MapPin className="announcement-meta-icon" />
                        Ankara
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="announcements-side">
                <Link href="/announcements" className="announcement-small">
                  <div
                    className="announcement-small-thumb"
                    style={{
                      backgroundImage:
                        'url("https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop")',
                    }}
                  />
                  <div className="announcement-small-body">
                    <div className="announcement-small-kicker">KAMPANYA</div>
                    <h4 className="announcement-small-title">Üyeliğe Özel İlk Görüşme İndirimi</h4>
                    <p className="announcement-small-desc">
                      Seçili kurumlarda tanışma dersleri ve değerlendirme görüşmeleri avantajlı.
                    </p>
                  </div>
                </Link>

                <Link href="/announcements" className="announcement-small">
                  <div
                    className="announcement-small-thumb"
                    style={{
                      backgroundImage:
                        'url("https://images.unsplash.com/photo-1454165205744-3b78555e5572?w=600&h=400&fit=crop")',
                    }}
                  />
                  <div className="announcement-small-body">
                    <div className="announcement-small-kicker">BİLGİLENDİRME</div>
                    <h4 className="announcement-small-title">Yeni Filtreler ve Arama Deneyimi</h4>
                    <p className="announcement-small-desc">
                      Lokasyon, fiyat ve kategori filtreleriyle en uygun seçeneklere daha hızlı ulaşın.
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          <section className="blog-section">
            <div className="blog-section-header">
              <h2 className="blog-section-title">Blog Yazıları</h2>
              <p className="blog-section-subtitle">Uzmanlardan öneriler ve faydalı bilgiler</p>
            </div>
            <div className="blog-section-grid">
              {blogPosts.slice(0, 3).map((post, index) => (
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
            </>
          )}
      </main>
      </div>
      <div className="content-layout">
        <div className="content-layout-inner">
          <section className="purple-featured-section" aria-label="Hızlı Keşif">
            <div className="purple-featured-bg" aria-hidden />
            <div className="purple-featured-inner">
              <div className="purple-featured-heading">
                <span className="purple-featured-kicker">Yabancı Dil İçin Özenle Seçildi</span>
                <h2 className="purple-featured-title">Dil Eğitiminde Fark Yaratanlar</h2>
              </div>

              <div className="purple-featured-cards">
                {purpleFeatured.map((card) => (
                  <Link
                    key={card.id}
                    href={getInstitutionDetailHref({ slug: card.slug })}
                    className="purple-featured-card"
                    aria-label={card.title}
                  >
                    <div className="purple-featured-card-media">
                      {card.imageUrl ? (
                        <img className="purple-featured-card-img" src={card.imageUrl} alt="" />
                      ) : (
                        <div className="purple-featured-card-img purple-featured-card-img--empty" aria-hidden>
                          <Building2 size={40} strokeWidth={1.25} />
                        </div>
                      )}
                      <span className="purple-featured-card-badge">{card.badge}</span>
                    </div>
                    <div className="purple-featured-card-body">
                      <h3 className="purple-featured-card-title">{card.title}</h3>
                      <div className="purple-featured-card-location">
                        <MapPin className="purple-featured-card-location-icon" aria-hidden />
                        <span>{card.location}</span>
                      </div>
                      <div className="purple-featured-card-cta">{card.cta} ›</div>
                    </div>
                  </Link>
                ))}
              </div>
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
                  {premiumPicks.slice(premiumPicksPage * 3, premiumPicksPage * 3 + 3).map((item) => (
                    <Link
                      key={item.id}
                      href={getInstitutionDetailHref({ slug: item.slug })}
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
          <video
            className="expandable-chat-toggle-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          >
            <source src="/gifs/meko_soru.mp4" type="video/mp4" />
          </video>
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
