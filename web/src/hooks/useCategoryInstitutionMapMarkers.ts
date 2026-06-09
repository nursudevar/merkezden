"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryResultItem } from "@/components/category/useCategoryInstitutions";
import {
  fetchInstitutionMapMarkersForSources,
  type InstitutionMapMarker,
  type InstitutionMapMarkerSource,
} from "@/lib/institutionMapMarkers";

function toMapSources(results: CategoryResultItem[]): InstitutionMapMarkerSource[] {
  return results
    .map((item) => {
      const id = Number(item.id);
      const slug = String(item.slug ?? "").trim();
      const name = String(item.name ?? "").trim();
      if (!Number.isFinite(id) || !slug || !name) return null;
      return {
        id,
        slug,
        name,
        address: String(item.description ?? item.location ?? "").trim() || undefined,
      };
    })
    .filter((item): item is InstitutionMapMarkerSource => item !== null);
}

export function useCategoryInstitutionMapMarkers(
  results: CategoryResultItem[] | undefined,
  listLoading: boolean | undefined,
) {
  const [markers, setMarkers] = useState<InstitutionMapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const sources = useMemo(() => toMapSources(results ?? []), [results]);

  useEffect(() => {
    if (listLoading) {
      setLoading(true);
      return;
    }

    if (sources.length === 0) {
      setMarkers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const next = await fetchInstitutionMapMarkersForSources(sources);
        if (!cancelled) setMarkers(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listLoading, sources]);

  return { markers, loading };
}
