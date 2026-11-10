import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";

export type LatLngBoundsTuple = [[number, number], [number, number]];

export type DistrictBoundaryGeoJson = {
  type: string;
  coordinates?: unknown;
  geometries?: DistrictBoundaryGeoJson[];
};

export type DistrictMapView = {
  bounds: LatLngBoundsTuple;
  boundaryGeoJson: DistrictBoundaryGeoJson | null;
  maxZoom?: number;
};

/** Konumsuz varsayılan: Türkiye coğrafi merkezi, ülke geneli görünüm. */
export const DEFAULT_MAP_CENTER = { lat: 39.0, lng: 35.15 };
export const MAP_ZOOM_DEFAULT = 6;
export const MAP_ZOOM_CITY = 10;
export const MAP_ZOOM_DISTRICT = 12;
export const MAP_ZOOM_NEIGHBORHOOD = 15;
export const MAP_FIT_MAX_ZOOM_CITY = 11;
export const MAP_FIT_MAX_ZOOM_DISTRICT = 14;
export const MAP_FIT_MAX_ZOOM_NEIGHBORHOOD = 16;

export type LocationMapFocusView = {
  lat?: number;
  lng?: number;
  zoom?: number;
  bounds?: LatLngBoundsTuple;
  maxZoom?: number;
  boundaryGeoJson: DistrictBoundaryGeoJson | null;
};

const boundaryCache = new Map<string, DistrictMapView>();
const cityViewCache = new Map<string, LocationMapFocusView>();

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

function cacheKey(city: string, district: string): string {
  return `${normalizeKey(city)}::${normalizeKey(district)}`;
}

function parseBoundingBox(raw: unknown): LatLngBoundsTuple | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const south = Number(raw[0]);
  const north = Number(raw[1]);
  const west = Number(raw[2]);
  const east = Number(raw[3]);
  if (![south, north, west, east].every(Number.isFinite)) return null;
  if (south >= north || west >= east) return null;
  return [
    [south, west],
    [north, east],
  ];
}

export function boundsFromMarkers(markers: InstitutionMapMarker[]): LatLngBoundsTuple | null {
  if (markers.length === 0) return null;

  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;

  for (const marker of markers) {
    const lat = Number(marker.latitude);
    const lng = Number(marker.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  }

  if (!Number.isFinite(south) || !Number.isFinite(north) || !Number.isFinite(west) || !Number.isFinite(east)) {
    return null;
  }

  const latPad = Math.max(0.008, (north - south) * 0.12);
  const lngPad = Math.max(0.008, (east - west) * 0.12);

  return [
    [south - latPad, west - lngPad],
    [north + latPad, east + lngPad],
  ];
}

async function fetchDistrictBoundaryFromApi(
  city: string,
  district: string,
): Promise<DistrictMapView | null> {
  const params = new URLSearchParams({ city, district });
  const response = await fetch(`/api/geocode/district-boundary?${params.toString()}`);
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    bounds?: LatLngBoundsTuple;
    boundaryGeoJson?: DistrictBoundaryGeoJson | null;
  };

  if (!payload.bounds) return null;

  return {
    bounds: payload.bounds,
    boundaryGeoJson: payload.boundaryGeoJson ?? null,
  };
}

export async function resolveDistrictMapView(
  city: string,
  district: string,
  markersInDistrict: InstitutionMapMarker[],
): Promise<DistrictMapView | null> {
  const trimmedDistrict = district.trim();
  const trimmedCity = city.trim();
  if (!trimmedDistrict) return null;

  const key = cacheKey(trimmedCity, trimmedDistrict);
  const cached = boundaryCache.get(key);
  if (cached) return cached;

  let view: DistrictMapView | null = null;

  if (trimmedCity) {
    try {
      view = await fetchDistrictBoundaryFromApi(trimmedCity, trimmedDistrict);
    } catch {
      view = null;
    }
  }

  if (!view) {
    const markerBounds = boundsFromMarkers(markersInDistrict);
    if (!markerBounds) return null;
    view = {
      bounds: markerBounds,
      boundaryGeoJson: null,
      maxZoom: MAP_FIT_MAX_ZOOM_DISTRICT,
    };
  } else if (view.maxZoom == null) {
    view = { ...view, maxZoom: MAP_FIT_MAX_ZOOM_DISTRICT };
  }

  boundaryCache.set(key, view);
  return view;
}

async function fetchCityCenterFromPlaceApi(
  city: string,
): Promise<LocationMapFocusView | null> {
  const params = new URLSearchParams({ q: `${city}, Türkiye` });
  const response = await fetch(`/api/geocode/place?${params.toString()}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { lat?: number; lng?: number };
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    zoom: MAP_ZOOM_CITY,
    boundaryGeoJson: null,
  };
}

/**
 * İl odaklı görünüm: önce şehir marker bounds, yoksa mevcut place geocode API.
 * Yeni tablo / ekstra bağımlılık yok.
 */
export async function resolveCityMapView(
  city: string,
  markersInCity: InstitutionMapMarker[],
): Promise<LocationMapFocusView | null> {
  const trimmedCity = city.trim();
  if (!trimmedCity) return null;

  const markerBounds = boundsFromMarkers(markersInCity);
  if (markerBounds) {
    return {
      bounds: markerBounds,
      maxZoom: MAP_FIT_MAX_ZOOM_CITY,
      boundaryGeoJson: null,
    };
  }

  const key = normalizeKey(trimmedCity);
  const cached = cityViewCache.get(key);
  if (cached) return cached;

  let view: LocationMapFocusView | null = null;
  try {
    view = await fetchCityCenterFromPlaceApi(trimmedCity);
  } catch {
    view = null;
  }
  if (!view) return null;
  cityViewCache.set(key, view);
  return view;
}

/** Mahalle: marker bounds; yoksa null (çağıran ilçe/il fallback uygular). */
export function resolveNeighborhoodMapView(
  markersInNeighborhood: InstitutionMapMarker[],
): LocationMapFocusView | null {
  const bounds = boundsFromMarkers(markersInNeighborhood);
  if (!bounds) return null;
  return {
    bounds,
    maxZoom: MAP_FIT_MAX_ZOOM_NEIGHBORHOOD,
    boundaryGeoJson: null,
  };
}

export function defaultMapFocusView(): LocationMapFocusView {
  return {
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
    zoom: MAP_ZOOM_DEFAULT,
    boundaryGeoJson: null,
  };
}

export function parseNominatimDistrictResult(row: {
  boundingbox?: unknown;
  geojson?: DistrictBoundaryGeoJson;
}): DistrictMapView | null {
  const bounds = parseBoundingBox(row.boundingbox);
  if (!bounds) return null;

  return {
    bounds,
    boundaryGeoJson: row.geojson ?? null,
  };
}
