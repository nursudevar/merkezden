"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Sanat";

const filterConfig = {
  categories: [
    { label: "Müzik", count: 16, value: "muzik" },
    { label: "Resim", count: 12, value: "resim" },
    { label: "Tiyatro", count: 8, value: "tiyatro" },
    { label: "Dans", count: 14, value: "dans" },
  ],
};

export default function ArtsPage() {
  const [searchText, setSearchText] = useState("");
  const [district, setDistrict] = useState("");
  const { results, isLoading, error, districts } = useCategoryInstitutions(CATEGORY_NAME, {
    search: searchText,
    district,
  });

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
        categoryName={CATEGORY_NAME}
        subtitle="Sanat ve yaratıcılık odaklı eğitim kurumları. Müzik, resim, tiyatro ve daha fazlası için profesyonel eğitim."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
