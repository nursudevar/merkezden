import type { Metadata } from "next";
import { getCategorySeoByName } from "@/lib/seo/categorySeoContent";

/**
 * Kategori sayfası `<head>` metadata’sı.
 * On-page H1 / uzun açıklama `categorySeoContent` ile paylaşılır; konum/query bağlanmaz.
 */
export function getCategoryPageMetadata(categoryName: string): Metadata {
  const entry = getCategorySeoByName(categoryName);
  if (entry) {
    return {
      title: entry.metaTitle,
      description: entry.metaDescription,
    };
  }

  const label = String(categoryName ?? "").trim() || "Eğitim";
  return {
    title: `${label} | Merkezden`,
    description: `${label} kurumlarını Merkezden üzerinden keşfedin; filtreleyin ve profilleri inceleyin.`,
  };
}
