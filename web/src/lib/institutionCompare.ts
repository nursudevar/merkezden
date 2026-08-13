export const INSTITUTION_COMPARE_STORAGE_KEY = "merkezden-institution-compare";
export const INSTITUTION_COMPARE_MAX = 3;

export type InstitutionCompareItem = {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string;
};

function isPositiveInstitutionId(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isInteger(value);
}

export function normalizeInstitutionCompareItem(
  value: unknown,
): InstitutionCompareItem | null {
  if (value == null || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "number" ? row.id : Number(row.id);
  if (!isPositiveInstitutionId(id)) return null;

  const name = String(row.name ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  if (!name || !slug) return null;

  const imageUrl = String(row.imageUrl ?? "").trim();
  return imageUrl ? { id, name, slug, imageUrl } : { id, name, slug };
}

export function parseInstitutionCompareItems(raw: unknown): InstitutionCompareItem[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<number>();
  const items: InstitutionCompareItem[] = [];
  for (const entry of raw) {
    const item = normalizeInstitutionCompareItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= INSTITUTION_COMPARE_MAX) break;
  }
  return items;
}

export function addInstitutionCompareItem(
  items: InstitutionCompareItem[],
  candidate: unknown,
): InstitutionCompareItem[] {
  const item = normalizeInstitutionCompareItem(candidate);
  if (!item) return items;
  if (items.some((current) => current.id === item.id)) return items;
  if (items.length >= INSTITUTION_COMPARE_MAX) return items;
  return [...items, item];
}

export function removeInstitutionCompareItem(
  items: InstitutionCompareItem[],
  institutionId: number,
): InstitutionCompareItem[] {
  if (!isPositiveInstitutionId(institutionId)) return items;
  return items.filter((item) => item.id !== institutionId);
}

export function toggleInstitutionCompareItem(
  items: InstitutionCompareItem[],
  candidate: unknown,
): InstitutionCompareItem[] {
  const item = normalizeInstitutionCompareItem(candidate);
  if (!item) return items;
  if (items.some((current) => current.id === item.id)) {
    return removeInstitutionCompareItem(items, item.id);
  }
  return addInstitutionCompareItem(items, item);
}

export function clearInstitutionCompareItems(): InstitutionCompareItem[] {
  return [];
}

/** URL `?ids=12,34,56` — pozitif tam sayı, sıra korunur, duplicate yok, en fazla 3. */
export function parseCompareInstitutionIdsFromQuery(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of String(raw).split(",")) {
    const trimmed = part.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) continue;
    const id = Number(trimmed);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= INSTITUTION_COMPARE_MAX) break;
  }
  return ids;
}

export function readInstitutionCompareFromStorage(): InstitutionCompareItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INSTITUTION_COMPARE_STORAGE_KEY);
    if (!raw) return [];
    return parseInstitutionCompareItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeInstitutionCompareToStorage(items: InstitutionCompareItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      INSTITUTION_COMPARE_STORAGE_KEY,
      JSON.stringify(parseInstitutionCompareItems(items)),
    );
  } catch {
    // private mode / quota
  }
}
