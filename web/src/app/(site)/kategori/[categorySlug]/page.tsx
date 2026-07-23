"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";
import {
  EMPTY_SCHOOL_CATEGORY_FILTERS,
  type SchoolCategoryFilterPayload,
} from "@/components/category/schoolCategoryFilterTypes";
import { fetchInstitutionCategoryBySlug } from "@/lib/categoryHelpers";

export default function DynamicCategoryPage() {
  const params = useParams<{ categorySlug?: string | string[] }>();
  const categorySlugParam = params?.categorySlug;
  const categorySlug = String(
    Array.isArray(categorySlugParam) ? categorySlugParam[0] : categorySlugParam ?? "",
  ).trim();

  const [categoryName, setCategoryName] = useState("");
  const [resolvedSlug, setResolvedSlug] = useState(categorySlug);
  const [categoryReady, setCategoryReady] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [district, setDistrict] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<SchoolCategoryFilterPayload>(
    EMPTY_SCHOOL_CATEGORY_FILTERS,
  );

  useEffect(() => {
    if (!categorySlug) {
      notFound();
      return;
    }

    let cancelled = false;
    setCategoryReady(false);

    void (async () => {
      const category = await fetchInstitutionCategoryBySlug(categorySlug);
      if (cancelled) return;

      if (!category) {
        notFound();
        return;
      }

      setCategoryName(category.name);
      setResolvedSlug(category.slug);
      setCategoryReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  const handleCategoryFilterPayloadChange = useCallback(
    (payload: SchoolCategoryFilterPayload) => {
      setCategoryFilters(payload);
    },
    [],
  );

  const { results, isLoading, error, districts } = useCategoryInstitutions(categoryName, {
    search: searchText,
    district,
    categorySlug: resolvedSlug,
    schoolFilters: categoryFilters,
  });

  const listLoading = !categoryReady || isLoading;

  return (
    <>
      <CategoryHero
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectedDistrict={district}
        onDistrictChange={setDistrict}
        districts={districts}
      />
      <CategoryPageLayout
        categoryName={categoryName || categorySlug}
        categorySlug={resolvedSlug}
        subtitle="Ankara bölgesinde öne çıkan eğitim kurumlarını inceleyin."
        results={results}
        isLoading={listLoading}
        errorMessage={categoryReady ? error : null}
        schoolModeProps={{
          linkedSearch: searchText,
          onLinkedSearchChange: setSearchText,
          linkedDistrict: district,
          onLinkedDistrictChange: setDistrict,
          onSchoolFilterPayloadChange: handleCategoryFilterPayloadChange,
        }}
      />
    </>
  );
}
