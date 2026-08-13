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
};

const boundaryCache = new Map<string, DistrictMapView>();

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
    };
  }

  boundaryCache.set(key, view);
  return view;
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
