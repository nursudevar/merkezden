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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
  "SÜRÜCÜ KURSU",
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

/** Bilinen kategori sayfalarına gider; bilinmeyen aktif kategoriler `/kategori/{slug}` kullanır. */
export function getCategoryHref(name: string, slug: string): string | null {
  const key = normalizeCategoryKey(`${name} ${slug}`);
  if (key.includes("surucu kursu")) return "/surucu-kursu";
  if (key.includes("okul")) return "/school";
  if (key.includes("kurs") || key.includes("sinav")) return "/courses";
  if (key.includes("spor")) return "/sports";
  if (key.includes("sanat")) return "/arts";
  if (key.includes("yabanci dil") || key.includes("dil")) return "/languages";
  if (key.includes("kisisel gelisim")) return "/personal-development";
  if (key.includes("mesleki egitim")) return "/vocational-training";
  if (key.includes("ozel egitim")) return "/special-education";

  const normalizedSlug = String(slug ?? "").trim();
  if (normalizedSlug) {
    return `/kategori/${normalizedSlug}`;
  }
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
  if (key.includes("surucu kursu")) {
    return Car;
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

export type ActiveInstitutionCategory = {
  id: number;
  name: string;
  slug: string;
};

export async function fetchActiveInstitutionCategories(): Promise<ActiveInstitutionCategory[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, slug, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data?.length) return [];

  return sortByHomeMainCategoryOrder(
    (data as Array<{ id: number; name: string | null; slug: string | null }>)
      .map((row) => ({
        id: row.id,
        name: String(row.name ?? "").trim(),
        slug: String(row.slug ?? "").trim(),
      }))
      .filter((row) => row.name.length > 0),
  );
}

export async function fetchInstitutionCategoryBySlug(
  slug: string,
): Promise<ActiveInstitutionCategory | null> {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error || !data) return null;

  const name = String((data as { name?: string | null }).name ?? "").trim();
  const resolvedSlug = String((data as { slug?: string | null }).slug ?? "").trim();
  const id = Number((data as { id?: number | null }).id);

  if (!name || !Number.isFinite(id)) return null;

  return {
    id,
    name,
    slug: resolvedSlug || normalizedSlug,
  };
}

/** "Hepsi" + kategori adları; DB boş/hatalıysa fallback listesi kullanılır. */
export function buildCategoryTabNames(
  categories: ActiveInstitutionCategory[],
  fallback: readonly string[],
): string[] {
  if (categories.length === 0) return [...fallback];
  return ["Hepsi", ...categories.map((category) => category.name)];
}
