import type { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/** Ana sayfa / kategori fiyat UI sınırları (choice listesine bağlı değil). */
export const INSTITUTION_PRICE_FILTER_MIN = 0;
export const INSTITUTION_PRICE_FILTER_MAX = 300_000;

export function formatPriceFilterValue(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return safeValue.toLocaleString("tr-TR");
}

/** Panel / filtre input → negatif olmayan tamsayı veya null. */
export function parsePriceInputToIntOrNull(raw: string): number | null {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

/** Public detay / genel bilgiler gösterimi. */
export function formatInstitutionPriceRangeDisplay(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const minN = min == null ? null : Number(min);
  const maxN = max == null ? null : Number(max);
  const hasMin = minN != null && Number.isFinite(minN);
  const hasMax = maxN != null && Number.isFinite(maxN);
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax) {
    return `${formatPriceFilterValue(minN!)} TL - ${formatPriceFilterValue(maxN!)} TL`;
  }
  if (hasMin) return `${formatPriceFilterValue(minN!)} TL'den başlayan`;
  return `${formatPriceFilterValue(maxN!)} TL'ye kadar`;
}

function normalizeFeatureKey(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePriceRangeFromText(raw: string): { min: number; max: number } | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const lower = text.toLocaleLowerCase("tr-TR");
  const norm = normalizeFeatureKey(text);

  const isFree =
    lower.includes("ücretsiz") || norm.includes("ucretsiz") || lower === "0" || lower === "0 tl" || lower === "0₺";
  if (isFree) return { min: 0, max: 0 };

  const compact = text.replace(/\s+/g, "");
  const numericTokens = compact.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const numbers = numericTokens
    .map((tok) => Number(tok.replace(/[.,]/g, "")))
    .filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return null;

  const isUpperOpen =
    /\+/.test(text) ||
    /üzeri/i.test(text) ||
    norm.includes("uzeri") ||
    norm.includes("ve ustu") ||
    norm.includes("ustu") ||
    norm.includes("yukari") ||
    norm.includes("more");
  const isLowerOpen =
    /alt[ıi]/i.test(text) ||
    norm.includes("alti") ||
    norm.includes("altinda") ||
    norm.includes("kadar") ||
    norm.includes("less") ||
    norm.includes("under");

  if (numbers.length >= 2) {
    const min = Math.min(numbers[0], numbers[1]);
    const max = Math.max(numbers[0], numbers[1]);
    return { min, max };
  }

  const single = numbers[0];
  if (isUpperOpen) return { min: single, max: Number.POSITIVE_INFINITY };
  if (isLowerOpen) return { min: 0, max: single };
  return { min: single, max: single };
}

export function rangesOverlap(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  const aMin = Math.min(a.min, a.max);
  const aMax = Math.max(a.min, a.max);
  const bMin = Math.min(b.min, b.max);
  const bMax = Math.max(b.min, b.max);
  return aMin <= bMax && bMin <= aMax;
}

function stripTrailingPriceUnit(text: string): string {
  return text.replace(/\s*(tl|₺)\s*$/gi, "").trim();
}

function parsePriceRangeNumericToken(part: string): number | null {
  const digits = String(part ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Eğitmen fiyat_araligi choice etiketlerinden min/max çıkarır.
 * Örnek: "0-1000", "50.000-100.000", "100.000-200.000"
 */
export function parseInstructorPriceRangeBound(raw: string): { min: number; max: number } | null {
  const text = stripTrailingPriceUnit(String(raw ?? "").trim());
  if (!text) return null;

  const dashParts = text.split("-").map((part) => part.trim()).filter(Boolean);
  if (dashParts.length === 2) {
    const first = parsePriceRangeNumericToken(dashParts[0]);
    const second = parsePriceRangeNumericToken(dashParts[1]);
    if (first !== null && second !== null) {
      return { min: Math.min(first, second), max: Math.max(first, second) };
    }
  }

  return parsePriceRangeFromText(text);
}

/** Virgülle birleştirilmiş birden fazla fiyat aralığını ayrıştırır. */
export function parseAllInstructorPriceRangesFromText(
  raw: string,
): Array<{ min: number; max: number }> {
  const text = stripTrailingPriceUnit(String(raw ?? "").trim());
  if (!text) return [];

  const segments = text
    .split(/[,;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const ranges: Array<{ min: number; max: number }> = [];
  for (const segment of segments) {
    const parsed = parseInstructorPriceRangeBound(segment);
    if (parsed) ranges.push(parsed);
  }

  if (ranges.length === 0) {
    const whole = parseInstructorPriceRangeBound(text);
    if (whole) ranges.push(whole);
  }

  return ranges;
}

/**
 * Eğitmen fiyat etiketi kullanıcı aralığıyla kesişiyor mu?
 * Parse edilemeyen etiketler filtre dışında bırakılmaz (listede kalır).
 */
export function instructorPriceLabelOverlapsUserRange(
  priceLabel: string,
  userRange: { min: number; max: number },
): boolean {
  const instructorRanges = parseAllInstructorPriceRangesFromText(priceLabel);
  if (instructorRanges.length === 0) return true;
  return instructorRanges.some((range) => rangesOverlap(range, userRange));
}

async function fetchAllPagedRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * Kurum fiyat filtresi — institutions.min_fiyat / max_fiyat (range overlap).
 * İkisi dolu: min_fiyat <= selectedMax AND max_fiyat >= selectedMin (kolonlar NOT NULL).
 * Sadece min: max_fiyat >= selectedMin (NOT NULL).
 * Sadece max: min_fiyat <= selectedMax (NOT NULL).
 */
export async function resolveInstitutionIdsByPriceRange(
  supabase: SupabaseBrowser,
  range: { min?: number | null; max?: number | null },
): Promise<number[]> {
  const minRaw = range.min;
  const maxRaw = range.max;
  const hasMin = minRaw != null && Number.isFinite(Number(minRaw));
  const hasMax = maxRaw != null && Number.isFinite(Number(maxRaw));
  if (!hasMin && !hasMax) return [];

  const selectedMin = hasMin ? Math.max(0, Math.floor(Number(minRaw))) : null;
  const selectedMax = hasMax ? Math.max(0, Math.floor(Number(maxRaw))) : null;

  const rows = await fetchAllPagedRows<{ id: number }>(async (from, to) => {
    let query = supabase.from("institutions").select("id");

    if (selectedMin != null && selectedMax != null) {
      query = query
        .not("min_fiyat", "is", null)
        .not("max_fiyat", "is", null)
        .lte("min_fiyat", selectedMax)
        .gte("max_fiyat", selectedMin);
    } else if (selectedMin != null) {
      query = query.not("max_fiyat", "is", null).gte("max_fiyat", selectedMin);
    } else if (selectedMax != null) {
      query = query.not("min_fiyat", "is", null).lte("min_fiyat", selectedMax);
    }

    return query.range(from, to);
  });

  const out: number[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) out.push(id);
  }
  return out;
}
