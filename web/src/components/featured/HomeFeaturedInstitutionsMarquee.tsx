"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FeaturedInstitution } from "./featuredInstitutionTypes";
import { mapInstitutionRowToFeatured } from "./mapInstitutionRowToFeatured";
import { FeaturedInstitutionCardLink } from "./FeaturedInstitutionCardLink";

export function HomeFeaturedInstitutionsMarquee({
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  isAuthenticated,
  mode = "home",
  viewAllHref = "/one-cikanlar",
}: {
  onToggleFavorite: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds: Set<number>;
  favoritesEnabled: boolean;
  favoriteActionLoadingIds: Set<number>;
  isAuthenticated: boolean;
  /** `home`: başlık + ana sayfa bağlantısı; `standalone`: sadece kayan şerit (öne çıkanlar sayfası). */
  mode?: "home" | "standalone";
  viewAllHref?: string;
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
        .select(
          "id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))",
        )
        .eq("institution_name", "Deneme")
        .maybeSingle();

      if (cancelled || error || !row) return;

      const mapped = mapInstitutionRowToFeatured(supabase, row as Record<string, unknown>);
      if (mapped) setFeaturedPinnedDeneme(mapped);
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
        .select(
          "id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))",
        )
        .not("institution_name", "is", null)
        .limit(180);

      if (cancelled || error || !data) return;

      const dynamicItems = (data as Array<Record<string, unknown>>)
        .map((row) => mapInstitutionRowToFeatured(supabase, row))
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

  const featuredList = featuredPinnedDeneme
    ? [
        featuredPinnedDeneme,
        ...shuffledFeaturedInstitutions.filter((i) => i.id !== featuredPinnedDeneme.id).slice(0, 7),
      ]
    : shuffledFeaturedInstitutions;
  const marqueeList = [...featuredList, ...featuredList];

  return (
    <section className="featured-institutions-section">
      {mode === "home" ? (
        <div className="featured-institutions-header">
          <div className="featured-institutions-header-left">
            <h2 className="featured-institutions-title">Öne Çıkanlar</h2>
          </div>
        </div>
      ) : null}
      <div className="featured-institutions-slider">
        <div className="featured-institutions-scroller">
          {marqueeList.map((institution, index) => {
            const isDuplicate = index >= featuredList.length;
            const key = `${institution.id}-${index}`;
            const isFavorite = favoriteIds.has(institution.id);
            const isActionLoading = favoriteActionLoadingIds.has(institution.id);
            const canRenderImage = Boolean(institution.imageUrl) && !brokenFeaturedImageIds.has(institution.id);
            return (
              <FeaturedInstitutionCardLink
                key={key}
                institution={institution}
                isDuplicate={isDuplicate}
                isFavorite={isFavorite}
                isActionLoading={isActionLoading}
                favoritesEnabled={favoritesEnabled}
                isAuthenticated={isAuthenticated}
                canRenderImage={canRenderImage}
                onToggleFavorite={onToggleFavorite}
                onImageError={() =>
                  setBrokenFeaturedImageIds((prev) => {
                    const next = new Set(prev);
                    next.add(institution.id);
                    return next;
                  })
                }
              />
            );
          })}
        </div>
      </div>
      {mode === "home" ? (
        <div className="featured-institutions-view-all">
          <Link href={viewAllHref}>Tüm Kurumları Görüntüle →</Link>
        </div>
      ) : null}
    </section>
  );
}
