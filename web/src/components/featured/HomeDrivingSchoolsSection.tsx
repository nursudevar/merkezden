"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Car, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchInstitutionCategoryBySlug } from "@/lib/categoryHelpers";
import { getInstitutionDetailHref, resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";

const CATEGORY_LIST_HREF = "/surucu-kursu";
const CATEGORY_SLUG = "surucu-kursu";
const HOME_DRIVING_SCHOOL_LIMIT = 20;

const INSTITUTION_SELECT =
  "id, slug, source, institution_name, subheading, district, city, logo";

type HomeDrivingSchoolCardItem = {
  id: number;
  href: string;
  name: string;
  location: string;
  subheading: string;
  imageUrl: string;
  logoInitial: string;
};

function pickInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "S";
  return trimmed.charAt(0).toLocaleUpperCase("tr-TR") || "S";
}

function buildLocation(district?: string | null, city?: string | null): string {
  const parts = [district, city]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
}

function mapInstitutionRowToCardItem(
  row: Record<string, unknown>,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): HomeDrivingSchoolCardItem | null {
  const id = Number(row.id);
  const name = String(row.institution_name ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  if (!Number.isFinite(id) || id <= 0 || !name) return null;

  const location = buildLocation(
    row.district as string | null | undefined,
    row.city as string | null | undefined,
  );
  const imageUrl = resolveInstitutionLogoPublicUrl(supabase, String(row.logo ?? ""));

  return {
    id,
    name,
    href: slug ? getInstitutionDetailHref({ slug, source: String(row.source ?? "") }) : CATEGORY_LIST_HREF,
    location,
    subheading: String(row.subheading ?? "").trim() || "Ehliyet ve direksiyon eğitimi",
    imageUrl,
    logoInitial: pickInitial(name),
  };
}

export function HomeDrivingSchoolsSection() {
  const [items, setItems] = useState<HomeDrivingSchoolCardItem[]>([]);
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

  const scrollCards = useCallback(
    (direction: "left" | "right") => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const cards = Array.from(scroller.children).filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.classList.contains("home-driving-school-card"),
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
    },
    [updateScrollButtons],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const category = await fetchInstitutionCategoryBySlug(CATEGORY_SLUG);
        if (cancelled) return;

        if (!category?.id) {
          console.warn("[home-driving-schools] kategori bulunamadı:", { slug: CATEGORY_SLUG });
          setItems([]);
          return;
        }

        const { data, error } = await supabase
          .from("institutions")
          .select(INSTITUTION_SELECT)
          .eq("category_id", category.id)
          .ilike("city", "Ankara")
          .eq("is_approved", true)
          .not("institution_name", "is", null)
          .order("institution_name", { ascending: true })
          .limit(HOME_DRIVING_SCHOOL_LIMIT);

        if (cancelled) return;

        if (error || !Array.isArray(data)) {
          console.warn("[home-driving-schools] fetch error:", error?.message ?? "unknown");
          setItems([]);
          return;
        }

        const mapped = (data as Array<Record<string, unknown>>)
          .map((row) => mapInstitutionRowToCardItem(row, supabase))
          .filter((item): item is HomeDrivingSchoolCardItem => item !== null);

        setItems(mapped.slice(0, HOME_DRIVING_SCHOOL_LIMIT));
      } catch (fetchError) {
        console.warn("[home-driving-schools] unexpected error:", fetchError);
        if (!cancelled) {
          setItems([]);
        }
      }
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

  const visibleItems = useMemo(() => items, [items]);

  if (visibleItems.length === 0) return null;

  return (
    <section className="home-driving-schools-section" aria-labelledby="home-driving-schools-title">
      <div className="home-driving-schools-header">
        <div className="home-driving-schools-header-main">
          <div className="home-driving-schools-header-text">
            <h2 className="home-driving-schools-title" id="home-driving-schools-title">
              Sürücü Kursları
            </h2>
          </div>
          <div className="home-driving-schools-actions">
            {visibleItems.length > 1 ? (
              <div className="home-driving-schools-nav" aria-label="Surucu kurslari kaydirma butonlari">
                <button
                  type="button"
                  className="home-driving-schools-nav-btn"
                  aria-label="Sola kaydir"
                  onClick={() => scrollCards("left")}
                  disabled={!canScrollLeft}
                >
                  <ChevronLeft className="home-driving-schools-nav-icon" />
                </button>
                <button
                  type="button"
                  className="home-driving-schools-nav-btn"
                  aria-label="Saga kaydir"
                  onClick={() => scrollCards("right")}
                  disabled={!canScrollRight}
                >
                  <ChevronRight className="home-driving-schools-nav-icon" />
                </button>
              </div>
            ) : null}
            <Link href={CATEGORY_LIST_HREF} className="home-driving-schools-all-link">
              tümünü gör
            </Link>
          </div>
        </div>
      </div>

      <div className="home-driving-schools-track" ref={scrollerRef}>
        {visibleItems.map((item) => {
          const showImage = Boolean(item.imageUrl) && !brokenImageIds.has(item.id);
          return (
            <Link key={item.id} href={item.href} className="home-driving-school-card">
              <div className="home-driving-school-card-banner" aria-hidden>
                <div className="home-driving-school-card-banner-glow" />
                <Car className="home-driving-school-card-banner-icon" />
              </div>

              {showImage ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="home-driving-school-card-logo home-driving-school-card-logo--image"
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
                <span className="home-driving-school-card-logo-fallback" aria-hidden>
                  {item.logoInitial}
                </span>
              )}

              <div className="home-driving-school-card-body">
                <h3 className="home-driving-school-card-name">{item.name}</h3>
                {item.location ? (
                  <p className="home-driving-school-card-location">
                    <MapPin className="home-driving-school-card-location-icon" aria-hidden />
                    <span>{item.location}</span>
                  </p>
                ) : null}
                {item.subheading ? (
                  <p className="home-driving-school-card-subheading">{item.subheading}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
