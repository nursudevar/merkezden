import type { Metadata } from "next";

type CategorySeoEntry = {
  title: string;
  description: string;
};

const CATEGORY_SEO_BY_NAME: Record<string, CategorySeoEntry> = {
  Okul: {
    title: "Ankara Okulları ve Eğitim Kurumları | Merkezden",
    description:
      "Ankara'daki okulları, eğitim kurumlarını, özelliklerini ve hizmetlerini karşılaştırın.",
  },
  "Kurs & Sınava Hazırlık": {
    title: "Ankara Kurs ve Sınav Hazırlık Merkezleri | Merkezden",
    description:
      "Ankara'da YKS, LGS, KPSS ve branş kurslarını; programları, fiyatları ve özellikleriyle karşılaştırın.",
  },
  Spor: {
    title: "Ankara Spor Kursları ve Kulüpleri | Merkezden",
    description:
      "Ankara'daki spor kurslarını, kulüplerini ve antrenman programlarını keşfedin; size en uygun tesisi bulun.",
  },
  Sanat: {
    title: "Ankara Sanat Kursları ve Atölyeleri | Merkezden",
    description:
      "Ankara'da resim, müzik, dans ve diğer sanat kurslarını inceleyin; atölyeleri ve eğitmenleri karşılaştırın.",
  },
  "Yabancı Dil": {
    title: "Ankara Yabancı Dil Kursları | Merkezden",
    description:
      "Ankara'daki yabancı dil kurslarını, eğitim programlarını ve seviye seçeneklerini karşılaştırarak keşfedin.",
  },
  "Kişisel Gelişim": {
    title: "Ankara Kişisel Gelişim Kursları | Merkezden",
    description:
      "Ankara'da kişisel gelişim, koçluk ve beceri kurslarını keşfedin; hedefinize uygun programı bulun.",
  },
  "Mesleki Eğitim": {
    title: "Ankara Mesleki Eğitim Kursları | Merkezden",
    description:
      "Ankara'daki mesleki eğitim kurslarını, sertifika programlarını ve atölyeleri karşılaştırın.",
  },
  "Özel Eğitim": {
    title: "Ankara Özel Eğitim Kurumları | Merkezden",
    description:
      "Ankara'da özel eğitim ve destek hizmeti veren kurumları; uzmanlık alanları ve programlarıyla inceleyin.",
  },
  "Sürücü Kursu": {
    title: "Ankara Sürücü Kursları | Merkezden",
    description:
      "Ankara'daki sürücü kurslarını, eğitim paketlerini ve başarı oranlarını karşılaştırarak seçin.",
  },
};

export function getCategoryPageMetadata(categoryName: string): Metadata {
  const name = String(categoryName ?? "").trim();
  const entry = CATEGORY_SEO_BY_NAME[name];
  if (entry) {
    return { title: entry.title, description: entry.description };
  }

  const label = name || "Eğitim";
  return {
    title: `Ankara ${label} Kurumları | Merkezden`,
    description: `Ankara'daki ${label.toLowerCase()} kurumlarını, özelliklerini ve hizmetlerini karşılaştırın.`,
  };
}
