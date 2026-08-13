"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { SlidersHorizontal } from "lucide-react";
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
import { resolveDistrictMapView } from "@/lib/districtMapView";
import {
  beginUserGeolocationRequest,
  diagnoseGeolocationPreflight,
} from "@/lib/geolocationClient";

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

function markerMatchesCity(marker: InstitutionMapMarker, city: string): boolean {
  if (!city) return true;
  return normalizeLocationKey(marker.city) === normalizeLocationKey(city);
}

function markerMatchesDistrict(marker: InstitutionMapMarker, district: string): boolean {
  if (!district) return true;
  return normalizeLocationKey(marker.district) === normalizeLocationKey(district);
}

function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches;
}

export function HaritadaAraPageClient() {
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

  const [selectedCity, setSelectedCity] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [cityDistrictMap, setCityDistrictMap] = useState<Record<string, string[]>>({});
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbyActive, setNearbyActive] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapFocus, setMapFocus] = useState<InstitutionMapFocusTarget | null>(null);
  const nearbyRequestIdRef = useRef(0);
  const nearbyInFlightRef = useRef(false);
  const districtFocusRequestIdRef = useRef(0);
  const activeGeoCancelRef = useRef<(() => void) | null>(null);

  const cities = useMemo(
    () => Object.keys(cityDistrictMap).sort((a, b) => a.localeCompare(b, "tr")),
    [cityDistrictMap],
  );

  const districts = useMemo(() => {
    if (!selectedCity) return [];
    return cityDistrictMap[selectedCity] ?? [];
  }, [cityDistrictMap, selectedCity]);

  const filteredMarkers = useMemo(() => {
    const searchKey = normalizeLocationKey(appliedSearchQuery);
    const filtered = markers.filter((marker) => {
      if (!markerMatchesCity(marker, selectedCity)) return false;
      if (!markerMatchesDistrict(marker, selectedDistrict)) return false;
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
  }, [markers, selectedCity, selectedDistrict, appliedSearchQuery, nearbyActive, userLocation]);

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

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      const { data } = await supabase
        .from("institutions")
        .select("city, district")
        .eq("is_approved", true)
        .limit(5000);

      if (cancelled || !Array.isArray(data)) return;

      const nextMap: Record<string, Set<string>> = {};
      for (const row of data) {
        const city = String(row.city ?? "").trim();
        const district = String(row.district ?? "").trim();
        if (!city) continue;
        if (!nextMap[city]) nextMap[city] = new Set();
        if (district) nextMap[city].add(district);
      }

      const plain: Record<string, string[]> = {};
      for (const [city, set] of Object.entries(nextMap)) {
        plain[city] = Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
      }
      setCityDistrictMap(plain);

      const ankaraKey = Object.keys(plain).find(
        (city) => normalizeLocationKey(city) === "ankara",
      );
      if (ankaraKey) {
        setDefaultCity(ankaraKey);
        setSelectedCity((prev) => prev || ankaraKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleCityChange = useCallback(
    (city: string) => {
      districtFocusRequestIdRef.current += 1;
      setSelectedCity(city);
      setSelectedDistrict("");
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

  const handleDistrictChange = useCallback(
    (district: string) => {
      districtFocusRequestIdRef.current += 1;
      const requestId = districtFocusRequestIdRef.current;
      setSelectedDistrict(district);
      clearNearbyMode();
      closeDrawerAndScrollToResults();

      if (!district.trim()) {
        setMapFocus({
          lat: DEFAULT_MAP_CENTER.lat,
          lng: DEFAULT_MAP_CENTER.lng,
          zoom: DEFAULT_MAP_ZOOM,
          boundaryGeoJson: null,
          token: Date.now(),
        });
        return;
      }

      void (async () => {
        const districtMarkers = markers.filter(
          (marker) =>
            markerMatchesCity(marker, selectedCity) && markerMatchesDistrict(marker, district),
        );
        const view = await resolveDistrictMapView(selectedCity, district, districtMarkers);
        if (requestId !== districtFocusRequestIdRef.current || !view) return;

        setMapFocus({
          bounds: view.bounds,
          boundaryGeoJson: view.boundaryGeoJson,
          token: Date.now(),
        });
      })();
    },
    [clearNearbyMode, closeDrawerAndScrollToResults, markers, selectedCity],
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

      setSelectedCity("");
      setSelectedDistrict("");
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
    if (selectedDistrict) return true;
    if (nearbyActive) return true;
    if (defaultCity && selectedCity !== defaultCity) return true;
    return false;
  }, [
    searchQuery,
    appliedSearchQuery,
    selectedDistrict,
    nearbyActive,
    selectedCity,
    defaultCity,
  ]);

  const handleResetFilters = useCallback(() => {
    nearbyRequestIdRef.current += 1;
    nearbyInFlightRef.current = false;
    activeGeoCancelRef.current?.();
    activeGeoCancelRef.current = null;
    setNearbyLoading(false);
    setSearchQuery("");
    setAppliedSearchQuery("");
    setSelectedDistrict("");
    setSelectedCity(defaultCity);
    clearNearbyMode();
    setMapFocus({
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      zoom: DEFAULT_MAP_ZOOM,
      boundaryGeoJson: null,
      token: Date.now(),
    });
    closeDrawerAndScrollToResults();
  }, [defaultCity, clearNearbyMode, closeDrawerAndScrollToResults]);

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
    cities,
    districts,
    selectedCity,
    selectedDistrict,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    onSearchSubmit: handleSearchSubmit,
    onCityChange: handleCityChange,
    onDistrictChange: handleDistrictChange,
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
              loading={loading}
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
