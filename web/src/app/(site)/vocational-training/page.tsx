"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "Bilgisayar", count: 20, value: "bilgisayar" },
    { label: "Muhasebe", count: 15, value: "muhasebe" },
    { label: "Grafik Tasarım", count: 12, value: "grafik" },
    { label: "Dil Kursları", count: 18, value: "dil" },
  ],
};

export default function VocationalTrainingPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Mesleki Eğitim"
        subtitle="Mesleki beceriler ve kariyer gelişimi için eğitim kurumları. İş hayatında başarılı olmak için gerekli eğitimleri alın."
        filterConfig={filterConfig}
      />
    </>
  );
}

