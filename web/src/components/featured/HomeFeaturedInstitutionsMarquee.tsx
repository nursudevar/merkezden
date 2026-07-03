"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchFeaturedPublicInstructors,
  mapPublicInstructorToFeaturedItem,
  type FeaturedInstructorItem,
} from "@/lib/publicInstructorSearch";
import type { FeaturedInstitution } from "./featuredInstitutionTypes";
import { fetchHomeFeaturedPinnedRows } from "./homeFeaturedPinned";
import { mapInstitutionRowToFeatured } from "./mapInstitutionRowToFeatured";
import { FeaturedInstitutionCardLink } from "./FeaturedInstitutionCardLink";
import { FeaturedInstructorCardLink } from "./FeaturedInstructorCardLink";

const MARQUEE_FEATURED_COUNT = 8;
const INSTRUCTOR_FETCH_LIMIT = 6;

type FeaturedMarqueeEntry =
  | { kind: "institution"; institution: FeaturedInstitution }
  | { kind: "instructor"; instructor: FeaturedInstructorItem };

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
  const [featuredList, setFeaturedList] = useState<FeaturedMarqueeEntry[]>([]);
  const [brokenInstitutionImageIds, setBrokenInstitutionImageIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [brokenInstructorImageIds, setBrokenInstructorImageIds] = useState<Set<number>>(
    () => new Set(),
  );

  useEffect(() => {
    setIsMarqueeMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();

      const [pinnedRows, listResult, instructorRows] = await Promise.all([
        fetchHomeFeaturedPinnedRows(supabase),
        supabase
          .from("institutions")
          .select(MARQUEE_INSTITUTION_SELECT)
          .not("institution_name", "is", null)
          .eq("is_approved", true)
          .limit(180),
        fetchFeaturedPublicInstructors(supabase, { limit: INSTRUCTOR_FETCH_LIMIT }),
      ]);

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

      const instructors = instructorRows
        .map((row) => mapPublicInstructorToFeaturedItem(row, supabase))
        .filter((item): item is FeaturedInstructorItem => item !== null);

      const institutions =
        listResult.error || !listResult.data
          ? []
          : (listResult.data as Array<Record<string, unknown>>)
              .map((row) => mapInstitutionRowToFeatured(supabase, row))
              .filter((item): item is FeaturedInstitution => item !== null);

      const pinnedEntries: FeaturedMarqueeEntry[] = pinned.map((institution) => ({
        kind: "institution",
        institution,
      }));

      const otherInstitutions = institutions.filter((item) => !pinnedIds.has(item.id));
      const mixedOthers = shuffleItems<FeaturedMarqueeEntry>([
        ...otherInstitutions.map((institution) => ({ kind: "institution" as const, institution })),
        ...instructors.map((instructor) => ({ kind: "instructor" as const, instructor })),
      ]).slice(0, Math.max(0, MARQUEE_FEATURED_COUNT - pinnedEntries.length));

      setFeaturedList([...pinnedEntries, ...mixedOthers].slice(0, MARQUEE_FEATURED_COUNT));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
          {marqueeList.map((entry, index) => {
            const isDuplicate = index >= featuredList.length;

            if (entry.kind === "instructor") {
              const instructor = entry.instructor;
              const canRenderImage =
                Boolean(instructor.imageUrl) && !brokenInstructorImageIds.has(instructor.id);

              return (
                <FeaturedInstructorCardLink
                  key={`instructor-${instructor.id}-${index}`}
                  instructor={instructor}
                  isDuplicate={isDuplicate}
                  canRenderImage={canRenderImage}
                  onImageError={() =>
                    setBrokenInstructorImageIds((prev) => {
                      const next = new Set(prev);
                      next.add(instructor.id);
                      return next;
                    })
                  }
                />
              );
            }

            const institution = entry.institution;
            const key = `institution-${institution.id}-${index}`;
            const isFavorite = favoriteIds.has(institution.id);
            const isActionLoading = favoriteActionLoadingIds.has(institution.id);
            const canRenderImage =
              Boolean(institution.imageUrl) && !brokenInstitutionImageIds.has(institution.id);

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
                  setBrokenInstitutionImageIds((prev) => {
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
