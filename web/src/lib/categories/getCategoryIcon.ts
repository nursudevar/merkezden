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
import { normalizeCategoryKey } from "./getCategoryHref";

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
