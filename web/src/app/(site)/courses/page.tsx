"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "YKS Hazırlık", count: 15, value: "yks" },
    { label: "LGS Hazırlık", count: 12, value: "lgs" },
    { label: "KPSS", count: 8, value: "kpss" },
    { label: "Dil Kursları", count: 20, value: "dil" },
  ],
};

export default function CoursesPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Kurs & Sınava Hazırlık"
        subtitle="Sınavlara hazırlık ve kişisel gelişim kursları. Başarıya giden yolda size en uygun eğitim programını bulun."
        filterConfig={filterConfig}
      />
    </>
  );
}

