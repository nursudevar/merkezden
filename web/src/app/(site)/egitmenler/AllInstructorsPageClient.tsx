"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { formatInstitutionPriceRangeDisplay } from "@/lib/institutionPriceRangeFilter";
import {
  fetchActiveFeaturedInstructorOrderMap,
  sortWithFeaturedPriority,
  type FeaturedOrderMap,
} from "@/lib/featuredAccountsClient";
import {
  fetchInstructorFeatureCategoriesClient,
  type InstructorFeatureCategoryRow,
} from "@/lib/instructorFeaturesClient";
import {
  fetchPublicInstructorsForListing,
  hasInstructorCategoryFilterPayload,
  instructorStoredPriceOverlapsSelectedRange,
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
    min_fiyat?: number | null;
    max_fiyat?: number | null;
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
  minFiyat: number | null;
  maxFiyat: number | null;
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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
    priceLabel: "",
    minFiyat: null,
    maxFiyat: null,
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

function storedInstructorPrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(value);
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

  const minFiyat = storedInstructorPrice(row.min_fiyat);
  const maxFiyat = storedInstructorPrice(row.max_fiyat);

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
    priceLabel: formatInstitutionPriceRangeDisplay(minFiyat, maxFiyat) ?? "Fiyat belirtilmedi",
    minFiyat,
    maxFiyat,
    categoryId: Number.isFinite(Number(row.category_id)) ? Number(row.category_id) : null,
  };
}

const INSTRUCTOR_CATEGORY_PARAM = "kategori";
const INSTRUCTOR_SEARCH_PARAM_ORDER = ["kategori", "il", "ilce", "mahalle"] as const;

function orderInstructorSearch(search: string): string {
  const source = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const prioritized = new Map<string, string[]>();
  const rest: Array<[string, string]> = [];
  for (const [key, value] of source.entries()) {
    if ((INSTRUCTOR_SEARCH_PARAM_ORDER as readonly string[]).includes(key)) {
      const values = prioritized.get(key);
      if (values) values.push(value);
      else prioritized.set(key, [value]);
    } else {
      rest.push([key, value]);
    }
  }
  const ordered = new URLSearchParams();
  for (const key of INSTRUCTOR_SEARCH_PARAM_ORDER) {
    for (const value of prioritized.get(key) ?? []) ordered.append(key, value);
  }
  for (const [key, value] of rest) ordered.append(key, value);
  return ordered.toString();
}

function readInstructorCategoryParam(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(INSTRUCTOR_CATEGORY_PARAM)?.trim() ?? "";
}

function writeInstructorCategoryParam(slug: string, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (slug) params.set(INSTRUCTOR_CATEGORY_PARAM, slug);
  else params.delete(INSTRUCTOR_CATEGORY_PARAM);
  const ordered = orderInstructorSearch(params.toString());
  const next = `${window.location.pathname}${ordered ? `?${ordered}` : ""}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  if (mode === "push") window.history.pushState(window.history.state, "", next);
  else window.history.replaceState(window.history.state, "", next);
}

function resolveInstructorCategorySlug(
  raw: string,
  categories: InstructorFeatureCategoryRow[],
): string | null {
  const slug = raw.trim();
  if (!slug) return "";
  const known = categories.some((row) => String(row.slug ?? "").trim() === slug);
  return known ? slug : null;
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

  useEffect(() => {
    const { pushState, replaceState } = window.history;
    const orderUrl = (url?: string | URL | null) => {
      if (url == null) return url;
      const parsed = new URL(typeof url === "string" ? url : url.href, window.location.href);
      if (parsed.origin !== window.location.origin || parsed.pathname !== "/egitmenler") return url;
      const search = orderInstructorSearch(parsed.search);
      return `${parsed.pathname}${search ? `?${search}` : ""}${parsed.hash}`;
    };
    window.history.pushState = (data, unused, url) => {
      pushState.call(window.history, data, unused, orderUrl(url));
    };
    window.history.replaceState = (data, unused, url) => {
      replaceState.call(window.history, data, unused, orderUrl(url));
    };

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const ordered = orderUrl(current);
    if (ordered !== current) replaceState.call(window.history, window.history.state, "", ordered);

    return () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
    };
  }, []);
  const [instructorFeatureFilters, setInstructorFeatureFilters] =
    useState<InstructorCategoryFilterPayload>(EMPTY_INSTRUCTOR_CATEGORY_FILTERS);
  const [featureAllowedIds, setFeatureAllowedIds] = useState<Set<number> | null>(null);
  const [featureFilterLoading, setFeatureFilterLoading] = useState(false);

  const instructorFeatureFiltersKey = useMemo(
    () => JSON.stringify(instructorFeatureFilters),
    [instructorFeatureFilters],
  );

  const categoriesRef = useRef(instructorCategories);
  categoriesRef.current = instructorCategories;
  const categoryRef = useRef(filters.category);
  categoryRef.current = filters.category;

  const applyCategoryFromUrl = useCallback((categories: InstructorFeatureCategoryRow[]) => {
    if (categories.length === 0) return;
    const resolved = resolveInstructorCategorySlug(readInstructorCategoryParam(), categories);
    const nextCategory = resolved ?? "";
    if (resolved === null) writeInstructorCategoryParam("", "replace");
    categoryRef.current = nextCategory;
    setFilters((prev) => (prev.category === nextCategory ? prev : { ...prev, category: nextCategory }));
  }, []);

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
        applyCategoryFromUrl(categoriesResult.categories);
      }

      if (!featuredOrderResult.error) {
        setFeaturedInstructorOrderMap(featuredOrderResult.orderMap);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyCategoryFromUrl]);

  useEffect(() => {
    const onPopState = () => applyCategoryFromUrl(categoriesRef.current);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyCategoryFromUrl]);

  const handleFilterChange = (next: FilterState) => {
    const categories = categoriesRef.current;
    const requested = String(next.category ?? "").trim();
    if (requested === categoryRef.current) {
      setFilters(next);
      return;
    }
    const resolved =
      categories.length === 0 ? requested : resolveInstructorCategorySlug(requested, categories);
    if (resolved === null) return;
    categoryRef.current = resolved;
    writeInstructorCategoryParam(resolved, "push");
    setFilters({ ...next, category: resolved });
  };

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

        const mappedItems = rows
          .map((row) => mapInstructorRowToListItem(row as InstructorDirectoryRow, supabase))
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

      if (
        !instructorStoredPriceOverlapsSelectedRange(item.minFiyat, item.maxFiyat, priceRange)
      ) {
        return false;
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
      onFilterChange={handleFilterChange}
      instructorModeProps={{
        linkedLocation: location,
        onLinkedLocationChange: setLocation,
        onInstructorFilterPayloadChange: setInstructorFeatureFilters,
        controlledInstructorCategorySlug: filters.category,
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
