"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, ImageOff } from "lucide-react";
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
  buildCategoryTabNames,
  fetchActiveInstitutionCategories,
} from "@/lib/categoryHelpers";
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
const CATEGORY_TAB_FIRST_ROW_COUNT = 7;

function normalizeCategoryName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryMatches(itemCategory: string, selectedCategory: string): boolean {
  const itemKey = normalizeCategoryName(itemCategory);
  const selectedKey = normalizeCategoryName(selectedCategory);
  if (itemKey === selectedKey) return true;
  if (selectedKey === "kurs sinava hazirlik") {
    return itemKey === "kurs sinav" || itemKey === "kurs ve sinav" || itemKey === "sinava hazirlik";
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

function AnnouncementCategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
}: {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  const categoryRows = [
    categories.slice(0, CATEGORY_TAB_FIRST_ROW_COUNT),
    categories.slice(CATEGORY_TAB_FIRST_ROW_COUNT),
  ];

  return (
    <div className="blog-category-tabs">
      {categoryRows.map((row, rowIndex) => (
        <div key={`announcement-category-row-${rowIndex}`} className="blog-category-tab-row">
          {row.map((category) => (
            <button
              key={category}
              type="button"
              className={`blog-category-tab ${selectedCategory === category ? "blog-category-tab--active" : ""}`}
              onClick={() => onCategoryChange(category)}
              aria-pressed={selectedCategory === category}
            >
              {category}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Hepsi");
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementItem | null>(null);
  const [categories, setCategories] = useState<string[]>([...ANNOUNCEMENT_CATEGORY_TABS_FALLBACK]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const rows = await fetchActiveInstitutionCategories();
      if (cancelled) return;
      setCategories(buildCategoryTabNames(rows, ANNOUNCEMENT_CATEGORY_TABS_FALLBACK));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (selectedCategory === "Hepsi") return announcements;
    return announcements.filter((item) => categoryMatches(item.categoryName, selectedCategory));
  }, [announcements, selectedCategory]);

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
        }
      : null;

  return (
    <div className="page-container">
      <HeaderClientWrapper />

      <main className="main-content">
        <div className="announcements-page">
          <section className="blog-listing-header">
            <h1 className="blog-listing-title">Duyurular</h1>
            <p className="blog-listing-subtitle">
              Platformdaki en yeni gelişmeleri, kampanyaları ve bilgilendirmeleri buradan takip edin.
            </p>
          </section>

          <AnnouncementCategoryTabs
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />

          {loading ? (
            <section className="announcements-section" aria-label="Duyuru listesi yükleniyor">
              <p>Yükleniyor...</p>
            </section>
          ) : error ? (
            <section className="announcements-section" aria-label="Duyuru listesi hatası">
              <p>{error}</p>
            </section>
          ) : !featured ? (
            <section className="announcements-section" aria-label="Duyuru listesi boş">
              <p>Henüz duyuru bulunmuyor.</p>
            </section>
          ) : (
            <>
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
                        {featured.ownerCity ? (
                          <span className="announcement-meta-item">
                            <MapPin className="announcement-meta-icon" />
                            {featured.ownerCity}
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

            {filteredAnnouncements.length > 0 ? (
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
            </>
          )}
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
