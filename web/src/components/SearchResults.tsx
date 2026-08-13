"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Building2, Heart, UserRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { getInstitutionDetailHref, resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import { InstitutionCompareToggleButton } from "@/components/compare/InstitutionCompareToggleButton";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  resolveInstitutionIdsByPriceRange,
  resolveInstitutionIdsByPriceRangeSelections,
} from "@/lib/institutionPriceRangeFilter";
import {
  isStudentAgeFilterTextActive,
  resolveInstitutionIdsByStudentAgeFilter,
  resolveInstructorIdsByStudentAgeFilter,
  studentAgeFilterQueryFromTextPayload,
  type StudentAgeFilterTextPayload,
} from "@/lib/institutionStudentAgeFilter";
import {
  fetchPublicInstructorsForListing,
  getPublicInstructorDetailHref,
  mapPublicInstructorDisplayName,
  buildPublicInstructorLocation,
} from "@/lib/publicInstructorSearch";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";
import {
  buildProfileSearchVariants,
  escapeProfileLikeValue,
  resolveInstitutionIdsByProfileSearch,
} from "@/lib/profileSearch";
import "@/styles/pages/home.scss";

type SearchResultsViewMode = "recommended" | "three" | "four";

interface SearchResult {
  id: string;
  resultType: "institution" | "instructor";
  name: string;
  description: string;
  location: string;
  mainCategory: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  slug: string;
  source?: string | null;
  detailUrl: string;
  /** Gerçek `institutions.id`; presentation `id` alanından bağımsız. */
  institutionId?: number;
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
  /** Kurum türü: `private` = Özel, `public` = Devlet; birden fazla seçimde OR mantığı */
  schoolStatusFilters?: ("private" | "public")[];
  /** Öğrenci yaşı (ham metin); hem kurum hem eğitmen */
  studentAgeRange?: StudentAgeFilterTextPayload | null;
  /** Hizmet tipi: yüz yüze / online / bireysel / grup; birden fazla seçimde OR mantığı */
  serviceTypeFilters?: ("face" | "online" | "individual" | "group")[];
  /** Aylık fiyat aralığı (TL). `defaultMin`/`defaultMax` ile verilen tam aralıktan sapıldığında devreye girer. */
  priceRangeFilter?: { min: number; max: number; defaultMin: number; defaultMax: number };
  /** DB fiyat aralığı seçenek etiketleri (ör. 1000-5000). Birden fazla seçimde OR mantığı. */
  priceRangeSelections?: string[];
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

function isHizmetTipiDefinition(row: { name?: string | null; slug?: string | null }): boolean {
  const t = normalizeFeatureKey(`${row.slug ?? ""} ${row.name ?? ""}`);
  return (
    t.includes("hizmet tipi") ||
    t.includes("servis tipi") ||
    t.includes("service type")
  );
}

function choiceLabelMatchesSchoolStatus(choiceName: string, status: "private" | "public"): boolean {
  const n = String(choiceName ?? "").trim().toLocaleLowerCase("tr-TR");
  if (status === "private") {
    return n === "özel" || n.startsWith("özel ") || n === "private";
  }
  return n === "devlet" || n.startsWith("devlet ") || n.includes("devlet") || n === "public";
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

export default function SearchResults({
  query,
  cityFilter,
  districtFilter,
  schoolStatusFilters,
  studentAgeRange,
  serviceTypeFilters,
  priceRangeFilter,
  priceRangeSelections,
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
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(() => new Set());
  const [visibleCount, setVisibleCount] = useState(20);
  /**
   * Sayfa başına gösterilecek sonuç adımı.
   * Desktop'ta 20, mobil/tablet'te (<1024px) 10. SSR'da default 20; hydration sonrası viewport'a göre güncellenir.
   */
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<SearchResultsViewMode>("recommended");

  const pageSizeRef = useRef(pageSize);
  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 1023px)");
    const apply = () => setPageSize(mql.matches ? 10 : 20);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const trimmedQuery = query.trim();
  const trimmedCity = String(cityFilter ?? "").trim();
  const trimmedDistrict = String(districtFilter ?? "").trim();
  const schoolStatuses = schoolStatusFilters ?? [];
  const studentAgeFilter = studentAgeFilterQueryFromTextPayload(studentAgeRange);
  const studentAgeFilterActive = isStudentAgeFilterTextActive(studentAgeRange);
  const studentAgeRangeKey = studentAgeRange
    ? `${studentAgeRange.min}|${studentAgeRange.max}`
    : "";
  const serviceTypes = serviceTypeFilters ?? [];
  const priceSelectionLabels = priceRangeSelections ?? [];
  const priceSelectionFilterIsActive = priceSelectionLabels.length > 0;
  const priceFilterIsActive =
    priceSelectionFilterIsActive ||
    Boolean(
      priceRangeFilter &&
        (priceRangeFilter.min > priceRangeFilter.defaultMin ||
          priceRangeFilter.max < priceRangeFilter.defaultMax),
    );
  const priceMin = priceRangeFilter?.min ?? 0;
  const priceMax = priceRangeFilter?.max ?? 0;
  const institutionTypeIdList = institutionTypeIds ?? [];
  const hasActiveFilter =
    trimmedQuery.length > 0 ||
    trimmedDistrict.length > 0 ||
    schoolStatuses.length > 0 ||
    studentAgeFilterActive ||
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
            .select("id, institution_name, subheading, about, city, district, type, address, official_phone, official_email, website, facebook_url, instagram_url, x_url, linkedin_url, logo, slug, source, institution_type_id, institution_type:institution_types(name, category:institution_categories(name))")
            .not("institution_name", "is", null)
            .eq("is_approved", true)
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
              setVisibleCount(pageSizeRef.current);
              setError(null);
              return;
            }
            baseQuery = baseQuery.in("id", allowedIds);
          }

          let studentAgeInstructorIds: Set<number> | undefined;
          if (studentAgeFilterActive) {
            const [instAgeIds, instrAgeIds] = await Promise.all([
              resolveInstitutionIdsByStudentAgeFilter(supabase, {
                userFilter: studentAgeFilter,
              }),
              resolveInstructorIdsByStudentAgeFilter(supabase, {
                userFilter: studentAgeFilter,
              }),
            ]);
            studentAgeInstructorIds = new Set(instrAgeIds);
            if (instAgeIds.length === 0) {
              baseQuery = baseQuery.in("id", [-1]);
            } else {
              baseQuery = baseQuery.in("id", instAgeIds);
            }
          }

          if (serviceTypes.length > 0) {
            const serviceIds = await resolveInstitutionIdsByServiceTypes(supabase, serviceTypes);
            if (serviceIds.length === 0) {
              setResults([]);
              setVisibleCount(pageSizeRef.current);
              setError(null);
              return;
            }
            baseQuery = baseQuery.in("id", serviceIds);
          }

          if (priceFilterIsActive) {
            const priceIds = priceSelectionFilterIsActive
              ? await resolveInstitutionIdsByPriceRangeSelections(supabase, priceSelectionLabels)
              : await resolveInstitutionIdsByPriceRange(supabase, {
                  min: priceMin,
                  max: priceMax,
                });
            if (priceIds.length === 0) {
              setResults([]);
              setVisibleCount(pageSizeRef.current);
              setError(null);
              return;
            }
            baseQuery = baseQuery.in("id", priceIds);
          }

          if (trimmedQuery) {
            const relatedSearch = await resolveInstitutionIdsByProfileSearch(supabase, trimmedQuery);
            const searchVariants = buildProfileSearchVariants(trimmedQuery)
              .map(escapeProfileLikeValue)
              .filter(Boolean);
            const searchColumns = [
              "institution_name",
              "subheading",
              "about",
              "city",
              "district",
              "type",
              "address",
              "official_phone",
              "official_email",
              "website",
              "facebook_url",
              "instagram_url",
              "x_url",
              "linkedin_url",
            ] as const;
            const orParts = searchVariants.flatMap((term) => {
              const q = `%${term}%`;
              return searchColumns.map((col) => `${col}.ilike.${q}`);
            });
            if (relatedSearch.institutionIds.length > 0) {
              orParts.push(`id.in.(${relatedSearch.institutionIds.join(",")})`);
            }
            if (relatedSearch.institutionTypeIds.length > 0) {
              orParts.push(`institution_type_id.in.(${relatedSearch.institutionTypeIds.join(",")})`);
            }
            if (orParts.length > 0) {
              baseQuery = baseQuery.or(orParts.join(","));
            }
          }

          const [{ data, error }, instructorRows] = await Promise.all([
            baseQuery,
            fetchPublicInstructorsForListing(supabase, {
              searchTerm: trimmedQuery || undefined,
              city: trimmedCity || undefined,
              district: trimmedDistrict || undefined,
              priceRange:
                priceFilterIsActive && !priceSelectionFilterIsActive
                  ? { min: priceMin, max: priceMax }
                  : undefined,
              allowedInstructorIds: studentAgeInstructorIds,
            }),
          ]);

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
              const address = String(row.address ?? "").trim();
              const institutionType = row.institution_type as
                | { name?: string | null; category?: { name?: string | null } | Array<{ name?: string | null }> | null }
                | Array<{ name?: string | null; category?: { name?: string | null } | Array<{ name?: string | null }> | null }>
                | undefined;
              const typeRow = Array.isArray(institutionType) ? institutionType[0] : institutionType;
              const categoryJoin = typeRow?.category;
              const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
              const mainCategory = String(categoryRow?.name ?? "").trim();
              const subheading = String(row.subheading ?? "").trim();
              const about = String(row.about ?? "").trim();
              const description = subheading || about || address || mainCategory;
              const logoValue = typeof row.logo === "string" ? row.logo : null;
              const imageUrl = resolveInstitutionLogoPublicUrl(supabase, logoValue);
              const slug = String(row.slug ?? "").trim();
              const source = (row.source as string | null) ?? null;

              return {
                id: `institution-${id}`,
                resultType: "institution",
                name,
                description,
                location,
                mainCategory,
                rating: 4.8,
                reviewCount: Math.floor(4.8 * 25),
                imageUrl,
                slug,
                source,
                detailUrl: getInstitutionDetailHref({ id, slug, source }),
                institutionId: id,
                badge: {
                  icon: "",
                  label: "Kurum",
                  color: "purple",
                },
              } satisfies SearchResult;
            })
            .filter((item) => item !== null);

          const mappedInstitutions = mappedRows;

          const mappedInstructors: SearchResult[] = instructorRows.flatMap((row) => {
            const numericId = Number(row.id);
            if (!Number.isFinite(numericId) || numericId <= 0) return [];

            const name = mapPublicInstructorDisplayName(row);
            const title = String(row.title ?? "").trim();
            const branch = String(row.branch ?? "").trim();
            const about = String(row.about ?? "").trim();
            const bio = String(row.bio ?? "").trim();
            const description = about || bio || title || branch;
            const imageUrl = resolvePublicInstructorProfilePictureUrl(
              String(row.profile_picture ?? "").trim(),
              supabase,
            );

            return [
              {
                id: `instructor-${numericId}`,
                resultType: "instructor",
                name,
                description,
                location: buildPublicInstructorLocation(row),
                mainCategory: "Bireysel Eğitmen",
                rating: 0,
                reviewCount: 0,
                imageUrl,
                slug: String(row.slug ?? "").trim(),
                source: null,
                detailUrl: getPublicInstructorDetailHref(row.slug, numericId),
                badge: {
                  icon: "",
                  label: "Bireysel Eğitmen",
                  color: "orange",
                },
              },
            ];
          });

          const mappedResults = [...mappedInstitutions, ...mappedInstructors].sort((a, b) =>
            a.name.localeCompare(b.name, "tr", { sensitivity: "base" }),
          );

          setResults(mappedResults);
          setVisibleCount(pageSizeRef.current);
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
  }, [hasActiveFilter, trimmedQuery, trimmedCity, trimmedDistrict, schoolStatuses.join(","), studentAgeFilterActive, studentAgeRangeKey, serviceTypes.join(","), priceFilterIsActive, priceSelectionFilterIsActive, priceSelectionLabels.join(","), priceMin, priceMax, institutionTypeIdList.join(",")]);

  if (!hasActiveFilter) {
    return null;
  }

  const emptyLabel = trimmedQuery
    ? `"${trimmedQuery}" için sonuç bulunamadı.`
    : "Bu filtre ile eşleşen kurum veya eğitmen bulunamadı.";

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
            const isInstructor = result.resultType === "instructor";
            const institutionId = isInstructor
              ? NaN
              : Number(String(result.id).replace(/^institution-/, ""));
            const isFavorite =
              !isInstructor && Number.isFinite(institutionId)
                ? Boolean(favoriteIds?.has(institutionId))
                : false;
            const isActionLoading =
              !isInstructor && Number.isFinite(institutionId)
                ? Boolean(favoriteActionLoadingIds?.has(institutionId))
                : false;
            const canRenderImage = Boolean(result.imageUrl) && !brokenImageIds.has(result.id);

            return (
            <Link
              key={result.id}
              href={result.detailUrl}
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
                        next.add(result.id);
                        return next;
                      })
                    }
                  />
                ) : (
                  <div className="search-result-placeholder" aria-label="Logo bulunmuyor">
                    {isInstructor ? <UserRound size={28} /> : <Building2 size={28} />}
                  </div>
                )}
                <div className="search-result-overlay" />
                {result.badge && (
                  <div className={`search-result-badge search-result-badge--${result.badge.color}`}>
                    <span className="search-result-badge-label">{result.badge.label}</span>
                  </div>
                )}
                {!isInstructor ? (
                  <button
                    type="button"
                    className="search-result-favorite"
                    aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                    disabled={
                      isActionLoading ||
                      !Number.isFinite(institutionId) ||
                      (isAuthenticated && !favoritesEnabled)
                    }
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
                ) : null}
                {!isInstructor &&
                typeof result.institutionId === "number" &&
                Number.isInteger(result.institutionId) &&
                result.institutionId > 0 &&
                result.slug ? (
                  <InstitutionCompareToggleButton
                    className="institution-compare-toggle--overlay"
                    item={{
                      id: result.institutionId,
                      name: result.name,
                      slug: result.slug,
                      imageUrl: result.imageUrl,
                    }}
                  />
                ) : null}
              </div>
              <div className="search-result-content">
                <div className="search-result-location">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z" fill="currentColor"/>
                  </svg>
                  <span>{result.location}</span>
                </div>
                <h3 className="search-result-name">{result.name}</h3>
                {result.description ? (
                  <p className="search-result-description">{result.description}</p>
                ) : null}
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
              onClick={() => setVisibleCount((prev) => prev + pageSize)}
            >
              Daha Fazla Gör (+{pageSize})
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
