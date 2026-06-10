"use client";

import { useState } from "react";
import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";
import { ANKARA_DISTRICTS } from "@/constants/districts";

const CATEGORY_NAME = "Patili Dostlar";

const PATILI_DOSTLAR_FILTER_CONFIG = {
  categories: [
    { label: "Pet Otel/Kreş", count: 0, value: "pet-otel-kres" },
    { label: "Köpek Eğitimi", count: 0, value: "kopek-egitimi" },
    { label: "Pet Kuaför", count: 0, value: "pet-kuafor" },
  ],
};

export default function PatiliDostlarPage() {
  const [searchText, setSearchText] = useState("");
  const [district, setDistrict] = useState("");

  return (
    <>
      <CategoryHero
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectedDistrict={district}
        onDistrictChange={setDistrict}
        districts={[...ANKARA_DISTRICTS]}
      />
      <CategoryPageLayout
        categoryName={CATEGORY_NAME}
        subtitle="Evcil dostlarınız için hizmetleri keşfedin."
        filterConfig={PATILI_DOSTLAR_FILTER_CONFIG}
        results={[]}
        isLoading={false}
        errorMessage={null}
        emptyResultsMessage="Bu kategoriye ait kurum henüz bulunmuyor."
      />
    </>
  );
}
