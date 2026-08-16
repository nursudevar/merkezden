"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeProfileSearchText } from "@/lib/profileSearch";

export type TurkiyeLocationOption = {
  id: number;
  ad: string;
  slug: string;
};

export const HOME_DEFAULT_CITY_AD = "Ankara";
const LOCATION_PAGE_SIZE = 1000;

export function toLocationIdString(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) return String(parsed);
    }
  }
  return "";
}

export function parseLocationId(value: unknown): number | null {
  const asString = toLocationIdString(value);
  if (!asString) return null;
  const parsed = Number(asString);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function sortLocationOptions(rows: TurkiyeLocationOption[]): TurkiyeLocationOption[] {
  return [...rows].sort((a, b) => a.ad.localeCompare(b.ad, "tr", { sensitivity: "base" }));
}

export function locationOptionMatches(ad: string, query: string): boolean {
  const needle = normalizeProfileSearchText(query);
  if (!needle) return true;
  return normalizeProfileSearchText(ad).includes(needle);
}

export function findLocationIdByAd(rows: TurkiyeLocationOption[], ad: string): string {
  const target = normalizeProfileSearchText(ad);
  if (!target) return "";
  const match = rows.find((row) => normalizeProfileSearchText(row.ad) === target);
  return match ? String(match.id) : "";
}

export function normalizeLocationSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function findLocationIdBySlug(rows: TurkiyeLocationOption[], slug: string): string {
  const target = normalizeLocationSlug(slug);
  if (!target) return "";
  const match = rows.find((row) => normalizeLocationSlug(row.slug) === target);
  return match ? String(match.id) : "";
}

export function findLocationSlugById(rows: TurkiyeLocationOption[], id: unknown): string {
  const parsed = parseLocationId(id);
  if (parsed == null) return "";
  const match = rows.find((row) => row.id === parsed);
  return normalizeLocationSlug(match?.slug ?? "");
}

function parseLocationRows(data: unknown): TurkiyeLocationOption[] {
  if (!Array.isArray(data)) return [];
  const rows: TurkiyeLocationOption[] = [];
  const seen = new Set<number>();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const id = Number((item as { id?: unknown }).id);
    const ad = String((item as { ad?: unknown }).ad ?? "").trim();
    const slug = String((item as { slug?: unknown }).slug ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !ad || seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, ad, slug });
  }
  return sortLocationOptions(rows);
}

async function fetchLocationRows(
  table: "iller" | "ilceler" | "mahalleler",
  filter?: { column: "il_id" | "ilce_id"; value: number },
): Promise<TurkiyeLocationOption[]> {
  const supabase = createSupabaseBrowserClient();
  const all: TurkiyeLocationOption[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select("id, ad, slug")
      .order("id", { ascending: true })
      .range(from, from + LOCATION_PAGE_SIZE - 1);
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message || `${table} yüklenemedi.`);
    }
    all.push(...parseLocationRows(data));
    if (!data || data.length < LOCATION_PAGE_SIZE) break;
    from += LOCATION_PAGE_SIZE;
  }

  return sortLocationOptions(all);
}

let illerPromise: Promise<TurkiyeLocationOption[]> | null = null;
const ilcelerByIlIdPromise = new Map<number, Promise<TurkiyeLocationOption[]>>();
const mahallelerByIlceIdPromise = new Map<number, Promise<TurkiyeLocationOption[]>>();

function cachedLocationFetch(
  cache: Map<number, Promise<TurkiyeLocationOption[]>>,
  key: number,
  loader: () => Promise<TurkiyeLocationOption[]>,
): Promise<TurkiyeLocationOption[]> {
  const existing = cache.get(key);
  if (existing) return existing;
  const next = loader().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, next);
  return next;
}

export function fetchIller(): Promise<TurkiyeLocationOption[]> {
  if (!illerPromise) {
    illerPromise = fetchLocationRows("iller").catch((error) => {
      illerPromise = null;
      throw error;
    });
  }
  return illerPromise;
}

export function fetchIlcelerByIlId(ilId: number): Promise<TurkiyeLocationOption[]> {
  return cachedLocationFetch(ilcelerByIlIdPromise, ilId, () =>
    fetchLocationRows("ilceler", { column: "il_id", value: ilId }),
  );
}

export function fetchMahallelerByIlceId(ilceId: number): Promise<TurkiyeLocationOption[]> {
  return cachedLocationFetch(mahallelerByIlceIdPromise, ilceId, () =>
    fetchLocationRows("mahalleler", { column: "ilce_id", value: ilceId }),
  );
}

export function findLocationAdById(rows: TurkiyeLocationOption[], id: unknown): string {
  const parsed = parseLocationId(id);
  if (parsed == null) return "";
  const match = rows.find((row) => row.id === parsed);
  return String(match?.ad ?? "").trim();
}

export type LocationAdMaps = {
  ilAdById: Map<number, string>;
  ilceAdById: Map<number, string>;
};

export function formatInstructorLocationLabel(
  ilAd: string,
  ilceAd: string,
  empty = "-",
): string {
  const city = String(ilAd ?? "").trim();
  const district = String(ilceAd ?? "").trim();
  if (city && district) return `${district} / ${city}`;
  return district || city || empty;
}

export function formatAnnouncementLocationLabel(ilAd: string, ilceAd: string): string {
  const city = String(ilAd ?? "").trim();
  const district = String(ilceAd ?? "").trim();
  if (city && district) return `${city} / ${district}`;
  return city || district;
}

export async function buildLocationAdMaps(
  rows: Array<{ il_id?: unknown; ilce_id?: unknown }>,
): Promise<LocationAdMaps> {
  const uniqueIlIds = [
    ...new Set(
      rows
        .map((row) => parseLocationId(row.il_id))
        .filter((id): id is number => id != null),
    ),
  ];

  const ilAdById = new Map<number, string>();
  const ilceAdById = new Map<number, string>();
  if (uniqueIlIds.length === 0) return { ilAdById, ilceAdById };

  const iller = await fetchIller();
  for (const il of iller) {
    ilAdById.set(il.id, il.ad);
  }

  const ilcelerLists = await Promise.all(uniqueIlIds.map((ilId) => fetchIlcelerByIlId(ilId)));
  for (const list of ilcelerLists) {
    for (const ilce of list) {
      ilceAdById.set(ilce.id, ilce.ad);
    }
  }

  return { ilAdById, ilceAdById };
}

export function lookupLocationAds(
  ilId: unknown,
  ilceId: unknown,
  maps: LocationAdMaps,
): { ilAd: string; ilceAd: string } {
  const parsedIlId = parseLocationId(ilId);
  const parsedIlceId = parseLocationId(ilceId);
  return {
    ilAd: parsedIlId != null ? String(maps.ilAdById.get(parsedIlId) ?? "").trim() : "",
    ilceAd: parsedIlceId != null ? String(maps.ilceAdById.get(parsedIlceId) ?? "").trim() : "",
  };
}
