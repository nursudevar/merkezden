"use client";

import { useEffect, useState } from "react";
import {
  fetchAllInstitutionMapMarkers,
  type InstitutionMapMarker,
} from "@/lib/institutionMapMarkers";

export function useAllInstitutionMapMarkers() {
  const [markers, setMarkers] = useState<InstitutionMapMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const next = await fetchAllInstitutionMapMarkers();
        if (!cancelled) setMarkers(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { markers, loading };
}
