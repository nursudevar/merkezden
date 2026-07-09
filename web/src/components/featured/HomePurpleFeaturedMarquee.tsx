"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchInstitutionCategoryBySlug } from "@/lib/categoryHelpers";
import { getInstitutionDetailHref, resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";

const LIST_SIZE = 20;
const FETCH_LIMIT = 240;
const DRIVING_SCHOOL_CATEGORY_SLUG = "surucu-kursu";
const PURPLE_BADGES = ["ÖNE ÇIKAN", "POPÜLER", "TAVSİYE", "YENİ"];

type PurpleFeaturedCard = {
  id: number;
  badge: string;
  title: string;
  location: string;
  cta: string;
  imageUrl: string;
  slug: string;
  source: string;
};

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function mapRowToPurpleCard(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  row: Record<string, unknown>,
): PurpleFeaturedCard | null {
  const id = Number(row.id);
  const title = String(row.institution_name ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  if (!Number.isFinite(id) || !title || !slug) return null;

  const district = String(row.district ?? "").trim();
  const city = String(row.city ?? "").trim();
  const location = [district, city].filter(Boolean).join(", ") || "Konum bilgisi yok";
  const imageUrl = resolveInstitutionLogoPublicUrl(supabase, String(row.logo ?? ""));

  return {
    id,
    badge: "YENİ",
    title,
    location,
    cta: "Detayları Gör",
    imageUrl,
    slug,
    source: String(row.source ?? "").trim(),
  };
}

export function HomePurpleFeaturedMarquee() {
  const [cards, setCards] = useState<PurpleFeaturedCard[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());
  const sliderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const category = await fetchInstitutionCategoryBySlug(DRIVING_SCHOOL_CATEGORY_SLUG);

      if (cancelled) return;

      if (!category?.id) {
        console.warn("[purple-featured] sürücü kursu kategorisi bulunamadı:", {
          slug: DRIVING_SCHOOL_CATEGORY_SLUG,
        });
        setCards([]);
        return;
      }

      const { data, error } = await supabase
        .from("institutions")
        .select("id, slug, source, institution_name, city, district, logo")
        .eq("category_id", category.id)
        .ilike("city", "Ankara")
        .not("institution_name", "is", null)
        .eq("is_approved", true)
        .order("institution_name", { ascending: true })
        .limit(FETCH_LIMIT);

      if (cancelled) return;

      if (error || !data?.length) {
        if (error) {
          console.warn("[purple-featured] kurum listesi hatası:", error.message);
        }
        setCards([]);
        return;
      }

      const mapped = (data as Array<Record<string, unknown>>)
        .map((row) => mapRowToPurpleCard(supabase, row))
        .filter((item): item is PurpleFeaturedCard => item !== null);

      if (mapped.length === 0) {
        setCards([]);
        return;
      }

      const list = shuffleItems(mapped).slice(0, LIST_SIZE);
      setCards(
        list.map((card, index) => ({
          ...card,
          badge: PURPLE_BADGES[index % PURPLE_BADGES.length] ?? "YENİ",
        })),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const updateCardWidth = () => {
      const containerWidth = slider.getBoundingClientRect().width;
      const useTwoColumns = window.matchMedia("(max-width: 1180px)").matches;
      const columns = useTwoColumns ? 2 : 4;
      const gap = useTwoColumns ? 12 : 10;
      const cardWidth = (containerWidth - gap * (columns - 1)) / columns;
      slider.style.setProperty("--purple-featured-card-width", `${Math.max(0, cardWidth)}px`);
    };

    updateCardWidth();
    const resizeObserver = new ResizeObserver(updateCardWidth);
    resizeObserver.observe(slider);
    window.addEventListener("resize", updateCardWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCardWidth);
    };
  }, []);

  if (cards.length === 0) return null;

  const marqueeList = [...cards, ...cards];

  return (
    <div className="purple-featured-slider" ref={sliderRef}>
      <div className="purple-featured-scroller">
        {marqueeList.map((card, index) => {
          const isDuplicate = index >= cards.length;
          const canRenderImage = Boolean(card.imageUrl) && !brokenImageIds.has(card.id);
          return (
            <Link
              key={`${card.id}-${index}`}
              href={getInstitutionDetailHref({ slug: card.slug, source: card.source })}
              className="purple-featured-card"
              aria-label={card.title}
              aria-hidden={isDuplicate ? true : undefined}
              tabIndex={isDuplicate ? -1 : undefined}
            >
              <div className="purple-featured-card-media">
                {canRenderImage ? (
                  <img
                    className="purple-featured-card-img"
                    src={card.imageUrl}
                    alt=""
                    onError={() =>
                      setBrokenImageIds((prev) => {
                        const next = new Set(prev);
                        next.add(card.id);
                        return next;
                      })
                    }
                  />
                ) : (
                  <div className="purple-featured-card-img purple-featured-card-img--empty" aria-hidden>
                    <Building2 size={32} strokeWidth={1.25} />
                  </div>
                )}
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
          );
        })}
      </div>
    </div>
  );
}
