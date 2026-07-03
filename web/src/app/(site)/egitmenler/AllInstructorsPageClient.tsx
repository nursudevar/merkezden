"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTORS_TABLE } from "@/lib/instructorProfileClient";
import {
  PUBLIC_INSTRUCTORS_TABLE,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import type { CategoryFilterConfig, FilterState } from "@/components/category/CategoryFilterSidebar";
import type { CategoryResultItem } from "@/components/category/useCategoryInstitutions";
import { parsePriceRangeFromText, rangesOverlap } from "@/lib/institutionPriceRangeFilter";

const FALLBACK_INSTRUCTOR_SELECT =
  "id, slug, full_name, name, surname, branch, school, city, district, price_range, profile_picture, is_active, is_approved";

type InstructorDirectoryRow = PublicInstructorRow &
  Record<string, unknown> & {
    slug?: string | null;
    full_name?: string | null;
    branch?: string | null;
    school?: string | null;
    city?: string | null;
    district?: string | null;
    price_range?: string | null;
    profile_picture?: string | null;
    is_active?: boolean | null;
    is_approved?: boolean | null;
  };

type InstructorListItem = {
  id: number;
  href: string;
  displayName: string;
  branchLabel: string;
  schoolLabel: string;
  locationLabel: string;
  imageUrl: string;
  priceLabel: string;
};

const TEMP_MOCK_INSTRUCTORS: InstructorListItem[] = [
  {
    id: -1001,
    href: "/egitmenler",
    displayName: "Ayşe Yılmaz",
    branchLabel: "Matematik",
    schoolLabel: "ODTÜ Matematik Öğretmenliği",
    locationLabel: "Çankaya / Ankara",
    imageUrl: "",
    priceLabel: "1000-5000 TL",
  },
  {
    id: -1002,
    href: "/egitmenler",
    displayName: "Mert Kılıç",
    branchLabel: "İngilizce",
    schoolLabel: "Hacettepe İngiliz Dili ve Edebiyatı",
    locationLabel: "Yenimahalle / Ankara",
    imageUrl: "",
    priceLabel: "5000-10000 TL",
  },
  {
    id: -1003,
    href: "/egitmenler",
    displayName: "Elif Demir",
    branchLabel: "Türkçe",
    schoolLabel: "Ankara Üniversitesi Türk Dili",
    locationLabel: "Etimesgut / Ankara",
    imageUrl: "",
    priceLabel: "0-1000 TL",
  },
  {
    id: -1004,
    href: "/egitmenler",
    displayName: "Can Arslan",
    branchLabel: "Fizik",
    schoolLabel: "Bilkent Fizik",
    locationLabel: "Balgat / Ankara",
    imageUrl: "",
    priceLabel: "1000-5000 TL",
  },
  {
    id: -1005,
    href: "/egitmenler",
    displayName: "Zeynep Kaya",
    branchLabel: "Kimya",
    schoolLabel: "Gazi Kimya Öğretmenliği",
    locationLabel: "Keçiören / Ankara",
    imageUrl: "",
    priceLabel: "5000-10000 TL",
  },
  {
    id: -1006,
    href: "/egitmenler",
    displayName: "Deniz Aydın",
    branchLabel: "Biyoloji",
    schoolLabel: "Ege Üniversitesi Biyoloji",
    locationLabel: "Mamak / Ankara",
    imageUrl: "",
    priceLabel: "10000-50000 TL",
  },
  {
    id: -1007,
    href: "/egitmenler",
    displayName: "Seda Çetin",
    branchLabel: "Geometri",
    schoolLabel: "Selçuk Üniversitesi Matematik",
    locationLabel: "Sincan / Ankara",
    imageUrl: "",
    priceLabel: "1000-5000 TL",
  },
  {
    id: -1008,
    href: "/egitmenler",
    displayName: "Burak Şahin",
    branchLabel: "Almanca",
    schoolLabel: "Marmara Üniversitesi Alman Dili",
    locationLabel: "Çayyolu / Ankara",
    imageUrl: "",
    priceLabel: "5000-10000 TL",
  },
];

const PRIORITY_INSTRUCTOR_ID = 1;

function prioritizeInstructor(items: InstructorListItem[], instructorId: number): InstructorListItem[] {
  const targetIndex = items.findIndex((item) => item.id === instructorId);
  if (targetIndex <= 0) return items;
  const nextItems = [...items];
  const [targetItem] = nextItems.splice(targetIndex, 1);
  nextItems.unshift(targetItem);
  return nextItems;
}

function withTemporaryMockInstructors(items: InstructorListItem[]): InstructorListItem[] {
  const realItems = items.filter((item) => item.id > 0);
  return prioritizeInstructor([...TEMP_MOCK_INSTRUCTORS, ...realItems], PRIORITY_INSTRUCTOR_ID);
}

function hasSupabaseResponseError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error !== "object") return true;
  const row = error as { message?: string; code?: string };
  if (row.message || row.code) return true;
  return Object.keys(error as object).length > 0;
}

function describeSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const row = error as { message?: string; code?: string; details?: string };
  return [row.message, row.code, row.details].filter(Boolean).join(" | ") || JSON.stringify(error);
}

function isMissingActiveColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const row = error as { message?: string; details?: string };
  const text = `${String(row.message ?? "")} ${String(row.details ?? "")}`.toLocaleLowerCase("tr-TR");
  return text.includes("is_active") && text.includes("column");
}

function formatInstructorPriceRange(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "Fiyat belirtilmedi";
  if (/\btl\b/i.test(raw)) return raw;
  return `${raw} TL`;
}

function buildInstructorDisplayName(row: InstructorDirectoryRow): string {
  const fullName = String(row.full_name ?? "").trim();
  if (fullName) return fullName;
  return publicInstructorDisplayName(row);
}

function buildInstructorLocation(row: InstructorDirectoryRow): string {
  const city = String(row.city ?? "").trim();
  const district = String(row.district ?? "").trim();
  if (city && district) return `${district} / ${city}`;
  return district || city;
}

function mapInstructorRowToListItem(
  row: InstructorDirectoryRow,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): InstructorListItem | null {
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const displayName = buildInstructorDisplayName(row);
  const hrefKey = String(row.slug ?? "").trim() || String(id);
  if (!displayName || !hrefKey) return null;

  return {
    id,
    href: `/egitmenler/${encodeURIComponent(hrefKey)}`,
    displayName,
    branchLabel: String(row.branch ?? "").trim() || "Branş belirtilmedi",
    schoolLabel: String(row.school ?? "").trim(),
    locationLabel: buildInstructorLocation(row),
    imageUrl: resolvePublicInstructorProfilePictureUrl(
      String(row.profile_picture ?? "").trim(),
      supabase,
    ),
    priceLabel: formatInstructorPriceRange(row.price_range),
  };
}

async function queryInstructorRows(
  table: string,
  select: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  filterActive: boolean,
): Promise<{ rows: InstructorDirectoryRow[]; error: unknown }> {
  let query = supabase
    .from(table)
    .select(select)
    .eq("is_approved", true)
    .order("name", { ascending: true })
    .order("surname", { ascending: true })
    .limit(1000);

  if (filterActive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  return {
    rows: ((data ?? []) as unknown as InstructorDirectoryRow[]) ?? [],
    error,
  };
}

async function fetchInstructorDirectoryRows(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ rows: InstructorDirectoryRow[]; error: string | null }> {
  const publicActive = await queryInstructorRows(PUBLIC_INSTRUCTORS_TABLE, "*", supabase, true);
  if (!hasSupabaseResponseError(publicActive.error) && publicActive.rows.length > 0) {
    return { rows: publicActive.rows, error: null };
  }
  if (hasSupabaseResponseError(publicActive.error) && !isMissingActiveColumnError(publicActive.error)) {
    console.warn("[public_instructors] directory(active):", describeSupabaseError(publicActive.error));
  }

  if (hasSupabaseResponseError(publicActive.error) && isMissingActiveColumnError(publicActive.error)) {
    const publicAll = await queryInstructorRows(PUBLIC_INSTRUCTORS_TABLE, "*", supabase, false);
    if (!hasSupabaseResponseError(publicAll.error) && publicAll.rows.length > 0) {
      return { rows: publicAll.rows, error: null };
    }
    if (hasSupabaseResponseError(publicAll.error)) {
      console.warn("[public_instructors] directory(all):", describeSupabaseError(publicAll.error));
    }
  }

  const instructorsActive = await queryInstructorRows(
    INSTRUCTORS_TABLE,
    FALLBACK_INSTRUCTOR_SELECT,
    supabase,
    true,
  );
  if (!hasSupabaseResponseError(instructorsActive.error)) {
    return { rows: instructorsActive.rows, error: null };
  }
  if (!isMissingActiveColumnError(instructorsActive.error)) {
    console.warn("[instructors] directory(active):", describeSupabaseError(instructorsActive.error));
  }

  if (isMissingActiveColumnError(instructorsActive.error)) {
    const instructorsAll = await queryInstructorRows(
      INSTRUCTORS_TABLE,
      FALLBACK_INSTRUCTOR_SELECT,
      supabase,
      false,
    );
    if (!hasSupabaseResponseError(instructorsAll.error)) {
      return { rows: instructorsAll.rows, error: null };
    }
    console.warn("[instructors] directory(all):", describeSupabaseError(instructorsAll.error));
  }

  return { rows: [], error: "Eğitmen listesi yüklenemedi." };
}

export function AllInstructorsPageClient() {
  const [items, setItems] = useState<InstructorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    city: "ankara",
    district: "",
    category: "",
    priceRange: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const result = await fetchInstructorDirectoryRows(supabase);
      if (cancelled) return;

      if (result.error) {
        setItems(withTemporaryMockInstructors([]));
        setLoadError(null);
        setLoading(false);
        return;
      }

      const mappedItems = result.rows
        .map((row) => mapInstructorRowToListItem(row, supabase))
        .filter((item): item is InstructorListItem => item !== null);

      setItems(withTemporaryMockInstructors(mappedItems));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filterConfig = useMemo<CategoryFilterConfig>(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const branch = item.branchLabel.trim();
      if (!branch || branch === "Branş belirtilmedi") continue;
      counts.set(branch, (counts.get(branch) ?? 0) + 1);
    }
    return {
      searchPlaceholder: "Eğitmen adı ara...",
      categories: Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b, "tr", { sensitivity: "base" }))
        .map(([label, count]) => ({ label, count, value: label })),
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("tr-TR");
    const district = filters.district.trim().toLocaleLowerCase("tr-TR");
    const category = filters.category.trim().toLocaleLowerCase("tr-TR");
    const priceRange = filters.priceRange;

    return items.filter((item) => {
      if (search) {
        const haystack = [
          item.displayName,
          item.branchLabel,
          item.schoolLabel,
          item.locationLabel,
          item.priceLabel,
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR");
        if (!haystack.includes(search)) return false;
      }

      if (district && district !== "__all__") {
        if (!item.locationLabel.toLocaleLowerCase("tr-TR").includes(district)) return false;
      }

      if (category) {
        if (item.branchLabel.toLocaleLowerCase("tr-TR") !== category) return false;
      }

      if (priceRange) {
        const rowRange = parsePriceRangeFromText(item.priceLabel);
        if (!rowRange || !rangesOverlap(rowRange, priceRange)) return false;
      }

      return true;
    });
  }, [filters, items]);

  const results = useMemo<CategoryResultItem[]>(() => {
    return filteredItems.map((item) => ({
      id: `instructor-${item.id}`,
      resultType: "instructor",
      name: item.displayName,
      description: item.schoolLabel || item.branchLabel,
      location: item.locationLabel || "Konum bilgisi yok",
      price: item.priceLabel,
      ageRange: "-",
      rating: 0,
      reviewCount: 0,
      badges: [],
      logoInitial: item.displayName.charAt(0).toLocaleUpperCase("tr-TR") || "E",
      imageUrl: item.imageUrl || undefined,
      detailUrl: item.href,
      instructorBranch: item.branchLabel,
      instructorTitle: item.schoolLabel,
      priceRange: item.priceLabel,
    }));
  }, [filteredItems]);

  return (
    <CategoryPageLayout
      categoryName="Eğitmenler"
      resultsTitle="Listelenen Eğitmenler"
      filterConfig={filterConfig}
      results={results}
      isLoading={loading}
      errorMessage={loadError}
      emptyResultsMessage="Henüz listelenecek eğitmen bulunmuyor."
      onFilterChange={setFilters}
    />
  );
}
