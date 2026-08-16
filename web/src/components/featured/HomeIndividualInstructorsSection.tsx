"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BookMarked,
  BookOpen,
  Brain,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Heart,
  Languages,
  Laptop,
  Library,
  Lightbulb,
  MessageCircle,
  NotebookPen,
  Pencil,
  Presentation,
  School,
  type LucideProps,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchPublicInstructorsListClient,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";

const HOME_INSTRUCTOR_LIMIT = 12;
const HOME_INSTRUCTOR_TEST_MIN_COUNT = 12;
/** Duyurular `.duyurular-track--animated` ile aynı döngü süresi */
const HOME_INSTRUCTORS_MARQUEE_MS = 48_000;

type HomeInstructorCardItem = {
  id: number;
  href: string;
  displayName: string;
  subtitle: string;
  location: string;
  imageUrl: string;
  initials: string;
};

const TEMP_HOME_INSTRUCTORS: HomeInstructorCardItem[] = [
  {
    id: -101,
    href: "/egitmenler/test-matematik-egitmeni",
    displayName: "Ayşe Demir",
    subtitle: "Matematik",
    location: "Çankaya, Ankara",
    imageUrl: "",
    initials: "AD",
  },
  {
    id: -102,
    href: "/egitmenler/test-ingilizce-egitmeni",
    displayName: "Mert Kaya",
    subtitle: "İngilizce",
    location: "Yenimahalle, Ankara",
    imageUrl: "",
    initials: "MK",
  },
  {
    id: -103,
    href: "/egitmenler/test-fizik-egitmeni",
    displayName: "Zeynep Arslan",
    subtitle: "Fizik",
    location: "Çankaya, Ankara",
    imageUrl: "",
    initials: "ZA",
  },
  {
    id: -104,
    href: "/egitmenler/test-kimya-egitmeni",
    displayName: "Emre Şahin",
    subtitle: "Kimya",
    location: "Keçiören, Ankara",
    imageUrl: "",
    initials: "EŞ",
  },
  {
    id: -105,
    href: "/egitmenler/test-turkce-egitmeni",
    displayName: "Elif Yıldız",
    subtitle: "Türkçe",
    location: "Etimesgut, Ankara",
    imageUrl: "",
    initials: "EY",
  },
  {
    id: -106,
    href: "/egitmenler/test-biyoloji-egitmeni",
    displayName: "Can Aydın",
    subtitle: "Biyoloji",
    location: "Mamak, Ankara",
    imageUrl: "",
    initials: "CA",
  },
];

function withTemporaryInstructorItems(items: HomeInstructorCardItem[]): HomeInstructorCardItem[] {
  if (items.length >= HOME_INSTRUCTOR_TEST_MIN_COUNT) return items;
  return [...items, ...TEMP_HOME_INSTRUCTORS].slice(0, HOME_INSTRUCTOR_TEST_MIN_COUNT);
}

type InstructorThemeIcon = ComponentType<LucideProps>;

const INSTRUCTOR_THEME_ICONS: InstructorThemeIcon[] = [
  BookOpen,
  GraduationCap,
  NotebookPen,
  Pencil,
  Library,
  School,
  Languages,
  Calculator,
  MessageCircle,
  Presentation,
  Lightbulb,
  Brain,
  BookMarked,
  FileText,
  Laptop,
];

function pickInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "E";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
}

function buildLocation(ilceAd?: string | null, ilAd?: string | null): string {
  const parts = [ilceAd, ilAd]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.join(", ");
}

function buildSubtitle(row: PublicInstructorRow & Record<string, unknown>): string {
  const candidates = [row.branch, row.school];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }
  return "";
}

function pickInstructorThemeIcon(seed: string | number): InstructorThemeIcon {
  const text = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return INSTRUCTOR_THEME_ICONS[hash % INSTRUCTOR_THEME_ICONS.length] ?? BookOpen;
}

function mapInstructorRowToCardItem(
  row: PublicInstructorRow & Record<string, unknown>,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): HomeInstructorCardItem | null {
  const displayName = publicInstructorDisplayName(row);
  const hrefKey = String(row.slug ?? row.id ?? "").trim();
  if (!displayName || !hrefKey || !row.id) return null;

  return {
    id: Number(row.id),
    href: `/egitmenler/${encodeURIComponent(hrefKey)}`,
    displayName,
    subtitle: buildSubtitle(row),
    location: buildLocation(row.locationIlceAd, row.locationIlAd),
    imageUrl: resolvePublicInstructorProfilePictureUrl(
      String(row.profile_picture ?? "").trim(),
      supabase,
    ),
    initials: pickInitials(displayName),
  };
}

function measureInstructorStepPx(track: HTMLElement): number {
  const item = track.querySelector<HTMLElement>(".home-individual-instructor-item");
  if (!item) return 0;
  const styles = getComputedStyle(track);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
  return item.getBoundingClientRect().width + gap;
}

function measureInstructorLoopPx(track: HTMLElement, itemCount: number): number {
  const items = track.querySelectorAll<HTMLElement>(".home-individual-instructor-item");
  if (itemCount > 0 && items.length >= itemCount + 1) {
    return items[itemCount].offsetLeft - items[0].offsetLeft;
  }
  return measureInstructorStepPx(track) * Math.max(itemCount, 0);
}

export function HomeIndividualInstructorsSection({
  onToggleFavorite,
  favoriteInstructorIds,
  favoritesEnabled = false,
  favoriteInstructorActionLoadingIds,
  isAuthenticated = false,
}: {
  onToggleFavorite: (instructorId: number, e: React.MouseEvent) => void;
  favoriteInstructorIds: Set<number>;
  favoritesEnabled?: boolean;
  favoriteInstructorActionLoadingIds: Set<number>;
  isAuthenticated?: boolean;
}) {
  const [items, setItems] = useState<HomeInstructorCardItem[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());
  const [isMarqueeMounted, setIsMarqueeMounted] = useState(false);
  const [manualNudgePx, setManualNudgePx] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const syncMarqueeDistance = useCallback((itemCount: number) => {
    const track = trackRef.current;
    if (!track || itemCount <= 1) return;
    const loopPx = measureInstructorLoopPx(track, itemCount);
    if (loopPx > 0) {
      track.style.setProperty("--home-instructors-marquee-distance", `${loopPx}px`);
    }
  }, []);

  const scrollCards = useCallback((direction: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;

    const step = measureInstructorStepPx(track);
    const itemCount = Math.floor(
      track.querySelectorAll(".home-individual-instructor-item").length / 2,
    );
    const loopPx = measureInstructorLoopPx(track, itemCount);
    if (step <= 0 || loopPx <= 0) return;

    setManualNudgePx((prev) => {
      let next = prev + (direction === "right" ? step : -step);
      while (next <= -loopPx) next += loopPx;
      while (next >= loopPx) next -= loopPx;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const fallback = await fetchPublicInstructorsListClient({
        limit: HOME_INSTRUCTOR_LIMIT,
        supabase,
      });
      if (cancelled) return;
      const rows = fallback.rows as Array<PublicInstructorRow & Record<string, unknown>>;

      const mapped = rows
        .map((row) => mapInstructorRowToCardItem(row, supabase))
        .filter((item): item is HomeInstructorCardItem => item !== null)
        .slice(0, HOME_INSTRUCTOR_LIMIT);

      setItems(withTemporaryInstructorItems(mapped));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = useMemo(() => items.slice(0, HOME_INSTRUCTOR_LIMIT), [items]);
  const marqueeItems = useMemo(
    () => (visibleItems.length > 1 ? [...visibleItems, ...visibleItems] : visibleItems),
    [visibleItems],
  );

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setIsMarqueeMounted(true);
      syncMarqueeDistance(visibleItems.length);
    });

    const track = trackRef.current;
    const slider = sliderRef.current;
    if (!track) {
      return () => window.cancelAnimationFrame(raf);
    }

    const handleResize = () => syncMarqueeDistance(visibleItems.length);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncMarqueeDistance(visibleItems.length))
        : null;

    window.addEventListener("resize", handleResize);
    resizeObserver?.observe(track);
    if (slider) resizeObserver?.observe(slider);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [visibleItems.length, syncMarqueeDistance, marqueeItems.length]);

  if (visibleItems.length === 0) return null;

  const trackAnimated =
    isMarqueeMounted && visibleItems.length > 1
      ? " home-individual-instructors-track--animated"
      : "";

  const trackStyle = {
    "--home-instructors-marquee-duration": `${HOME_INSTRUCTORS_MARQUEE_MS}ms`,
  } as CSSProperties;

  return (
    <section
      className="home-individual-instructors-section"
      aria-labelledby="home-individual-instructors-title"
    >
      <div className="home-individual-instructors-header">
        <div className="home-individual-instructors-header-main">
          <div className="home-individual-instructors-header-text">
            <h2
              className="home-individual-instructors-title"
              id="home-individual-instructors-title"
            >
              Özel Ders / Eğitmenler
            </h2>
          </div>
          <div className="home-individual-instructors-actions">
            {visibleItems.length > 1 ? (
              <div
                className="home-individual-instructors-nav"
                aria-label="Bireysel egitmenler kaydirma butonlari"
              >
                <button
                  type="button"
                  className="home-individual-instructors-nav-btn"
                  aria-label="Sola kaydir"
                  onClick={() => scrollCards("left")}
                >
                  <ChevronLeft className="home-individual-instructors-nav-icon" />
                </button>
                <button
                  type="button"
                  className="home-individual-instructors-nav-btn"
                  aria-label="Saga kaydir"
                  onClick={() => scrollCards("right")}
                >
                  <ChevronRight className="home-individual-instructors-nav-icon" />
                </button>
              </div>
            ) : null}
            <Link href="/egitmenler" className="home-individual-instructors-all-link">
              tümünü gör
            </Link>
          </div>
        </div>
      </div>

      <div className="home-individual-instructors-grid" ref={sliderRef}>
        <div
          className="home-individual-instructors-nudge"
          style={{ transform: `translateX(${-manualNudgePx}px)` }}
        >
          <div
            className={`home-individual-instructors-track${trackAnimated}`}
            ref={trackRef}
            style={trackStyle}
          >
            {marqueeItems.map((item, index) => {
              const isDuplicate = index >= visibleItems.length;
              const showImage = Boolean(item.imageUrl) && !brokenImageIds.has(item.id);
              const ThemeIcon = pickInstructorThemeIcon(
                Number.isFinite(item.id) && item.id > 0 ? item.id : item.displayName || index,
              );

              return (
                <Link
                  key={`${item.id}-${index}`}
                  href={item.href}
                  className="home-individual-instructor-item"
                  tabIndex={isDuplicate ? -1 : undefined}
                  aria-hidden={isDuplicate ? true : undefined}
                >
                  <div className="home-individual-instructor-avatar-wrap">
                    <div className="home-individual-instructor-avatar-border">
                      <div className="home-individual-instructor-avatar-inner">
                        {showImage ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.displayName}
                            fill
                            className="home-individual-instructor-avatar-image"
                            sizes="(max-width: 767px) 112px, 136px"
                            unoptimized
                            onError={() =>
                              setBrokenImageIds((prev) => {
                                const next = new Set(prev);
                                next.add(item.id);
                                return next;
                              })
                            }
                          />
                        ) : (
                          <div
                            className="home-individual-instructor-avatar-fallback"
                            aria-hidden
                          >
                            {item.initials}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="home-individual-instructor-avatar-actions">
                      <button
                        type="button"
                        className="home-individual-instructor-favorite"
                        aria-label={
                          favoriteInstructorIds.has(item.id)
                            ? "Favorilerden kaldır"
                            : "Favorilere ekle"
                        }
                        tabIndex={isDuplicate ? -1 : undefined}
                        disabled={
                          favoriteInstructorActionLoadingIds.has(item.id) ||
                          (isAuthenticated && !favoritesEnabled)
                        }
                        onClick={(e) => {
                          onToggleFavorite(item.id, e);
                        }}
                      >
                        <Heart
                          size={16}
                          strokeWidth={2}
                          className={
                            favoriteInstructorIds.has(item.id)
                              ? "home-individual-instructor-favorite-icon home-individual-instructor-favorite-icon--active"
                              : "home-individual-instructor-favorite-icon"
                          }
                        />
                      </button>
                      <span className="home-individual-instructor-icon" aria-hidden>
                        <ThemeIcon size={18} strokeWidth={2} />
                      </span>
                    </div>
                  </div>

                  <div className="home-individual-instructor-name">{item.displayName}</div>
                  {item.subtitle ? (
                    <div className="home-individual-instructor-subtitle">{item.subtitle}</div>
                  ) : null}
                  {item.location ? (
                    <div className="home-individual-instructor-location">{item.location}</div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
