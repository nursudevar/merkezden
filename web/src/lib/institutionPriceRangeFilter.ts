import type { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

/** institution_feature_definitions.id — Aylık Ortalama Fiyat Aralığı */
export const INSTITUTION_PRICE_RANGE_DEFINITION_ID = 289;

export type InstitutionPriceRangeOption = {
  label: string;
  min: number;
  max: number;
};

/** institution_feature_choices (definition_id = 289) ile uyumlu seçenekler */
export const INSTITUTION_PRICE_RANGE_OPTIONS: InstitutionPriceRangeOption[] = [
  { label: "0-1000", min: 0, max: 1000 },
  { label: "1000-5000", min: 1000, max: 5000 },
  { label: "5000-10000", min: 5000, max: 10000 },
  { label: "10000-50000", min: 10000, max: 50000 },
  { label: "50.000-100.000", min: 50_000, max: 100_000 },
  { label: "100.000-200.000", min: 100_000, max: 200_000 },
  { label: "200.000-300.000", min: 200_000, max: 300_000 },
];

export const INSTITUTION_PRICE_FILTER_MIN = INSTITUTION_PRICE_RANGE_OPTIONS[0]?.min ?? 0;
export const INSTITUTION_PRICE_FILTER_MAX =
  INSTITUTION_PRICE_RANGE_OPTIONS[INSTITUTION_PRICE_RANGE_OPTIONS.length - 1]?.max ?? 300_000;

export function formatPriceFilterValue(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return safeValue.toLocaleString("tr-TR");
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

export function isInstitutionPriceRangeDefinition(row: {
  id?: number | null;
  name?: string | null;
  slug?: string | null;
}): boolean {
  if (Number(row.id) === INSTITUTION_PRICE_RANGE_DEFINITION_ID) return true;
  return (
    isInstitutionPriceRangeFieldName(row.name ?? "") ||
    isInstitutionPriceRangeFieldName(row.slug ?? "")
  );
}

export function isInstitutionPriceRangeFieldName(name: string): boolean {
  const key = normalizeFeatureKey(name);
  return (
    key.includes("aylik ortalama fiyat") ||
    key.includes("fiyat araligi") ||
    key.includes("ortalama fiyat araligi")
  );
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

export function sortPriceRangeChoicesByMin<T extends { name: string }>(choices: T[]): T[] {
  return [...choices].sort((a, b) => {
    const aRange = parsePriceRangeFromText(a.name);
    const bRange = parsePriceRangeFromText(b.name);
    const aMin = aRange?.min ?? Number.POSITIVE_INFINITY;
    const bMin = bRange?.min ?? Number.POSITIVE_INFINITY;
    if (aMin !== bMin) return aMin - bMin;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

export function orderPriceRangeChoicesFromCanonical<T extends { id: number; name: string }>(
  choices: T[],
): T[] {
  const byLabel = new Map(choices.map((choice) => [choice.name.trim(), choice]));
  const ordered: T[] = [];
  for (const option of INSTITUTION_PRICE_RANGE_OPTIONS) {
    const match = byLabel.get(option.label);
    if (match) ordered.push(match);
  }
  const usedIds = new Set(ordered.map((choice) => choice.id));
  const rest = sortPriceRangeChoicesByMin(choices.filter((choice) => !usedIds.has(choice.id)));
  return [...ordered, ...rest];
}

const QUERY_PAGE_SIZE = 1000;
const MAX_QUERY_PAGES = 50;

async function fetchAllPagedRows<T>(
  runPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const from = page * QUERY_PAGE_SIZE;
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await runPage(from, to);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < QUERY_PAGE_SIZE) break;
  }
  return rows;
}

export async function resolveInstitutionIdsByPriceRange(
  supabase: SupabaseBrowser,
  range: { min: number; max: number },
): Promise<number[]> {
  const userRange = {
    min: Math.max(0, Math.min(range.min, range.max)),
    max: Math.max(range.min, range.max),
  };

  const defsRaw = await fetchAllPagedRows<{
    id: number;
    name?: string | null;
    slug?: string | null;
    input_type?: string | null;
    unit?: string | null;
  }>(async (from, to) =>
    supabase
      .from("institution_feature_definitions")
      .select("id, name, slug, input_type, unit")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const defs = defsRaw.filter((d) => Number.isFinite(d.id) && isInstitutionPriceRangeDefinition(d));
  if (defs.length === 0) return [];

  const defIds = defs.map((d) => d.id);
  const inputTypeByDefId = new Map<number, string>();
  for (const d of defs) {
    inputTypeByDefId.set(d.id, String(d.input_type ?? "").trim().toLowerCase());
  }

  const choicesRaw = await fetchAllPagedRows<{ id: number; name?: string | null }>(async (from, to) =>
    supabase
      .from("institution_feature_choices")
      .select("id, feature_definition_id, name")
      .in("feature_definition_id", defIds)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const choiceRangeById = new Map<number, { min: number; max: number }>();
  for (const c of choicesRaw) {
    const cid = Number(c.id);
    if (!Number.isFinite(cid)) continue;
    const r = parseInstructorPriceRangeBound(String(c.name ?? ""));
    if (r) choiceRangeById.set(cid, r);
  }

  const idSet = new Set<number>();

  const entriesRaw = await fetchAllPagedRows<{
    id: number;
    institution_id: number;
    feature_definition_id: number;
    number_answer: number | null;
    text_answer: string | null;
  }>(async (from, to) =>
    supabase
      .from("institution_feature_entries")
      .select("id, institution_id, feature_definition_id, number_answer, text_answer")
      .in("feature_definition_id", defIds)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const choiceEntryIdToInstitution = new Map<number, number>();
  for (const e of entriesRaw) {
    const iid = Number(e.institution_id);
    if (!Number.isFinite(iid)) continue;
    const inputType = inputTypeByDefId.get(Number(e.feature_definition_id)) ?? "";

    if (inputType === "single_select" || inputType === "multi_select") {
      choiceEntryIdToInstitution.set(Number(e.id), iid);
    } else if (inputType === "number") {
      const n = Number(e.number_answer);
      if (!Number.isFinite(n)) continue;
      if (rangesOverlap({ min: n, max: n }, userRange)) idSet.add(iid);
    } else if (inputType === "text") {
      const r = parseInstructorPriceRangeBound(String(e.text_answer ?? ""));
      if (r && rangesOverlap(r, userRange)) idSet.add(iid);
    }
  }

  if (choiceEntryIdToInstitution.size > 0 && choiceRangeById.size > 0) {
    const matchingChoiceIds = Array.from(choiceRangeById.entries())
      .filter(([, r]) => rangesOverlap(r, userRange))
      .map(([cid]) => cid);
    if (matchingChoiceIds.length > 0) {
      const links = await fetchAllPagedRows<{ institution_feature_entry_id: number }>(
        async (from, to) =>
          supabase
            .from("institution_feature_entry_choices")
            .select("institution_feature_entry_id, choice_id")
            .in("choice_id", matchingChoiceIds)
            .order("institution_feature_entry_id", { ascending: true })
            .order("choice_id", { ascending: true })
            .range(from, to),
      );
      for (const row of links) {
        const iid = choiceEntryIdToInstitution.get(Number(row.institution_feature_entry_id));
        if (Number.isFinite(iid)) idSet.add(iid!);
      }
    }
  }

  return Array.from(idSet);
}

export async function resolveInstitutionIdsByPriceRangeSelections(
  supabase: SupabaseBrowser,
  selectedLabels: string[],
): Promise<number[]> {
  if (selectedLabels.length === 0) return [];

  const idSet = new Set<number>();
  for (const label of selectedLabels) {
    const option = INSTITUTION_PRICE_RANGE_OPTIONS.find((item) => item.label === label);
    if (!option) continue;
    const ids = await resolveInstitutionIdsByPriceRange(supabase, {
      min: option.min,
      max: option.max,
    });
    ids.forEach((id) => idSet.add(id));
  }
  return Array.from(idSet);
}
