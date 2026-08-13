"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const runFetch = async () => {
      setLoading(true);
      try {
        const next = await fetchAllInstitutionMapMarkers();
        if (!cancelled) setMarkers(next);
      } finally {
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
  }, [enabled, deferUntilIdle]);

  return { markers, loading };
}
