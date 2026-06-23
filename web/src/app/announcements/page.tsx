"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, ImageOff } from "lucide-react";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/blog.scss";
import "@/styles/pages/announcements.scss";

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string | null;
  institutionName: string;
  institutionCity: string;
  categoryName: string;
  linkUrl: string | null;
};

const ANNOUNCEMENT_CATEGORY_TABS = [
  "Hepsi",
  "Okul",
  "Kurs & Sınava Hazırlık",
  "Spor",
  "Sanat",
  "Yabancı Dil",
  "Kişisel Gelişim",
  "Mesleki Eğitim",
  "Özel Eğitim",
  "Patili Dostlar",
];

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
  return (
    <div className="blog-category-tabs">
      {categories.map((category) => (
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
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Hepsi");
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("announcements")
        .select(
          "id, title, content, announcement_image_url, link_url, created_at, institution:institutions(institution_name, city, institution_type:institution_types(category:institution_categories(name)))"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("[announcements][list] load error", error);
        setError("Duyurular yüklenemedi.");
        setAnnouncements([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Array<{
        id: string | number;
        title: string | null;
        content: string | null;
        announcement_image_url: string | null;
        link_url: string | null;
        created_at: string | null;
        institution:
          | {
              institution_name: string | null;
              city: string | null;
              institution_type?:
                | { category?: { name?: string | null } | Array<{ name?: string | null }> | null }
                | Array<{ category?: { name?: string | null } | Array<{ name?: string | null }> | null }>
                | null;
            }
          | Array<{
              institution_name: string | null;
              city: string | null;
              institution_type?:
                | { category?: { name?: string | null } | Array<{ name?: string | null }> | null }
                | Array<{ category?: { name?: string | null } | Array<{ name?: string | null }> | null }>
                | null;
            }>
          | null;
      }>;

      const mapped: AnnouncementItem[] = rows
        .map((r) => {
          const inst = Array.isArray(r.institution) ? r.institution[0] ?? null : r.institution ?? null;
          const typeJoin = inst?.institution_type;
          const typeRow = Array.isArray(typeJoin) ? typeJoin[0] : typeJoin;
          const categoryJoin = typeRow?.category;
          const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
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
            categoryName: String(categoryRow?.name ?? "").trim(),
            linkUrl: r.link_url ? String(r.link_url).trim() || null : null,
          } as AnnouncementItem;
        })
        .filter((item): item is AnnouncementItem => item !== null);

      setAnnouncements(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => ANNOUNCEMENT_CATEGORY_TABS, []);
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
          institutionName: activeAnnouncement.institutionName,
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
                        {featured.institutionCity ? (
                          <span className="announcement-meta-item">
                            <MapPin className="announcement-meta-icon" />
                            {featured.institutionCity}
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
                          {item.institutionName ? (
                            <div className="announcement-small-kicker">
                              {item.institutionName.toLocaleUpperCase("tr-TR")}
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
                        {item.institutionName ? (
                          <div className="announcement-small-kicker">
                            {item.institutionName.toLocaleUpperCase("tr-TR")}
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
