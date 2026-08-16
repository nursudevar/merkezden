import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Ana sayfa / SearchResults ile aynı: private = Özel, public = Devlet */
export type SchoolStatus = "private" | "public";

/** Haritada Ara URL slug’ları */
export type KurumTuruSlug = "devlet" | "ozel";

export const KURUM_TURU_PARAM = "kurum-turu";

export const KURUM_TURU_OPTIONS: ReadonlyArray<{ slug: KurumTuruSlug; label: string }> = [
  { slug: "devlet", label: "Devlet" },
  { slug: "ozel", label: "Özel" },
];

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

export function isOkulDurumuDefinition(row: {
  name?: string | null;
  slug?: string | null;
}): boolean {
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("okul durumu") ||
    t.includes("okul turu") ||
    t.includes("kurum turu")
  );
}

export function choiceLabelMatchesSchoolStatus(
  choiceName: string,
  status: SchoolStatus,
): boolean {
  const n = String(choiceName ?? "").trim().toLocaleLowerCase("tr-TR");
  if (status === "private") {
    return n === "özel" || n.startsWith("özel ") || n === "private";
  }
  return n === "devlet" || n.startsWith("devlet ") || n.includes("devlet") || n === "public";
}

export function kurumTuruSlugToSchoolStatus(slug: KurumTuruSlug): SchoolStatus {
  return slug === "ozel" ? "private" : "public";
}

export function schoolStatusToKurumTuruSlug(status: SchoolStatus): KurumTuruSlug {
  return status === "private" ? "ozel" : "devlet";
}

export function parseKurumTuruSlug(raw: string): KurumTuruSlug | null {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "devlet") return "devlet";
  if (normalized === "ozel" || normalized === "özel") return "ozel";
  return null;
}

/** Tekrarlı `kurum-turu` + virgüllü değerler (duyurular kategori/etiket ile aynı). */
export function readKurumTuruSlugsFromSearch(search: string): KurumTuruSlug[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const seen = new Set<KurumTuruSlug>();
  const result: KurumTuruSlug[] = [];
  for (const raw of params.getAll(KURUM_TURU_PARAM)) {
    for (const part of raw.split(",")) {
      const slug = parseKurumTuruSlug(part);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      result.push(slug);
    }
  }
  return result;
}

export function writeKurumTuruSlugsToParams(
  params: URLSearchParams,
  slugs: readonly KurumTuruSlug[],
): void {
  params.delete(KURUM_TURU_PARAM);
  for (const slug of slugs) {
    if (slug === "devlet" || slug === "ozel") params.append(KURUM_TURU_PARAM, slug);
  }
}

async function resolveInstitutionIdsByFeatureChoices(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  matchDefinition: (row: { name?: string | null; slug?: string | null }) => boolean,
  matchChoice: (choiceName: string) => boolean,
): Promise<number[]> {
  const { data: defsRaw, error: defErr } = await supabase
    .from("institution_feature_definitions")
    .select("id, name, slug, input_type")
    .eq("is_active", true);

  if (defErr) throw defErr;

  const definitions = (
    (defsRaw ?? []) as Array<{
      id: number;
      name?: string | null;
      slug?: string | null;
      input_type?: string | null;
    }>
  ).filter((d) => Number.isFinite(d.id) && matchDefinition(d));
  const defIds = definitions.map((d) => d.id);
  if (defIds.length === 0) return [];

  const { data: choicesRaw, error: chErr } = await supabase
    .from("institution_feature_choices")
    .select("id, feature_definition_id, name")
    .in("feature_definition_id", defIds)
    .eq("is_active", true);

  if (chErr) throw chErr;

  const choices = (choicesRaw ?? []) as Array<{
    id: number;
    feature_definition_id: number;
    name?: string | null;
  }>;
  const targetChoiceIds = new Set<number>();
  for (const c of choices) {
    const cid = Number(c.id);
    if (!Number.isFinite(cid)) continue;
    if (matchChoice(String(c.name ?? ""))) targetChoiceIds.add(cid);
  }
  if (targetChoiceIds.size === 0) return [];

  const targetIds = Array.from(targetChoiceIds);
  const idSet = new Set<number>();

  const choiceDefIds = definitions
    .filter((d) => d.input_type === "single_select" || d.input_type === "multi_select")
    .map((d) => d.id);
  if (choiceDefIds.length > 0) {
    const { data: choiceEntries, error: e2 } = await supabase
      .from("institution_feature_entries")
      .select("id, institution_id")
      .in("feature_definition_id", choiceDefIds);

    if (e2) throw e2;
    const entries = (choiceEntries ?? []) as Array<{ id: number; institution_id: number }>;
    const entryIds = entries.map((e) => e.id).filter((id) => Number.isFinite(id));
    const entryIdToInstitutionId = new Map<number, number>();
    for (const e of entries) {
      entryIdToInstitutionId.set(Number(e.id), Number(e.institution_id));
    }

    if (entryIds.length > 0) {
      const { data: links, error: e3 } = await supabase
        .from("institution_feature_entry_choices")
        .select("institution_feature_entry_id, choice_id")
        .in("institution_feature_entry_id", entryIds)
        .in("choice_id", targetIds);

      if (e3) throw e3;
      for (const row of (links ?? []) as Array<{
        institution_feature_entry_id: number;
        choice_id: number;
      }>) {
        const eid = Number(row.institution_feature_entry_id);
        const cid = Number(row.choice_id);
        if (!targetChoiceIds.has(cid)) continue;
        const iid = entryIdToInstitutionId.get(eid);
        if (Number.isFinite(iid)) idSet.add(iid!);
      }
    }
  }

  return Array.from(idSet);
}

/**
 * Okul Durumu / Okul Türü / Kurum Türü feature choice’larına göre kurum id’leri.
 * Ana sayfa SearchResults ile aynı kaynak ve eşleşme kuralları.
 */
export async function resolveInstitutionIdsBySchoolStatuses(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  statuses: readonly SchoolStatus[],
): Promise<number[]> {
  if (statuses.length === 0) return [];
  return resolveInstitutionIdsByFeatureChoices(
    supabase,
    isOkulDurumuDefinition,
    (name) => statuses.some((s) => choiceLabelMatchesSchoolStatus(name, s)),
  );
}

export async function resolveInstitutionIdsByKurumTuruSlugs(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  slugs: readonly KurumTuruSlug[],
): Promise<number[]> {
  const statuses = slugs.map(kurumTuruSlugToSchoolStatus);
  return resolveInstitutionIdsBySchoolStatuses(supabase, statuses);
}
