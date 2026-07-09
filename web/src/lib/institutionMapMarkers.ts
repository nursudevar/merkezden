import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";

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
};

type InstitutionLocationRow = {
  institution_id: number;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string | null;
};

type InstitutionRow = {
  id: number;
  institution_name: string | null;
  address: string | null;
  official_phone: string | null;
  official_email: string | null;
  logo: string | null;
  slug: string | null;
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

const LOCATION_CHUNK = 200;
/** PostgREST varsayılan max_rows (1000); range ile sayfalama için sayfa boyutu */
const LOCATION_PAGE_SIZE = 1000;
const MAX_LOCATION_PAGES = 50;

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
      };
      return marker;
    })
    .filter((item): item is InstitutionMapMarker => Boolean(item));
}

async function fetchInstitutionRowsByIds(
  institutionIds: number[],
): Promise<Map<number, InstitutionRow>> {
  if (institutionIds.length === 0) return new Map();

  const supabase = createSupabaseBrowserClient();
  const institutionsById = new Map<number, InstitutionRow>();

  for (let i = 0; i < institutionIds.length; i += LOCATION_CHUNK) {
    const chunk = institutionIds.slice(i, i + LOCATION_CHUNK);
    const { data, error } = await supabase
      .from("institutions")
      .select("id, institution_name, address, official_phone, official_email, logo, slug, institution_type:institution_types(name, category:institution_categories(id, name, slug))")
      .in("id", chunk)
      .eq("is_approved", true);

    if (error || !Array.isArray(data)) continue;
    (data as InstitutionRow[]).forEach((row) => {
      institutionsById.set(row.id, row);
    });
  }

  return institutionsById;
}

async function fetchSuccessLocationsForIds(
  institutionIds: number[],
): Promise<InstitutionLocationRow[]> {
  if (institutionIds.length === 0) return [];

  const supabase = createSupabaseBrowserClient();
  const rows: InstitutionLocationRow[] = [];

  for (let i = 0; i < institutionIds.length; i += LOCATION_CHUNK) {
    const chunk = institutionIds.slice(i, i + LOCATION_CHUNK);
    const { data, error } = await supabase
      .from("institution_locations")
      .select("institution_id, latitude, longitude, geocode_status")
      .in("institution_id", chunk)
      .eq("geocode_status", "success")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error || !Array.isArray(data)) continue;
    rows.push(...(data as InstitutionLocationRow[]));
  }

  return dedupeLocationRowsByInstitutionId(rows);
}

async function fetchAllSuccessLocationRows(): Promise<InstitutionLocationRow[]> {
  const supabase = createSupabaseBrowserClient();
  const locationRows: InstitutionLocationRow[] = [];

  for (let page = 0; page < MAX_LOCATION_PAGES; page += 1) {
    const from = page * LOCATION_PAGE_SIZE;
    const to = from + LOCATION_PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("institution_locations")
      .select("institution_id, latitude, longitude, geocode_status")
      .eq("geocode_status", "success")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("institution_id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!Array.isArray(data)) break;

    const batch = data as InstitutionLocationRow[];
    locationRows.push(...batch);
    if (batch.length < LOCATION_PAGE_SIZE) break;
  }

  return dedupeLocationRowsByInstitutionId(locationRows);
}

/** Ana sayfa: tüm geocode edilmiş kurum konumları */
export async function fetchAllInstitutionMapMarkers(): Promise<InstitutionMapMarker[]> {
  const locationRows = await fetchAllSuccessLocationRows();
  if (locationRows.length === 0) return [];
  const institutionIds = locationRows
    .map((row) => row.institution_id)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const institutionsById = await fetchInstitutionRowsByIds(institutionIds);

  return dedupeMarkersByInstitutionId(
    mergeLocationRowsWithInstitutionRows(locationRows, institutionsById),
  );
}

/** Kategori listesi: yalnızca verilen kurumlar için konum birleştirme */
export async function fetchInstitutionMapMarkersForSources(
  sources: InstitutionMapMarkerSource[],
): Promise<InstitutionMapMarker[]> {
  const validSources = sources.filter(
    (s) => Number.isFinite(s.id) && String(s.slug ?? "").trim() && String(s.name ?? "").trim(),
  );
  if (validSources.length === 0) return [];

  const institutionIds = validSources.map((source) => source.id);
  const locationRows = await fetchSuccessLocationsForIds(institutionIds);
  const institutionsById = await fetchInstitutionRowsByIds(institutionIds);

  return dedupeMarkersByInstitutionId(
    mergeLocationRowsWithInstitutionRows(locationRows, institutionsById),
  );
}
