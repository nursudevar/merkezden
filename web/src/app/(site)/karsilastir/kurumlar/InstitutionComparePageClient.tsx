"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseCompareInstitutionIdsFromQuery } from "@/lib/institutionCompare";
import { getInstitutionDetailHref, resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import {
  alignInstitutionCompareFeatureRows,
  formatPublicFeatureCompareCell,
  isPublicFeatureCompareCellEmpty,
  mapPublicInstitutionFeatures,
  type InstitutionFeatureChoiceRow,
  type InstitutionFeatureDefinitionRow,
  type InstitutionFeatureEntryChoiceRow,
  type InstitutionFeatureEntryRow,
  type InstitutionFeatureGroupRow,
  type InstitutionCompareFeatureSection,
  type PublicFeatureCompareValue,
} from "@/lib/institutionPublicFeatures";

type CompareInstitutionColumn = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string;
  categoryName: string;
  categorySlug: string;
  location: string;
  profileHref: string;
};

type InstitutionListRow = {
  id: number;
  slug: string | null;
  institution_name: string | null;
  logo: string | null;
  city: string | null;
  district: string | null;
  is_approved: boolean | null;
  category: {
    name: string | null;
    slug?: string | null;
  } | Array<{ name: string | null; slug?: string | null }> | null;
};

type FeatureEntryWithInstitution = InstitutionFeatureEntryRow & {
  institution_id: number;
};

function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isUnauthorizedSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const record = err as Record<string, unknown>;
  const code = String(record.code ?? "");
  const message = String(record.message ?? "").toLowerCase();
  return (
    code === "401" ||
    code === "42501" ||
    message.includes("unauthorized") ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

export default function InstitutionComparePageClient() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const requestedIds = useMemo(
    () => parseCompareInstitutionIdsFromQuery(idsParam),
    [idsParam],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<CompareInstitutionColumn[]>([]);
  const [sections, setSections] = useState<InstitutionCompareFeatureSection[]>([]);
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (requestedIds.length < 2) {
      setColumns([]);
      setSections([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          { data: institutionData, error: institutionError },
          { data: groupsData, error: groupsError },
          { data: definitionsData, error: definitionsError },
          { data: choicesData, error: choicesError },
        ] = await Promise.all([
          supabase
            .from("institutions")
            .select(
              "id, slug, institution_name, logo, city, district, is_approved, category:institution_categories(name, slug)",
            )
            .eq("is_approved", true)
            .in("id", requestedIds),
          supabase
            .from("institution_feature_groups")
            .select("id, name, display_order, is_active, category_slug")
            .eq("is_active", true)
            .order("display_order", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true }),
          supabase
            .from("institution_feature_definitions")
            .select("id, group_id, name, slug, input_type, unit, display_order, is_active")
            .eq("is_active", true)
            .order("display_order", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true }),
          supabase
            .from("institution_feature_choices")
            .select("id, feature_definition_id, name, display_order, is_active")
            .eq("is_active", true)
            .order("display_order", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true }),
        ]);

        if (cancelled) return;

        if (
          institutionError ||
          groupsError ||
          definitionsError ||
          choicesError
        ) {
          if (
            isUnauthorizedSupabaseError(institutionError) ||
            isUnauthorizedSupabaseError(groupsError) ||
            isUnauthorizedSupabaseError(definitionsError) ||
            isUnauthorizedSupabaseError(choicesError)
          ) {
            setColumns([]);
            setSections([]);
            setLoading(false);
            return;
          }
          console.warn("[compare][institutions][query-warning]", {
            institutionError,
            groupsError,
            definitionsError,
            choicesError,
          });
          setError("Karşılaştırma yüklenirken bir hata oluştu.");
          setColumns([]);
          setSections([]);
          setLoading(false);
          return;
        }

        const institutionRows = (institutionData as InstitutionListRow[] | null) ?? [];
        const byId = new Map(institutionRows.map((row) => [Number(row.id), row]));
        const orderedRows = requestedIds
          .map((id) => byId.get(id))
          .filter((row): row is InstitutionListRow => Boolean(row));

        const nextColumns: CompareInstitutionColumn[] = orderedRows
          .map((row) => {
            const slug = String(row.slug ?? "").trim();
            const name = String(row.institution_name ?? "").trim();
            if (!slug || !name) return null;
            const category = unwrapJoin(row.category);
            const city = String(row.city ?? "").trim();
            const district = String(row.district ?? "").trim();
            return {
              id: Number(row.id),
              name,
              slug,
              logoUrl: resolveInstitutionLogoPublicUrl(supabase, row.logo),
              categoryName: String(category?.name ?? "").trim(),
              categorySlug: String(category?.slug ?? "").trim(),
              location: [city, district].filter(Boolean).join(", "),
              profileHref: getInstitutionDetailHref({ slug }),
            };
          })
          .filter((column): column is CompareInstitutionColumn => Boolean(column));

        if (nextColumns.length < 2) {
          setColumns([]);
          setSections([]);
          setLoading(false);
          return;
        }

        const approvedIds = nextColumns.map((column) => column.id);
        const { data: entriesData, error: entriesError } = await supabase
          .from("institution_feature_entries")
          .select(
            "id, institution_id, feature_definition_id, boolean_answer, text_answer, number_answer, selected_choice_id",
          )
          .in("institution_id", approvedIds);

        if (cancelled) return;

        if (entriesError) {
          if (isUnauthorizedSupabaseError(entriesError)) {
            setColumns(nextColumns);
            setSections([]);
            setLoading(false);
            return;
          }
          console.warn("[compare][institutions][entries-warning]", entriesError);
          setError("Karşılaştırma yüklenirken bir hata oluştu.");
          setColumns([]);
          setSections([]);
          setLoading(false);
          return;
        }

        const entries = (entriesData as FeatureEntryWithInstitution[] | null) ?? [];
        const entryIds = entries.map((entry) => entry.id);
        let entryChoices: InstitutionFeatureEntryChoiceRow[] = [];

        if (entryIds.length > 0) {
          const { data: entryChoicesData, error: entryChoicesError } = await supabase
            .from("institution_feature_entry_choices")
            .select("institution_feature_entry_id, choice_id")
            .in("institution_feature_entry_id", entryIds);

          if (cancelled) return;

          if (entryChoicesError) {
            if (isUnauthorizedSupabaseError(entryChoicesError)) {
              setColumns(nextColumns);
              setSections([]);
              setLoading(false);
              return;
            }
            console.warn("[compare][institutions][entry-choices-warning]", entryChoicesError);
          } else {
            entryChoices = (entryChoicesData as InstitutionFeatureEntryChoiceRow[] | null) ?? [];
          }
        }

        const groups = (groupsData as InstitutionFeatureGroupRow[] | null) ?? [];
        const definitions = (definitionsData as InstitutionFeatureDefinitionRow[] | null) ?? [];
        const choices = (choicesData as InstitutionFeatureChoiceRow[] | null) ?? [];

        const entriesByInstitutionId = new Map<number, InstitutionFeatureEntryRow[]>();
        entries.forEach((entry) => {
          const current = entriesByInstitutionId.get(entry.institution_id) ?? [];
          current.push(entry);
          entriesByInstitutionId.set(entry.institution_id, current);
        });

        const entryIdsByInstitutionId = new Map<number, Set<number>>();
        entries.forEach((entry) => {
          const current = entryIdsByInstitutionId.get(entry.institution_id) ?? new Set<number>();
          current.add(entry.id);
          entryIdsByInstitutionId.set(entry.institution_id, current);
        });

        const mappedColumns: Array<{ compareValues: PublicFeatureCompareValue[] }> = nextColumns.map(
          (column) => {
            const institutionEntries = entriesByInstitutionId.get(column.id) ?? [];
            const institutionEntryIds = entryIdsByInstitutionId.get(column.id) ?? new Set<number>();
            const institutionEntryChoices = entryChoices.filter((choice) =>
              institutionEntryIds.has(choice.institution_feature_entry_id),
            );
            const mapped = mapPublicInstitutionFeatures({
              groups,
              definitions,
              choices,
              entries: institutionEntries,
              entryChoices: institutionEntryChoices,
              categorySlug: column.categorySlug,
            });
            return { compareValues: mapped.compareValues };
          },
        );

        if (cancelled) return;
        setBrokenLogoIds(new Set());
        setColumns(nextColumns);
        setSections(alignInstitutionCompareFeatureRows(mappedColumns));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("[compare][institutions][load-error]", err);
        setError("Karşılaştırma yüklenirken bir hata oluştu.");
        setColumns([]);
        setSections([]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestedIds]);

  const colCount = columns.length;
  const showEmpty = !loading && !error && columns.length < 2;

  return (
    <div className="institution-compare-page">
      <div className="institution-compare-container">
        <header className="institution-compare-hero">
          <h1 className="institution-compare-title">Kurum Karşılaştır</h1>
          <p className="institution-compare-subtitle">
            Seçtiğiniz kurumların public özelliklerini yan yana inceleyin.
          </p>
        </header>

        {loading ? (
          <p className="institution-compare-status" role="status">
            Yükleniyor...
          </p>
        ) : error ? (
          <p className="institution-compare-status institution-compare-status--error" role="alert">
            {error}
          </p>
        ) : showEmpty ? (
          <div className="institution-compare-empty">
            <p>Karşılaştırma için en az 2 onaylı kurum gerekli.</p>
          </div>
        ) : (
          <div className="institution-compare-scroll">
            <table
              className={`institution-compare-table institution-compare-table--cols-${colCount}`}
            >
              <colgroup>
                <col className="institution-compare-col institution-compare-col--feature" />
                {columns.map((column) => (
                  <col
                    key={column.id}
                    className="institution-compare-col institution-compare-col--institution"
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="institution-compare-feature-col" scope="col">
                    Özellik
                  </th>
                  {columns.map((column) => {
                    const showLogo = Boolean(column.logoUrl) && !brokenLogoIds.has(column.id);
                    return (
                    <th key={column.id} scope="col">
                      <div className="institution-compare-institution">
                        {showLogo ? (
                          <img
                            src={column.logoUrl}
                            alt=""
                            className="institution-compare-logo"
                            onError={() => {
                              setBrokenLogoIds((prev) => {
                                if (prev.has(column.id)) return prev;
                                const next = new Set(prev);
                                next.add(column.id);
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <span
                            className="institution-compare-logo institution-compare-logo--fallback"
                            aria-hidden
                          >
                            {column.name.trim().charAt(0).toUpperCase() || "K"}
                          </span>
                        )}
                        <p className="institution-compare-name" title={column.name}>
                          {column.name}
                        </p>
                        {column.categoryName ? (
                          <p className="institution-compare-meta">{column.categoryName}</p>
                        ) : null}
                        {column.location ? (
                          <p className="institution-compare-meta">{column.location}</p>
                        ) : null}
                        <Link href={column.profileHref} className="institution-compare-profile-link">
                          Profili Gör
                        </Link>
                      </div>
                    </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sections.length === 0 ? (
                  <tr>
                    <td colSpan={colCount + 1} className="institution-compare-empty-cell">
                      Karşılaştırılacak ortak özellik bulunamadı.
                    </td>
                  </tr>
                ) : (
                  sections.map((section) => (
                    <CompareSectionRows
                      key={section.groupId}
                      section={section}
                      colCount={colCount}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareSectionRows({
  section,
  colCount,
}: {
  section: InstitutionCompareFeatureSection;
  colCount: number;
}) {
  return (
    <>
      <tr className="institution-compare-group-row">
        <th className="institution-compare-group-title" colSpan={colCount + 1} scope="colgroup">
          {section.title}
        </th>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.rowKey}>
          <th className="institution-compare-feature-col" scope="row">
            {row.label}
          </th>
          {row.cells.map((cell, index) => {
            const empty = isPublicFeatureCompareCellEmpty(cell);
            return (
              <td
                key={`${row.rowKey}-${index}`}
                className={
                  empty
                    ? "institution-compare-cell institution-compare-cell--empty"
                    : "institution-compare-cell"
                }
              >
                {empty ? "—" : formatPublicFeatureCompareCell(cell)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
