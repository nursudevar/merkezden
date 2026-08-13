export const INSTRUCTOR_COMPARE_STORAGE_KEY = "merkezden-instructor-compare";
export const INSTRUCTOR_COMPARE_MAX = 3;

export type InstructorCompareItem = {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string;
};

function isPositiveInstructorId(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isInteger(value);
}

export function normalizeInstructorCompareItem(
  value: unknown,
): InstructorCompareItem | null {
  if (value == null || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "number" ? row.id : Number(row.id);
  if (!isPositiveInstructorId(id)) return null;

  const name = String(row.name ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  if (!name || !slug) return null;

  const imageUrl = String(row.imageUrl ?? "").trim();
  return imageUrl ? { id, name, slug, imageUrl } : { id, name, slug };
}

export function parseInstructorCompareItems(raw: unknown): InstructorCompareItem[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<number>();
  const items: InstructorCompareItem[] = [];
  for (const entry of raw) {
    const item = normalizeInstructorCompareItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= INSTRUCTOR_COMPARE_MAX) break;
  }
  return items;
}

export function addInstructorCompareItem(
  items: InstructorCompareItem[],
  candidate: unknown,
): InstructorCompareItem[] {
  const item = normalizeInstructorCompareItem(candidate);
  if (!item) return items;
  if (items.some((current) => current.id === item.id)) return items;
  if (items.length >= INSTRUCTOR_COMPARE_MAX) return items;
  return [...items, item];
}

export function removeInstructorCompareItem(
  items: InstructorCompareItem[],
  instructorId: number,
): InstructorCompareItem[] {
  if (!isPositiveInstructorId(instructorId)) return items;
  return items.filter((item) => item.id !== instructorId);
}

export function toggleInstructorCompareItem(
  items: InstructorCompareItem[],
  candidate: unknown,
): InstructorCompareItem[] {
  const item = normalizeInstructorCompareItem(candidate);
  if (!item) return items;
  if (items.some((current) => current.id === item.id)) {
    return removeInstructorCompareItem(items, item.id);
  }
  return addInstructorCompareItem(items, item);
}

export function clearInstructorCompareItems(): InstructorCompareItem[] {
  return [];
}

export function readInstructorCompareFromStorage(): InstructorCompareItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INSTRUCTOR_COMPARE_STORAGE_KEY);
    if (!raw) return [];
    return parseInstructorCompareItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeInstructorCompareToStorage(items: InstructorCompareItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      INSTRUCTOR_COMPARE_STORAGE_KEY,
      JSON.stringify(parseInstructorCompareItems(items)),
    );
  } catch {
    // private mode / quota
  }
}

/** URL `?ids=12,34,56` — pozitif tam sayı, sıra korunur, duplicate yok, en fazla 3. */
export function parseCompareInstructorIdsFromQuery(raw: string | null | undefined): number[] {
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
    if (ids.length >= INSTRUCTOR_COMPARE_MAX) break;
  }
  return ids;
}
