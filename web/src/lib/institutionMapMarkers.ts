import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import { fetchAllPostgrestPages } from "@/lib/postgrestQueryPages";

export type MapAccountType = "institution" | "instructor";

export type MapLocationPrecision = "address" | "neighborhood" | "district";

export type InstitutionMapMarker = {
  id: number;
  slug: string;
  institution_name: string;
  address: string;
  official_phone: string;
  official_email: string;
  logoUrl: string;
  institutionTypeName: string;
  latitude: number;
  longitude: number;
  categoryName: string;
  categorySlug: string;
  categoryId: number | null;
  city: string;
  district: string;
  ilId: number | null;
  ilceId: number | null;
  mahalleId: number | null;
  accountType?: MapAccountType;
  mapKey?: string;
  branch?: string;
  locationPrecision?: MapLocationPrecision;
};

export function getMapMarkerAccountType(marker: InstitutionMapMarker): MapAccountType {
  return marker.accountType === "instructor" ? "instructor" : "institution";
}

export function getMapMarkerKey(marker: InstitutionMapMarker): string {
  return marker.mapKey ?? `${getMapMarkerAccountType(marker)}:${marker.id}`;
}

type InstitutionLocationRow = {
  institution_id: number;
  latitude: number | null;
  longitude: number | null;
};

type InstitutionRow = {
  id: number;
  institution_name: string | null;
  address: string | null;
  official_phone: string | null;
  official_email: string | null;
  logo: string | null;
  slug: string | null;
  city: string | null;
  district: string | null;
  il_id?: number | null;
  ilce_id?: number | null;
  mahalle_id?: number | null;
  institution_type?:
    | {
        name?: string | null;
        category?:
          | {
              id?: number | null;
              name?: string | null;
              slug?: string | null;
            }
          | Array<{
              id?: number | null;
              name?: string | null;
              slug?: string | null;
            }>
          | null;
      }
    | Array<{
        name?: string | null;
        category?:
          | {
              id?: number | null;
              name?: string | null;
              slug?: string | null;
            }
          | Array<{
              id?: number | null;
              name?: string | null;
              slug?: string | null;
            }>
          | null;
      }>
    | null;
};

export type InstitutionMapMarkerSource = {
  id: number;
  slug: string;
  name: string;
  address?: string;
  official_phone?: string;
  official_email?: string;
};

/** Kategori listesinden gelen kurum meta verisi — institution tablosu tekrar sorgulanmaz. */
export type InstitutionMapMarkerListSource = InstitutionMapMarkerSource & {
  logoUrl?: string;
  institutionTypeName?: string;
  categoryName?: string;
  categorySlug?: string;
  categoryId?: number | null;
  city?: string;
  district?: string;
  ilId?: number | null;
  ilceId?: number | null;
  mahalleId?: number | null;
};

const LOCATION_CHUNK = 200;
/** Aynı anda açık tutulan chunk isteği üst sınırı (Supabase yükünü sınırlar) */
const LOCATION_FETCH_CONCURRENCY = 4;

async function mapChunksWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
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

function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

function toMarkerLocationId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dedupeLocationRowsByInstitutionId(
  rows: InstitutionLocationRow[],
): InstitutionLocationRow[] {
  const byId = new Map<number, InstitutionLocationRow>();
  for (const row of rows) {
    const id = row.institution_id;
    if (typeof id !== "number" || !Number.isFinite(id)) continue;
    if (!byId.has(id)) byId.set(id, row);
  }
  return Array.from(byId.values());
}

function dedupeMarkersByInstitutionId(markers: InstitutionMapMarker[]): InstitutionMapMarker[] {
  const byId = new Map<number, InstitutionMapMarker>();
  for (const marker of markers) {
    if (!byId.has(marker.id)) byId.set(marker.id, marker);
  }
  return Array.from(byId.values());
}

function mergeLocationRowsWithListSources(
  locationRows: InstitutionLocationRow[],
  sourcesById: Map<number, InstitutionMapMarkerListSource>,
): InstitutionMapMarker[] {
  return locationRows
    .map((location) => {
      const source = sourcesById.get(location.institution_id);
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      const slug = String(source?.slug ?? "").trim();

      if (!source || !slug || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const marker: InstitutionMapMarker = {
        id: source.id,
        slug,
        institution_name: String(source.name ?? "Kurum").trim() || "Kurum",
        address:
          String(source.address ?? "").trim() || "Adres bilgisi bulunamadı",
        official_phone: String(source.official_phone ?? "").trim(),
        official_email: String(source.official_email ?? "").trim(),
        logoUrl: String(source.logoUrl ?? "").trim(),
        institutionTypeName: String(source.institutionTypeName ?? "").trim(),
        latitude: lat,
        longitude: lng,
        categoryName: String(source.categoryName ?? "").trim(),
        categorySlug: String(source.categorySlug ?? "").trim(),
        categoryId:
          source.categoryId != null && Number.isFinite(Number(source.categoryId))
            ? Number(source.categoryId)
            : null,
        city: String(source.city ?? "").trim(),
        district: String(source.district ?? "").trim(),
        ilId: toMarkerLocationId(source.ilId),
        ilceId: toMarkerLocationId(source.ilceId),
        mahalleId: toMarkerLocationId(source.mahalleId),
        accountType: "institution",
        mapKey: `institution:${source.id}`,
      };
      return marker;
    })
    .filter((item): item is InstitutionMapMarker => Boolean(item));
}

function mergeLocationRowsWithInstitutionRows(
  locationRows: InstitutionLocationRow[],
  institutionsById: Map<number, InstitutionRow>,
): InstitutionMapMarker[] {
  const supabase = createSupabaseBrowserClient();

  return locationRows
    .map((location) => {
      const institution = institutionsById.get(location.institution_id);
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      const slug = String(institution?.slug ?? "").trim();
      const typeJoin = institution?.institution_type;
      const typeRow = Array.isArray(typeJoin) ? typeJoin[0] : typeJoin;
      const categoryJoin = typeRow?.category;
      const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;

      if (!institution || !slug || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const marker: InstitutionMapMarker = {
        id: institution.id,
        slug,
        institution_name: String(institution.institution_name ?? "Kurum").trim() || "Kurum",
        address: String(institution.address ?? "").trim() || "Adres bilgisi bulunamadı",
        official_phone: String(institution.official_phone ?? "").trim(),
        official_email: String(institution.official_email ?? "").trim(),
        logoUrl: resolveInstitutionLogoPublicUrl(supabase, institution.logo),
        institutionTypeName: String(typeRow?.name ?? "").trim(),
        latitude: lat,
        longitude: lng,
        categoryName: String(categoryRow?.name ?? "").trim(),
        categorySlug: String(categoryRow?.slug ?? "").trim(),
        categoryId: Number.isFinite(Number(categoryRow?.id)) ? Number(categoryRow?.id) : null,
        city: String(institution.city ?? "").trim(),
        district: String(institution.district ?? "").trim(),
        ilId: toMarkerLocationId(institution.il_id),
        ilceId: toMarkerLocationId(institution.ilce_id),
        mahalleId: toMarkerLocationId(institution.mahalle_id),
        accountType: "institution",
        mapKey: `institution:${institution.id}`,
      };
      return marker;
    })
    .filter((item): item is InstitutionMapMarker => Boolean(item));
}

/** Popup, filtre, arama ve etkileşim için gereken kurum alanları (fazladan kolon yok). */
const INSTITUTION_MAP_MARKER_SELECT =
  "id, institution_name, address, official_phone, official_email, logo, slug, city, district, il_id, ilce_id, mahalle_id, institution_type:institution_types(name, category:institution_categories(id, name, slug))";

async function fetchInstitutionRowsByIds(
  institutionIds: number[],
): Promise<Map<number, InstitutionRow>> {
  if (institutionIds.length === 0) return new Map();

  const supabase = createSupabaseBrowserClient();
  const institutionsById = new Map<number, InstitutionRow>();
  const chunks = chunkIds(institutionIds, LOCATION_CHUNK);

  await mapChunksWithConcurrency(chunks, LOCATION_FETCH_CONCURRENCY, async (chunk) => {
    const { data, error } = await supabase
      .from("institutions")
      .select(INSTITUTION_MAP_MARKER_SELECT)
      .in("id", chunk)
      .eq("is_approved", true);

    if (error) throw error;
    if (!Array.isArray(data)) {
      throw new Error("Institution map marker chunk returned invalid data");
    }
    for (const row of data as InstitutionRow[]) {
      institutionsById.set(row.id, row);
    }
  });

  return institutionsById;
}

async function fetchSuccessLocationsForIds(
  institutionIds: number[],
): Promise<InstitutionLocationRow[]> {
  if (institutionIds.length === 0) return [];

  const supabase = createSupabaseBrowserClient();
  const rows: InstitutionLocationRow[] = [];
  const chunks = chunkIds(institutionIds, LOCATION_CHUNK);

  await mapChunksWithConcurrency(chunks, LOCATION_FETCH_CONCURRENCY, async (chunk) => {
    const { data, error } = await supabase
      .from("institution_locations")
      .select("institution_id, latitude, longitude")
      .in("institution_id", chunk)
      .eq("geocode_status", "success")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) throw error;
    if (!Array.isArray(data)) {
      throw new Error("Institution location chunk returned invalid data");
    }
    rows.push(...(data as InstitutionLocationRow[]));
  });

  return dedupeLocationRowsByInstitutionId(rows);
}

async function fetchAllSuccessLocationRows(): Promise<InstitutionLocationRow[]> {
  const supabase = createSupabaseBrowserClient();
  // geocode_status yalnızca filtrede; select'te taşınmaz. Eksik sayfa / hata throw eder.
  const locationRows = await fetchAllPostgrestPages<InstitutionLocationRow>((from, to) =>
    supabase
      .from("institution_locations")
      .select("institution_id, latitude, longitude")
      .eq("geocode_status", "success")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("institution_id", { ascending: true })
      .range(from, to),
  );

  return dedupeLocationRowsByInstitutionId(locationRows);
}

/** Ana sayfa: tüm geocode edilmiş kurum konumları */
let allInstitutionMapMarkersCache: InstitutionMapMarker[] | null = null;
let allInstitutionMapMarkersInflight: Promise<InstitutionMapMarker[]> | null = null;

export async function fetchAllInstitutionMapMarkers(): Promise<InstitutionMapMarker[]> {
  if (allInstitutionMapMarkersCache) {
    return allInstitutionMapMarkersCache;
  }
  if (allInstitutionMapMarkersInflight) {
    return allInstitutionMapMarkersInflight;
  }

  allInstitutionMapMarkersInflight = (async () => {
    const locationRows = await fetchAllSuccessLocationRows();
    if (locationRows.length === 0) {
      allInstitutionMapMarkersCache = [];
      return [];
    }
    const institutionIds = locationRows
      .map((row) => row.institution_id)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const institutionsById = await fetchInstitutionRowsByIds(institutionIds);

    const markers = dedupeMarkersByInstitutionId(
      mergeLocationRowsWithInstitutionRows(locationRows, institutionsById),
    );
    allInstitutionMapMarkersCache = markers;
    return markers;
  })().finally(() => {
    allInstitutionMapMarkersInflight = null;
  });

  return allInstitutionMapMarkersInflight;
}

/** Kategori listesi: liste meta verisi + yalnızca konum sorgusu */
export async function fetchInstitutionMapMarkersForListSources(
  sources: InstitutionMapMarkerListSource[],
): Promise<InstitutionMapMarker[]> {
  const validSources = sources.filter(
    (s) => Number.isFinite(s.id) && String(s.slug ?? "").trim() && String(s.name ?? "").trim(),
  );
  if (validSources.length === 0) return [];

  const sourcesById = new Map(validSources.map((source) => [source.id, source]));
  const institutionIds = validSources.map((source) => source.id);
  const locationRows = await fetchSuccessLocationsForIds(institutionIds);

  return dedupeMarkersByInstitutionId(
    mergeLocationRowsWithListSources(locationRows, sourcesById),
  );
}
