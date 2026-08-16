import type { MetadataRoute } from "next";
import { joinCanonicalUrl, resolveCanonicalOrigin } from "@/lib/seo/siteUrl";
import {
  fetchApprovedInstitutionSitemapEntries,
  fetchExtraCategorySitemapEntries,
  fetchPublicInstructorSitemapEntries,
  fetchPublishedBlogSitemapEntries,
  type SitemapPathEntry,
} from "@/lib/seo/sitemapData";

/** Saatlik yenileme — bot her istekte tam tablo taramasın, içerik de güncel kalsın. */
export const revalidate = 3600;

type StaticSitemapItem = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

/** Canonical public listing / bilgi sayfaları (query parametresi yok). */
const STATIC_ENTRIES: readonly StaticSitemapItem[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/okul", changeFrequency: "daily", priority: 0.9 },
  { path: "/kurs-ve-sinava-hazirlik", changeFrequency: "daily", priority: 0.9 },
  { path: "/spor", changeFrequency: "daily", priority: 0.9 },
  { path: "/sanat", changeFrequency: "daily", priority: 0.9 },
  { path: "/yabanci-dil", changeFrequency: "daily", priority: 0.9 },
  { path: "/kisisel-gelisim", changeFrequency: "daily", priority: 0.9 },
  { path: "/mesleki-egitim", changeFrequency: "daily", priority: 0.9 },
  { path: "/ozel-egitim", changeFrequency: "daily", priority: 0.9 },
  { path: "/surucu-kursu", changeFrequency: "daily", priority: 0.9 },
  { path: "/patili-dostlar", changeFrequency: "daily", priority: 0.9 },
  { path: "/egitmenler", changeFrequency: "daily", priority: 0.9 },
  { path: "/haritada-ara", changeFrequency: "daily", priority: 0.9 },
  { path: "/duyurular", changeFrequency: "daily", priority: 0.7 },
  { path: "/blog-yazilari", changeFrequency: "daily", priority: 0.7 },
  { path: "/one-cikanlar", changeFrequency: "weekly", priority: 0.7 },
  { path: "/nasil-calisir", changeFrequency: "monthly", priority: 0.6 },
  { path: "/uyelik", changeFrequency: "monthly", priority: 0.6 },
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.5 },
  { path: "/iletisim", changeFrequency: "monthly", priority: 0.5 },
  { path: "/sikca-sorulan-sorular", changeFrequency: "monthly", priority: 0.5 },
] as const;

function toSitemapItem(
  origin: string,
  entry: SitemapPathEntry,
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>,
  priority: number,
): MetadataRoute.Sitemap[number] {
  const item: MetadataRoute.Sitemap[number] = {
    url: joinCanonicalUrl(origin, entry.path),
    changeFrequency,
    priority,
  };
  if (entry.lastModified) {
    item.lastModified = entry.lastModified;
  }
  return item;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = resolveCanonicalOrigin();

  const [institutions, instructors, blogPosts, extraCategories] = await Promise.all([
    fetchApprovedInstitutionSitemapEntries(),
    fetchPublicInstructorSitemapEntries(),
    fetchPublishedBlogSitemapEntries(),
    fetchExtraCategorySitemapEntries(),
  ]);

  const items: MetadataRoute.Sitemap = [];
  const seenUrls = new Set<string>();

  const pushUnique = (item: MetadataRoute.Sitemap[number]) => {
    if (seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    items.push(item);
  };

  for (const entry of STATIC_ENTRIES) {
    pushUnique({
      url: joinCanonicalUrl(origin, entry.path),
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    });
  }

  for (const entry of extraCategories) {
    pushUnique(toSitemapItem(origin, entry, "daily", 0.9));
  }

  for (const entry of institutions) {
    pushUnique(toSitemapItem(origin, entry, "weekly", 0.8));
  }

  for (const entry of instructors) {
    pushUnique(toSitemapItem(origin, entry, "weekly", 0.8));
  }

  for (const entry of blogPosts) {
    pushUnique(toSitemapItem(origin, entry, "monthly", 0.7));
  }

  return items;
}
