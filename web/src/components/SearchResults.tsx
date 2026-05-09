"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Building2, Heart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { getInstitutionDetailHref } from "@/lib/institutionHelpers";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { matchesSearch } from "@/lib/utils";
import "@/styles/pages/home.scss";

type SearchResultsViewMode = "recommended" | "three" | "four";

interface SearchResult {
  id: string | number;
  name: string;
  description: string;
  location: string;
  mainCategory: string;
  subCategory: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  slug: string;
  source?: string | null;
  badge: {
    icon: string;
    label: string;
    color: string;
  } | null;
}

interface SearchResultsProps {
  query: string;
  cityFilter?: string;
  districtFilter?: string;
  /** Okul durumu: `private` = Özel, `public` = Devlet; birden fazla seçimde OR mantığı */
  schoolStatusFilters?: ("private" | "public")[];
  /** Öğrenci yaşı: `child` = Çocuk (0-17), `adult` = Yetişkin (18+); birden fazla seçimde OR mantığı */
  studentAgeFilters?: ("child" | "adult")[];
  /** Hizmet tipi: yüz yüze / online / bireysel / grup; birden fazla seçimde OR mantığı */
  serviceTypeFilters?: ("face" | "online" | "individual" | "group")[];
  /** Aylık fiyat aralığı (TL). `defaultMin`/`defaultMax` ile verilen tam aralıktan sapıldığında devreye girer. */
  priceRangeFilter?: { min: number; max: number; defaultMin: number; defaultMax: number };
  /** `institution_types.id` — birden fazla seçimde OR; diğer filtrelerle AND */
  institutionTypeIds?: number[];
  onResultClick?: () => void;
  onClearSearch?: () => void;
  /** Sonuç başlığında «Temizle» butonu için: ana sayfadaki tüm aktif filtreleri sıfırlar. */
  onClearAllFilters?: () => void;
  onToggleFavorite?: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds?: Set<number>;
  favoritesEnabled?: boolean;
  favoriteActionLoadingIds?: Set<number>;
  isAuthenticated?: boolean;
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

function isOkulDurumuDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("okul durumu") ||
    t.includes("okul turu") ||
    t.includes("kurum turu")
  );
}

function isOgrenciYasiDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("ogrenci yasi") ||
    t.includes("ogrenci_yasi") ||
    t.includes("yas araligi") ||
    t === "yas" ||
    t.endsWith(" yas") ||
    t.startsWith("yas ")
  );
}

function isHizmetTipiDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("hizmet tipi") ||
    t.includes("servis tipi") ||
    t.includes("service type")
  );
}

function isFiyatAraligiDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("fiyat araligi") ||
    t.includes("aylik ortalama fiyat") ||
    t.includes("ortalama fiyat") ||
    t.includes("price range") ||
    t.includes("monthly price") ||
    t === "fiyat" ||
    t.startsWith("fiyat ") ||
    t.endsWith(" fiyat") ||
    t.includes(" fiyat ") ||
    t.includes("ucret")
  );
}

function parsePriceRangeFromText(raw: string): { min: number; max: number } | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const lower = text.toLocaleLowerCase("tr-TR");
  const norm = normalizeFeatureKey(text);

  const isFree = lower.includes("ücretsiz") || norm.includes("ucretsiz") || lower === "0" || lower === "0 tl" || lower === "0₺";
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

function rangesOverlap(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.min <= b.max && b.min <= a.max;
}

function choiceLabelMatchesSchoolStatus(choiceName: string, status: "private" | "public"): boolean {
  const n = String(choiceName ?? "").trim().toLocaleLowerCase("tr-TR");
  if (status === "private") {
    return n === "özel" || n.startsWith("özel ") || n === "private";
  }
  return n === "devlet" || n.startsWith("devlet ") || n.includes("devlet") || n === "public";
}

function choiceLabelMatchesStudentAge(choiceName: string, target: "child" | "adult"): boolean {
  const raw = String(choiceName ?? "").trim();
  const n = raw.toLocaleLowerCase("tr-TR");
  const norm = normalizeFeatureKey(raw);
  if (target === "child") {
    return (
      n.includes("çocuk") ||
      norm.includes("cocuk") ||
      n.includes("0-17") ||
      n.includes("0 17") ||
      n.includes("child") ||
      n.includes("kid")
    );
  }
  return (
    n.includes("yetişkin") ||
    norm.includes("yetiskin") ||
    n.includes("18+") ||
    n.includes("18 +") ||
    n.includes("adult")
  );
}

function choiceLabelMatchesServiceType(choiceName: string, target: "face" | "online" | "individual" | "group"): boolean {
  const raw = String(choiceName ?? "").trim();
  const n = raw.toLocaleLowerCase("tr-TR");
  const norm = normalizeFeatureKey(raw);
  if (target === "face") {
    return (
      n.includes("yüz yüze") ||
      norm.includes("yuz yuze") ||
      n.includes("yüzyüze") ||
      norm.includes("yuzyuze") ||
      n.includes("face to face") ||
      n.includes("face-to-face") ||
      n.includes("onsite")
    );
  }
  if (target === "online") {
    return n.includes("online") || n.includes("uzaktan") || n.includes("remote");
  }
  if (target === "individual") {
    return (
      n.includes("bireysel") ||
      norm.includes("bireysel") ||
      n.includes("individual") ||
      n.includes("tekil")
    );
  }
  return (
    n.includes("grup") ||
    n.includes("group") ||
    n.includes("sınıf") ||
    norm.includes("sinif")
  );
}

async function resolveInstitutionIdsByFeatureChoices(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  matchDefinition: (row: { name?: string | null; slug?: string | null }) => boolean,
  matchChoice: (choiceName: string) => boolean
): Promise<number[]> {
  const { data: defsRaw, error: defErr } = await supabase
    .from("institution_feature_definitions")
    .select("id, name, slug, input_type")
    .eq("is_active", true);

  if (defErr) throw defErr;

  const definitions = ((defsRaw ?? []) as Array<{ id: number; name?: string | null; slug?: string | null; input_type?: string | null }>).filter(
    (d) => Number.isFinite(d.id) && matchDefinition(d)
  );
  const defIds = definitions.map((d) => d.id);
  if (defIds.length === 0) return [];

  const { data: choicesRaw, error: chErr } = await supabase
    .from("institution_feature_choices")
    .select("id, feature_definition_id, name")
    .in("feature_definition_id", defIds)
    .eq("is_active", true);

  if (chErr) throw chErr;

  const choices = (choicesRaw ?? []) as Array<{ id: number; feature_definition_id: number; name?: string | null }>;
  const targetChoiceIds = new Set<number>();
  for (const c of choices) {
    const cid = Number(c.id);
    if (!Number.isFinite(cid)) continue;
    if (matchChoice(String(c.name ?? ""))) targetChoiceIds.add(cid);
  }
  if (targetChoiceIds.size === 0) return [];

  const targetIds = Array.from(targetChoiceIds);
  const idSet = new Set<number>();

  const singleDefIds = definitions.filter((d) => d.input_type === "single_select").map((d) => d.id);
  if (singleDefIds.length > 0) {
    const { data: entRows, error: e1 } = await supabase
      .from("institution_feature_entries")
      .select("institution_id, selected_choice_id")
      .in("feature_definition_id", singleDefIds)
      .not("selected_choice_id", "is", null);

    if (e1) throw e1;
    for (const row of (entRows ?? []) as Array<{ institution_id: number; selected_choice_id: number | null }>) {
      const sid = Number(row.selected_choice_id);
      const iid = Number(row.institution_id);
      if (Number.isFinite(iid) && Number.isFinite(sid) && targetChoiceIds.has(sid)) idSet.add(iid);
    }
  }

  const multiDefIds = definitions.filter((d) => d.input_type === "multi_select").map((d) => d.id);
  if (multiDefIds.length > 0) {
    const { data: multiEntries, error: e2 } = await supabase
      .from("institution_feature_entries")
      .select("id, institution_id")
      .in("feature_definition_id", multiDefIds);

    if (e2) throw e2;
    const entries = (multiEntries ?? []) as Array<{ id: number; institution_id: number }>;
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
      for (const row of (links ?? []) as Array<{ institution_feature_entry_id: number; choice_id: number }>) {
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

async function resolveInstitutionIdsBySchoolStatuses(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  statuses: ("private" | "public")[]
): Promise<number[]> {
  if (statuses.length === 0) return [];
  return resolveInstitutionIdsByFeatureChoices(
    supabase,
    isOkulDurumuDefinition,
    (name) => statuses.some((s) => choiceLabelMatchesSchoolStatus(name, s))
  );
}

async function resolveInstitutionIdsByStudentAges(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  ages: ("child" | "adult")[]
): Promise<number[]> {
  if (ages.length === 0) return [];
  return resolveInstitutionIdsByFeatureChoices(
    supabase,
    isOgrenciYasiDefinition,
    (name) => ages.some((a) => choiceLabelMatchesStudentAge(name, a))
  );
}

async function resolveInstitutionIdsByServiceTypes(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  types: ("face" | "online" | "individual" | "group")[]
): Promise<number[]> {
  if (types.length === 0) return [];
  return resolveInstitutionIdsByFeatureChoices(
    supabase,
    isHizmetTipiDefinition,
    (name) => types.some((t) => choiceLabelMatchesServiceType(name, t))
  );
}

/**
 * Fiyat Aralığı / Aylık Ortalama Fiyat Aralığı feature'ı üzerinden
 * kullanıcı [min, max] aralığıyla kesişen kurum id'lerini döndürür.
 * Choice metni (single/multi_select), number_answer ve text_answer biçimlerini destekler.
 */
async function resolveInstitutionIdsByPriceRange(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  range: { min: number; max: number }
): Promise<number[]> {
  const userRange = {
    min: Math.max(0, Math.min(range.min, range.max)),
    max: Math.max(range.min, range.max),
  };

  const { data: defsRaw, error: defErr } = await supabase
    .from("institution_feature_definitions")
    .select("id, name, slug, input_type, unit")
    .eq("is_active", true);
  if (defErr) throw defErr;

  const defs = ((defsRaw ?? []) as Array<{
    id: number;
    name?: string | null;
    slug?: string | null;
    input_type?: string | null;
    unit?: string | null;
  }>).filter((d) => Number.isFinite(d.id) && isFiyatAraligiDefinition(d));
  if (defs.length === 0) return [];

  const defIds = defs.map((d) => d.id);
  const inputTypeByDefId = new Map<number, string>();
  for (const d of defs) inputTypeByDefId.set(d.id, String(d.input_type ?? ""));

  const choiceRangeById = new Map<number, { min: number; max: number }>();
  const { data: choicesRaw, error: chErr } = await supabase
    .from("institution_feature_choices")
    .select("id, feature_definition_id, name")
    .in("feature_definition_id", defIds)
    .eq("is_active", true);
  if (chErr) throw chErr;
  for (const c of (choicesRaw ?? []) as Array<{ id: number; name?: string | null }>) {
    const cid = Number(c.id);
    if (!Number.isFinite(cid)) continue;
    const r = parsePriceRangeFromText(String(c.name ?? ""));
    if (r) choiceRangeById.set(cid, r);
  }

  const idSet = new Set<number>();

  const { data: entriesRaw, error: entErr } = await supabase
    .from("institution_feature_entries")
    .select("id, institution_id, feature_definition_id, selected_choice_id, number_answer, text_answer")
    .in("feature_definition_id", defIds);
  if (entErr) throw entErr;

  const entries = (entriesRaw ?? []) as Array<{
    id: number;
    institution_id: number;
    feature_definition_id: number;
    selected_choice_id: number | null;
    number_answer: number | null;
    text_answer: string | null;
  }>;

  const multiEntryIdToInstitution = new Map<number, number>();
  for (const e of entries) {
    const iid = Number(e.institution_id);
    if (!Number.isFinite(iid)) continue;
    const inputType = inputTypeByDefId.get(Number(e.feature_definition_id)) ?? "";

    if (inputType === "single_select") {
      const cid = Number(e.selected_choice_id);
      if (!Number.isFinite(cid)) continue;
      const r = choiceRangeById.get(cid);
      if (r && rangesOverlap(r, userRange)) idSet.add(iid);
    } else if (inputType === "number") {
      const n = Number(e.number_answer);
      if (!Number.isFinite(n)) continue;
      if (rangesOverlap({ min: n, max: n }, userRange)) idSet.add(iid);
    } else if (inputType === "text") {
      const r = parsePriceRangeFromText(String(e.text_answer ?? ""));
      if (r && rangesOverlap(r, userRange)) idSet.add(iid);
    } else if (inputType === "multi_select") {
      multiEntryIdToInstitution.set(Number(e.id), iid);
    }
  }

  if (multiEntryIdToInstitution.size > 0 && choiceRangeById.size > 0) {
    const matchingChoiceIds = Array.from(choiceRangeById.entries())
      .filter(([, r]) => rangesOverlap(r, userRange))
      .map(([cid]) => cid);
    if (matchingChoiceIds.length > 0) {
      const { data: links, error: linkErr } = await supabase
        .from("institution_feature_entry_choices")
        .select("institution_feature_entry_id, choice_id")
        .in("institution_feature_entry_id", Array.from(multiEntryIdToInstitution.keys()))
        .in("choice_id", matchingChoiceIds);
      if (linkErr) throw linkErr;
      for (const row of (links ?? []) as Array<{ institution_feature_entry_id: number; choice_id: number }>) {
        const iid = multiEntryIdToInstitution.get(Number(row.institution_feature_entry_id));
        if (Number.isFinite(iid)) idSet.add(iid!);
      }
    }
  }

  return Array.from(idSet);
}

export default function SearchResults({
  query,
  cityFilter,
  districtFilter,
  schoolStatusFilters,
  studentAgeFilters,
  serviceTypeFilters,
  priceRangeFilter,
  institutionTypeIds,
  onResultClick,
  onClearSearch,
  onClearAllFilters,
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  isAuthenticated,
}: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());
  const [visibleCount, setVisibleCount] = useState(20);
  const [viewMode, setViewMode] = useState<SearchResultsViewMode>("recommended");

  const trimmedQuery = query.trim();
  const trimmedCity = String(cityFilter ?? "").trim();
  const trimmedDistrict = String(districtFilter ?? "").trim();
  const schoolStatuses = schoolStatusFilters ?? [];
  const studentAges = studentAgeFilters ?? [];
  const serviceTypes = serviceTypeFilters ?? [];
  const priceFilterIsActive = Boolean(
    priceRangeFilter &&
      (priceRangeFilter.min > priceRangeFilter.defaultMin ||
        priceRangeFilter.max < priceRangeFilter.defaultMax)
  );
  const priceMin = priceRangeFilter?.min ?? 0;
  const priceMax = priceRangeFilter?.max ?? 0;
  const institutionTypeIdList = institutionTypeIds ?? [];
  const hasActiveFilter =
    trimmedQuery.length > 0 ||
    trimmedDistrict.length > 0 ||
    schoolStatuses.length > 0 ||
    studentAges.length > 0 ||
    serviceTypes.length > 0 ||
    priceFilterIsActive ||
    institutionTypeIdList.length > 0;

  useEffect(() => {
    if (!hasActiveFilter) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError(null);
      const run = async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          let baseQuery = supabase
            .from("institutions")
            .select("id, institution_name, city, district, type, address, logo, slug, source, institution_type:institution_types(name, category:institution_categories(name))")
            .not("institution_name", "is", null)
            .order("institution_name", { ascending: true })
            .limit(600);

          if (trimmedCity) {
            baseQuery = baseQuery.ilike("city", trimmedCity);
          }
          if (trimmedDistrict) {
            baseQuery = baseQuery.ilike("district", trimmedDistrict);
          }

          if (institutionTypeIdList.length > 0) {
            baseQuery = baseQuery.in("institution_type_id", institutionTypeIdList);
          }

          if (schoolStatuses.length > 0) {
            const allowedIds = await resolveInstitutionIdsBySchoolStatuses(supabase, schoolStatuses);
            if (allowedIds.length === 0) {
              setResults([]);
              setVisibleCount(20);
              setError(null);
              return;
            }
            baseQuery = baseQuery.in("id", allowedIds);
          }

          if (studentAges.length > 0) {
            const ageIds = await resolveInstitutionIdsByStudentAges(supabase, studentAges);
            if (ageIds.length === 0) {
              setResults([]);
              setVisibleCount(20);
              setError(null);
              return;
            }
            baseQuery = baseQuery.in("id", ageIds);
          }

          if (serviceTypes.length > 0) {
            const serviceIds = await resolveInstitutionIdsByServiceTypes(supabase, serviceTypes);
            if (serviceIds.length === 0) {
              setResults([]);
              setVisibleCount(20);
              setError(null);
              return;
            }
            baseQuery = baseQuery.in("id", serviceIds);
          }

          if (priceFilterIsActive) {
            const priceIds = await resolveInstitutionIdsByPriceRange(supabase, {
              min: priceMin,
              max: priceMax,
            });
            if (priceIds.length === 0) {
              setResults([]);
              setVisibleCount(20);
              setError(null);
              return;
            }
            baseQuery = baseQuery.in("id", priceIds);
          }

          const { data, error } = await baseQuery;

          if (error) {
            throw error;
          }

          const mappedRows = ((data ?? []) as Array<Record<string, unknown>>)
            .map((row) => {
              const id = Number(row.id);
              const name = String(row.institution_name ?? "").trim();
              if (!Number.isFinite(id) || !name) return null;

              const district = String(row.district ?? "").trim();
              const location = district || "Konum bilgisi yok";
              const type = String(row.type ?? "").trim();
              const address = String(row.address ?? "").trim();
              const description = type || address || "Kurum bilgisi";
              const institutionType = row.institution_type as
                | { name?: string | null; category?: { name?: string | null } | null }
                | undefined;
              const mainCategory = String(institutionType?.category?.name ?? "").trim();
              const subCategory = String(institutionType?.name ?? "").trim() || type;
              const logoPath = String(row.logo ?? "").trim();
              const imageUrl = logoPath
                ? supabase.storage.from("institution-logos").getPublicUrl(logoPath).data.publicUrl
                : "";

              return {
                id: id.toString(),
                name,
                description,
                location,
                mainCategory,
                subCategory,
                rating: 4.8,
                reviewCount: Math.floor(4.8 * 25),
                imageUrl,
                slug: String(row.slug ?? "").trim(),
                source: (row.source as string | null) ?? null,
                badge: null,
              } satisfies SearchResult;
            })
            .filter((item) => item !== null);

          const mappedResults = trimmedQuery
            ? mappedRows.filter(
                (institution) =>
                  matchesSearch(institution.name, trimmedQuery) ||
                  matchesSearch(institution.location, trimmedQuery) ||
                  matchesSearch(institution.description, trimmedQuery) ||
                  matchesSearch(institution.mainCategory, trimmedQuery) ||
                  matchesSearch(institution.subCategory, trimmedQuery)
              )
            : mappedRows;

          setResults(mappedResults);
          setVisibleCount(20);
          setError(null);
        } catch (err) {
          console.error("[SearchResults] Error:", err);
          setError("Arama sırasında bir hata oluştu");
          setResults([]);
        } finally {
          setLoading(false);
        }
      };

      void run();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasActiveFilter, trimmedQuery, trimmedCity, trimmedDistrict, [...schoolStatuses].sort().join(","), [...studentAges].sort().join(","), [...serviceTypes].sort().join(","), priceFilterIsActive, priceMin, priceMax, [...institutionTypeIdList].sort((a, b) => a - b).join(",")]);

  if (!hasActiveFilter) {
    return null;
  }

  const emptyLabel = trimmedQuery
    ? `"${trimmedQuery}" için sonuç bulunamadı.`
    : "Bu filtre ile eşleşen kurum bulunamadı.";

  if (loading) {
    return (
      <section className="search-results-section">
        <div className="search-results-container">
          <div className="search-results-loading">
            <p>Aranıyor...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="search-results-section">
        <div className="search-results-container">
          <div className="search-results-error">
            <p>{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="search-results-section">
        <div className="search-results-container">
          <div className="search-results-empty">
            <p>{emptyLabel}</p>
          </div>
        </div>
      </section>
    );
  }

  const visibleResults = results.slice(0, visibleCount);
  const hasMoreResults = visibleCount < results.length;

  const gridClassName =
    viewMode === "three"
      ? "search-results-grid search-results-grid--three"
      : viewMode === "four"
        ? "search-results-grid search-results-grid--four"
        : "search-results-grid";

  return (
    <section className="search-results-section">
      <div className="search-results-container">
        <div className="search-results-header">
          <h2 className="search-results-title">
            Arama Sonuçları ({results.length})
          </h2>
          <div className="search-results-header-right">
            {onClearAllFilters ? (
              <button
                type="button"
                onClick={onClearAllFilters}
                className="search-results-clear-button"
                aria-label="Tüm filtreleri temizle"
              >
                Temizle
              </button>
            ) : null}
            <div className="search-results-sort">
              <span className="search-results-sort-label">Sırala:</span>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as SearchResultsViewMode)}>
                <SelectTrigger className="search-results-sort-select">
                  <SelectValue placeholder="Önerilenler" />
                </SelectTrigger>
                <SelectContent
                  className="select-content search-results-view-select-popper"
                  side="bottom"
                  avoidCollisions={false}
                >
                  <SelectItem value="recommended" className="select-item">
                    Önerilenler
                  </SelectItem>
                  <SelectItem value="three" className="select-item">
                    3&apos;lü Görünüm
                  </SelectItem>
                  <SelectItem value="four" className="select-item">
                    4&apos;lü Görünüm
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {onClearSearch && trimmedQuery ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="search-results-clear-button"
              >
                Sıfırla
              </button>
            ) : null}
          </div>
        </div>
        <div className={gridClassName}>
          {visibleResults.map((result) => {
            const institutionId = Number(result.id);
            const isFavorite = Number.isFinite(institutionId) ? Boolean(favoriteIds?.has(institutionId)) : false;
            const isActionLoading = Number.isFinite(institutionId)
              ? Boolean(favoriteActionLoadingIds?.has(institutionId))
              : false;
            const canRenderImage =
              Number.isFinite(institutionId) &&
              Boolean(result.imageUrl) &&
              !brokenImageIds.has(institutionId);

            return (
            <Link
              key={result.id}
              href={getInstitutionDetailHref({
                id: result.id,
                slug: result.slug,
                source: result.source ?? null,
              })}
              className="search-result-card"
              aria-label={`${result.name} detayları`}
              onClick={onResultClick}
            >
              <div className="search-result-image-wrapper">
                {canRenderImage ? (
                  <Image
                    src={result.imageUrl}
                    alt={result.name}
                    fill
                    className="search-result-image"
                    sizes="240px"
                    unoptimized
                    onError={() =>
                      setBrokenImageIds((prev) => {
                        const next = new Set(prev);
                        next.add(institutionId);
                        return next;
                      })
                    }
                  />
                ) : (
                  <div className="search-result-placeholder" aria-label="Logo bulunmuyor">
                    <Building2 size={28} />
                  </div>
                )}
                <div className="search-result-overlay" />
                {result.badge && (
                  <div className={`search-result-badge search-result-badge--${result.badge.color}`}>
                    <span className="search-result-badge-label">{result.badge.label}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="search-result-favorite"
                  aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                  disabled={isActionLoading || !Number.isFinite(institutionId) || (isAuthenticated && !favoritesEnabled)}
                  onClick={(e) => {
                    if (!onToggleFavorite || !Number.isFinite(institutionId)) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    onToggleFavorite(institutionId, e);
                  }}
                >
                  <Heart
                    className={
                      isFavorite ? "search-result-heart-icon search-result-heart-icon--active" : "search-result-heart-icon"
                    }
                  />
                </button>
              </div>
              <div className="search-result-content">
                <div className="search-result-location">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z" fill="currentColor"/>
                  </svg>
                  <span>{result.location}</span>
                </div>
                <h3 className="search-result-name">{result.name}</h3>
                <p className="search-result-description" title={result.description}>{result.description}</p>
              </div>
            </Link>
            );
          })}
        </div>
        {hasMoreResults && (
          <div className="search-results-load-more-wrap">
            <button
              type="button"
              className="search-results-load-more-button"
              onClick={() => setVisibleCount((prev) => prev + 20)}
            >
              Daha Fazla Gör (+20)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
