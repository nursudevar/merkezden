/** Feature definition slugs for student age min/max (number_answer). */
export const STUDENT_AGE_MIN_SLUG = "ogrenci-min-yasi";
export const STUDENT_AGE_MAX_SLUG = "ogrenci-max-yasi";

export const STUDENT_AGE_RANGE_LABEL = "Öğrenci Yaşı";
export const STUDENT_AGE_MIN_INPUT_LABEL = "Minimum Yaş";
export const STUDENT_AGE_MAX_INPUT_LABEL = "Maksimum Yaş";

/** Panel / filtre input sınırları */
export const STUDENT_AGE_INPUT_MIN = 0.5;
export const STUDENT_AGE_INPUT_MAX = 99;
export const STUDENT_AGE_INPUT_STEP = 0.5;

/**
 * Eğitmen panelinde Öğrenci Yaşı (min/max) gösterilecek kategori slug'ları.
 * Patili Dostlar ve Sürücü Kursu dahil değildir.
 */
export const INSTRUCTOR_PANEL_STUDENT_AGE_CATEGORY_SLUGS = [
  "kurs-sinava-hazirlik",
  "yabanci-dil",
  "sanat",
  "spor",
  "kisisel-gelisim",
  "mesleki-egitim",
  "ozel-egitim",
] as const;

export function isInstructorPanelStudentAgeCategorySlug(
  slug: string | null | undefined,
): boolean {
  const normalized = String(slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i");
  return (INSTRUCTOR_PANEL_STUDENT_AGE_CATEGORY_SLUGS as readonly string[]).includes(
    normalized,
  );
}

function normalizeFeatureSlug(slug: string | null | undefined): string {
  return String(slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
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

export function isStudentAgeMinFeature(feature: { slug?: string | null }): boolean {
  return normalizeFeatureSlug(feature.slug) === STUDENT_AGE_MIN_SLUG;
}

export function isStudentAgeMaxFeature(feature: { slug?: string | null }): boolean {
  return normalizeFeatureSlug(feature.slug) === STUDENT_AGE_MAX_SLUG;
}

export function isStudentAgeRangeNumberFeature(feature: { slug?: string | null }): boolean {
  return isStudentAgeMinFeature(feature) || isStudentAgeMaxFeature(feature);
}

/**
 * Eski multi_select “Öğrenci Yaşı” (checkbox / Mezun / Özel Gereksinimli).
 * Yeni min/max number alanlarını kapsamaz.
 */
export function isLegacyStudentAgeMultiSelectFeature(feature: {
  slug?: string | null;
  name?: string | null;
  input_type?: string | null;
}): boolean {
  if (feature.input_type !== "multi_select") return false;
  if (isStudentAgeRangeNumberFeature(feature)) return false;
  const slug = normalizeFeatureSlug(feature.slug);
  const name = normalizeFeatureNameKey(feature.name);
  const blob = `${slug.replace(/-/g, " ")} ${name}`.trim();
  return (
    blob.includes("ogrenci yasi") ||
    blob.includes("ogrenci_yasi") ||
    name === "ogrenci yasi" ||
    slug === "ogrenci-yasi" ||
    slug === "ogrenci_yasi"
  );
}

/** Ondalık yaş için güvenli sayı dönüşümü (parseInt / yuvarlama yok). */
export function parseStudentAgeDecimalNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const trimmed = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * Panel input parse: boş | geçerli (>0, ≤99) | geçersiz.
 * Ondalık korunur; yuvarlanmaz.
 */
export function parseStudentAgeDecimalInput(
  raw: string,
): { kind: "empty" } | { kind: "ok"; value: number } | { kind: "invalid" } {
  const trimmed = String(raw ?? "").trim().replace(",", ".");
  if (!trimmed) return { kind: "empty" };
  if (!/^\d+(\.\d+)?$/.test(trimmed) && !/^\.\d+$/.test(trimmed)) return { kind: "invalid" };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { kind: "invalid" };
  if (value <= 0 || value > STUDENT_AGE_INPUT_MAX) return { kind: "invalid" };
  return { kind: "ok", value };
}

/** @deprecated Use parseStudentAgeDecimalInput */
export const parseNonNegativeIntegerAgeInput = parseStudentAgeDecimalInput;

/**
 * Input onChange: boş veya yazılabilir ondalık metin (negatif / harf engelli).
 * Ara durumlar ("1.") serbest bırakılır; nihai doğrulama validate ile yapılır.
 */
export function sanitizeStudentAgeDecimalInput(raw: string): string | null {
  if (raw === "") return "";
  const normalized = String(raw).replace(",", ".");
  if (normalized.includes("-") || normalized.includes("+") || /[eE]/.test(normalized)) {
    return null;
  }
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  return normalized;
}

/** @deprecated Use sanitizeStudentAgeDecimalInput */
export const sanitizeNonNegativeIntegerAgeInput = sanitizeStudentAgeDecimalInput;

/**
 * İkisi de boş → geçerli.
 * Biri dolu biri boş → hata.
 * Değerler > 0 ve ≤ 99; max ≥ min.
 */
export function validateStudentAgeRangeValues(minRaw: string, maxRaw: string): string | null {
  const minTrimmed = String(minRaw ?? "").trim();
  const maxTrimmed = String(maxRaw ?? "").trim();

  if (!minTrimmed && !maxTrimmed) return null;

  if (!minTrimmed || !maxTrimmed) {
    return "Minimum ve maksimum yaş birlikte doldurulmalıdır.";
  }

  const minValue = parseStudentAgeDecimalNumber(minTrimmed);
  const maxValue = parseStudentAgeDecimalNumber(maxTrimmed);

  if (minValue == null || maxValue == null) {
    return "Geçerli bir yaş girin.";
  }

  if (minValue <= 0 || maxValue <= 0) {
    return "Yaş 0'dan büyük olmalıdır.";
  }

  if (minValue > STUDENT_AGE_INPUT_MAX || maxValue > STUDENT_AGE_INPUT_MAX) {
    return "Yaş en fazla 99 olabilir.";
  }

  if (maxValue < minValue) {
    return "Maksimum yaş, minimum yaştan küçük olamaz.";
  }

  return null;
}

export function findStudentAgeRangeDefinitions<T extends { slug?: string | null }>(
  definitions: T[],
): { min: T | undefined; max: T | undefined } {
  return {
    min: definitions.find((f) => isStudentAgeMinFeature(f)),
    max: definitions.find((f) => isStudentAgeMaxFeature(f)),
  };
}

/** Public detay: yuvarlamadan `1.5–4.5 Yaş` veya `7 Yaş`. */
export function formatStudentAgeDisplay(min: number, max: number): string {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const formatOne = (n: number) => String(n);
  if (lo === hi) return `${formatOne(lo)} Yaş`;
  return `${formatOne(lo)}–${formatOne(hi)} Yaş`;
}
