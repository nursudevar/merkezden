"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "Müzik", count: 16, value: "muzik" },
    { label: "Resim", count: 12, value: "resim" },
    { label: "Tiyatro", count: 8, value: "tiyatro" },
    { label: "Dans", count: 14, value: "dans" },
  ],
};

export default function ArtsPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Sanat"
        subtitle="Sanat ve yaratıcılık odaklı eğitim kurumları. Müzik, resim, tiyatro ve daha fazlası için profesyonel eğitim."
        filterConfig={filterConfig}
      />
    </>
  );
}

