/** Ana sayfa kategori kartları ve footer ile aynı rota eşlemesi */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Building2,
  Car,
  Dumbbell,
  GraduationCap,
  HeartHandshake,
  Languages,
  Landmark,
  Palette,
  PawPrint,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Utensils,
} from "lucide-react"; 

export const normalizeCategoryKey = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Ana sayfa ana kategoriler ve footer etiketleri için sabit sıra */
export const HOME_MAIN_CATEGORY_ORDER = [
  "OKUL",
  "KURS & SINAVA HAZIRLIK",
  "SPOR",
  "SANAT",
  "YABANCI DİL",
  "KİŞİSEL GELİŞİM",
  "MESLEKİ EĞİTİM",
  "ÖZEL EĞİTİM",
] as const;

export function sortByHomeMainCategoryOrder<T extends { name: string }>(items: T[]): T[] {
  const orderMap = new Map(
    HOME_MAIN_CATEGORY_ORDER.map((label, index) => [normalizeCategoryKey(label), index]),
  );

  return [...items].sort((a, b) => {
    const aIndex = orderMap.get(normalizeCategoryKey(a.name));
    const bIndex = orderMap.get(normalizeCategoryKey(b.name));

    if (aIndex != null && bIndex != null) return aIndex - bIndex;
    if (aIndex != null) return -1;
    if (bIndex != null) return 1;
    return a.name.localeCompare(b.name, "tr-TR");
  });
}

/** Bilinen kategori sayfalarına gider; yoksa null (çağıran `/okullar` vb. kullanabilir) */
export function getCategoryHref(name: string, slug: string): string | null {
  const key = normalizeCategoryKey(`${name} ${slug}`);
  if (key.includes("okul")) return "/school";
  if (key.includes("kurs") || key.includes("sinav")) return "/courses";
  if (key.includes("spor")) return "/sports";
  if (key.includes("sanat")) return "/arts";
  if (key.includes("yabanci dil") || key.includes("dil")) return "/languages";
  if (key.includes("kisisel gelisim")) return "/personal-development";
  if (key.includes("mesleki egitim")) return "/vocational-training";
  if (key.includes("ozel egitim")) return "/special-education";
  return null;
}

/**
 * Ana kategoriler kartı — başlık/slug ile uyumlu ikonlar.
 * Geniş "egitim" eşlemesi yok; önce dar anahtar kelimeler (getCategoryHref sırasına yakın).
 */
export function getCategoryIcon(name: string, slug: string): LucideIcon {
  const key = normalizeCategoryKey(`${name} ${slug}`);
  const slugKey = normalizeCategoryKey(slug);

  if (
    key.includes("patili") ||
    key.includes("pet") ||
    key.includes("hayvan") ||
    key.includes("veteriner") ||
    slugKey.includes("pet") ||
    slugKey.includes("patili")
  ) {
    return PawPrint;
  }
  if (key.includes("ozel egitim")) {
    return HeartHandshake;
  }
  if (key.includes("mesleki")) {
    return Briefcase;
  }
  if (key.includes("kisisel gelisim")) {
    return TrendingUp;
  }
  if (key.includes("yabanci dil") || key.includes("yabanci-dil")) {
    return Languages;
  }
  if (key.includes("sanat") || key.includes("kultur")) {
    return Palette;
  }
  if (key.includes("spor")) {
    return Dumbbell;
  }
  if (key.includes("kurs") || key.includes("sinav") || key.includes("hazirlik")) {
    return BookOpen;
  }
  if (key.includes("okul")) {
    return Landmark;
  }
  if (/\bdil\b/.test(key) || key.includes(" dil") || key.startsWith("dil ")) {
    return Languages;
  }

  if (key.includes("saglik") || key.includes("hastane") || key.includes("klinik")) {
    return Stethoscope;
  }
  if (key.includes("gastronomi") || key.includes("restoran") || key.includes("kafe") || key.includes("yemek")) {
    return Utensils;
  }
  if (key.includes("yasam") || key.includes("guzellik") || key.includes("spa")) {
    return Sparkles;
  }
  if (key.includes("alisveris") || key.includes("market")) {
    return ShoppingBag;
  }
  if (key.includes("otomotiv") || key.includes("arac")) {
    return Car;
  }
  if (key.includes("kurumsal") || key.includes("ofis")) {
    return Briefcase;
  }
  if (key.includes("egitim")) {
    return GraduationCap;
  }

  return Building2;
}
