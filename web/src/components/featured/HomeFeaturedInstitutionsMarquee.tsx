"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FeaturedInstitution } from "./featuredInstitutionTypes";
import { fetchHomeFeaturedPinnedRows } from "./homeFeaturedPinned";
import { mapInstitutionRowToFeatured } from "./mapInstitutionRowToFeatured";
import { FeaturedInstitutionCardLink } from "./FeaturedInstitutionCardLink";

const MARQUEE_FEATURED_COUNT = 8;

const MARQUEE_INSTITUTION_SELECT =
  "id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))";

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
  const [isMarqueeMounted, setIsMarqueeMounted] = useState(false);
  const [shuffledFeaturedInstitutions, setShuffledFeaturedInstitutions] = useState<FeaturedInstitution[]>([]);
  const [brokenFeaturedImageIds, setBrokenFeaturedImageIds] = useState<Set<number>>(() => new Set());
  const [featuredPinnedInstitutions, setFeaturedPinnedInstitutions] = useState<FeaturedInstitution[]>(
    [],
  );

  useEffect(() => {
    setIsMarqueeMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const pinnedRows = await fetchHomeFeaturedPinnedRows(supabase);

      if (cancelled) return;

      const pinned: FeaturedInstitution[] = [];
      const pinnedIds = new Set<number>();

      for (const row of pinnedRows) {
        const mapped = mapInstitutionRowToFeatured(supabase, row);
        if (mapped && !pinnedIds.has(mapped.id)) {
          pinned.push(mapped);
          pinnedIds.add(mapped.id);
        }
      }

      setFeaturedPinnedInstitutions(pinned);
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
        .select(MARQUEE_INSTITUTION_SELECT)
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

  const pinnedIds = new Set(featuredPinnedInstitutions.map((i) => i.id));
  const featuredList =
    featuredPinnedInstitutions.length > 0
      ? [
          ...featuredPinnedInstitutions,
          ...shuffledFeaturedInstitutions
            .filter((i) => !pinnedIds.has(i.id))
            .slice(0, Math.max(0, MARQUEE_FEATURED_COUNT - featuredPinnedInstitutions.length)),
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
        <div
          className={`featured-institutions-scroller${
            isMarqueeMounted && featuredList.length > 0
              ? " featured-institutions-scroller--animated"
              : ""
          }`}
        >
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
