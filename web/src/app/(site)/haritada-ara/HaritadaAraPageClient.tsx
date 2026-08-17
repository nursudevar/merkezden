"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { SlidersHorizontal } from "lucide-react";
import CategoryBreadcrumb from "@/components/category/CategoryBreadcrumb";
import { HaritadaAraFilterSidebar } from "@/components/map/HaritadaAraFilterSidebar";
import { InstitutionMapSearchExperience } from "@/components/map/InstitutionMapSearchExperience";
import type { InstitutionMapFocusTarget } from "@/components/map/InstitutionLocationsMap";
import { useHaritadaAraMapMarkers } from "@/hooks/useHaritadaAraMapMarkers";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FavoritesError,
  getMyFavoriteInstitutionIds,
  getMyFavoriteInstructorIds,
  toggleFavorite,
  toggleInstructorFavorite,
} from "@/lib/favorites/favoritesClient";
import {
  getMapMarkerAccountType,
  type InstitutionMapMarker,
} from "@/lib/institutionMapMarkers";
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
import {
  readKurumTuruSlugsFromSearch,
  resolveInstitutionIdsByKurumTuruSlugs,
  writeKurumTuruSlugsToParams,
  type KurumTuruSlug,
} from "@/lib/institutionSchoolStatusFilter";
import {
  fetchActiveInstitutionCategories,
  type ActiveInstitutionCategory,
} from "@/lib/categoryHelpers";
import { fetchInstructorFeatureCategoriesClient } from "@/lib/instructorFeaturesClient";
import {
  mergeMapSearchCategories,
  markerMatchesSelectedCategories,
  readMapCategorySlugsFromSearch,
  sanitizeMapCategorySlugs,
  writeMapCategorySlugsToParams,
} from "@/lib/institutionMapCategoryFilter";
import {
  readMapHesapTipiFromSearch,
  writeMapHesapTipiToParams,
  type MapHesapTipi,
} from "@/lib/mapSearchAccountType";

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

export function HaritadaAraPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { markers, loading } = useHaritadaAraMapMarkers();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [instructorFavoriteIds, setInstructorFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [instructorFavoriteActionLoadingIds, setInstructorFavoriteActionLoadingIds] = useState<
    Set<number>
  >(() => new Set());

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const isFilterOpenRef = useRef(false);
  isFilterOpenRef.current = isFilterOpen;
  const resultsScrollRef = useRef<HTMLDivElement>(null);

  const [selectedIlId, setSelectedIlId] = useState("");
  const [defaultIlId, setDefaultIlId] = useState("");
  const [selectedIlceId, setSelectedIlceId] = useState("");
  const [selectedMahalleId, setSelectedMahalleId] = useState("");
  const [selectedKurumTuru, setSelectedKurumTuru] = useState<KurumTuruSlug[]>([]);
  const [kurumTuruAllowedIds, setKurumTuruAllowedIds] = useState<Set<number> | null>(null);
  const [selectedHesapTipi, setSelectedHesapTipi] = useState<MapHesapTipi>("hepsi");
  const [mapCategories, setMapCategories] = useState<ActiveInstitutionCategory[]>([]);
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>([]);
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
  const mapCategoriesRef = useRef(mapCategories);
  markersRef.current = markers;
  illerRef.current = iller;
  mapCategoriesRef.current = mapCategories;

  const mapCategoriesReady = mapCategories.length > 0;
  const mapCategoriesKey = useMemo(
    () => mapCategories.map((category) => category.slug).join("\0"),
    [mapCategories],
  );

  const selectedIlAd = iller.find((row) => String(row.id) === selectedIlId)?.ad ?? "";
  const selectedIlceAd = ilceler.find((row) => String(row.id) === selectedIlceId)?.ad ?? "";
  const selectedIlIdNum = parseLocationId(selectedIlId);
  const selectedIlceIdNum = parseLocationId(selectedIlceId);
  const selectedMahalleIdNum = parseLocationId(selectedMahalleId);

  const filteredMarkers = useMemo(() => {
    if (!locationDefaultsReady) return [];
    const searchKey = normalizeLocationKey(appliedSearchQuery);
    const filtered = markers.filter((marker) => {
      const accountType = getMapMarkerAccountType(marker);
      if (selectedHesapTipi === "kurumlar" && accountType !== "institution") return false;
      if (selectedHesapTipi === "egitmenler" && accountType !== "instructor") return false;
      if (!markerMatchesLocationIds(marker, selectedIlIdNum, selectedIlceIdNum, selectedMahalleIdNum)) {
        return false;
      }
      if (
        accountType === "institution" &&
        kurumTuruAllowedIds &&
        !kurumTuruAllowedIds.has(marker.id)
      ) {
        return false;
      }
      if (!markerMatchesSelectedCategories(marker, selectedCategorySlugs, mapCategories)) {
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
          marker.branch ?? "",
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
    selectedHesapTipi,
    kurumTuruAllowedIds,
    selectedCategorySlugs,
    mapCategories,
    appliedSearchQuery,
    nearbyActive,
    userLocation,
  ]);

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
    let cancelled = false;

    void (async () => {
      try {
        const [institutionRows, instructorResult] = await Promise.all([
          fetchActiveInstitutionCategories(),
          fetchInstructorFeatureCategoriesClient(),
        ]);
        if (cancelled) return;
        setMapCategories(
          mergeMapSearchCategories(institutionRows, instructorResult.categories ?? []),
        );
      } catch (error) {
        console.error("Harita kategorileri yüklenemedi:", error);
        if (!cancelled) setMapCategories([]);
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
      setSelectedKurumTuru(readKurumTuruSlugsFromSearch(searchKey));
      setSelectedHesapTipi(readMapHesapTipiFromSearch(searchKey));
      const categorySlugs = readMapCategorySlugsFromSearch(searchKey);
      const categories = mapCategoriesRef.current;
      setSelectedCategorySlugs(
        categories.length > 0
          ? sanitizeMapCategorySlugs(categorySlugs, categories)
          : categorySlugs,
      );
      lastHydratedSearchKeyRef.current = searchKey;
      if (nextIlceId || nextMahalleId) {
        void focusMapForLocation(nextIlId, nextIlceId, nextMahalleId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultIlId, focusMapForLocation, mapCategoriesKey, locationDefaultsReady, searchKey]);

  useEffect(() => {
    if (!locationDefaultsReady) return;
    if (lastHydratedSearchKeyRef.current !== searchKey) return;
    const pendingCategorySlugs = readMapCategorySlugsFromSearch(searchKey);
    if (pendingCategorySlugs.length > 0 && !mapCategoriesReady) return;
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
      writeKurumTuruSlugsToParams(params, selectedKurumTuru);
      writeMapHesapTipiToParams(params, selectedHesapTipi);
      writeMapCategorySlugsToParams(params, selectedCategorySlugs);
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
    mapCategoriesReady,
    selectedIlId,
    selectedIlceId,
    selectedMahalleId,
    selectedKurumTuru,
    selectedHesapTipi,
    selectedCategorySlugs,
  ]);

  useEffect(() => {
    if (selectedKurumTuru.length === 0) {
      setKurumTuruAllowedIds(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const ids = await resolveInstitutionIdsByKurumTuruSlugs(supabase, selectedKurumTuru);
        if (!cancelled) setKurumTuruAllowedIds(new Set(ids));
      } catch (error) {
        console.error("Kurum türü filtresi yüklenemedi:", error);
        if (!cancelled) setKurumTuruAllowedIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKurumTuru]);

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
      setInstructorFavoriteIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoriteActionLoadingIds(new Set());
      setInstructorFavoriteActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    void (async () => {
      try {
        const [institutionIds, instructorIds] = await Promise.all([
          getMyFavoriteInstitutionIds(),
          getMyFavoriteInstructorIds(),
        ]);
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(institutionIds));
        setInstructorFavoriteIds(new Set(instructorIds));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === "NOT_INDIVIDUAL") {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
          setInstructorFavoriteIds(new Set());
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
    if (selectedKurumTuru.length > 0 && selectedHesapTipi !== "egitmenler") return true;
    if (selectedHesapTipi !== "hepsi") return true;
    if (selectedCategorySlugs.length > 0) return true;
    if (nearbyActive) return true;
    if (defaultIlId && selectedIlId !== defaultIlId) return true;
    return false;
  }, [
    searchQuery,
    appliedSearchQuery,
    selectedIlceId,
    selectedMahalleId,
    selectedKurumTuru,
    selectedHesapTipi,
    selectedCategorySlugs,
    nearbyActive,
    selectedIlId,
    defaultIlId,
  ]);

  const handleHesapTipiChange = useCallback(
    (value: MapHesapTipi) => {
      setSelectedHesapTipi(value);
      closeDrawerAndScrollToResults();
    },
    [closeDrawerAndScrollToResults],
  );

  const handleKurumTuruToggle = useCallback((slug: KurumTuruSlug) => {
    setSelectedKurumTuru((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug],
    );
    closeDrawerAndScrollToResults();
  }, [closeDrawerAndScrollToResults]);

  const handleCategorySelectAll = useCallback(() => {
    setSelectedCategorySlugs([]);
    closeDrawerAndScrollToResults();
  }, [closeDrawerAndScrollToResults]);

  const handleCategoryToggle = useCallback(
    (slug: string) => {
      const normalizedSlug = slug.trim().toLowerCase();
      setSelectedCategorySlugs((prev) => {
        if (prev.includes(normalizedSlug)) {
          return prev.filter((item) => item !== normalizedSlug);
        }
        return [...prev, normalizedSlug];
      });
      closeDrawerAndScrollToResults();
    },
    [closeDrawerAndScrollToResults],
  );

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
    setSelectedKurumTuru([]);
    setSelectedHesapTipi("hepsi");
    setSelectedCategorySlugs([]);
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
    async (
      entityId: number,
      e: React.MouseEvent,
      accountType: "institution" | "instructor" = "institution",
    ) => {
      e.preventDefault();
      e.stopPropagation();

      if (!user || !favoritesEnabled) return;

      if (accountType === "instructor") {
        if (instructorFavoriteActionLoadingIds.has(entityId)) return;
        const wasFavorited = instructorFavoriteIds.has(entityId);
        setInstructorFavoriteActionLoadingIds((prev) => {
          const next = new Set(prev);
          next.add(entityId);
          return next;
        });
        setInstructorFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.delete(entityId);
          else next.add(entityId);
          return next;
        });
        try {
          const res = await toggleInstructorFavorite(entityId);
          setInstructorFavoriteIds((prev) => {
            const next = new Set(prev);
            if (res.isFavorited) next.add(entityId);
            else next.delete(entityId);
            return next;
          });
        } catch {
          setInstructorFavoriteIds((prev) => {
            const next = new Set(prev);
            if (wasFavorited) next.add(entityId);
            else next.delete(entityId);
            return next;
          });
        } finally {
          setInstructorFavoriteActionLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(entityId);
            return next;
          });
        }
        return;
      }

      if (favoriteActionLoadingIds.has(entityId)) return;
      const wasFavorited = favoriteIds.has(entityId);
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.add(entityId);
        return next;
      });
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(entityId);
        else next.add(entityId);
        return next;
      });

      try {
        const res = await toggleFavorite(entityId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (res.isFavorited) next.add(entityId);
          else next.delete(entityId);
          return next;
        });
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(entityId);
          else next.delete(entityId);
          return next;
        });
      } finally {
        setFavoriteActionLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(entityId);
          return next;
        });
      }
    },
    [
      user,
      favoritesEnabled,
      favoriteActionLoadingIds,
      favoriteIds,
      instructorFavoriteActionLoadingIds,
      instructorFavoriteIds,
    ],
  );

  const filterSidebarProps = {
    iller,
    ilceler,
    mahalleler,
    selectedIlId,
    selectedIlceId,
    selectedMahalleId,
    selectedKurumTuru,
    selectedHesapTipi,
    onHesapTipiChange: handleHesapTipiChange,
    mapCategories,
    selectedCategorySlugs,
    onCategorySelectAll: handleCategorySelectAll,
    onCategoryToggle: handleCategoryToggle,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    onSearchSubmit: handleSearchSubmit,
    onIlChange: handleIlChange,
    onIlceChange: handleIlceChange,
    onMahalleChange: handleMahalleChange,
    onKurumTuruToggle: handleKurumTuruToggle,
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
          <div className="haritada-ara-filter-panel">
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
              instructorFavoriteIds={instructorFavoriteIds}
              favoritesEnabled={favoritesEnabled && !favoritesLoading}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              instructorFavoriteActionLoadingIds={instructorFavoriteActionLoadingIds}
              isAuthenticated={Boolean(user)}
              hesapTipi={selectedHesapTipi}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
