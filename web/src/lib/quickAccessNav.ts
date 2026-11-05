import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  Briefcase,
  Car,
  CircleHelp,
  GraduationCap,
  HeartHandshake,
  Info,
  Languages,
  MapPin,
  Megaphone,
  Palette,
  PawPrint,
  Sparkles,
  Dumbbell,
  Users,
} from "lucide-react";

export type QuickAccessNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * Etiketler `HOME_MAIN_CATEGORY_ORDER` / `publicBreadcrumb` kategori adlarıyla
 * aynıdır (blog sekmelerindeki title-case biçim). Rotalar değişmez.
 */
export const QUICK_ACCESS_CATEGORIES: readonly QuickAccessNavItem[] = [
  { id: "okul", label: "Okul", href: "/okul", icon: GraduationCap },
  { id: "sinav", label: "Kurs & Sınava Hazırlık", href: "/kurs-ve-sinava-hazirlik", icon: BookOpen },
  { id: "dil", label: "Yabancı Dil", href: "/yabanci-dil", icon: Languages },
  { id: "sanat", label: "Sanat", href: "/sanat", icon: Palette },
  { id: "spor", label: "Spor", href: "/spor", icon: Dumbbell },
  { id: "kisisel", label: "Kişisel Gelişim", href: "/kisisel-gelisim", icon: Sparkles },
  { id: "mesleki", label: "Mesleki Eğitim", href: "/mesleki-egitim", icon: Briefcase },
  { id: "ozel", label: "Özel Eğitim", href: "/ozel-egitim", icon: HeartHandshake },
  { id: "surucu", label: "Sürücü Kursu", href: "/surucu-kursu", icon: Car },
  { id: "patili", label: "Patili Dostlar", href: "/patili-dostlar", icon: PawPrint },
] as const;

export const QUICK_ACCESS_PRIMARY: readonly QuickAccessNavItem[] = [
  { id: "egitmenler", label: "Eğitmenler", href: "/egitmenler", icon: Users },
  { id: "harita", label: "Haritada Ara", href: "/haritada-ara", icon: MapPin },
  { id: "duyurular", label: "Duyurular", href: "/duyurular", icon: Megaphone },
  { id: "rehber", label: "Eğitim Rehberi", href: "/blog-yazilari", icon: BookMarked },
] as const;

export const QUICK_ACCESS_FOOTER: readonly QuickAccessNavItem[] = [
  { id: "hakkimizda", label: "Hakkımızda", href: "/hakkimizda", icon: Info },
  { id: "sss", label: "Sıkça Sorulan Sorular", href: "/sikca-sorulan-sorular", icon: CircleHelp },
] as const;

export const QUICK_ACCESS_ALL: readonly QuickAccessNavItem[] = [
  ...QUICK_ACCESS_CATEGORIES,
  ...QUICK_ACCESS_PRIMARY,
  ...QUICK_ACCESS_FOOTER,
];

/** Panel / auth gibi genel gezinti göstermeyen rotalar. */
export function shouldShowAppSidebar(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] || "/";
  const hiddenPrefixes = [
    "/panel",
    "/egitmen-paneli",
    "/admin",
    "/giris",
    "/kayit-ol",
    "/sifremi-unuttum",
    "/sifre-guncelle",
    "/dashboard",
  ];
  return !hiddenPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isQuickAccessNavActive(pathname: string, href: string): boolean {
  if (!pathname || !href) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
