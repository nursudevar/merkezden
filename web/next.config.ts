import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "kjfvjqarphvlypiftjed.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      // Tek segment: /institutions/:slug → /kurumlar/:slug
      // /institutions/meb/:id iki segment; ayrı kural aşağıda.
      {
        source: "/institutions/meb/:id",
        destination: "/kurumlar/meb/:id",
        permanent: true,
      },
      {
        source: "/institutions/:slug",
        destination: "/kurumlar/:slug",
        permanent: true,
      },
      {
        source: "/institution",
        destination: "/kurum-paneli",
        permanent: true,
      },
      {
        source: "/courses",
        destination: "/kurs-ve-sinava-hazirlik",
        permanent: true,
      },
      {
        source: "/arts",
        destination: "/sanat",
        permanent: true,
      },
      {
        source: "/blog",
        destination: "/blog-yazilari",
        permanent: true,
      },
      {
        source: "/blog/:slug",
        destination: "/blog-yazilari/:slug",
        permanent: true,
      },
      {
        source: "/about",
        destination: "/hakkimizda",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/iletisim",
        permanent: true,
      },
      {
        source: "/faq",
        destination: "/sikca-sorulan-sorular",
        permanent: true,
      },
      {
        source: "/announcements",
        destination: "/duyurular",
        permanent: true,
      },
      {
        source: "/school",
        destination: "/okul",
        permanent: true,
      },
      {
        source: "/okullar",
        destination: "/okul",
        permanent: true,
      },
      {
        source: "/sports",
        destination: "/spor",
        permanent: true,
      },
      {
        source: "/languages",
        destination: "/yabanci-dil",
        permanent: true,
      },
      {
        source: "/personal-development",
        destination: "/kisisel-gelisim",
        permanent: true,
      },
      {
        source: "/special-education",
        destination: "/ozel-egitim",
        permanent: true,
      },
      {
        source: "/vocational-training",
        destination: "/mesleki-egitim",
        permanent: true,
      },
      {
        source: "/login",
        destination: "/giris",
        permanent: true,
      },
      {
        source: "/signup",
        destination: "/kayit-ol",
        permanent: true,
      },
      {
        source: "/forgot-password",
        destination: "/sifremi-unuttum",
        permanent: true,
      },
      {
        source: "/profile",
        destination: "/profil",
        permanent: true,
      },
      {
        source: "/auth/update-password",
        destination: "/sifre-guncelle",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
