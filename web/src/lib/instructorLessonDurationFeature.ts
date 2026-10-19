/** Global eğitmen Ders Süresi min/max number tanımları. */
export const LESSON_DURATION_MIN_SLUG = "ders-suresi-min";
export const LESSON_DURATION_MAX_SLUG = "ders-suresi-max";

export const LESSON_DURATION_LABEL = "Ders Süresi";
export const LESSON_DURATION_PANEL_LABEL = "Ders Süresi (Dakika)";
export const LESSON_DURATION_PANEL_PLACEHOLDER =
  "Tek süre için 50, aralık için 30-40 şeklinde giriniz";
export const LESSON_DURATION_PANEL_FORMAT_ERROR =
  "Ders süresini 50 veya 30-60 formatında girin.";
export const LESSON_DURATION_MIN_INPUT_LABEL = "Minimum";
export const LESSON_DURATION_MAX_INPUT_LABEL = "Maksimum";
export const LESSON_DURATION_UNIT_LABEL = "dakika";

function normalizeFeatureSlug(slug: string | null | undefined): string {
  return String(slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

export function isLessonDurationMinFeature(feature: { slug?: string | null }): boolean {
  return normalizeFeatureSlug(feature.slug) === LESSON_DURATION_MIN_SLUG;
}

export function isLessonDurationMaxFeature(feature: { slug?: string | null }): boolean {
  return normalizeFeatureSlug(feature.slug) === LESSON_DURATION_MAX_SLUG;
}

export function isLessonDurationRangeNumberFeature(feature: { slug?: string | null }): boolean {
  return isLessonDurationMinFeature(feature) || isLessonDurationMaxFeature(feature);
}

function normalizeFeatureNameKey(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Eski multi_select Ders Süresi. Yeni min/max number tanımlarını kapsamaz. */
export function isLegacyLessonDurationMultiSelectFeature(feature: {
  slug?: string | null;
  name?: string | null;
  input_type?: string | null;
}): boolean {
  if (String(feature.input_type ?? "").trim().toLowerCase() !== "multi_select") return false;
  if (isLessonDurationRangeNumberFeature(feature)) return false;
  const slug = normalizeFeatureSlug(feature.slug);
  const name = normalizeFeatureNameKey(feature.name);
  return slug === "ders-suresi" || slug === "ders_suresi" || name === "ders suresi";
}

export function sanitizeLessonDurationInput(raw: string): string {
  return String(raw ?? "").replace(/[^\d]/g, "");
}

export type LessonDurationPanelParse =
  | { kind: "empty" }
  | { kind: "exact"; value: number }
  | { kind: "range"; min: number; max: number }
  | { kind: "invalid" };

/** Paneldeki tek Ders Süresi alanı: `50`, `30-40`, `30 - 40`. */
export function parseLessonDurationPanelInput(raw: string): LessonDurationPanelParse {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { kind: "empty" };
  if (trimmed.startsWith("-") || trimmed.includes("--")) return { kind: "invalid" };
  const dashCount = (trimmed.match(/-/g) ?? []).length;
  if (dashCount > 1) return { kind: "invalid" };
  if (dashCount === 0) {
    if (!/^\d+$/.test(trimmed)) return { kind: "invalid" };
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1) return { kind: "invalid" };
    return { kind: "exact", value };
  }
  const match = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return { kind: "invalid" };
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < 1 || min > max) {
    return { kind: "invalid" };
  }
  return { kind: "range", min, max };
}

/**
 * Kayıtlı min/max değerini tek input metnine çevirir.
 * Eşit değerler tek sayı, aralık `30-60` olur.
 * Yalnız bir taraf doluysa yalnızca o sayı gösterilir; eksik taraf yazılmaz.
 * Sayıya dönmeyen bozuk metin olduğu gibi bırakılır.
 */
export function formatLessonDurationPanelInput(minRaw: string, maxRaw: string): string {
  const minText = String(minRaw ?? "").trim();
  const maxText = String(maxRaw ?? "").trim();
  const minParsed = parseLessonDurationInput(minText);
  const maxParsed = parseLessonDurationInput(maxText);
  const min = minParsed.kind === "ok" ? minParsed.value : null;
  const max = maxParsed.kind === "ok" ? maxParsed.value : null;
  if (min != null && max != null) {
    if (min === max) return String(min);
    return `${min}-${max}`;
  }
  if (min != null) return String(min);
  if (max != null) return String(max);
  if (minText && maxText) return `${minText}-${maxText}`;
  return minText || maxText;
}

export function parseLessonDurationInput(
  raw: string,
): { kind: "empty" } | { kind: "ok"; value: number } | { kind: "invalid" } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { kind: "empty" };
  if (!/^\d+$/.test(trimmed)) return { kind: "invalid" };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { kind: "invalid" };
  return { kind: "ok", value };
}

/**
 * İkisi de boş veya yalnız biri dolu → geçerli.
 * İkisi de doluysa minimum, maksimumdan büyük olamaz.
 * Negatif ve sayı olmayan değer geçersizdir.
 */
export function validateLessonDurationRangeValues(minRaw: string, maxRaw: string): string | null {
  const minParsed = parseLessonDurationInput(minRaw);
  const maxParsed = parseLessonDurationInput(maxRaw);
  if (minParsed.kind === "invalid" || maxParsed.kind === "invalid") {
    return "Ders süresi yalnızca 0 veya pozitif tam sayı olabilir.";
  }
  if (
    minParsed.kind === "ok" &&
    maxParsed.kind === "ok" &&
    maxParsed.value < minParsed.value
  ) {
    return "Maksimum ders süresi, minimum ders süresinden küçük olamaz.";
  }
  return null;
}

export function findLessonDurationRangeDefinitions<T extends { slug?: string | null }>(
  definitions: T[],
): { min: T | undefined; max: T | undefined } {
  return {
    min: definitions.find((feature) => isLessonDurationMinFeature(feature)),
    max: definitions.find((feature) => isLessonDurationMaxFeature(feature)),
  };
}

/** Eşit süre: `50 dakika`. Aralık: `30 — 60 dakika`. Yalnız min/max: mevcut cümle kalıbı. */
export function formatLessonDurationDisplay(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const hasMin = min != null && Number.isFinite(min);
  const hasMax = max != null && Number.isFinite(max);
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax) {
    if (min === max) return `${min} ${LESSON_DURATION_UNIT_LABEL}`;
    return `${min} — ${max} ${LESSON_DURATION_UNIT_LABEL}`;
  }
  if (hasMin) return `${min} ${LESSON_DURATION_UNIT_LABEL}dan başlayan`;
  return `${max} ${LESSON_DURATION_UNIT_LABEL}ya kadar`;
}

/**
 * Fiyat aralığı ile aynı NULL kuralı:
 * ikisi dolu: storedMin <= selectedMax AND storedMax >= selectedMin (ikisi de dolu);
 * yalnız min: storedMax >= selectedMin;
 * yalnız max: storedMin <= selectedMax.
 */
export function lessonDurationStoredOverlapsSelected(args: {
  storedMin: number | null;
  storedMax: number | null;
  selectedMin: number | null;
  selectedMax: number | null;
}): boolean {
  const { storedMin, storedMax, selectedMin, selectedMax } = args;
  const hasSelectedMin = selectedMin != null && Number.isFinite(selectedMin);
  const hasSelectedMax = selectedMax != null && Number.isFinite(selectedMax);
  if (!hasSelectedMin && !hasSelectedMax) return false;
  if (hasSelectedMin && hasSelectedMax) {
    return (
      storedMin != null &&
      storedMax != null &&
      storedMin <= selectedMax! &&
      storedMax >= selectedMin!
    );
  }
  if (hasSelectedMin) return storedMax != null && storedMax >= selectedMin!;
  return storedMin != null && selectedMax != null && storedMin <= selectedMax;
}
