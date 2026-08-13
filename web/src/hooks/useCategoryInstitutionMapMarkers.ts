"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CategoryResultItem } from "@/components/category/useCategoryInstitutions";
import {
  fetchInstitutionMapMarkersForListSources,
  type InstitutionMapMarker,
  type InstitutionMapMarkerListSource,
} from "@/lib/institutionMapMarkers";

function toMapListSources(results: CategoryResultItem[]): InstitutionMapMarkerListSource[] {
  const sources: InstitutionMapMarkerListSource[] = [];

  for (const item of results) {
    if (item.resultType === "instructor") continue;

    const id = Number(item.institutionId ?? item.id);
    const slug = String(item.slug ?? "").trim();
    const name = String(item.name ?? "").trim();
    if (!Number.isFinite(id) || !slug || !name) continue;

    sources.push({
      id,
      slug,
      name,
      address:
        String(item.mapAddress ?? item.description ?? item.location ?? "").trim() ||
        undefined,
      official_phone: item.officialPhone,
      official_email: item.officialEmail,
      logoUrl: item.imageUrl,
      institutionTypeName: item.institutionTypeName,
      categoryName: item.mapCategoryName,
      categorySlug: item.mapCategorySlug,
      categoryId: item.mapCategoryId ?? null,
      city: item.mapCity,
      district: item.mapDistrict,
    });
  }

  return sources;
}

function buildSourcesKey(sources: InstitutionMapMarkerListSource[]): string {
  if (sources.length === 0) return "";
  return sources
    .map((source) => source.id)
    .sort((a, b) => a - b)
    .join(",");
}

export function useCategoryInstitutionMapMarkers(
  results: CategoryResultItem[] | undefined,
  _listLoading?: boolean,
) {
  const [markers, setMarkers] = useState<InstitutionMapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);

  const sources = useMemo(() => toMapListSources(results ?? []), [results]);
  const sourcesKey = useMemo(() => buildSourcesKey(sources), [sources]);

  useEffect(() => {
    if (sourcesKey === "") {
      setMarkers([]);
      setLoading(false);
      hasLoadedOnceRef.current = false;
      return;
    }

    let cancelled = false;
    const showBlockingLoader = !hasLoadedOnceRef.current;
    if (showBlockingLoader) {
      setLoading(true);
    }

    (async () => {
      try {
        const next = await fetchInstitutionMapMarkersForListSources(sources);
        if (cancelled) return;
        setMarkers(next);
        hasLoadedOnceRef.current = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Yalnızca kurum kimliği seti değişince fetch; liste loading durumunda yeniden yükleme yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey]);

  return { markers, loading: loading && markers.length === 0 };
}
