import type { Metadata } from "next";
import { getCategoryPageMetadata } from "@/lib/seo/categoryPageMetadata";
import { fetchInstitutionCategoryBySlugServer } from "@/lib/seo/metadataServer";
import CategorySlugPageClient from "./CategorySlugPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}): Promise<Metadata> {
  const { categorySlug } = await params;
  const slug = String(categorySlug ?? "").trim();
  if (!slug) {
    return {
      title: "Kategori Bulunamadı | Merkezden",
      description: "Aradığınız kategori sayfası bulunamadı.",
    };
  }

  const category = await fetchInstitutionCategoryBySlugServer(slug);
  if (!category) {
    return getCategoryPageMetadata(slug.replace(/-/g, " "));
  }

  return getCategoryPageMetadata(category.name);
}

export default function DynamicCategoryPage() {
  return <CategorySlugPageClient />;
}
