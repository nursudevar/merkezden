"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CategoryResultItem } from "@/components/category/useCategoryInstitutions";
import {
  fetchInstitutionMapMarkersForSources,
  type InstitutionMapMarker,
  type InstitutionMapMarkerSource,
} from "@/lib/institutionMapMarkers";

function toMapSources(results: CategoryResultItem[]): InstitutionMapMarkerSource[] {
  const sources: InstitutionMapMarkerSource[] = [];

  for (const item of results) {
    if (item.resultType === "instructor") continue;

    const id = Number(item.id);
    const slug = String(item.slug ?? "").trim();
    const name = String(item.name ?? "").trim();
    if (!Number.isFinite(id) || !slug || !name) continue;

    sources.push({
      id,
      slug,
      name,
      address: String(item.description ?? item.location ?? "").trim() || undefined,
    });
  }

  return sources;
}

function buildSourcesKey(sources: InstitutionMapMarkerSource[]): string {
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

  const sources = useMemo(() => toMapSources(results ?? []), [results]);
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
        const next = await fetchInstitutionMapMarkersForSources(sources);
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
