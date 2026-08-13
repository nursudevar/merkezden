"use client";

import { useCallback, useEffect, useState } from "react";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";
import {
  EMPTY_SCHOOL_CATEGORY_FILTERS,
  type SchoolCategoryFilterPayload,
} from "@/components/category/schoolCategoryFilterTypes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeCategoryKey } from "@/lib/categoryHelpers";

const CATEGORY_NAME = "Mesleki Eğitim";
const FALLBACK_CATEGORY_SLUG = "vocational-training";

export default function VocationalTrainingPageClient() {
  const [searchText, setSearchText] = useState("");
  const [district, setDistrict] = useState("");
  const [categorySlug, setCategorySlug] = useState<string>(FALLBACK_CATEGORY_SLUG);
  const [categoryFilters, setCategoryFilters] = useState<SchoolCategoryFilterPayload>(
    EMPTY_SCHOOL_CATEGORY_FILTERS,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("institution_categories")
        .select("slug, name")
        .eq("is_active", true);

      if (cancelled) return;

      if (error || !data?.length) {
        setCategorySlug(FALLBACK_CATEGORY_SLUG);
        return;
      }

      const rows = data as Array<{ slug: string | null; name: string | null }>;
      const targetName = CATEGORY_NAME.trim();
      const byExactName = rows.find((r) => String(r.name ?? "").trim() === targetName);
      const byKey = rows.find((r) => {
        const nk = normalizeCategoryKey(`${r.name ?? ""} ${r.slug ?? ""}`);
        return nk.includes("mesleki egitim") || nk.includes("mesleki-egitim") || nk.includes("meslek");
      });

      const resolved = String((byExactName ?? byKey)?.slug ?? "").trim();
      setCategorySlug(resolved || FALLBACK_CATEGORY_SLUG);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCategoryFilterPayloadChange = useCallback(
    (payload: SchoolCategoryFilterPayload) => {
      setCategoryFilters(payload);
    },
    [],
  );

  const { results, isLoading, error, districts } = useCategoryInstitutions(CATEGORY_NAME, {
    search: searchText,
    district,
    categorySlug,
    schoolFilters: categoryFilters,
  });

  return (
      <CategoryPageLayout
        districts={districts}
        categoryName={CATEGORY_NAME}
        categorySlug={categorySlug}
        subtitle="Mesleki beceriler ve kariyer gelişimi için eğitim kurumları. İş hayatında başarılı olmak için gerekli eğitimleri alın."
        results={results}
        isLoading={isLoading}
        errorMessage={error}
        schoolModeProps={{
          linkedSearch: searchText,
          onLinkedSearchChange: setSearchText,
          linkedDistrict: district,
          onLinkedDistrictChange: setDistrict,
          onSchoolFilterPayloadChange: handleCategoryFilterPayloadChange,
        }}
      />
  );
}
