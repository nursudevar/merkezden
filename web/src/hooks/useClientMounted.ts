"use client";

import { useEffect, useState } from "react";

/** SSR ile istemci ilk render'ını eşleştirmek için (Radix/Leaflet hydration). */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
