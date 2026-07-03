"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PUBLIC_INSTRUCTORS_TABLE,
  fetchPublicInstructorsListClient,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";

const HOME_INSTRUCTOR_LIMIT = 6;
const HOME_INSTRUCTOR_TEST_MIN_COUNT = 9;

type HomeInstructorCardItem = {
  id: number;
  href: string;
  displayName: string;
  branch: string;
  school: string;
  imageUrl: string;
  priceLabel: string;
};

const TEMP_HOME_INSTRUCTORS: HomeInstructorCardItem[] = [
  {
    id: -101,
    href: "/egitmenler/test-matematik-egitmeni",
    displayName: "Ayse Demir",
    branch: "Matematik",
    school: "ODTU Matematik Ogretmenligi",
    imageUrl: "",
    priceLabel: "1000-5000 TL",
  },
  {
    id: -102,
    href: "/egitmenler/test-ingilizce-egitmeni",
    displayName: "Mert Kaya",
    branch: "Ingilizce",
    school: "Hacettepe Ingiliz Dili ve Edebiyati",
    imageUrl: "",
    priceLabel: "5000-10000 TL",
  },
  {
    id: -103,
    href: "/egitmenler/test-fizik-egitmeni",
    displayName: "Zeynep Arslan",
    branch: "Fizik",
    school: "Bilkent Fizik",
    imageUrl: "",
    priceLabel: "1000-5000 TL",
  },
  {
    id: -104,
    href: "/egitmenler/test-kimya-egitmeni",
    displayName: "Emre Sahin",
    branch: "Kimya",
    school: "Gazi Kimya Ogretmenligi",
    imageUrl: "",
    priceLabel: "5000-10000 TL",
  },
  {
    id: -105,
    href: "/egitmenler/test-turkce-egitmeni",
    displayName: "Elif Yildiz",
    branch: "Turkce",
    school: "Ankara Universitesi Turk Dili",
    imageUrl: "",
    priceLabel: "0-1000 TL",
  },
  {
    id: -106,
    href: "/egitmenler/test-biyoloji-egitmeni",
    displayName: "Can Aydin",
    branch: "Biyoloji",
    school: "Ege Biyoloji",
    imageUrl: "",
    priceLabel: "10000-50000 TL",
  },
];

function withTemporaryInstructorItems(items: HomeInstructorCardItem[]): HomeInstructorCardItem[] {
  if (items.length >= HOME_INSTRUCTOR_TEST_MIN_COUNT) return items;
  return [...items, ...TEMP_HOME_INSTRUCTORS].slice(0, HOME_INSTRUCTOR_TEST_MIN_COUNT);
}

function formatInstructorPriceRange(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/\btl\b/i.test(raw)) return raw;
  return `${raw} TL`;
}

function formatInstructorPrice(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${new Intl.NumberFormat("tr-TR").format(value)}₺/saat`;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/[₺]|tl|\/\s*saat/i.test(raw)) return raw;

  const numeric = Number(raw.replace(/[^\d.,]/g, "").replace(",", "."));
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${new Intl.NumberFormat("tr-TR").format(numeric)}₺/saat`;
  }

  return raw;
}

function extractInstructorPrice(row: Record<string, unknown>): string {
  const priceRange = formatInstructorPriceRange(row.price_range);
  if (priceRange) return priceRange;

  const candidates = [
    row.price,
    row.hourly_price,
    row.lesson_price,
    row.price_text,
  ];

  for (const candidate of candidates) {
    const formatted = formatInstructorPrice(candidate);
    if (formatted) return formatted;
  }

  return "";
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
    branch: String(row.branch ?? "").trim(),
    school: String(row.school ?? "").trim(),
    imageUrl: resolvePublicInstructorProfilePictureUrl(
      String(row.profile_picture ?? "").trim(),
      supabase,
    ),
    priceLabel: extractInstructorPrice(row),
  };
}

export function HomeIndividualInstructorsSection() {
  const [items, setItems] = useState<HomeInstructorCardItem[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const updateScrollButtons = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    setCanScrollLeft(scroller.scrollLeft > 4);
    setCanScrollRight(maxScrollLeft - scroller.scrollLeft > 4);
  }, []);

  const scrollCards = useCallback((direction: "left" | "right") => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const cards = Array.from(scroller.children).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.classList.contains("home-individual-instructor-card"),
    );
    if (cards.length === 0) return;

    const currentLeft = scroller.scrollLeft;
    const tolerance = 12;
    const scrollerRect = scroller.getBoundingClientRect();
    const targets = cards.map((card) =>
      Math.max(0, currentLeft + (card.getBoundingClientRect().left - scrollerRect.left) - 4),
    );

    const targetLeft =
      direction === "right"
        ? targets.find((target) => target > currentLeft + tolerance) ?? targets[targets.length - 1]
        : [...targets].reverse().find((target) => target < currentLeft - tolerance) ?? targets[0];

    scroller.scrollTo({
      left: targetLeft,
      behavior: "smooth",
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => updateScrollButtons());
    });
  }, [updateScrollButtons]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from(PUBLIC_INSTRUCTORS_TABLE)
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("id", { ascending: false })
        .limit(HOME_INSTRUCTOR_LIMIT);

      if (cancelled) return;

      if (error || !Array.isArray(data)) {
        const fallback = await fetchPublicInstructorsListClient({
          limit: HOME_INSTRUCTOR_LIMIT,
          supabase,
        });
        if (cancelled) return;
        const mappedFallback = fallback.rows
          .map((row) =>
            mapInstructorRowToCardItem(
              row as PublicInstructorRow & Record<string, unknown>,
              supabase,
            ),
          )
          .filter((item): item is HomeInstructorCardItem => item !== null);
        setItems(withTemporaryInstructorItems(mappedFallback));
        return;
      }

      const mapped = (data as Array<Record<string, unknown>>)
        .map((row) =>
          mapInstructorRowToCardItem(
            row as PublicInstructorRow & Record<string, unknown>,
            supabase,
          ),
        )
        .filter((item): item is HomeInstructorCardItem => item !== null);

      setItems(withTemporaryInstructorItems(mapped));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => updateScrollButtons());
    const scroller = scrollerRef.current;
    if (!scroller) {
      return () => window.cancelAnimationFrame(raf);
    }

    const handleScroll = () => updateScrollButtons();
    const handleResize = () => updateScrollButtons();
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateScrollButtons()) : null;

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    resizeObserver?.observe(scroller);

    return () => {
      window.cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [items, updateScrollButtons]);

  const visibleItems = useMemo(() => items.slice(0, Math.max(HOME_INSTRUCTOR_LIMIT, items.length)), [items]);

  if (visibleItems.length === 0) return null;

  return (
    <section className="home-individual-instructors-section" aria-labelledby="home-individual-instructors-title">
      <div className="home-individual-instructors-header">
        <div className="home-individual-instructors-header-main">
          <div className="home-individual-instructors-header-text">
            <h2 className="home-individual-instructors-title" id="home-individual-instructors-title">
              Özel Ders / Eğitmenler
            </h2>
          </div>
          <div className="home-individual-instructors-actions">
            {visibleItems.length > 1 ? (
              <div className="home-individual-instructors-nav" aria-label="Bireysel egitmenler kaydirma butonlari">
                <button
                  type="button"
                  className="home-individual-instructors-nav-btn"
                  aria-label="Sola kaydir"
                  onClick={() => scrollCards("left")}
                  disabled={!canScrollLeft}
                >
                  <ChevronLeft className="home-individual-instructors-nav-icon" />
                </button>
                <button
                  type="button"
                  className="home-individual-instructors-nav-btn"
                  aria-label="Saga kaydir"
                  onClick={() => scrollCards("right")}
                  disabled={!canScrollRight}
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

      <div className="home-individual-instructors-grid" ref={scrollerRef}>
        {visibleItems.map((item) => {
          const showImage = Boolean(item.imageUrl) && !brokenImageIds.has(item.id);
          const specialty = item.branch || item.school;
          return (
            <Link key={item.id} href={item.href} className="home-individual-instructor-card">
              <div className="home-individual-instructor-card-media">
                {showImage ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.displayName}
                    fill
                    className="home-individual-instructor-card-image"
                    sizes="(max-width: 767px) 120px, (max-width: 1023px) 145px, 155px"
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
                  <div className="home-individual-instructor-card-fallback" aria-hidden>
                    <GraduationCap size={34} />
                  </div>
                )}
              </div>

              <div className="home-individual-instructor-card-body">
                <h3 className="home-individual-instructor-card-name">{item.displayName}</h3>
                {specialty ? (
                  <p className="home-individual-instructor-card-school">{specialty}</p>
                ) : null}
                {item.priceLabel ? (
                  <p className="home-individual-instructor-card-price">{item.priceLabel}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
