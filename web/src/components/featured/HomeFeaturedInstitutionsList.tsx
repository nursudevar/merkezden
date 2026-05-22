"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FeaturedInstitutionListCard,
  type FeaturedInstitutionListItem,
} from "./FeaturedInstitutionListCard";
import { fetchHomeFeaturedPinnedRows } from "./homeFeaturedPinned";
import { mapInstitutionRowToListItem } from "./mapInstitutionRowToListItem";

const LIST_SIZE = 36;
const FETCH_LIMIT = 300;

const INSTITUTION_SELECT =
  "id, slug, source, institution_name, district, logo";

function shuffleInstitutions<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function HomeFeaturedInstitutionsList() {
  const [institutions, setInstitutions] = useState<FeaturedInstitutionListItem[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();

      const [pinnedRows, listResult] = await Promise.all([
        fetchHomeFeaturedPinnedRows(supabase),
        supabase
          .from("institutions")
          .select(INSTITUTION_SELECT)
          .not("institution_name", "is", null)
          .limit(FETCH_LIMIT),
      ]);

      if (cancelled) return;

      const pinned: FeaturedInstitutionListItem[] = [];
      const pinnedIds = new Set<number>();

      for (const row of pinnedRows) {
        const item = mapInstitutionRowToListItem(supabase, row);
        if (item && !pinnedIds.has(item.id)) {
          pinned.push(item);
          pinnedIds.add(item.id);
        }
      }

      if (listResult.error || !listResult.data) {
        if (pinned.length > 0) setInstitutions(pinned);
        return;
      }

      const mapped = (listResult.data as Array<Record<string, unknown>>)
        .map((row) => mapInstitutionRowToListItem(supabase, row))
        .filter((item): item is FeaturedInstitutionListItem => item !== null);

      if (mapped.length === 0) {
        if (pinned.length > 0) setInstitutions(pinned);
        return;
      }

      const others = shuffleInstitutions(mapped.filter((item) => !pinnedIds.has(item.id))).slice(
        0,
        Math.max(0, LIST_SIZE - pinned.length),
      );

      setInstitutions([...pinned, ...others]);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (institutions.length === 0) return null;

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
        {institutions.map((institution) => {
          const canRenderImage =
            Boolean(institution.imageUrl) && !brokenImageIds.has(institution.id);
          return (
            <FeaturedInstitutionListCard
              key={institution.id}
              institution={institution}
              canRenderImage={canRenderImage}
              onImageError={() =>
                setBrokenImageIds((prev) => {
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
