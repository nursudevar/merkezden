import {
  fetchIlcelerByIlId,
  fetchIller,
  fetchMahallelerByIlceId,
  findLocationAdById,
  parseLocationId,
} from "@/lib/turkiyeLocationsClient";
import type { InstitutionMapMarker, MapLocationPrecision } from "@/lib/institutionMapMarkers";
import { PUBLIC_INSTRUCTORS_TABLE } from "@/lib/publicInstructorClient";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";
import { getPublicInstructorDetailHref } from "@/lib/publicInstructorSearch";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isValidLatLng } from "@/lib/geoDistance";

const INSTRUCTOR_PAGE_SIZE = 1000;
const MAX_INSTRUCTOR_PAGES = 10;
const MAX_DISTRICT_GEOCODE = 24;
const MAX_NEIGHBORHOOD_GEOCODE = 20;
const MAX_ADDRESS_GEOCODE = 8;
const GEOCODE_CONCURRENCY = 2;

const INSTRUCTOR_MAP_SELECT_WITH_ABROAD =
  "id, slug, name, surname, full_name, address, branch, phone, profile_picture, category_id, is_approved, is_active, il_id, ilce_id, mahalle_id, is_abroad";

const INSTRUCTOR_MAP_SELECT =
  "id, slug, name, surname, full_name, address, branch, phone, profile_picture, category_id, is_approved, is_active, il_id, ilce_id, mahalle_id";

type InstructorMapRow = {
  id: number;
  slug?: string | null;
  name?: string | null;
  surname?: string | null;
  full_name?: string | null;
  address?: string | null;
  branch?: string | null;
  phone?: string | null;
  profile_picture?: string | null;
  category_id?: number | null;
  is_approved?: boolean | null;
  is_active?: boolean | null;
  il_id?: number | null;
  ilce_id?: number | null;
  mahalle_id?: number | null;
  is_abroad?: boolean | null;
};

type LatLng = { lat: number; lng: number };

type InstructorLocationLabels = { ilAd: string; ilceAd: string; mahalleAd: string };

type ResolvedInstructorCoords = {
  coords: LatLng;
  precision: MapLocationPrecision;
};

function instructorDisplayName(row: InstructorMapRow): string {
  const fullName = String(row.full_name ?? "").trim();
  if (fullName) return fullName;
  return `${String(row.name ?? "").trim()} ${String(row.surname ?? "").trim()}`.trim() || "Eğitmen";
}

function toPositiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function districtCacheKey(city: string, district: string): string {
  return `${city.trim().toLocaleLowerCase("tr-TR")}::${district.trim().toLocaleLowerCase("tr-TR")}`;
}

function neighborhoodCacheKey(city: string, district: string, neighborhood: string): string {
  return `${districtCacheKey(city, district)}::${neighborhood.trim().toLocaleLowerCase("tr-TR")}`;
}

function placeQueryKey(query: string): string {
  return query.trim().toLocaleLowerCase("tr-TR");
}

const districtCentroidCache = new Map<string, LatLng | null>();
const placeLatLngCache = new Map<string, LatLng | null>();

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const current = items[index];
        index += 1;
        await mapper(current);
      }
    }),
  );
}

async function resolveDistrictCentroid(city: string, district: string): Promise<LatLng | null> {
  const trimmedCity = city.trim();
  const trimmedDistrict = district.trim();
  if (!trimmedCity || !trimmedDistrict) return null;

  const key = districtCacheKey(trimmedCity, trimmedDistrict);
  if (districtCentroidCache.has(key)) return districtCentroidCache.get(key) ?? null;

  try {
    const params = new URLSearchParams({ city: trimmedCity, district: trimmedDistrict });
    const response = await fetch(`/api/geocode/district-boundary?${params.toString()}`);
    if (!response.ok) {
      districtCentroidCache.set(key, null);
      return null;
    }
    const payload = (await response.json()) as { bounds?: [[number, number], [number, number]] };
    const bounds = payload.bounds;
    if (!bounds || bounds.length < 2) {
      districtCentroidCache.set(key, null);
      return null;
    }
    const south = Number(bounds[0][0]);
    const west = Number(bounds[0][1]);
    const north = Number(bounds[1][0]);
    const east = Number(bounds[1][1]);
    const lat = (south + north) / 2;
    const lng = (west + east) / 2;
    if (!isValidLatLng(lat, lng)) {
      districtCentroidCache.set(key, null);
      return null;
    }
    const next = { lat, lng };
    districtCentroidCache.set(key, next);
    return next;
  } catch {
    districtCentroidCache.set(key, null);
    return null;
  }
}

async function resolvePlaceLatLng(query: string): Promise<LatLng | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  const key = placeQueryKey(trimmed);
  if (placeLatLngCache.has(key)) return placeLatLngCache.get(key) ?? null;

  try {
    const params = new URLSearchParams({ q: trimmed });
    const response = await fetch(`/api/geocode/place?${params.toString()}`);
    if (!response.ok) {
      placeLatLngCache.set(key, null);
      return null;
    }
    const payload = (await response.json()) as { lat?: number; lng?: number };
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    if (!isValidLatLng(lat, lng)) {
      placeLatLngCache.set(key, null);
      return null;
    }
    const next = { lat, lng };
    placeLatLngCache.set(key, next);
    return next;
  } catch {
    placeLatLngCache.set(key, null);
    return null;
  }
}

function buildNeighborhoodQuery(labels: InstructorLocationLabels): string {
  const parts = [labels.mahalleAd, labels.ilceAd, labels.ilAd, "Türkiye"]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(", ");
}

function buildAddressQuery(address: string, labels: InstructorLocationLabels): string | null {
  const trimmedAddress = address.trim();
  if (trimmedAddress.length < 8) return null;
  const locationLabel = formatInstructorMapLocation(labels).toLocaleLowerCase("tr-TR");
  if (trimmedAddress.toLocaleLowerCase("tr-TR") === locationLabel) return null;
  const parts = [trimmedAddress, labels.mahalleAd, labels.ilceAd, labels.ilAd, "Türkiye"]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(", ");
}

async function fetchInstructorMapRows(): Promise<InstructorMapRow[]> {
  const supabase = createSupabaseBrowserClient();
  const rows: InstructorMapRow[] = [];
  let select = INSTRUCTOR_MAP_SELECT_WITH_ABROAD;

  for (let page = 0; page < MAX_INSTRUCTOR_PAGES; page += 1) {
    const from = page * INSTRUCTOR_PAGE_SIZE;
    const to = from + INSTRUCTOR_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(PUBLIC_INSTRUCTORS_TABLE)
      .select(select)
      .eq("is_active", true)
      .eq("is_approved", true)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      if (select === INSTRUCTOR_MAP_SELECT_WITH_ABROAD) {
        select = INSTRUCTOR_MAP_SELECT;
        page -= 1;
        continue;
      }
      throw error;
    }

    const batch = ((data ?? []) as unknown as InstructorMapRow[]).filter(
      (row) => toPositiveId(row.id) != null,
    );
    rows.push(...batch);
    if (batch.length < INSTRUCTOR_PAGE_SIZE) break;
  }

  return rows.filter((row) => row.is_abroad !== true);
}

async function fetchInstructorCategoryMeta(
  categoryIds: number[],
): Promise<Map<number, { name: string; slug: string }>> {
  const map = new Map<number, { name: string; slug: string }>();
  if (categoryIds.length === 0) return map;

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("instructor_categories")
    .select("id, name, slug")
    .in("id", categoryIds)
    .eq("is_active", true);

  if (error || !data?.length) return map;

  for (const item of data as Array<{ id: number; name?: string | null; slug?: string | null }>) {
    const id = toPositiveId(item.id);
    const name = String(item.name ?? "").trim();
    if (id == null || !name) continue;
    map.set(id, { name, slug: String(item.slug ?? "").trim() });
  }
  return map;
}

async function fetchInstructorLocationLabels(
  rows: InstructorMapRow[],
): Promise<Map<number, InstructorLocationLabels>> {
  const labels = new Map<number, InstructorLocationLabels>();
  if (rows.length === 0) return labels;

  const iller = await fetchIller();
  const uniqueIlIds = [
    ...new Set(rows.map((row) => parseLocationId(row.il_id)).filter((id): id is number => id != null)),
  ];
  const uniqueIlceIds = [
    ...new Set(rows.map((row) => parseLocationId(row.ilce_id)).filter((id): id is number => id != null)),
  ];

  const ilcelerLists = await Promise.all(uniqueIlIds.map((ilId) => fetchIlcelerByIlId(ilId)));
  const ilceler = ilcelerLists.flat();
  const mahallelerLists = await Promise.all(uniqueIlceIds.map((ilceId) => fetchMahallelerByIlceId(ilceId)));
  const mahalleler = mahallelerLists.flat();

  for (const row of rows) {
    const id = toPositiveId(row.id);
    if (id == null) continue;
    labels.set(id, {
      ilAd: findLocationAdById(iller, row.il_id),
      ilceAd: findLocationAdById(ilceler, row.ilce_id),
      mahalleAd: findLocationAdById(mahalleler, row.mahalle_id),
    });
  }
  return labels;
}

function formatInstructorMapLocation(parts: InstructorLocationLabels): string {
  return [parts.ilAd, parts.ilceAd, parts.mahalleAd].map((part) => part.trim()).filter(Boolean).join(", ");
}

let instructorRowsCache: InstructorMapRow[] | null = null;
let instructorRowsInflight: Promise<InstructorMapRow[]> | null = null;

async function getInstructorMapRows(): Promise<InstructorMapRow[]> {
  if (instructorRowsCache) return instructorRowsCache;
  if (instructorRowsInflight) return instructorRowsInflight;
  instructorRowsInflight = fetchInstructorMapRows()
    .then((rows) => {
      instructorRowsCache = rows;
      return rows;
    })
    .finally(() => {
      instructorRowsInflight = null;
    });
  return instructorRowsInflight;
}

export function prefetchInstructorMapRows(): void {
  void getInstructorMapRows();
}

async function resolveInstructorCoords(
  row: InstructorMapRow,
  labels: InstructorLocationLabels,
): Promise<ResolvedInstructorCoords | null> {
  const addressQuery = buildAddressQuery(String(row.address ?? ""), labels);
  if (addressQuery) {
    const fromAddress = placeLatLngCache.get(placeQueryKey(addressQuery));
    if (fromAddress && isValidLatLng(fromAddress.lat, fromAddress.lng)) {
      return { coords: fromAddress, precision: "address" };
    }
  }

  if (labels.mahalleAd && labels.ilceAd && labels.ilAd) {
    const fromNeighborhood = placeLatLngCache.get(placeQueryKey(buildNeighborhoodQuery(labels)));
    if (fromNeighborhood && isValidLatLng(fromNeighborhood.lat, fromNeighborhood.lng)) {
      return { coords: fromNeighborhood, precision: "neighborhood" };
    }
  }

  if (labels.ilAd && labels.ilceAd) {
    const fromDistrict = districtCentroidCache.get(districtCacheKey(labels.ilAd, labels.ilceAd));
    if (fromDistrict && isValidLatLng(fromDistrict.lat, fromDistrict.lng)) {
      return { coords: fromDistrict, precision: "district" };
    }
  }

  return null;
}

export async function fetchInstructorMapMarkers(): Promise<InstitutionMapMarker[]> {
  const rows = await getInstructorMapRows();
  if (rows.length === 0) return [];

  const categoryIds = [
    ...new Set(rows.map((row) => toPositiveId(row.category_id)).filter((id): id is number => id != null)),
  ];
  const [categoryMeta, locationLabels] = await Promise.all([
    fetchInstructorCategoryMeta(categoryIds),
    fetchInstructorLocationLabels(rows),
  ]);

  const addressQueries = new Map<string, string>();
  const neighborhoodQueries = new Map<string, string>();
  const districtQueries = new Map<string, { city: string; district: string }>();

  for (const row of rows) {
    const id = toPositiveId(row.id);
    if (id == null) continue;
    const labels = locationLabels.get(id);
    if (!labels) continue;

    const addressQuery = buildAddressQuery(String(row.address ?? ""), labels);
    if (addressQuery && !addressQueries.has(placeQueryKey(addressQuery))) {
      addressQueries.set(placeQueryKey(addressQuery), addressQuery);
    }
    if (labels.mahalleAd && labels.ilceAd && labels.ilAd) {
      const neighborhoodQuery = buildNeighborhoodQuery(labels);
      const key = neighborhoodCacheKey(labels.ilAd, labels.ilceAd, labels.mahalleAd);
      if (!neighborhoodQueries.has(key)) neighborhoodQueries.set(key, neighborhoodQuery);
    }
    if (labels.ilAd && labels.ilceAd) {
      const key = districtCacheKey(labels.ilAd, labels.ilceAd);
      if (!districtQueries.has(key)) {
        districtQueries.set(key, { city: labels.ilAd, district: labels.ilceAd });
      }
    }
  }

  await Promise.all([
    mapWithConcurrency(
      Array.from(addressQueries.values()).slice(0, MAX_ADDRESS_GEOCODE),
      GEOCODE_CONCURRENCY,
      async (query) => {
        await resolvePlaceLatLng(query);
      },
    ),
    mapWithConcurrency(
      Array.from(neighborhoodQueries.values()).slice(0, MAX_NEIGHBORHOOD_GEOCODE),
      GEOCODE_CONCURRENCY,
      async (query) => {
        await resolvePlaceLatLng(query);
      },
    ),
    mapWithConcurrency(
      Array.from(districtQueries.values()).slice(0, MAX_DISTRICT_GEOCODE),
      GEOCODE_CONCURRENCY,
      async ({ city, district }) => {
        await resolveDistrictCentroid(city, district);
      },
    ),
  ]);

  const supabase = createSupabaseBrowserClient();
  const markers: InstitutionMapMarker[] = [];

  for (const row of rows) {
    const id = toPositiveId(row.id);
    if (id == null) continue;
    const labels = locationLabels.get(id) ?? { ilAd: "", ilceAd: "", mahalleAd: "" };
    const resolved = await resolveInstructorCoords(row, labels);
    if (!resolved) continue;

    const categoryId = toPositiveId(row.category_id);
    const category = categoryId != null ? categoryMeta.get(categoryId) : undefined;
    const locationLabel = formatInstructorMapLocation(labels);
    const address = String(row.address ?? "").trim() || locationLabel || "Konum bilgisi bulunamadı";
    const slug = String(row.slug ?? "").trim() || String(id);

    markers.push({
      id,
      slug,
      institution_name: instructorDisplayName(row),
      address,
      official_phone: String(row.phone ?? "").trim(),
      official_email: "",
      logoUrl: resolvePublicInstructorProfilePictureUrl(String(row.profile_picture ?? "").trim(), supabase),
      institutionTypeName: "Eğitmen",
      latitude: resolved.coords.lat,
      longitude: resolved.coords.lng,
      categoryName: category?.name ?? "",
      categorySlug: category?.slug ?? "",
      categoryId,
      city: labels.ilAd,
      district: labels.ilceAd,
      ilId: parseLocationId(row.il_id),
      ilceId: parseLocationId(row.ilce_id),
      mahalleId: parseLocationId(row.mahalle_id),
      accountType: "instructor",
      mapKey: `instructor:${id}`,
      branch: String(row.branch ?? "").trim(),
      locationPrecision: resolved.precision,
    });
  }

  return markers;
}

export function instructorDetailHref(marker: InstitutionMapMarker): string {
  return getPublicInstructorDetailHref(marker.slug, marker.id);
}

export function isApproximateInstructorLocation(marker: InstitutionMapMarker): boolean {
  return (
    marker.accountType === "instructor" &&
    (marker.locationPrecision === "neighborhood" || marker.locationPrecision === "district")
  );
}
