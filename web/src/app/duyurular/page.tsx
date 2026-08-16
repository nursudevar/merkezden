"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, MapPin, ImageOff, RotateCcw } from "lucide-react";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchAnnouncementsPageItems,
  type AnnouncementsPageItem,
} from "@/lib/homeAnnouncementsClient";
import {
  ANNOUNCEMENT_TAG_OPTIONS,
  announcementTagFromSlug,
  announcementTagToSlug,
  getAnnouncementTagBadgeClassName,
  type AnnouncementTag,
} from "@/lib/announcementTags";
import {
  buildCategoryTabNames,
  fetchActiveInstitutionCategories,
  getCategoryHref,
  getCategoryIcon,
  normalizeCategoryKey,
  type ActiveInstitutionCategory,
} from "@/lib/categoryHelpers";
import {
  CATEGORY_ALL_ILCELER_VALUE,
  resolveCategoryLocationFromSearch,
} from "@/components/category/categoryLocationFilter";
import CategoryBreadcrumb from "@/components/category/CategoryBreadcrumb";
import {
  fetchIller,
  fetchIlcelerByIlId,
  findLocationSlugById,
  parseLocationId,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/blog.scss";
import "@/styles/pages/announcements.scss";

type AnnouncementItem = AnnouncementsPageItem;

const ANNOUNCEMENT_CATEGORY_TABS_FALLBACK = [
  "Hepsi",
  "Okul",
  "Kurs & Sınava Hazırlık",
  "Spor",
  "Sanat",
  "Yabancı Dil",
  "Kişisel Gelişim",
  "Mesleki Eğitim",
  "Özel Eğitim",
  "Sürücü Kursu",
  "Patili Dostlar",
] as const;
const ANNOUNCEMENTS_ALL_ILLER_VALUE = "__all_iller__";
const KATEGORI_PARAM = "kategori";
const ETIKET_PARAM = "etiket";
const DUYURULAR_MANAGED_PARAMS = [
  "il",
  "ilce",
  "mahalle",
  "il_id",
  "ilce_id",
  "mahalle_id",
  KATEGORI_PARAM,
  ETIKET_PARAM,
] as const;

function readRepeatedSlugs(params: URLSearchParams, key: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(",")) {
      const slug = part.trim().toLowerCase();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      result.push(slug);
    }
  }
  return result;
}

function searchQueryEqual(a: string, b: string): boolean {
  const left = new URLSearchParams(a.startsWith("?") ? a.slice(1) : a);
  const right = new URLSearchParams(b.startsWith("?") ? b.slice(1) : b);
  const serialize = (params: URLSearchParams) =>
    [...params.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort((x, y) => x.localeCompare(y))
      .join("&");
  return serialize(left) === serialize(right);
}

function categorySlugFromName(name: string, rows: ActiveInstitutionCategory[]): string {
  const key = normalizeCategoryKey(name);
  const match = rows.find((row) => normalizeCategoryKey(row.name) === key);
  if (match?.slug) return match.slug.trim().toLowerCase();
  const href = getCategoryHref(name, "");
  return href ? href.replace(/^\//, "").toLowerCase() : "";
}

function categoryNameFromSlug(
  slug: string,
  rows: ActiveInstitutionCategory[],
  names: readonly string[],
): string {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return "";
  const bySlug = rows.find((row) => row.slug.trim().toLowerCase() === normalized);
  if (bySlug?.name) return bySlug.name;
  const fromNames = names.find((name) => {
    if (name === "Hepsi") return false;
    return categorySlugFromName(name, rows) === normalized;
  });
  return fromNames ?? "";
}

function categoryMatches(itemCategory: string, selectedCategory: string): boolean {
  const itemKey = normalizeCategoryKey(itemCategory);
  const selectedKey = normalizeCategoryKey(selectedCategory);
  if (!itemKey || !selectedKey) return false;
  if (itemKey === selectedKey) return true;
  if (selectedKey === "kurs sinava hazirlik") {
    return (
      itemKey === "kurs sinav" ||
      itemKey === "kurs ve sinav" ||
      itemKey === "kurs ve sinava hazirlik" ||
      itemKey === "sinava hazirlik"
    );
  }
  return false;
}

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

function AnnouncementsFilterSidebar({
  selectedIlId,
  selectedIlceId,
  selectedAnnouncementTags,
  showResetFilters,
  onIlChange,
  onIlceChange,
  onAnnouncementTagToggle,
  onResetFilters,
}: {
  selectedIlId: string;
  selectedIlceId: string;
  selectedAnnouncementTags: readonly AnnouncementTag[];
  showResetFilters: boolean;
  onIlChange: (ilId: string) => void;
  onIlceChange: (ilceId: string) => void;
  onAnnouncementTagToggle: (tag: AnnouncementTag) => void;
  onResetFilters: () => void;
}) {
  const [iller, setIller] = useState<TurkiyeLocationOption[]>([]);
  const [ilceler, setIlceler] = useState<TurkiyeLocationOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchIller();
        if (!cancelled) setIller(rows);
      } catch (error) {
        console.error("İller yüklenemedi:", error);
        if (!cancelled) setIller([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ilId = parseLocationId(selectedIlId);
    if (ilId == null) {
      setIlceler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchIlcelerByIlId(ilId);
        if (!cancelled) setIlceler(rows);
      } catch (error) {
        console.error("İlçeler yüklenemedi:", error);
        if (!cancelled) setIlceler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIlId]);

  return (
    <aside className="category-filter-sidebar announcements-page-filter">
      <div className="category-filter-sidebar-card">
        <div className="category-filter-sidebar-header">
          <div className="category-filter-sidebar-header-content">
            <Image
              src="/images/filter.svg"
              alt="Filtreler"
              width={20}
              height={20}
              className="category-filter-sidebar-header-icon"
            />
            <h2 className="category-filter-sidebar-header-title">Filtreler</h2>
          </div>
        </div>
        <div className="category-filter-sidebar-content">
          <div className="category-filter-section">
            <h3 className="category-filter-section-title">KONUM</h3>
            <div className="category-filter-section-inputs">
              <Select
                value={selectedIlId || ANNOUNCEMENTS_ALL_ILLER_VALUE}
                onValueChange={(value) =>
                  onIlChange(value === ANNOUNCEMENTS_ALL_ILLER_VALUE ? "" : value)
                }
                disabled={iller.length === 0}
              >
                <SelectTrigger className="category-filter-select">
                  <SelectValue placeholder="Tüm İller" />
                </SelectTrigger>
                <SelectContent
                  className="select-content home-location-dropdown"
                  side="bottom"
                  avoidCollisions={false}
                >
                  <SelectItem value={ANNOUNCEMENTS_ALL_ILLER_VALUE} className="select-item">
                    Tüm İller
                  </SelectItem>
                  {iller.map((row) => (
                    <SelectItem key={row.id} value={String(row.id)} className="select-item">
                      {row.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedIlceId || CATEGORY_ALL_ILCELER_VALUE}
                onValueChange={(value) =>
                  onIlceChange(value === CATEGORY_ALL_ILCELER_VALUE ? "" : value)
                }
                disabled={!selectedIlId}
              >
                <SelectTrigger className="category-filter-select">
                  <SelectValue placeholder="Tüm İlçeler" />
                </SelectTrigger>
                <SelectContent
                  className="select-content home-location-dropdown"
                  side="bottom"
                  avoidCollisions={false}
                >
                  <SelectItem value={CATEGORY_ALL_ILCELER_VALUE} className="select-item">
                    Tüm İlçeler
                  </SelectItem>
                  {selectedIlId
                    ? ilceler.map((row) => (
                        <SelectItem key={row.id} value={String(row.id)} className="select-item">
                          {row.ad}
                        </SelectItem>
                      ))
                    : null}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="category-filter-section">
            <h3 className="category-filter-section-title">DUYURU KATEGORİLERİ</h3>
            <div className="category-filter-section-checkboxes">
              {ANNOUNCEMENT_TAG_OPTIONS.map((tag) => {
                const isChecked = selectedAnnouncementTags.includes(tag);
                return (
                  <label
                    key={tag}
                    className={`category-filter-checkbox-option${
                      isChecked ? " category-filter-checkbox-option--selected" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onAnnouncementTagToggle(tag)}
                      className="category-filter-checkbox-input"
                    />
                    <span className="category-filter-checkbox-label">{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {showResetFilters ? (
            <div className="category-filter-section">
              <button
                type="button"
                className="category-results-reset-btn"
                onClick={onResetFilters}
                aria-label="Tüm filtreleri sıfırla"
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>Filtreleri Sıfırla</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function uniqueCategoryTabNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = normalizeCategoryKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function getAnnouncementMainCategoryLogoSrc(name: string): string | null {
  const key = normalizeCategoryKey(name);
  if (key === "hepsi") return "/images/categories.svg";
  if (key.includes("surucu")) return "/images/surucu-kursu-logo.png";
  if (key.includes("patili") || key.includes("dostlar")) return "/images/patili-dostlar-logo.png";
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

function AnnouncementCategoryTabs({
  categories,
  selectedCategories,
  onCategoryToggle,
}: {
  categories: string[];
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
}) {
  const hepsiActive = selectedCategories.length === 0;

  return (
    <div className="announcements-category-grid" role="group" aria-label="Ana kategoriler">
      {categories.map((category) => {
        const isActive =
          category === "Hepsi" ? hepsiActive : selectedCategories.includes(category);
        const logoSrc = getAnnouncementMainCategoryLogoSrc(category);
        const Icon = getCategoryIcon(category, "");

        return (
          <button
            key={category}
            type="button"
            className={`announcements-category-card${
              isActive ? " announcements-category-card--active" : ""
            }`}
            onClick={() => onCategoryToggle(category)}
            aria-pressed={isActive}
          >
            <span className="announcements-category-card-icon-wrap" aria-hidden>
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt=""
                  width={28}
                  height={28}
                  className="announcements-category-card-icon"
                />
              ) : (
                <Icon className="announcements-category-card-icon" size={28} />
              )}
            </span>
            <span className="announcements-category-card-label">{category}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container">
          <HeaderClientWrapper />
          <main className="main-content">
            <div className="announcements-page">
              <p>Yükleniyor...</p>
            </div>
          </main>
        </div>
      }
    >
      <AnnouncementsPageContent />
    </Suspense>
  );
}

function AnnouncementsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedIlId, setSelectedIlId] = useState("");
  const [selectedIlceId, setSelectedIlceId] = useState("");
  const [selectedAnnouncementTags, setSelectedAnnouncementTags] = useState<AnnouncementTag[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementItem | null>(null);
  const [categoryRows, setCategoryRows] = useState<ActiveInstitutionCategory[]>([]);
  const [categories, setCategories] = useState<string[]>(() =>
    uniqueCategoryTabNames(ANNOUNCEMENT_CATEGORY_TABS_FALLBACK),
  );
  const [urlReady, setUrlReady] = useState(false);
  const lastHydratedSearchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const rows = await fetchActiveInstitutionCategories();
      if (cancelled) return;
      setCategoryRows(rows);
      setCategories(uniqueCategoryTabNames(buildCategoryTabNames(rows, ANNOUNCEMENT_CATEGORY_TABS_FALLBACK)));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const buildDuyurularSearch = useCallback(
    async (
      ilId: string,
      ilceId: string,
      categoryNames: string[],
      tags: readonly AnnouncementTag[],
      currentSearch: string,
    ) => {
      const params = new URLSearchParams(
        currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
      );
      for (const key of DUYURULAR_MANAGED_PARAMS) params.delete(key);

      const parsedIlId = parseLocationId(ilId);
      if (parsedIlId != null) {
        const iller = await fetchIller();
        const ilSlug = findLocationSlugById(iller, parsedIlId);
        if (ilSlug) params.set("il", ilSlug);
        const parsedIlceId = parseLocationId(ilceId);
        if (parsedIlceId != null) {
          const ilceler = await fetchIlcelerByIlId(parsedIlId);
          const ilceSlug = findLocationSlugById(ilceler, parsedIlceId);
          if (ilceSlug) params.set("ilce", ilceSlug);
        }
      }

      for (const name of categoryNames) {
        const slug = categorySlugFromName(name, categoryRows);
        if (slug) params.append(KATEGORI_PARAM, slug);
      }
      for (const tag of tags) {
        const slug = announcementTagToSlug(tag);
        if (slug) params.append(ETIKET_PARAM, slug);
      }

      return params.toString();
    },
    [categoryRows],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const location = await resolveCategoryLocationFromSearch(searchKey ? `?${searchKey}` : "");
      if (cancelled) return;
      setSelectedIlId(location.ilId);
      setSelectedIlceId(location.ilceId);

      const params = new URLSearchParams(searchKey);
      const categorySlugs = readRepeatedSlugs(params, KATEGORI_PARAM);
      if (categorySlugs.length === 0 || categoryRows.length > 0) {
        const categoryNames = categorySlugs
          .map((slug) => categoryNameFromSlug(slug, categoryRows, categories))
          .filter(Boolean);
        setSelectedCategories(categoryNames);
      }

      const tags = readRepeatedSlugs(params, ETIKET_PARAM)
        .map((slug) => announcementTagFromSlug(slug))
        .filter((tag): tag is AnnouncementTag => tag != null);
      setSelectedAnnouncementTags(tags);
      lastHydratedSearchKeyRef.current = searchKey;
      setUrlReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [categories, categoryRows, searchKey]);

  useEffect(() => {
    if (!urlReady) return;
    if (lastHydratedSearchKeyRef.current !== searchKey) return;
    const pendingCategorySlugs = readRepeatedSlugs(new URLSearchParams(searchKey), KATEGORI_PARAM);
    if (pendingCategorySlugs.length > 0 && categoryRows.length === 0) return;
    let cancelled = false;
    void (async () => {
      const nextSearch = await buildDuyurularSearch(
        selectedIlId,
        selectedIlceId,
        selectedCategories,
        selectedAnnouncementTags,
        searchKey,
      );
      if (cancelled || searchQueryEqual(nextSearch, searchKey)) return;
      const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
      router.push(nextUrl, { scroll: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    buildDuyurularSearch,
    pathname,
    router,
    searchKey,
    selectedAnnouncementTags,
    selectedCategories,
    selectedIlId,
    selectedIlceId,
    urlReady,
    categoryRows.length,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { items, error } = await fetchAnnouncementsPageItems(supabase);

      if (cancelled) return;
      if (error) {
        console.error("[announcements][list] load error", error);
        setError("Duyurular yüklenemedi.");
        setAnnouncements([]);
        setLoading(false);
        return;
      }

      setAnnouncements(items);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAnnouncements = useMemo(() => {
    const selectedIl = parseLocationId(selectedIlId);
    const selectedIlce = parseLocationId(selectedIlceId);
    const selectedTagSet =
      selectedAnnouncementTags.length > 0 ? new Set<string>(selectedAnnouncementTags) : null;

    return announcements.filter((item) => {
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.some((category) => categoryMatches(item.categoryName, category))
      ) {
        return false;
      }
      if (selectedIl != null && item.il_id !== selectedIl) return false;
      if (selectedIlce != null && item.ilce_id !== selectedIlce) return false;
      if (selectedTagSet && (!item.announcementTag || !selectedTagSet.has(item.announcementTag))) {
        return false;
      }
      return true;
    });
  }, [announcements, selectedAnnouncementTags, selectedCategories, selectedIlId, selectedIlceId]);

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    Boolean(selectedIlId) ||
    Boolean(selectedIlceId) ||
    selectedAnnouncementTags.length > 0;

  const featured = filteredAnnouncements[0] ?? null;
  const sideItems = filteredAnnouncements.slice(1, 3);

  const openAnnouncement = useCallback((item: AnnouncementItem) => {
    setActiveAnnouncement(item);
  }, []);

  const closeAnnouncement = useCallback(() => {
    setActiveAnnouncement(null);
  }, []);

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, item: AnnouncementItem) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAnnouncement(item);
      }
    },
    [openAnnouncement],
  );

  const activeAnnouncementForModal: AnnouncementDetailItem | null =
    activeAnnouncement
      ? {
          id: activeAnnouncement.id,
          title: activeAnnouncement.title,
          content: activeAnnouncement.content,
          imageUrl: activeAnnouncement.imageUrl,
          createdAt: activeAnnouncement.createdAt,
          institutionName: activeAnnouncement.ownerName,
          linkUrl: activeAnnouncement.linkUrl,
          announcementTag: activeAnnouncement.announcementTag,
          ownerHref: activeAnnouncement.ownerHref,
          locationLabel: activeAnnouncement.locationLabel || null,
        }
      : null;

  return (
    <div className="page-container">
      <HeaderClientWrapper />

      <main className="main-content">
        <div className="announcements-page">
          <div className="category-hero-breadcrumb-wrapper announcements-page-breadcrumb">
            <CategoryBreadcrumb
              categoryLabel="DUYURULAR"
              listingPathname="/duyurular"
              location={{ ilId: selectedIlId, ilceId: selectedIlceId, mahalleId: "" }}
            />
          </div>
          <div className="announcements-page-layout">
            <AnnouncementsFilterSidebar
              selectedIlId={selectedIlId}
              selectedIlceId={selectedIlceId}
              selectedAnnouncementTags={selectedAnnouncementTags}
              showResetFilters={hasActiveFilters}
              onIlChange={(nextIlId) => {
                setSelectedIlId(nextIlId);
                setSelectedIlceId("");
              }}
              onIlceChange={setSelectedIlceId}
              onAnnouncementTagToggle={(tag) => {
                setSelectedAnnouncementTags((prev) =>
                  prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
                );
              }}
              onResetFilters={() => {
                setSelectedCategories([]);
                setSelectedIlId("");
                setSelectedIlceId("");
                setSelectedAnnouncementTags([]);
              }}
            />

            <div className="announcements-page-main">
              {loading ? (
                <section className="announcements-section" aria-label="Duyuru listesi yükleniyor">
                  <p>Yükleniyor...</p>
                </section>
              ) : error ? (
                <section className="announcements-section" aria-label="Duyuru listesi hatası">
                  <p>{error}</p>
                </section>
              ) : featured ? (
                <section className="announcements-section" aria-label="Öne çıkan duyurular">
                  <div className="announcements-grid">
                    <article
                      className="announcement-featured announcement-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => openAnnouncement(featured)}
                      onKeyDown={(event) => handleCardKeyDown(event, featured)}
                      aria-label={`${featured.title} duyurusunu aç`}
                    >
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
                          {(() => {
                            const tag = String(featured.announcementTag ?? "").trim();
                            const tagClass = getAnnouncementTagBadgeClassName(tag);
                            if (!tag || !tagClass) return null;
                            return <span className={tagClass}>{tag}</span>;
                          })()}
                          <h2 className="announcement-featured-title">{featured.title}</h2>
                          {featured.content ? (
                            <p className="announcement-featured-desc">
                              {buildAnnouncementExcerpt(featured.content, 200)}
                            </p>
                          ) : null}
                          <div className="announcement-featured-meta">
                            {formatAnnouncementDateTr(featured.createdAt) ? (
                              <span className="announcement-meta-item">
                                <CalendarDays className="announcement-meta-icon" />
                                {formatAnnouncementDateTr(featured.createdAt)}
                              </span>
                            ) : null}
                            {featured.locationLabel ? (
                              <span className="announcement-meta-item">
                                <MapPin className="announcement-meta-icon" />
                                {featured.locationLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>

                    {sideItems.length > 0 ? (
                      <div className="announcements-side">
                        {sideItems.map((item) => (
                          <article
                            className="announcement-small announcement-clickable"
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openAnnouncement(item)}
                            onKeyDown={(event) => handleCardKeyDown(event, item)}
                            aria-label={`${item.title} duyurusunu aç`}
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
                              {item.ownerName ? (
                                <div className="announcement-small-kicker">
                                  {item.ownerName.toLocaleUpperCase("tr-TR")}
                                </div>
                              ) : null}
                              {(() => {
                                const tag = String(item.announcementTag ?? "").trim();
                                const tagClass = getAnnouncementTagBadgeClassName(tag);
                                if (!tag || !tagClass) return null;
                                return <span className={tagClass}>{tag}</span>;
                              })()}
                              <h3 className="announcement-small-title">{item.title}</h3>
                              {item.content ? (
                                <p className="announcement-small-desc">
                                  {buildAnnouncementExcerpt(item.content, 140)}
                                </p>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : (
                <section className="announcements-section" aria-label="Duyuru listesi boş">
                  <p className="category-results-empty">
                    {hasActiveFilters
                      ? "Seçtiğiniz filtrelere uygun duyuru bulunamadı."
                      : "Henüz duyuru bulunmuyor."}
                  </p>
                </section>
              )}

              <AnnouncementCategoryTabs
                categories={categories}
                selectedCategories={selectedCategories}
                onCategoryToggle={(category) => {
                  if (category === "Hepsi") {
                    setSelectedCategories([]);
                    return;
                  }
                  setSelectedCategories((prev) =>
                    prev.includes(category)
                      ? prev.filter((item) => item !== category)
                      : [...prev, category],
                  );
                }}
              />
            </div>
          </div>

          {!loading && !error && featured && filteredAnnouncements.length > 0 ? (
            <section className="announcements-list-section" aria-label="Tüm duyurular">
              <h2 className="announcements-list-section-title">Tüm Duyurular</h2>
              <div className="announcements-list-grid">
                {filteredAnnouncements.map((item) => (
                  <article
                    className="announcement-small announcement-clickable"
                    key={`list-${item.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openAnnouncement(item)}
                    onKeyDown={(event) => handleCardKeyDown(event, item)}
                    aria-label={`${item.title} duyurusunu aç`}
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
                      {item.ownerName ? (
                        <div className="announcement-small-kicker">
                          {item.ownerName.toLocaleUpperCase("tr-TR")}
                        </div>
                      ) : null}
                      {(() => {
                        const tag = String(item.announcementTag ?? "").trim();
                        const tagClass = getAnnouncementTagBadgeClassName(tag);
                        if (!tag || !tagClass) return null;
                        return <span className={tagClass}>{tag}</span>;
                      })()}
                      <h3 className="announcement-small-title">{item.title}</h3>
                      {item.content ? (
                        <p className="announcement-small-desc">
                          {buildAnnouncementExcerpt(item.content, 140)}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <AnnouncementDetailModal
        isOpen={Boolean(activeAnnouncementForModal)}
        onClose={closeAnnouncement}
        announcement={activeAnnouncementForModal}
      />
    </div>
  );
}
