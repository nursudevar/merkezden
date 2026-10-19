"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAllInstitutionMapMarkers,
  type InstitutionMapMarker,
} from "@/lib/institutionMapMarkers";

type UseAllInstitutionMapMarkersOptions = {
  /** false: fetch yapılmaz; harita alanı loading gösterir. */
  enabled?: boolean;
  /** true: fetch tarayıcı idle olunca planlanır (ana sayfa ilk paint için). */
  deferUntilIdle?: boolean;
};

export function useAllInstitutionMapMarkers(options?: UseAllInstitutionMapMarkersOptions) {
  const enabled = options?.enabled ?? true;
  const deferUntilIdle = options?.deferUntilIdle ?? false;
  const [markers, setMarkers] = useState<InstitutionMapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryLockRef = useRef(false);

  const retry = useCallback(() => {
    if (retryLockRef.current || loading) return;
    retryLockRef.current = true;
    setRetryCount((count) => count + 1);
  }, [loading]);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      setError(false);
      return;
    }

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const runFetch = async () => {
      setLoading(true);
      try {
        const next = await fetchAllInstitutionMapMarkers();
        if (cancelled) return;
        setMarkers(next);
        setError(false);
      } catch (fetchError) {
        console.error("[home-map] marker load error:", fetchError);
        if (!cancelled) {
          setMarkers([]);
          setError(true);
        }
      } finally {
        retryLockRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    const startFetch = () => {
      if (cancelled) return;
      void runFetch();
    };

    if (deferUntilIdle && typeof requestIdleCallback !== "undefined") {
      idleHandle = requestIdleCallback(startFetch, { timeout: 2000 });
    } else if (deferUntilIdle) {
      timeoutHandle = setTimeout(startFetch, 0);
    } else {
      startFetch();
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, [enabled, deferUntilIdle, retryCount]);

  return { markers, loading, error, retry };
}
