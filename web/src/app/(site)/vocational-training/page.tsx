"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { useCategoryInstitutions } from "@/components/category/useCategoryInstitutions";

const CATEGORY_NAME = "Mesleki Eğitim";

const filterConfig = {
  categories: [
    { label: "Bilgisayar", count: 20, value: "bilgisayar" },
    { label: "Muhasebe", count: 15, value: "muhasebe" },
    { label: "Grafik Tasarım", count: 12, value: "grafik" },
    { label: "Dil Kursları", count: 18, value: "dil" },
  ],
};

export default function VocationalTrainingPage() {
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
        subtitle="Mesleki beceriler ve kariyer gelişimi için eğitim kurumları. İş hayatında başarılı olmak için gerekli eğitimleri alın."
        filterConfig={filterConfig}
        results={results}
        isLoading={isLoading}
        errorMessage={error}
      />
    </>
  );
}
