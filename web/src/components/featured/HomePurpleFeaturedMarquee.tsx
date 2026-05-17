"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";

const LIST_SIZE = 20;
const FETCH_LIMIT = 240;
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
  const logoPath = String(row.logo ?? "").trim();
  const imageUrl = logoPath
    ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl
    : "";

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();

      const [denemeResult, listResult] = await Promise.all([
        supabase
          .from("institutions")
          .select("id, slug, source, institution_name, city, district, logo")
          .eq("institution_name", "Deneme")
          .maybeSingle(),
        supabase
          .from("institutions")
          .select("id, slug, source, institution_name, city, district, logo")
          .not("institution_name", "is", null)
          .limit(FETCH_LIMIT),
      ]);

      if (cancelled) return;

      const pinnedDeneme = denemeResult.data
        ? mapRowToPurpleCard(supabase, denemeResult.data as Record<string, unknown>)
        : null;

      if (listResult.error || !listResult.data) {
        if (pinnedDeneme) setCards([pinnedDeneme]);
        return;
      }

      const mapped = (listResult.data as Array<Record<string, unknown>>)
        .map((row) => mapRowToPurpleCard(supabase, row))
        .filter((item): item is PurpleFeaturedCard => item !== null);

      if (mapped.length === 0) {
        if (pinnedDeneme) setCards([pinnedDeneme]);
        return;
      }

      const others = shuffleItems(
        pinnedDeneme ? mapped.filter((item) => item.id !== pinnedDeneme.id) : mapped,
      ).slice(0, pinnedDeneme ? LIST_SIZE - 1 : LIST_SIZE);

      const list = pinnedDeneme ? [pinnedDeneme, ...others] : others;
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

  if (cards.length === 0) return null;

  const marqueeList = [...cards, ...cards];

  return (
    <div className="purple-featured-slider">
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
          );
        })}
      </div>
    </div>
  );
}
