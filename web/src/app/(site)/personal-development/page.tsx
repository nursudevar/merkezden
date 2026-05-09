"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Kişisel Gelişim";

const filterConfig = {
  categories: [
    { label: "Kişisel Gelişim", count: 18, value: "kisisel" },
    { label: "Yaşam Koçluğu", count: 12, value: "kocluk" },
    { label: "Motivasyon", count: 10, value: "motivasyon" },
    { label: "Liderlik", count: 8, value: "liderlik" },
  ],
};

export default function PersonalDevelopmentPage() {
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
        subtitle="Kişisel gelişim ve yaşam becerileri eğitimleri. Potansiyelinizi keşfedin ve kendinizi geliştirin."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
