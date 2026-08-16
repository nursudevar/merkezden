"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { SlidersHorizontal } from "lucide-react";
import CategoryBreadcrumb from "@/components/category/CategoryBreadcrumb";
import { HaritadaAraFilterSidebar } from "@/components/map/HaritadaAraFilterSidebar";
import { InstitutionMapSearchExperience } from "@/components/map/InstitutionMapSearchExperience";
import type { InstitutionMapFocusTarget } from "@/components/map/InstitutionLocationsMap";
import { useAllInstitutionMapMarkers } from "@/hooks/useAllInstitutionMapMarkers";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FavoritesError,
  getMyFavoriteInstitutionIds,
  toggleFavorite,
} from "@/lib/favorites/favoritesClient";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import { haversineDistanceKm, isValidLatLng } from "@/lib/geoDistance";
import { resolveDistrictMapView, boundsFromMarkers } from "@/lib/districtMapView";
import {
  beginUserGeolocationRequest,
  diagnoseGeolocationPreflight,
} from "@/lib/geolocationClient";
import {
  fetchIller,
  fetchIlcelerByIlId,
  fetchMahallelerByIlceId,
  findLocationIdByAd,
  HOME_DEFAULT_CITY_AD,
  parseLocationId,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";
import {
  resolveCategoryLocationFromSearch,
  writeCategoryLocationToSearch,
} from "@/components/category/categoryLocationFilter";

function searchQueryEqual(a: string, b: string): boolean {
  const left = new URLSearchParams(a.startsWith("?") ? a.slice(1) : a);
  const right = new URLSearchParams(b.startsWith("?") ? b.slice(1) : b);
  const serialize = (params: URLSearchParams) =>
    [...params.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort((x, y) => x.localeCompare(y))
      .join("&");
  return serialize(left) === serialize(right);
}

const DESKTOP_MIN_WIDTH = 1024;
/** Header altında kalacak minimum üst boşluk */
const FILTER_PIN_TOP = 100;

/** Yakınımdaki arama: harita zoom (mevcut flyTo davranışı; yarıçap kuralı yok — viewport listesi). */
const NEARBY_MAP_ZOOM = 13;

/** Harita ilk açılış merkezi / zoom (InstitutionLocationsMap ile aynı). */
const DEFAULT_MAP_CENTER = { lat: 39.9334, lng: 32.8597 };
const DEFAULT_MAP_ZOOM = 10;

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 60000,
};

function normalizeLocationKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

function markerMatchesLocationIds(
  marker: InstitutionMapMarker,
  ilId: number | null,
  ilceId: number | null,
  mahalleId: number | null,
): boolean {
  if (ilId != null && marker.ilId !== ilId) return false;
  if (ilceId != null && marker.ilceId !== ilceId) return false;
  if (mahalleId != null && marker.mahalleId !== mahalleId) return false;
  return true;
}

function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches;
}

export function HaritadaAraPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { markers, loading } = useAllInstitutionMapMarkers();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(
    () => new Set(),
  );

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const isFilterOpenRef = useRef(false);
  isFilterOpenRef.current = isFilterOpen;
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const sidebarSlotRef = useRef<HTMLDivElement>(null);
  const fixedFilterRef = useRef<HTMLDivElement>(null);

  const [selectedIlId, setSelectedIlId] = useState("");
  const [defaultIlId, setDefaultIlId] = useState("");
  const [selectedIlceId, setSelectedIlceId] = useState("");
  const [selectedMahalleId, setSelectedMahalleId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [iller, setIller] = useState<TurkiyeLocationOption[]>([]);
  const [ilceler, setIlceler] = useState<TurkiyeLocationOption[]>([]);
  const [mahalleler, setMahalleler] = useState<TurkiyeLocationOption[]>([]);
  const [locationDefaultsReady, setLocationDefaultsReady] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbyActive, setNearbyActive] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapFocus, setMapFocus] = useState<InstitutionMapFocusTarget | null>(null);
  const nearbyRequestIdRef = useRef(0);
  const nearbyInFlightRef = useRef(false);
  const districtFocusRequestIdRef = useRef(0);
  const activeGeoCancelRef = useRef<(() => void) | null>(null);
  const locationDefaultsReadyRef = useRef(false);
  const lastHydratedSearchKeyRef = useRef<string | null>(null);
  const writeGenerationRef = useRef(0);
  const markersRef = useRef(markers);
  const illerRef = useRef(iller);
  markersRef.current = markers;
  illerRef.current = iller;

  const selectedIlAd = iller.find((row) => String(row.id) === selectedIlId)?.ad ?? "";
  const selectedIlceAd = ilceler.find((row) => String(row.id) === selectedIlceId)?.ad ?? "";
  const selectedIlIdNum = parseLocationId(selectedIlId);
  const selectedIlceIdNum = parseLocationId(selectedIlceId);
  const selectedMahalleIdNum = parseLocationId(selectedMahalleId);

  const filteredMarkers = useMemo(() => {
    if (!locationDefaultsReady) return [];
    const searchKey = normalizeLocationKey(appliedSearchQuery);
    const filtered = markers.filter((marker) => {
      if (!markerMatchesLocationIds(marker, selectedIlIdNum, selectedIlceIdNum, selectedMahalleIdNum)) {
        return false;
      }
      if (!searchKey) return true;
      const haystack = normalizeLocationKey(
        [
          marker.institution_name,
          marker.address,
          marker.categoryName,
          marker.institutionTypeName,
          marker.city,
          marker.district,
        ].join(" "),
      );
      return haystack.includes(searchKey);
    });

    if (!nearbyActive || !userLocation) return filtered;

    return [...filtered].sort((a, b) => {
      const da = haversineDistanceKm(
        userLocation.lat,
        userLocation.lng,
        a.latitude,
        a.longitude,
      );
      const db = haversineDistanceKm(
        userLocation.lat,
        userLocation.lng,
        b.latitude,
        b.longitude,
      );
      return da - db;
    });
  }, [
    markers,
    locationDefaultsReady,
    selectedIlIdNum,
    selectedIlceIdNum,
    selectedMahalleIdNum,
    appliedSearchQuery,
    nearbyActive,
    userLocation,
  ]);

  const syncFixedFilterPosition = useCallback(() => {
    const slot = sidebarSlotRef.current;
    const panel = fixedFilterRef.current;
    if (!slot || !panel) return;

    if (!isDesktopViewport()) {
      panel.style.removeProperty("position");
      panel.style.removeProperty("top");
      panel.style.removeProperty("left");
      panel.style.removeProperty("width");
      panel.style.removeProperty("max-height");
      panel.style.removeProperty("overflow");
      panel.classList.remove("haritada-ara-filter-fixed--active");
      return;
    }

    const slotRect = slot.getBoundingClientRect();
    const container = slot.closest(".category-page-layout-container");
    const containerRect = container?.getBoundingClientRect();
    const resultsEl = resultsScrollRef.current;
    const resultsTop = resultsEl?.getBoundingClientRect().top;

    const naturalTop =
      typeof resultsTop === "number" && Number.isFinite(resultsTop)
        ? Math.min(slotRect.top, resultsTop)
        : slotRect.top;

    panel.classList.add("haritada-ara-filter-fixed--active");
    panel.style.position = "fixed";
    panel.style.left = `${Math.round(slotRect.left)}px`;
    panel.style.width = `${Math.round(slotRect.width)}px`;
    panel.style.removeProperty("max-height");
    panel.style.overflow = "visible";

    const panelHeight = panel.getBoundingClientRect().height;
    let top = Math.max(FILTER_PIN_TOP, naturalTop);

    // Layout container’ın altına gelince filtrenin alt kenarı container altıyla hizalansın
    if (containerRect && Number.isFinite(panelHeight) && panelHeight > 0) {
      top = Math.min(top, containerRect.bottom - panelHeight);
    }

    panel.style.top = `${Math.round(top)}px`;
  }, []);

  useLayoutEffect(() => {
    syncFixedFilterPosition();

    const onScrollOrResize = () => syncFixedFilterPosition();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    const slot = sidebarSlotRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && slot
        ? new ResizeObserver(() => syncFixedFilterPosition())
        : null;
    if (slot) resizeObserver?.observe(slot);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      resizeObserver?.disconnect();
    };
  }, [syncFixedFilterPosition, filteredMarkers.length, loading]);

  const focusMapForLocation = useCallback(
    async (ilIdValue: string, ilceIdValue: string, mahalleIdValue: string) => {
      const requestId = ++districtFocusRequestIdRef.current;
      const parsedIlId = parseLocationId(ilIdValue);
      const parsedIlceId = parseLocationId(ilceIdValue);
      const parsedMahalleId = parseLocationId(mahalleIdValue);

      if (parsedIlceId == null) {
        setMapFocus({
          lat: DEFAULT_MAP_CENTER.lat,
          lng: DEFAULT_MAP_CENTER.lng,
          zoom: DEFAULT_MAP_ZOOM,
          boundaryGeoJson: null,
          token: Date.now(),
        });
        return;
      }

      if (parsedMahalleId != null) {
        const mahalleMarkers = markersRef.current.filter((marker) =>
          markerMatchesLocationIds(marker, parsedIlId, parsedIlceId, parsedMahalleId),
        );
        const bounds = boundsFromMarkers(mahalleMarkers);
        if (requestId !== districtFocusRequestIdRef.current || !bounds) return;
        setMapFocus({
          bounds,
          boundaryGeoJson: null,
          token: Date.now(),
        });
        return;
      }

      const cityAd = illerRef.current.find((row) => row.id === parsedIlId)?.ad ?? "";
      let districtAd = "";
      if (parsedIlId != null) {
        try {
          const ilceRows = await fetchIlcelerByIlId(parsedIlId);
          districtAd = ilceRows.find((row) => row.id === parsedIlceId)?.ad ?? "";
        } catch {
          districtAd = "";
        }
      }

      const districtMarkers = markersRef.current.filter((marker) =>
        markerMatchesLocationIds(marker, parsedIlId, parsedIlceId, null),
      );
      const view = await resolveDistrictMapView(cityAd, districtAd, districtMarkers);
      if (requestId !== districtFocusRequestIdRef.current || !view) return;
      setMapFocus({
        bounds: view.bounds,
        boundaryGeoJson: view.boundaryGeoJson,
        token: Date.now(),
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const rows = await fetchIller();
        if (cancelled) return;
        setIller(rows);
        illerRef.current = rows;
        const ankaraId = findLocationIdByAd(rows, HOME_DEFAULT_CITY_AD);
        if (ankaraId) setDefaultIlId(ankaraId);
      } catch (error) {
        console.error("İller yüklenemedi:", error);
        if (!cancelled) setIller([]);
      } finally {
        if (!cancelled) {
          locationDefaultsReadyRef.current = true;
          setLocationDefaultsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!locationDefaultsReady) return;
    let cancelled = false;
    void (async () => {
      const resolved = await resolveCategoryLocationFromSearch(searchKey ? `?${searchKey}` : "");
      if (cancelled) return;
      const q = String(new URLSearchParams(searchKey).get("q") ?? "").trim();
      const nextIlId = resolved.ilId || defaultIlId;
      const nextIlceId = nextIlId ? resolved.ilceId : "";
      const nextMahalleId = nextIlceId ? resolved.mahalleId : "";
      setSelectedIlId(nextIlId);
      setSelectedIlceId(nextIlceId);
      setSelectedMahalleId(nextMahalleId);
      if (!nextIlId) setIlceler([]);
      if (!nextIlceId) setMahalleler([]);
      setSearchQuery(q);
      setAppliedSearchQuery(q);
      lastHydratedSearchKeyRef.current = searchKey;
      if (nextIlceId || nextMahalleId) {
        void focusMapForLocation(nextIlId, nextIlceId, nextMahalleId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultIlId, focusMapForLocation, locationDefaultsReady, searchKey]);

  useEffect(() => {
    if (!locationDefaultsReady) return;
    if (lastHydratedSearchKeyRef.current !== searchKey) return;
    const generation = ++writeGenerationRef.current;
    void (async () => {
      const nextSearch = await writeCategoryLocationToSearch(searchKey ? `?${searchKey}` : "", {
        ilId: selectedIlId,
        ilceId: selectedIlceId,
        mahalleId: selectedMahalleId,
      });
      if (generation !== writeGenerationRef.current) return;
      const params = new URLSearchParams(nextSearch);
      const trimmedQuery = appliedSearchQuery.trim();
      if (trimmedQuery) params.set("q", trimmedQuery);
      else params.delete("q");
      const serialized = params.toString();
      if (searchQueryEqual(serialized, searchKey)) return;
      const nextUrl = serialized ? `${pathname}?${serialized}` : pathname;
      router.push(nextUrl, { scroll: false });
    })();
  }, [
    appliedSearchQuery,
    locationDefaultsReady,
    pathname,
    router,
    searchKey,
    selectedIlId,
    selectedIlceId,
    selectedMahalleId,
  ]);

  useEffect(() => {
    const ilId = parseLocationId(selectedIlId);
    if (ilId == null) {
      setIlceler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchIlcelerByIlId(ilId);
        if (!cancelled) setIlceler(rows);
      } catch (error) {
        console.error("İlçeler yüklenemedi:", error);
        if (!cancelled) setIlceler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIlId]);

  useEffect(() => {
    const ilceId = parseLocationId(selectedIlceId);
    if (ilceId == null) {
      setMahalleler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchMahallelerByIlceId(ilceId);
        if (!cancelled) setMahalleler(rows);
      } catch (error) {
        console.error("Mahalleler yüklenemedi:", error);
        if (!cancelled) setMahalleler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIlceId]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(data.user ?? null);
      setIsAuthReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady || !user) {
      setFavoriteIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoriteActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    void (async () => {
      try {
        const ids = await getMyFavoriteInstitutionIds();
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === "NOT_INDIVIDUAL") {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
        } else {
          setFavoritesEnabled(false);
        }
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  const closeDrawerAndScrollToResults = useCallback(() => {
    if (!isFilterOpenRef.current) return;
    setIsFilterOpen(false);
    window.setTimeout(() => {
      const el = resultsScrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = Math.max(0, rect.top + window.scrollY - 72);
      window.scrollTo({ top, behavior: "smooth" });
    }, 220);
  }, []);

  const clearNearbyMode = useCallback(() => {
    setNearbyActive(false);
    setNearbyError(null);
    setUserLocation(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setAppliedSearchQuery(searchQuery.trim());
    clearNearbyMode();
    closeDrawerAndScrollToResults();
  }, [searchQuery, clearNearbyMode, closeDrawerAndScrollToResults]);

  const handleIlChange = useCallback(
    (ilId: string) => {
      districtFocusRequestIdRef.current += 1;
      setSelectedIlId(ilId);
      setSelectedIlceId("");
      setSelectedMahalleId("");
      setMahalleler([]);
      clearNearbyMode();
      setMapFocus({
        lat: DEFAULT_MAP_CENTER.lat,
        lng: DEFAULT_MAP_CENTER.lng,
        zoom: DEFAULT_MAP_ZOOM,
        boundaryGeoJson: null,
        token: Date.now(),
      });
      closeDrawerAndScrollToResults();
    },
    [clearNearbyMode, closeDrawerAndScrollToResults],
  );

  const handleIlceChange = useCallback(
    (ilceId: string) => {
      districtFocusRequestIdRef.current += 1;
      const requestId = districtFocusRequestIdRef.current;
      setSelectedIlceId(ilceId);
      setSelectedMahalleId("");
      if (!ilceId) setMahalleler([]);
      clearNearbyMode();
      closeDrawerAndScrollToResults();

      if (!ilceId.trim()) {
        setMapFocus({
          lat: DEFAULT_MAP_CENTER.lat,
          lng: DEFAULT_MAP_CENTER.lng,
          zoom: DEFAULT_MAP_ZOOM,
          boundaryGeoJson: null,
          token: Date.now(),
        });
        return;
      }

      const parsedIlId = parseLocationId(selectedIlId);
      const parsedIlceId = parseLocationId(ilceId);
      const cityAd = selectedIlAd;
      const districtAd = ilceler.find((row) => row.id === parsedIlceId)?.ad ?? "";

      void (async () => {
        const districtMarkers = markers.filter((marker) =>
          markerMatchesLocationIds(marker, parsedIlId, parsedIlceId, null),
        );
        const view = await resolveDistrictMapView(cityAd, districtAd, districtMarkers);
        if (requestId !== districtFocusRequestIdRef.current || !view) return;

        setMapFocus({
          bounds: view.bounds,
          boundaryGeoJson: view.boundaryGeoJson,
          token: Date.now(),
        });
      })();
    },
    [clearNearbyMode, closeDrawerAndScrollToResults, markers, selectedIlId, selectedIlAd, ilceler],
  );

  const handleMahalleChange = useCallback(
    (mahalleId: string) => {
      districtFocusRequestIdRef.current += 1;
      const requestId = districtFocusRequestIdRef.current;
      setSelectedMahalleId(mahalleId);
      clearNearbyMode();
      closeDrawerAndScrollToResults();

      if (!mahalleId.trim()) {
        if (!selectedIlceId.trim()) {
          setMapFocus({
            lat: DEFAULT_MAP_CENTER.lat,
            lng: DEFAULT_MAP_CENTER.lng,
            zoom: DEFAULT_MAP_ZOOM,
            boundaryGeoJson: null,
            token: Date.now(),
          });
          return;
        }

        const parsedIlId = parseLocationId(selectedIlId);
        const parsedIlceId = parseLocationId(selectedIlceId);
        void (async () => {
          const districtMarkers = markers.filter((marker) =>
            markerMatchesLocationIds(marker, parsedIlId, parsedIlceId, null),
          );
          const view = await resolveDistrictMapView(selectedIlAd, selectedIlceAd, districtMarkers);
          if (requestId !== districtFocusRequestIdRef.current || !view) return;
          setMapFocus({
            bounds: view.bounds,
            boundaryGeoJson: view.boundaryGeoJson,
            token: Date.now(),
          });
        })();
        return;
      }

      const parsedMahalleId = parseLocationId(mahalleId);
      const mahalleMarkers = markers.filter((marker) =>
        markerMatchesLocationIds(
          marker,
          parseLocationId(selectedIlId),
          parseLocationId(selectedIlceId),
          parsedMahalleId,
        ),
      );
      const bounds = boundsFromMarkers(mahalleMarkers);
      if (!bounds) return;
      setMapFocus({
        bounds,
        boundaryGeoJson: null,
        token: Date.now(),
      });
    },
    [
      clearNearbyMode,
      closeDrawerAndScrollToResults,
      markers,
      selectedIlId,
      selectedIlceId,
      selectedIlAd,
      selectedIlceAd,
    ],
  );

  useEffect(() => {
    return () => {
      nearbyRequestIdRef.current += 1;
      nearbyInFlightRef.current = false;
      activeGeoCancelRef.current?.();
      activeGeoCancelRef.current = null;
    };
  }, []);

  const handleNearbyClick = useCallback(() => {
    if (nearbyInFlightRef.current) return;

    const preflight = diagnoseGeolocationPreflight();
    if (!preflight.ok) {
      setNearbyActive(false);
      setUserLocation(null);
      setNearbyLoading(false);
      setNearbyError(preflight.message);
      return;
    }

    nearbyInFlightRef.current = true;
    const requestId = ++nearbyRequestIdRef.current;
    activeGeoCancelRef.current?.();

    const { cancel, promise } = beginUserGeolocationRequest(GEO_OPTIONS);
    activeGeoCancelRef.current = cancel;

    setNearbyLoading(true);
    setNearbyError(null);

    void promise.then((outcome) => {
      if (requestId !== nearbyRequestIdRef.current) return;

      activeGeoCancelRef.current = null;
      nearbyInFlightRef.current = false;
      setNearbyLoading(false);

      if (!outcome.ok) {
        setNearbyActive(false);
        setUserLocation(null);
        setNearbyError(outcome.message);
        return;
      }

      const lat = Number(outcome.lat);
      const lng = Number(outcome.lng);

      if (!isValidLatLng(lat, lng)) {
        setNearbyActive(false);
        setUserLocation(null);
        setNearbyError("Konum bilgisi alınamadı. Lütfen tekrar deneyin.");
        return;
      }

      locationDefaultsReadyRef.current = true;
      setLocationDefaultsReady(true);
      setSelectedIlId("");
      setSelectedIlceId("");
      setSelectedMahalleId("");
      setMahalleler([]);
      setAppliedSearchQuery("");
      setUserLocation({ lat, lng });
      setNearbyActive(true);
      setMapFocus({
        lat,
        lng,
        zoom: NEARBY_MAP_ZOOM,
        boundaryGeoJson: null,
        token: Date.now(),
      });
      closeDrawerAndScrollToResults();
    });
  }, [closeDrawerAndScrollToResults]);

  const hasActiveFilters = useMemo(() => {
    if (searchQuery.trim() || appliedSearchQuery.trim()) return true;
    if (selectedIlceId) return true;
    if (selectedMahalleId) return true;
    if (nearbyActive) return true;
    if (defaultIlId && selectedIlId !== defaultIlId) return true;
    return false;
  }, [
    searchQuery,
    appliedSearchQuery,
    selectedIlceId,
    selectedMahalleId,
    nearbyActive,
    selectedIlId,
    defaultIlId,
  ]);

  const handleResetFilters = useCallback(() => {
    nearbyRequestIdRef.current += 1;
    nearbyInFlightRef.current = false;
    activeGeoCancelRef.current?.();
    activeGeoCancelRef.current = null;
    setNearbyLoading(false);
    setSearchQuery("");
    setAppliedSearchQuery("");
    setSelectedIlceId("");
    setSelectedMahalleId("");
    setMahalleler([]);
    setSelectedIlId(defaultIlId);
    clearNearbyMode();
    setMapFocus({
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      zoom: DEFAULT_MAP_ZOOM,
      boundaryGeoJson: null,
      token: Date.now(),
    });
    closeDrawerAndScrollToResults();
  }, [defaultIlId, clearNearbyMode, closeDrawerAndScrollToResults]);

  const handleFavoriteToggle = useCallback(
    async (institutionId: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!user || !favoritesEnabled) return;
      if (favoriteActionLoadingIds.has(institutionId)) return;

      const wasFavorited = favoriteIds.has(institutionId);
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.add(institutionId);
        return next;
      });
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(institutionId);
        else next.add(institutionId);
        return next;
      });

      try {
        const res = await toggleFavorite(institutionId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (res.isFavorited) next.add(institutionId);
          else next.delete(institutionId);
          return next;
        });
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(institutionId);
          else next.delete(institutionId);
          return next;
        });
      } finally {
        setFavoriteActionLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(institutionId);
          return next;
        });
      }
    },
    [user, favoritesEnabled, favoriteActionLoadingIds, favoriteIds],
  );

  const filterSidebarProps = {
    iller,
    ilceler,
    mahalleler,
    selectedIlId,
    selectedIlceId,
    selectedMahalleId,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    onSearchSubmit: handleSearchSubmit,
    onIlChange: handleIlChange,
    onIlceChange: handleIlceChange,
    onMahalleChange: handleMahalleChange,
    onNearbyClick: handleNearbyClick,
    nearbyLoading,
    nearbyError,
    nearbyActive,
    showResetFilters: hasActiveFilters,
    onResetFilters: handleResetFilters,
  };

  return (
    <main className="category-page-layout haritada-ara-page" aria-labelledby="institution-map-search-title">
      <div className="category-page-layout-container">
        <div className="category-hero-breadcrumb-wrapper haritada-ara-breadcrumb">
          <CategoryBreadcrumb
            categoryLabel="HARİTADA ARA"
            listingPathname="/haritada-ara"
            location={{
              ilId: selectedIlId,
              ilceId: selectedIlceId,
              mahalleId: selectedMahalleId,
            }}
          />
        </div>
        <aside className="category-page-layout-sidebar haritada-ara-sidebar">
          <div ref={sidebarSlotRef} className="haritada-ara-sidebar-slot" aria-hidden />
          <div ref={fixedFilterRef} className="haritada-ara-filter-fixed">
            <HaritadaAraFilterSidebar {...filterSidebarProps} />
          </div>
        </aside>

        <div className="category-page-layout-results">
          <button
            type="button"
            className="category-page-layout-filter-toggle"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            aria-label="Filtreleri göster/gizle"
          >
            <SlidersHorizontal size={18} />
            Filtreler
          </button>

          <div
            className={`category-page-layout-filter-drawer${
              isFilterOpen ? " category-page-layout-filter-drawer--open" : ""
            }`}
          >
            <div
              className="category-page-layout-filter-drawer-overlay"
              onClick={() => setIsFilterOpen(false)}
              aria-hidden
            />
            <div className="category-page-layout-filter-drawer-content">
              <HaritadaAraFilterSidebar {...filterSidebarProps} />
            </div>
          </div>

          <div ref={resultsScrollRef} className="haritada-ara-results">
            <InstitutionMapSearchExperience
              markers={filteredMarkers}
              loading={loading || !locationDefaultsReady}
              mapKeyPrefix="haritada-ara"
              layout="page"
              showViewportInstitutionList
              focusTarget={mapFocus}
              onToggleFavorite={handleFavoriteToggle}
              favoriteIds={favoriteIds}
              favoritesEnabled={favoritesEnabled && !favoritesLoading}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              isAuthenticated={Boolean(user)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
