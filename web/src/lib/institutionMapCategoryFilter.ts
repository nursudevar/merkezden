import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import {
  sortByHomeMainCategoryOrder,
  type ActiveInstitutionCategory,
} from "@/lib/categoryHelpers";

export const MAP_CATEGORY_PARAM = "kategori";

/**
 * Kullanıcı-facing kategori birleştirme ve marker filtreleme için tek canonical anahtar.
 * `&` / `ve` ve bilinen kurs yazımları burada toplanır; dağınık özel if'ler kullanılmaz.
 */
const MAP_CATEGORY_CANONICAL_ALIASES: Readonly<Record<string, string>> = {
  "kurs sinav": "kurs ve sinava hazirlik",
  "kurs ve sinav": "kurs ve sinava hazirlik",
  "kurs sinava hazirlik": "kurs ve sinava hazirlik",
  "sinava hazirlik": "kurs ve sinava hazirlik",
};

export function normalizeMapCategory(value: string): string {
  const collapsed = value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/&/g, " ve ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return MAP_CATEGORY_CANONICAL_ALIASES[collapsed] ?? collapsed;
}

export function mapCategoryCanonicalKeys(name: string, slug = ""): string[] {
  const keys = new Set<string>();
  const nameKey = normalizeMapCategory(name);
  const slugKey = normalizeMapCategory(slug);
  if (nameKey) keys.add(nameKey);
  if (slugKey) keys.add(slugKey);
  return [...keys];
}

export function markerMatchesCategoryName(
  marker: InstitutionMapMarker,
  selectedCategory: string,
): boolean {
  const selectedKey = normalizeMapCategory(selectedCategory);
  if (!selectedKey) return false;
  return mapCategoryCanonicalKeys(marker.categoryName, marker.categorySlug).includes(selectedKey);
}

export function markerMatchesSelectedCategories(
  marker: InstitutionMapMarker,
  selectedSlugs: readonly string[],
  categories: readonly ActiveInstitutionCategory[],
): boolean {
  if (selectedSlugs.length === 0) return true;

  const selectedCategories = categories.filter((category) =>
    selectedSlugs.includes(category.slug.trim().toLowerCase()),
  );
  if (selectedCategories.length === 0) return true;

  return selectedCategories.some((category) =>
    mapCategoryCanonicalKeys(marker.categoryName, marker.categorySlug).some((key) =>
      mapCategoryCanonicalKeys(category.name, category.slug).includes(key),
    ),
  );
}

export function readMapCategorySlugsFromSearch(search: string): string[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of params.getAll(MAP_CATEGORY_PARAM)) {
    for (const part of raw.split(",")) {
      const slug = part.trim().toLowerCase();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      result.push(slug);
    }
  }
  return result;
}

export function writeMapCategorySlugsToParams(
  params: URLSearchParams,
  slugs: readonly string[],
): void {
  params.delete(MAP_CATEGORY_PARAM);
  for (const raw of slugs) {
    const slug = raw.trim().toLowerCase();
    if (slug) params.append(MAP_CATEGORY_PARAM, slug);
  }
}

export function mergeMapSearchCategories(
  institutionCategories: readonly ActiveInstitutionCategory[],
  instructorCategories: ReadonlyArray<{ id: number; name: string; slug?: string | null }>,
): ActiveInstitutionCategory[] {
  const byCanonical = new Map<string, ActiveInstitutionCategory>();

  const addCategory = (id: number, name: string, slug: string) => {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    const keys = mapCategoryCanonicalKeys(trimmedName, trimmedSlug);
    if (keys.length === 0) return;
    if (keys.some((key) => byCanonical.has(key))) return;

    const item: ActiveInstitutionCategory = {
      id,
      name: trimmedName,
      slug: trimmedSlug || trimmedName,
    };
    for (const key of keys) {
      byCanonical.set(key, item);
    }
  };

  for (const category of institutionCategories) {
    addCategory(category.id, category.name, category.slug);
  }
  for (const category of instructorCategories) {
    addCategory(-Math.abs(category.id), category.name, String(category.slug ?? ""));
  }

  return sortByHomeMainCategoryOrder([...new Set(byCanonical.values())]);
}

export function sanitizeMapCategorySlugs(
  slugs: readonly string[],
  categories: readonly ActiveInstitutionCategory[],
): string[] {
  const valid = new Set(categories.map((category) => category.slug.trim().toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of slugs) {
    const slug = raw.trim().toLowerCase();
    if (!slug || !valid.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    result.push(slug);
  }
  return result;
}
