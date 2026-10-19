"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAllInstitutionMapMarkers } from "@/hooks/useAllInstitutionMapMarkers";
import { fetchInstructorMapMarkers } from "@/lib/instructorMapMarkers";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";

export function useHaritadaAraMapMarkers() {
  const {
    markers: institutionMarkers,
    loading: institutionLoading,
    error: institutionFailed,
    retry: retryInstitutionMarkers,
  } = useAllInstitutionMapMarkers();
  const [instructorMarkers, setInstructorMarkers] = useState<InstitutionMapMarker[]>([]);
  const [instructorLoading, setInstructorLoading] = useState(true);
  const [instructorFailed, setInstructorFailed] = useState(false);
  const [instructorRetryCount, setInstructorRetryCount] = useState(0);
  const retryLockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setInstructorLoading(true);

    void (async () => {
      try {
        const next = await fetchInstructorMapMarkers();
        if (cancelled) return;
        setInstructorMarkers(next);
        setInstructorFailed(false);
      } catch (error) {
        console.error("Eğitmen harita konumları yüklenemedi:", error);
        if (!cancelled) {
          setInstructorMarkers([]);
          setInstructorFailed(true);
        }
      } finally {
        if (!cancelled) setInstructorLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instructorRetryCount]);

  const loading = institutionLoading || instructorLoading;
  const error = institutionFailed || instructorFailed;

  useEffect(() => {
    if (!loading) retryLockRef.current = false;
  }, [loading]);

  const retry = useCallback(() => {
    if (retryLockRef.current || loading) return;
    retryLockRef.current = true;
    retryInstitutionMarkers();
    setInstructorRetryCount((count) => count + 1);
  }, [loading, retryInstitutionMarkers]);

  const markers = useMemo(
    () => [...institutionMarkers, ...instructorMarkers],
    [institutionMarkers, instructorMarkers],
  );

  return {
    markers,
    loading,
    error,
    retry,
  };
}
