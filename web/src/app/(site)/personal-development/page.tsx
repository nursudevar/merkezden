"use client";

import CategoryHero from "@/components/category/CategoryHero";
import CategoryPageLayout from "@/components/category/CategoryPageLayout";

const filterConfig = {
  categories: [
    { label: "Kişisel Gelişim", count: 18, value: "kisisel" },
    { label: "Yaşam Koçluğu", count: 12, value: "kocluk" },
    { label: "Motivasyon", count: 10, value: "motivasyon" },
    { label: "Liderlik", count: 8, value: "liderlik" },
  ],
};

export default function PersonalDevelopmentPage() {
  return (
    <>
      <CategoryHero />
      <CategoryPageLayout
        categoryName="Kişisel Gelişim"
        subtitle="Kişisel gelişim ve yaşam becerileri eğitimleri. Potansiyelinizi keşfedin ve kendinizi geliştirin."
        filterConfig={filterConfig}
      />
    </>
  );
}

