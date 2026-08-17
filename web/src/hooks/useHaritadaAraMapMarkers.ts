"use client";

import { useEffect, useMemo, useState } from "react";
import { useAllInstitutionMapMarkers } from "@/hooks/useAllInstitutionMapMarkers";
import { fetchInstructorMapMarkers, prefetchInstructorMapRows } from "@/lib/instructorMapMarkers";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";

export function useHaritadaAraMapMarkers() {
  const { markers: institutionMarkers, loading: institutionLoading } = useAllInstitutionMapMarkers();
  const [instructorMarkers, setInstructorMarkers] = useState<InstitutionMapMarker[]>([]);

  useEffect(() => {
    prefetchInstructorMapRows();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchInstructorMapMarkers();
        if (!cancelled) setInstructorMarkers(next);
      } catch (error) {
        console.error("Eğitmen harita konumları yüklenemedi:", error);
        if (!cancelled) setInstructorMarkers([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const markers = useMemo(
    () => [...institutionMarkers, ...instructorMarkers],
    [institutionMarkers, instructorMarkers],
  );

  return {
    markers,
    loading: institutionLoading,
  };
}
