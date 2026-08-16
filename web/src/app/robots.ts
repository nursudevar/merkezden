import type { MetadataRoute } from "next";
import { joinCanonicalUrl, resolveCanonicalOrigin } from "@/lib/seo/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const origin = resolveCanonicalOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/panel",
          "/egitmen-paneli",
          "/kurum-paneli",
          "/giris",
          "/kayit-ol",
          "/sifremi-unuttum",
          "/sifre-guncelle",
          "/profil",
          "/dashboard",
          "/api/",
        ],
      },
    ],
    sitemap: joinCanonicalUrl(origin, "/sitemap.xml"),
  };
}
