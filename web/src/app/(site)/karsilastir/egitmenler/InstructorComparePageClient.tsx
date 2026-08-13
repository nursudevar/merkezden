"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseCompareInstructorIdsFromQuery } from "@/lib/instructorCompare";
import {
  INSTRUCTOR_FEATURE_ENTRIES_TABLE,
  INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE,
  type InstructorFeatureGroupRow,
} from "@/lib/instructorFeaturesClient";
import {
  alignInstructorCompareFeatureRows,
  formatInstructorPublicFeatureCompareCell,
  isInstructorPublicFeatureCompareCellEmpty,
  mapPublicInstructorFeatures,
  type InstructorCompareFeatureSection,
  type InstructorPublicFeatureChoice,
  type InstructorPublicFeatureDefinition,
  type InstructorPublicFeatureEntry,
  type InstructorPublicFeatureEntryChoice,
} from "@/lib/instructorPublicFeatures";
import {
  buildPublicInstructorLocation,
  getPublicInstructorDetailHref,
  mapPublicInstructorDisplayName,
} from "@/lib/publicInstructorSearch";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";

type CompareInstructorColumn = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string;
  categoryName: string;
  categorySlug: string;
  specialty: string;
  location: string;
  summary: string;
  profileHref: string;
};

type InstructorListRow = {
  id: number;
  slug: string | null;
  name: string | null;
  surname: string | null;
  full_name?: string | null;
  title: string | null;
  branch: string | null;
  about: string | null;
  bio: string | null;
  city: string | null;
  district: string | null;
  profile_picture: string | null;
  category_id: number | null;
  is_approved: boolean | null;
  is_active: boolean | null;
};

type FeatureEntryWithInstructor = InstructorPublicFeatureEntry & {
  instructor_id: number;
};

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

function buildInstructorSummary(row: InstructorListRow): string {
  const about = String(row.about ?? "").trim();
  if (about) return about;
  const bio = String(row.bio ?? "").trim();
  if (bio) return bio;
  const title = String(row.title ?? "").trim();
  return title;
}

export default function InstructorComparePageClient() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const requestedIds = useMemo(
    () => parseCompareInstructorIdsFromQuery(idsParam),
    [idsParam],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<CompareInstructorColumn[]>([]);
  const [sections, setSections] = useState<InstructorCompareFeatureSection[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());

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
          { data: instructorData, error: instructorError },
          { data: groupsData, error: groupsError },
          { data: definitionsData, error: definitionsError },
          { data: choicesData, error: choicesError },
        ] = await Promise.all([
          supabase
            .from("instructors")
            .select(
              "id, slug, name, surname, full_name, title, branch, about, bio, city, district, profile_picture, category_id, is_approved, is_active",
            )
            .eq("is_approved", true)
            .eq("is_active", true)
            .in("id", requestedIds),
          supabase
            .from("instructor_feature_groups")
            .select("id, name, slug, display_order, is_active, category_slug")
            .eq("is_active", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("instructor_feature_definitions")
            .select(
              "id, group_id, name, slug, input_type, unit, display_order, is_active, show_on_detail",
            )
            .eq("is_active", true)
            .eq("show_on_detail", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("instructor_feature_choices")
            .select("id, feature_definition_id, name, display_order, is_active")
            .eq("is_active", true)
            .order("display_order", { ascending: true })
            .order("id", { ascending: true }),
        ]);

        if (cancelled) return;

        if (instructorError || groupsError || definitionsError || choicesError) {
          if (
            isUnauthorizedSupabaseError(instructorError) ||
            isUnauthorizedSupabaseError(groupsError) ||
            isUnauthorizedSupabaseError(definitionsError) ||
            isUnauthorizedSupabaseError(choicesError)
          ) {
            setColumns([]);
            setSections([]);
            setLoading(false);
            return;
          }
          console.warn("[compare][instructors][query-warning]", {
            instructorError,
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

        const instructorRows = (instructorData as InstructorListRow[] | null) ?? [];
        const byId = new Map(instructorRows.map((row) => [Number(row.id), row]));
        const orderedRows = requestedIds
          .map((id) => byId.get(id))
          .filter((row): row is InstructorListRow => Boolean(row));

        // Public detail / liste ile aynı: category_id → ayrı instructor_categories sorgusu
        const categoryIds = Array.from(
          new Set(
            orderedRows
              .map((row) => Number(row.category_id))
              .filter((id) => Number.isFinite(id) && id > 0),
          ),
        );
        const categoryById = new Map<number, { name: string; slug: string }>();
        if (categoryIds.length > 0) {
          const { data: categoryData, error: categoryError } = await supabase
            .from("instructor_categories")
            .select("id, name, slug")
            .in("id", categoryIds);

          if (cancelled) return;

          if (categoryError) {
            if (isUnauthorizedSupabaseError(categoryError)) {
              // kategori yoksa kolonlar kategori metasız devam eder
            } else {
              console.warn("[compare][instructors][category-warning]", categoryError);
            }
          } else {
            for (const cat of (categoryData ?? []) as Array<{
              id: number;
              name: string | null;
              slug: string | null;
            }>) {
              const id = Number(cat.id);
              if (!Number.isFinite(id) || id <= 0) continue;
              categoryById.set(id, {
                name: String(cat.name ?? "").trim(),
                slug: String(cat.slug ?? "").trim(),
              });
            }
          }
        }

        const nextColumns: CompareInstructorColumn[] = orderedRows
          .map((row) => {
            const numericId = Number(row.id);
            if (!Number.isInteger(numericId) || numericId <= 0) return null;
            const name = mapPublicInstructorDisplayName(row);
            if (!name) return null;
            const slug = String(row.slug ?? "").trim() || String(numericId);
            const category =
              row.category_id != null && Number.isFinite(Number(row.category_id))
                ? categoryById.get(Number(row.category_id))
                : undefined;
            const specialty =
              String(row.branch ?? "").trim() ||
              String(row.title ?? "").trim() ||
              String(category?.name ?? "").trim();
            return {
              id: numericId,
              name,
              slug,
              imageUrl: resolvePublicInstructorProfilePictureUrl(row.profile_picture, supabase),
              categoryName: String(category?.name ?? "").trim(),
              categorySlug: String(category?.slug ?? "").trim(),
              specialty,
              location: buildPublicInstructorLocation(row),
              summary: buildInstructorSummary(row),
              profileHref: getPublicInstructorDetailHref(row.slug, numericId),
            };
          })
          .filter((column): column is CompareInstructorColumn => Boolean(column));

        if (nextColumns.length < 2) {
          setColumns([]);
          setSections([]);
          setLoading(false);
          return;
        }

        const approvedIds = nextColumns.map((column) => column.id);
        const { data: entriesData, error: entriesError } = await supabase
          .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
          .select(
            "id, instructor_id, feature_definition_id, boolean_answer, text_answer, number_answer, selected_choice_id",
          )
          .in("instructor_id", approvedIds);

        if (cancelled) return;

        if (entriesError) {
          if (isUnauthorizedSupabaseError(entriesError)) {
            setColumns(nextColumns);
            setSections([]);
            setLoading(false);
            return;
          }
          console.warn("[compare][instructors][entries-warning]", entriesError);
          setError("Karşılaştırma yüklenirken bir hata oluştu.");
          setColumns([]);
          setSections([]);
          setLoading(false);
          return;
        }

        const entries = (entriesData as FeatureEntryWithInstructor[] | null) ?? [];
        const entryIds = entries.map((entry) => entry.id);
        let entryChoices: InstructorPublicFeatureEntryChoice[] = [];

        if (entryIds.length > 0) {
          const { data: entryChoicesData, error: entryChoicesError } = await supabase
            .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
            .select("instructor_feature_entry_id, choice_id")
            .in("instructor_feature_entry_id", entryIds);

          if (cancelled) return;

          if (entryChoicesError) {
            if (isUnauthorizedSupabaseError(entryChoicesError)) {
              setColumns(nextColumns);
              setSections([]);
              setLoading(false);
              return;
            }
            console.warn("[compare][instructors][entry-choices-warning]", entryChoicesError);
          } else {
            entryChoices =
              (entryChoicesData as InstructorPublicFeatureEntryChoice[] | null) ?? [];
          }
        }

        const rawGroups: InstructorFeatureGroupRow[] = ((groupsData ?? []) as Array<{
          id: number;
          name: string;
          slug?: string | null;
          display_order?: number | null;
          category_slug?: string | null;
        }>).map((g) => ({
          id: g.id,
          name: g.name,
          slug: g.slug ?? null,
          display_order: g.display_order ?? null,
          category_slug: g.category_slug ?? null,
        }));
        const definitions = (definitionsData as InstructorPublicFeatureDefinition[] | null) ?? [];
        const choices = (choicesData as InstructorPublicFeatureChoice[] | null) ?? [];

        const entriesByInstructorId = new Map<number, InstructorPublicFeatureEntry[]>();
        entries.forEach((entry) => {
          const current = entriesByInstructorId.get(entry.instructor_id) ?? [];
          current.push(entry);
          entriesByInstructorId.set(entry.instructor_id, current);
        });

        const entryIdsByInstructorId = new Map<number, Set<number>>();
        entries.forEach((entry) => {
          const current = entryIdsByInstructorId.get(entry.instructor_id) ?? new Set<number>();
          current.add(entry.id);
          entryIdsByInstructorId.set(entry.instructor_id, current);
        });

        const mappedColumns = nextColumns.map((column) => {
          const instructorEntries = entriesByInstructorId.get(column.id) ?? [];
          const instructorEntryIds = entryIdsByInstructorId.get(column.id) ?? new Set<number>();
          const instructorEntryChoices = entryChoices.filter((choice) =>
            instructorEntryIds.has(choice.instructor_feature_entry_id),
          );
          const mapped = mapPublicInstructorFeatures({
            groups: rawGroups,
            definitions,
            choices,
            entries: instructorEntries,
            entryChoices: instructorEntryChoices,
            categorySlug: column.categorySlug || null,
          });
          return { compareValues: mapped.compareValues };
        });

        if (cancelled) return;
        setBrokenImageIds(new Set());
        setColumns(nextColumns);
        setSections(alignInstructorCompareFeatureRows(mappedColumns));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("[compare][instructors][load-error]", err);
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
          <h1 className="institution-compare-title">Eğitmen Karşılaştır</h1>
          <p className="institution-compare-subtitle">
            Seçtiğiniz eğitmenlerin public özelliklerini yan yana inceleyin.
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
            <p>Karşılaştırma için en az 2 onaylı eğitmen gerekli.</p>
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
                    const showImage =
                      Boolean(column.imageUrl) && !brokenImageIds.has(column.id);
                    return (
                      <th key={column.id} scope="col">
                        <div className="institution-compare-institution">
                          {showImage ? (
                            <img
                              src={column.imageUrl}
                              alt=""
                              className="institution-compare-logo"
                              onError={() => {
                                setBrokenImageIds((prev) => {
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
                              {column.name.trim().charAt(0).toUpperCase() || "E"}
                            </span>
                          )}
                          <p className="institution-compare-name" title={column.name}>
                            {column.name}
                          </p>
                          {column.specialty ? (
                            <p className="institution-compare-meta">{column.specialty}</p>
                          ) : null}
                          {column.location && column.location !== "-" ? (
                            <p className="institution-compare-meta">{column.location}</p>
                          ) : null}
                          {column.summary ? (
                            <p
                              className="institution-compare-meta institution-compare-meta--summary"
                              title={column.summary}
                            >
                              {column.summary}
                            </p>
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
  section: InstructorCompareFeatureSection;
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
            const empty = isInstructorPublicFeatureCompareCellEmpty(cell);
            return (
              <td
                key={`${row.rowKey}-${index}`}
                className={
                  empty
                    ? "institution-compare-cell institution-compare-cell--empty"
                    : "institution-compare-cell"
                }
              >
                {empty ? "—" : formatInstructorPublicFeatureCompareCell(cell)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
