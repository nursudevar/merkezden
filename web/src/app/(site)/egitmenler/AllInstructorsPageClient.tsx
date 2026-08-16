"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import type { FilterState } from "@/components/category/CategoryFilterSidebar";
import {
  resolveCategoryListingIlId,
  useCategoryLocationFilterState,
} from "@/components/category/categoryLocationFilter";
import {
  EMPTY_INSTRUCTOR_CATEGORY_FILTERS,
  type InstructorCategoryFilterPayload,
} from "@/components/category/instructorCategoryFilterTypes";
import type { CategoryResultItem } from "@/components/category/useCategoryInstitutions";
import { instructorPriceLabelOverlapsUserRange } from "@/lib/institutionPriceRangeFilter";
import {
  fetchActiveFeaturedInstructorOrderMap,
  sortWithFeaturedPriority,
  type FeaturedOrderMap,
} from "@/lib/featuredAccountsClient";
import {
  fetchInstructorFeatureCategoriesClient,
  fetchInstructorPriceRangeLabelsByInstructorIdsClient,
  formatInstructorPriceRangeDisplay,
  type InstructorFeatureCategoryRow,
} from "@/lib/instructorFeaturesClient";
import {
  fetchPublicInstructorsForListing,
  hasInstructorCategoryFilterPayload,
  resolveInstructorIdsFromInstructorCategoryFilterPayload,
} from "@/lib/publicInstructorSearch";
import { parseLocationId } from "@/lib/turkiyeLocationsClient";

type InstructorDirectoryRow = PublicInstructorRow &
  Record<string, unknown> & {
    slug?: string | null;
    full_name?: string | null;
    branch?: string | null;
    school?: string | null;
    il_id?: number | null;
    ilce_id?: number | null;
    locationIlAd?: string | null;
    locationIlceAd?: string | null;
    profile_picture?: string | null;
    is_active?: boolean | null;
    is_approved?: boolean | null;
    category_id?: number | null;
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
  categoryId: number | null;
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
    categoryId: null,
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
    categoryId: null,
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
    categoryId: null,
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
    categoryId: null,
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
    categoryId: null,
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
    categoryId: null,
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
    categoryId: null,
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
    categoryId: null,
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

function describeSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const row = error as { message?: string; code?: string; details?: string };
  return [row.message, row.code, row.details].filter(Boolean).join(" | ") || JSON.stringify(error);
}

function buildInstructorDisplayName(row: InstructorDirectoryRow): string {
  const fullName = String(row.full_name ?? "").trim();
  if (fullName) return fullName;
  return publicInstructorDisplayName(row);
}

function buildInstructorLocation(row: InstructorDirectoryRow): string {
  const city = String(row.locationIlAd ?? "").trim();
  const district = String(row.locationIlceAd ?? "").trim();
  if (city && district) return `${district} / ${city}`;
  return district || city;
}

function mapInstructorRowToListItem(
  row: InstructorDirectoryRow,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  priceLabel?: string,
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
    priceLabel: formatInstructorPriceRangeDisplay(priceLabel ?? ""),
    categoryId: Number.isFinite(Number(row.category_id)) ? Number(row.category_id) : null,
  };
}

export function AllInstructorsPageClient() {
  const [items, setItems] = useState<InstructorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featuredInstructorOrderMap, setFeaturedInstructorOrderMap] = useState<FeaturedOrderMap>(
    () => new Map(),
  );
  const [instructorCategories, setInstructorCategories] = useState<InstructorFeatureCategoryRow[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    city: "",
    district: "",
    category: "",
    priceRange: null,
  });
  const { location, setLocation, locationReady } = useCategoryLocationFilterState();
  const [instructorFeatureFilters, setInstructorFeatureFilters] =
    useState<InstructorCategoryFilterPayload>(EMPTY_INSTRUCTOR_CATEGORY_FILTERS);
  const [featureAllowedIds, setFeatureAllowedIds] = useState<Set<number> | null>(null);
  const [featureFilterLoading, setFeatureFilterLoading] = useState(false);

  const instructorFeatureFiltersKey = useMemo(
    () => JSON.stringify(instructorFeatureFilters),
    [instructorFeatureFilters],
  );

  const selectedInstructorCategoryId = useMemo(() => {
    const slug = String(filters.category ?? "").trim();
    if (!slug) return null;
    const category = instructorCategories.find((row) => String(row.slug ?? "").trim() === slug);
    const categoryId = Number(category?.id);
    return Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null;
  }, [filters.category, instructorCategories]);

  useEffect(() => {
    let cancelled = false;

    if (!hasInstructorCategoryFilterPayload(instructorFeatureFilters)) {
      setFeatureAllowedIds(null);
      setFeatureFilterLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setFeatureFilterLoading(true);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const allowedIds = await resolveInstructorIdsFromInstructorCategoryFilterPayload(
          supabase,
          instructorFeatureFilters,
        );
        if (cancelled) return;
        setFeatureAllowedIds(allowedIds);
      } catch (error) {
        console.warn("[instructor-feature-filters]", describeSupabaseError(error));
        if (cancelled) return;
        setFeatureAllowedIds(new Set<number>());
      } finally {
        if (!cancelled) setFeatureFilterLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instructorFeatureFiltersKey]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [featuredOrderResult, categoriesResult] = await Promise.all([
        fetchActiveFeaturedInstructorOrderMap(supabase),
        fetchInstructorFeatureCategoriesClient(supabase),
      ]);
      if (cancelled) return;

      if (!categoriesResult.error) {
        setInstructorCategories(categoriesResult.categories);
      }

      if (!featuredOrderResult.error) {
        setFeaturedInstructorOrderMap(featuredOrderResult.orderMap);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!locationReady) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const ilId = await resolveCategoryListingIlId(location.ilId);
        const ilceId = parseLocationId(location.ilceId);
        const mahalleId =
          ilceId != null ? parseLocationId(location.mahalleId) : null;

        const rows = await fetchPublicInstructorsForListing(supabase, {
          ilId,
          ilceId,
          mahalleId,
        });
        if (cancelled) return;

        const instructorIds = rows
          .map((row) => Number(row.id))
          .filter((id) => Number.isFinite(id) && id > 0);
        const priceLabelsByInstructorId = await fetchInstructorPriceRangeLabelsByInstructorIdsClient(
          instructorIds,
          supabase,
        );
        if (cancelled) return;

        const mappedItems = rows
          .map((row) =>
            mapInstructorRowToListItem(
              row as InstructorDirectoryRow,
              supabase,
              priceLabelsByInstructorId.get(Number(row.id)),
            ),
          )
          .filter((item): item is InstructorListItem => item !== null);

        setItems(withTemporaryMockInstructors(mappedItems));
        setLoading(false);
      } catch (error) {
        console.warn("[public_instructors] listing:", describeSupabaseError(error));
        if (cancelled) return;
        setItems(withTemporaryMockInstructors([]));
        setLoadError(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationReady, location.ilId, location.ilceId, location.mahalleId]);

  const filteredItems = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("tr-TR");
    const priceRange = filters.priceRange;

    return items.filter((item) => {
      if (selectedInstructorCategoryId != null) {
        if (item.id <= 0 || item.categoryId !== selectedInstructorCategoryId) return false;
      }

      if (featureAllowedIds !== null) {
        if (item.id <= 0 || !featureAllowedIds.has(item.id)) return false;
      }

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

      if (priceRange) {
        if (!instructorPriceLabelOverlapsUserRange(item.priceLabel, priceRange)) return false;
      }

      return true;
    });
  }, [filters, featureAllowedIds, items, selectedInstructorCategoryId]);

  const sortedFilteredItems = useMemo(() => {
    return sortWithFeaturedPriority(
      filteredItems,
      (item) => {
        const id = Number(item.id);
        return Number.isFinite(id) && id > 0 ? id : null;
      },
      featuredInstructorOrderMap,
    );
  }, [filteredItems, featuredInstructorOrderMap]);

  const results = useMemo<CategoryResultItem[]>(() => {
    return sortedFilteredItems.map((item) => {
      const numericId = Number(item.id);
      const slugFromHref = String(item.href ?? "")
        .replace(/^\/egitmenler\//, "")
        .trim();
      const slug =
        decodeURIComponent(slugFromHref) ||
        (Number.isFinite(numericId) && numericId > 0 ? String(numericId) : "");

      return {
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
        slug: slug || undefined,
        detailUrl: item.href,
        instructorBranch: item.branchLabel,
        instructorTitle: item.schoolLabel,
        priceRange: item.priceLabel,
        instructorId:
          Number.isInteger(numericId) && numericId > 0 ? numericId : undefined,
      };
    });
  }, [sortedFilteredItems]);

  return (
    <CategoryPageLayout
      categoryName="Eğitmenler"
      resultsTitle="Listelenen Eğitmenler"
      filterConfig={{ searchPlaceholder: "Eğitmen adı ara..." }}
      results={results}
      isLoading={loading || featureFilterLoading}
      errorMessage={loadError}
      emptyResultsMessage="Henüz listelenecek eğitmen bulunmuyor."
      onFilterChange={setFilters}
      instructorModeProps={{
        linkedLocation: location,
        onLinkedLocationChange: setLocation,
        onInstructorFilterPayloadChange: setInstructorFeatureFilters,
      }}
      extraBreadcrumbItems={
        selectedInstructorCategoryId
          ? instructorCategories
              .filter((row) => Number(row.id) === selectedInstructorCategoryId)
              .map((row) => ({
                label: String(row.name ?? "").trim(),
                href: "/egitmenler",
              }))
              .filter((item) => item.label.length > 0)
          : undefined
      }
    />
  );
}
