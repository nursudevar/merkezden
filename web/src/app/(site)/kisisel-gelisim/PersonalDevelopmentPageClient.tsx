"use client";

import { useCallback, useEffect, useState } from "react";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";
import { useCategoryLocationFilterState } from "@/components/category/categoryLocationFilter";
import {
  EMPTY_SCHOOL_CATEGORY_FILTERS,
  type SchoolCategoryFilterPayload,
} from "@/components/category/schoolCategoryFilterTypes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeCategoryKey } from "@/lib/categoryHelpers";

const CATEGORY_NAME = "Kişisel Gelişim";
const FALLBACK_CATEGORY_SLUG = "personal-development";

export default function PersonalDevelopmentPageClient() {
  const [searchText, setSearchText] = useState("");
  const { location, setLocation, locationReady } = useCategoryLocationFilterState();
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
        return nk.includes("kisisel gelisim") || nk.includes("kisisel-gelisim");
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

  const { results, isLoading, error } = useCategoryInstitutions(CATEGORY_NAME, {
    search: searchText,
    ilId: location.ilId,
    ilceId: location.ilceId,
    mahalleId: location.mahalleId,
    locationReady,
    categorySlug,
    schoolFilters: categoryFilters,
  });

  return (
      <CategoryPageLayout
        categoryName={CATEGORY_NAME}
        categorySlug={categorySlug}
        subtitle="Kişisel gelişim ve yaşam becerileri eğitimleri. Potansiyelinizi keşfedin ve kendinizi geliştirin."
        results={results}
        isLoading={isLoading}
        errorMessage={error}
        schoolModeProps={{
          linkedSearch: searchText,
          onLinkedSearchChange: setSearchText,
          linkedLocation: location,
          onLinkedLocationChange: setLocation,
          onSchoolFilterPayloadChange: handleCategoryFilterPayloadChange,
        }}
      />
  );
}
