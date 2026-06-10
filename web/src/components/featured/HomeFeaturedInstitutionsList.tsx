"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchFeaturedPublicInstructors,
  mapPublicInstructorToFeaturedItem,
  type FeaturedInstructorItem,
} from "@/lib/publicInstructorSearch";
import type { FeaturedInstitution } from "./featuredInstitutionTypes";
import { FeaturedInstitutionCardLink } from "./FeaturedInstitutionCardLink";
import { FeaturedInstructorCardLink } from "./FeaturedInstructorCardLink";
import {
  fetchHomeFeaturedPinnedInstructorRow,
  fetchHomeFeaturedPinnedRows,
  HOME_FEATURED_PINNED_INSTRUCTOR_POSITION,
} from "./homeFeaturedPinned";
import { mapInstitutionRowToFeatured } from "./mapInstitutionRowToFeatured";

const LIST_SIZE = 25;
const FETCH_LIMIT = 300;
const INSTRUCTOR_FETCH_LIMIT = 8;

type FeaturedListEntry =
  | { kind: "institution"; institution: FeaturedInstitution }
  | { kind: "instructor"; instructor: FeaturedInstructorItem };

const INSTITUTION_SELECT =
  "id, slug, source, institution_name, type, city, district, logo, institution_type:institution_types(name, category:institution_categories(name))";

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function insertPinnedInstructorAtPosition(
  entries: FeaturedListEntry[],
  instructor: FeaturedInstructorItem,
  position: number,
): FeaturedListEntry[] {
  const withoutDuplicate = entries.filter(
    (entry) => !(entry.kind === "instructor" && entry.instructor.id === instructor.id),
  );
  const insertAt = Math.min(Math.max(position, 0), withoutDuplicate.length);
  const next = [...withoutDuplicate];
  next.splice(insertAt, 0, { kind: "instructor", instructor });
  return next.slice(0, LIST_SIZE);
}

export function HomeFeaturedInstitutionsList({
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  isAuthenticated,
}: {
  onToggleFavorite: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds: Set<number>;
  favoritesEnabled: boolean;
  favoriteActionLoadingIds: Set<number>;
  isAuthenticated: boolean;
}) {
  const [entries, setEntries] = useState<FeaturedListEntry[]>([]);
  const [brokenInstitutionImageIds, setBrokenInstitutionImageIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [brokenInstructorImageIds, setBrokenInstructorImageIds] = useState<Set<number>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();

      const [pinnedRows, listResult, instructorRows, pinnedInstructorRow] = await Promise.all([
        fetchHomeFeaturedPinnedRows(supabase),
        supabase
          .from("institutions")
          .select(INSTITUTION_SELECT)
          .not("institution_name", "is", null)
          .limit(FETCH_LIMIT),
        fetchFeaturedPublicInstructors(supabase, { limit: INSTRUCTOR_FETCH_LIMIT }),
        fetchHomeFeaturedPinnedInstructorRow(supabase),
      ]);

      if (cancelled) return;

      const pinned: FeaturedInstitution[] = [];
      const pinnedIds = new Set<number>();

      for (const row of pinnedRows) {
        const item = mapInstitutionRowToFeatured(supabase, row);
        if (item && !pinnedIds.has(item.id)) {
          pinned.push(item);
          pinnedIds.add(item.id);
        }
      }

      const instructors = instructorRows
        .map((row) => mapPublicInstructorToFeaturedItem(row, supabase))
        .filter((item): item is FeaturedInstructorItem => item !== null);

      const pinnedInstructor = pinnedInstructorRow
        ? mapPublicInstructorToFeaturedItem(pinnedInstructorRow, supabase)
        : null;

      const applyPinnedInstructor = (entries: FeaturedListEntry[]): FeaturedListEntry[] => {
        if (!pinnedInstructor) return entries;
        return insertPinnedInstructorAtPosition(
          entries,
          pinnedInstructor,
          HOME_FEATURED_PINNED_INSTRUCTOR_POSITION,
        );
      };

      const buildEntries = (
        institutionItems: FeaturedInstitution[],
        instructorItems: FeaturedInstructorItem[],
      ): FeaturedListEntry[] => {
        const pinnedEntries: FeaturedListEntry[] = institutionItems
          .filter((item) => pinnedIds.has(item.id))
          .map((institution) => ({ kind: "institution", institution }));

        const otherInstitutions = institutionItems.filter((item) => !pinnedIds.has(item.id));
        const instructorPool = instructorItems.filter(
          (item) => item.id !== pinnedInstructor?.id,
        );
        const mixedOthers = shuffleItems<FeaturedListEntry>([
          ...otherInstitutions.map((institution) => ({ kind: "institution" as const, institution })),
          ...instructorPool.map((instructor) => ({ kind: "instructor" as const, instructor })),
        ]).slice(0, Math.max(0, LIST_SIZE - pinnedEntries.length));

        return applyPinnedInstructor([...pinnedEntries, ...mixedOthers].slice(0, LIST_SIZE));
      };

      if (listResult.error || !listResult.data) {
        const fallback = buildEntries(pinned, instructors);
        if (fallback.length > 0) setEntries(fallback);
        return;
      }

      const mapped = (listResult.data as Array<Record<string, unknown>>)
        .map((row) => mapInstitutionRowToFeatured(supabase, row))
        .filter((item): item is FeaturedInstitution => item !== null);

      const nextEntries = buildEntries(
        mapped.length > 0 ? [...pinned, ...mapped.filter((item) => !pinnedIds.has(item.id))] : pinned,
        instructors,
      );
      if (nextEntries.length > 0) setEntries(nextEntries);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="featured-institutions-list-section" aria-labelledby="home-featured-institutions-list-heading">
      <div className="featured-institutions-header">
        <div className="featured-institutions-header-left">
          <h2 className="featured-institutions-title" id="home-featured-institutions-list-heading">
            Öne Çıkanlar
          </h2>
        </div>
      </div>
      <div className="featured-institutions-list">
        {entries.map((entry) => {
          if (entry.kind === "instructor") {
            const instructor = entry.instructor;
            const canRenderImage =
              Boolean(instructor.imageUrl) && !brokenInstructorImageIds.has(instructor.id);

            return (
              <FeaturedInstructorCardLink
                key={`instructor-${instructor.id}`}
                instructor={instructor}
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
          const canRenderImage =
            Boolean(institution.imageUrl) && !brokenInstitutionImageIds.has(institution.id);
          const isFavorite = favoriteIds.has(institution.id);
          const isActionLoading = favoriteActionLoadingIds.has(institution.id);

          return (
            <FeaturedInstitutionCardLink
              key={`institution-${institution.id}`}
              institution={institution}
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
    </section>
  );
}
