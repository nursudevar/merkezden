"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Accessibility,
  BadgeCheck,
  BarChart3,
  Book,
  BookOpen,
  Building2,
  Calendar,
  Car,
  Clock,
  Clock3,
  Coins,
  CreditCard,
  DoorOpen,
  Dumbbell,
  FilePlus2,
  Files,
  Gift,
  GitBranch,
  Globe,
  GraduationCap,
  House,
  IdCard,
  KeyRound,
  Landmark,
  Languages,
  LayoutGrid,
  Layers,
  List,
  ListChecks,
  ListFilter,
  MapPin,
  Palette,
  PartyPopper,
  PawPrint,
  Repeat,
  RotateCcw,
  School,
  Search,
  Sparkles,
  Target,
  Timer,
  Users,
  UsersRound,
  WalletCards,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectMountGate } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CATEGORY_ALL_ILCELER_VALUE,
  CATEGORY_ALL_MAHALLELER_VALUE,
  EMPTY_CATEGORY_LOCATION_FILTER,
  type CategoryLocationFilterValue,
} from "@/components/category/categoryLocationFilter";
import {
  fetchIller,
  fetchIlcelerByIlId,
  fetchMahallelerByIlceId,
  findLocationIdByAd,
  HOME_DEFAULT_CITY_AD,
  parseLocationId,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";
import {
  INSTITUTION_PRICE_RANGE_DEFINITION_ID,
  INSTITUTION_PRICE_FILTER_MAX,
  INSTITUTION_PRICE_FILTER_MIN,
  isInstitutionPriceRangeFieldName,
  orderPriceRangeChoicesFromCanonical,
  parseInstructorPriceRangeBound,
  rangesOverlap,
  sortPriceRangeChoicesByMin,
} from "@/lib/institutionPriceRangeFilter";
import {
  PriceRangeSliderFilter,
  type PriceRangeSliderValue,
} from "@/components/filters/PriceRangeSliderFilter";
import { AgeRangeSliderFilter } from "@/components/filters/AgeRangeSliderFilter";
import {
  isStudentAgeFilterTextActive,
  type StudentAgeFilterTextPayload,
} from "@/lib/institutionStudentAgeFilter";
import {
  STUDENT_AGE_RANGE_LABEL,
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeRangeNumberFeature,
} from "@/lib/studentAgeRangeFeature";
import type { SchoolCategoryFilterPayload } from "@/components/category/schoolCategoryFilterTypes";
import type { InstructorCategoryFilterPayload } from "@/components/category/instructorCategoryFilterTypes";
import {
  buildInstructorFilterFieldsForListingCategory,
  fetchInstructorFeatureCategoriesClient,
  fetchInstructorFeatureFilterSchemaDataClient,
  type InstructorFeatureCategoryRow,
  type InstructorFeatureChoiceRow,
  type InstructorFeatureDefinitionRow,
  type InstructorFeatureGroupRow,
  type InstructorFilterField,
} from "@/lib/instructorFeaturesClient";
import { InstitutionMapSearchSection } from "@/components/map/InstitutionMapSearchSection";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import {
  HIGH_SCHOOL_TYPE_OPTIONS,
  LISE_INSTITUTION_TYPE_ID,
  OKUL_CATEGORY_SLUG,
} from "@/lib/schoolInstitutionTypes";

export interface CategoryFilterConfig {
  categories?: Array<{ label: string; count: number; value: string }>;
  searchPlaceholder?: string;
}

interface CategoryFilterSidebarProps {
  config?: CategoryFilterConfig;
  onFilterChange?: (filters: FilterState) => void;
  /**
   * Verildiğinde sidebar, mock KATEGORİLER ve AYLIK ÜCRET bölümleri yerine
   * ilgili kategoriye ait gerçek feature_groups/feature_definitions/feature_choices
   * verilerini DB'den çeker ve render eder. Ayrıca "Okul Türü" ile
   * "Başlıca Özellikler" alanları (slug'tan bağımsız ortak grup) bu modda gösterilir.
   */
  categorySlug?: string;
  /** `institution`: kategori slug ile kurum feature tabloları; `instructor`: eğitmen feature tabloları. */
  filterSchemaSource?: "institution" | "instructor";
  /** CategoryPageLayout tarafından sağlanır; yalnızca sidebar yerleşimi için kullanılır. */
  mapMarkers?: InstitutionMapMarker[];
  mapLoading?: boolean;
}

export interface FilterState {
  search: string;
  city: string;
  district: string;
  category: string;
  priceRange: PriceRangeSliderValue;
}

const defaultCategories = [
  { label: "Anaokulu / Kreş", count: 12, value: "anaokulu" },
  { label: "İlkokul", count: 8, value: "ilkokul" },
  { label: "Ortaokul", count: 5, value: "ortaokul" },
  { label: "Lise", count: 9, value: "lise" },
];

type FeatureGroupRow = {
  id: number;
  name: string | null;
  display_order: number | null;
  is_active: boolean | null;
  category_slug: string | null;
};

type FeatureDefinitionRow = {
  id: number;
  group_id: number | null;
  name: string | null;
  slug?: string | null;
  input_type: string | null;
  display_order: number | null;
  is_active: boolean | null;
  unit?: string | null;
};

type FeatureChoiceRow = {
  id: number;
  feature_definition_id: number | null;
  name: string | null;
  display_order: number | null;
  is_active: boolean | null;
};

type InstitutionTypeRow = {
  id: number;
  name: string | null;
  category_id: number | null;
  display_order: number | null;
  is_active: boolean | null;
};

/** UI'da bir grup için flatten edilmiş seçenek satırı. */
type FeatureFilterOption = {
  /** Benzersiz seçim anahtarı: choice ya da boolean definition referansı. */
  key: string;
  label: string;
};

type FeatureFilterDefinitionSection = {
  definitionId: number;
  name: string;
  options: FeatureFilterOption[];
};

type FeatureFilterGroup = {
  id: number;
  name: string;
  options: FeatureFilterOption[];
  /** Sürücü Kursu public: Belge Türleri alt başlıkları. Aynı group id ile filtrelenir. */
  definitionSections?: FeatureFilterDefinitionSection[];
};

/** Başlıca Özellikler için bir input. */
type CommonField =
  | {
      kind: "single_select";
      definitionId: number;
      name: string;
      placeholder: string;
      choices: Array<{ id: number; name: string }>;
    }
  | {
      kind: "multi_select";
      definitionId: number;
      name: string;
      choices: Array<{ id: number; name: string }>;
    }
  | {
      kind: "number_range";
      definitionId: number;
      name: string;
      unit: string | null;
    }
  | {
      kind: "student_age_range";
      definitionId: number;
      name: string;
    };

const FEATURE_OPTIONS_VISIBLE_LIMIT = 10;

function checkboxListClassName(optionCount: number): string {
  return optionCount === 1
    ? "category-filter-section-checkboxes category-filter-section-checkboxes--single"
    : "category-filter-section-checkboxes";
}

function sortCheckboxOptionsByLabel<T>(options: T[], getLabel: (option: T) => string): T[] {
  return [...options].sort((a, b) =>
    getLabel(a).localeCompare(getLabel(b), "tr", { sensitivity: "base" }),
  );
}
const COMMON_GROUP_NAME_KEY = "başlıca özellikler";
const PATILI_DOSTLAR_CATEGORY_SLUG = "patili-dostlar";
const KURS_SINAVA_HAZIRLIK_CATEGORY_SLUG = "kurs-sinava-hazirlik";
const YABANCI_DIL_CATEGORY_SLUG = "yabanci-dil";
const SANAT_CATEGORY_SLUG = "sanat";
const SPOR_CATEGORY_SLUG = "spor";
const KISISEL_GELISIM_CATEGORY_SLUG = "kisisel-gelisim";
const MESLEKI_EGITIM_CATEGORY_SLUG = "mesleki-egitim";
const OZEL_EGITIM_CATEGORY_SLUG = "ozel-egitim";
const SURUCU_KURSU_CATEGORY_SLUG = "surucu-kursu";

/** Eğitmen public filtre — Patili Dostlar şema alan sırası (fiyat Hizmet Yeri sonrası inject). */
const PATILI_DOSTLAR_INSTRUCTOR_FILTER_ORDER = [
  "evcil hayvan turu",
  "hizmet turu",
  "hizmet tipi",
  "hizmet yeri",
  "fiziki imkanlar",
  "musait gunler",
  "calisma saatleri",
  "egitim dili",
  "ucret tipi",
  "odeme secenekleri",
] as const;

const PATILI_DOSTLAR_INSTRUCTOR_FILTER_ORDER_KEYS = new Set<string>(
  PATILI_DOSTLAR_INSTRUCTOR_FILTER_ORDER,
);

/** Global Başlıca öğrenci/ders + hedef dışı alanlar — Patili'de gizlenir. */
const PATILI_DOSTLAR_HIDDEN_FILTER_NAMES = new Set([
  "ogrenci yasi",
  "ders seviyesi",
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "egitmenin seviyesi",
  "ders verme sikligi",
  "ders suresi",
  "musait saat baslangic",
  "musait saat bitis",
  "musait saat baslangic bitis",
  "deneme dersi mevcuttur",
  "deneme dersi",
  "egitim ozellikleri",
]);

/** Eğitmen public filtre — yalnızca Kurs / Sınava Hazırlık şema alan sırası (yaş/fiyat ayrı section). */
const KURS_SINAVA_HAZIRLIK_INSTRUCTOR_FILTER_ORDER = [
  "kurs turleri",
  "hizmet tipi",
  "hizmet yeri",
  "ders seviyesi",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim seviyesi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const KURS_SINAVA_HAZIRLIK_HIDDEN_FILTER_NAMES = new Set(["kurs ozellikleri"]);

/** Eğitmen public filtre — yalnızca Yabancı Dil şema alan sırası (yaş/fiyat ayrı section). */
const YABANCI_DIL_INSTRUCTOR_FILTER_ORDER = [
  "yabanci dil turleri",
  "hizmet tipi",
  "hizmet yeri",
  "ders seviyesi",
  "ogrencinin egitim seviyesi",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim seviyesi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

/** Eğitmen public filtre — yalnızca Sanat şema alan sırası (yaş/fiyat ayrı section). */
const SANAT_INSTRUCTOR_FILTER_ORDER = [
  "sanat turleri",
  "hizmet tipi",
  "hizmet yeri",
  "ders seviyesi",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim seviyesi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const SANAT_HIDDEN_FILTER_NAMES = new Set(["ogrencinin egitim seviyesi"]);

/** Eğitmen public filtre — yalnızca Spor şema alan sırası (yaş/fiyat ayrı section). */
const SPOR_INSTRUCTOR_FILTER_ORDER = [
  "spor turleri",
  "hizmet tipi",
  "hizmet yeri",
  "ders seviyesi",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim seviyesi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const SPOR_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "tesis turu",
  "egitim ozellikleri",
]);

/** Eğitmen public filtre — yalnızca Kişisel Gelişim şema alan sırası (yaş/fiyat ayrı section). */
const KISISEL_GELISIM_INSTRUCTOR_FILTER_ORDER = [
  "egitim turleri",
  "hizmet tipi",
  "hizmet yeri",
  "ders seviyesi",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim seviyesi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const KISISEL_GELISIM_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "egitim ozellikleri",
]);

/** Eğitmen public filtre — yalnızca Mesleki Eğitim şema alan sırası (yaş/fiyat ayrı section). */
const MESLEKI_EGITIM_INSTRUCTOR_FILTER_ORDER = [
  "egitim turleri",
  "hizmet tipi",
  "hizmet yeri",
  "ders seviyesi",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim seviyesi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const MESLEKI_EGITIM_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "egitim ozellikleri",
]);

/** Eğitmen public filtre — yalnızca Özel Eğitim şema alan sırası (yaş/fiyat ayrı section). */
const OZEL_EGITIM_INSTRUCTOR_FILTER_ORDER = [
  "ozel egitim turleri",
  "hizmet tipi",
  "hizmet yeri",
  "ders seviyesi",
  "ogrencinin egitim seviyesi",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim seviyesi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const OZEL_EGITIM_HIDDEN_FILTER_NAMES = new Set(["egitim ozellikleri"]);

/** Eğitmen public filtre — yalnızca Sürücü Kursu şema alan sırası (fiyat Araç İmkanı sonrası inject). */
const SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER = [
  "hizmet turleri",
  "hizmet tipi",
  "arac tipleri",
  "arac imkani",
  "musait gunler",
  "calisma saatleri",
  "ders verme sikligi",
  "ders suresi",
  "egitim dili",
  "ucret tipi",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER_KEYS = new Set<string>(
  SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER,
);

const SURUCU_KURSU_HIDDEN_FILTER_NAMES = new Set([
  "ders seviyesi",
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "hizmet yeri",
  "egitim ozellikleri",
  "kurs ozellikleri",
  "surucu kursu ozellikleri",
]);

/** Kişisel Gelişim — "Eğitim Türleri" ve olası DB adı varyantlarını tek anahtara indirger. */
function normalizeKisiselGelisimFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (
    key === "egitim turleri" ||
    key === "kisisel gelisim egitim turleri" ||
    key === "kisisel gelisim turleri" ||
    key.endsWith(" egitim turleri")
  ) {
    return "egitim turleri";
  }
  return key;
}

/** Mesleki Eğitim — "Eğitim Türleri" / "Mesleki Eğitim Türleri" varyantlarını tek anahtara indirger. */
function normalizeMeslekiEgitimFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (
    key === "egitim turleri" ||
    key === "mesleki egitim turleri" ||
    key === "mesleki egitim egitim turleri" ||
    key.endsWith(" egitim turleri")
  ) {
    return "egitim turleri";
  }
  return key;
}

/** Özel Eğitim — "Özel Eğitim Türleri" ve olası DB adı varyantlarını tek anahtara indirger. */
function normalizeOzelEgitimFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (
    key === "ozel egitim turleri" ||
    key === "ozel egitim egitim turleri" ||
    (key.includes("ozel") && key.includes("egitim") && key.includes("tur") && !key.includes("seviye"))
  ) {
    return "ozel egitim turleri";
  }
  return key;
}

/** Sürücü Kursu — Hizmet Türleri / Araç Tipleri / Araç İmkanı / Ödeme varyantlarını tek anahtara indirger. */
function normalizeSurucuKursuFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (
    key === "hizmet turleri" ||
    key.endsWith(" hizmet turleri") ||
    (key.includes("hizmet") && key.includes("turleri"))
  ) {
    return "hizmet turleri";
  }
  if (
    key === "arac tipleri" ||
    key === "arac tipi" ||
    (key.includes("arac") && key.includes("tip"))
  ) {
    return "arac tipleri";
  }
  if (
    key === "arac imkani" ||
    key === "arac imkanlari" ||
    key === "surucu kursu imkanlari" ||
    ((key.includes("imkan") || key.includes("imkanlar")) &&
      (key.includes("arac") || key.includes("surucu")))
  ) {
    return "arac imkani";
  }
  if (
    key === "odeme secenekleri" ||
    key === "odeme yontemleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  return key;
}

function normalizeInstructorFilterOrderKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function orderKursSinavaHazirlikInstructorFields(
  fields: InstructorFilterField[],
): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    KURS_SINAVA_HAZIRLIK_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeInstructorFilterOrderKey(field.name);
    return !KURS_SINAVA_HAZIRLIK_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeInstructorFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function orderYabanciDilInstructorFields(
  fields: InstructorFilterField[],
): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    YABANCI_DIL_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => field.kind !== "student_age_range");

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeInstructorFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function orderSanatInstructorFields(fields: InstructorFilterField[]): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    SANAT_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeInstructorFilterOrderKey(field.name);
    return !SANAT_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeInstructorFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function orderSporInstructorFields(fields: InstructorFilterField[]): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    SPOR_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeInstructorFilterOrderKey(field.name);
    return !SPOR_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeInstructorFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function orderKisiselGelisimInstructorFields(
  fields: InstructorFilterField[],
): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    KISISEL_GELISIM_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeKisiselGelisimFilterOrderKey(field.name);
    return !KISISEL_GELISIM_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeKisiselGelisimFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeKisiselGelisimFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function orderMeslekiEgitimInstructorFields(
  fields: InstructorFilterField[],
): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    MESLEKI_EGITIM_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeMeslekiEgitimFilterOrderKey(field.name);
    return !MESLEKI_EGITIM_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeMeslekiEgitimFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeMeslekiEgitimFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function orderOzelEgitimInstructorFields(fields: InstructorFilterField[]): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    OZEL_EGITIM_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeOzelEgitimFilterOrderKey(field.name);
    return !OZEL_EGITIM_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeOzelEgitimFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeOzelEgitimFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function orderSurucuKursuInstructorFields(fields: InstructorFilterField[]): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeSurucuKursuFilterOrderKey(field.name);
    const rawKey = normalizeInstructorFilterOrderKey(field.name);
    if (SURUCU_KURSU_HIDDEN_FILTER_NAMES.has(key) || SURUCU_KURSU_HIDDEN_FILTER_NAMES.has(rawKey)) {
      return false;
    }
    // Hedef listede olmayan ekstra alanları (Araç Sayısı, Fiziki İmkanlar, …) gösterme.
    return SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER_KEYS.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeSurucuKursuFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeSurucuKursuFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

/** Patili — Evcil Hayvan / Hizmet Türü / Fiziki-Ödeme grup adı varyantlarını tek anahtara indirger. */
function normalizePatiliDostlarFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (
    key === "evcil hayvan turu" ||
    key === "evcil hayvan turleri" ||
    (key.includes("evcil") && key.includes("hayvan") && key.includes("tur"))
  ) {
    return "evcil hayvan turu";
  }
  if (
    key === "hizmet turu" ||
    key === "hizmet turleri" ||
    (key.includes("hizmet") && key.includes("tur") && !key.includes("tip") && !key.includes("yer"))
  ) {
    return "hizmet turu";
  }
  if (
    key === "fiziki imkanlar" ||
    key === "fiziksel imkanlar" ||
    (key.includes("fizik") && key.includes("imkan"))
  ) {
    return "fiziki imkanlar";
  }
  if (key === "odeme secenekleri" || (key.includes("odeme") && key.includes("secenek"))) {
    return "odeme secenekleri";
  }
  if (
    key === "deneme dersi mevcuttur" ||
    key === "deneme dersi" ||
    (key.includes("deneme") && key.includes("ders"))
  ) {
    return "deneme dersi mevcuttur";
  }
  return key;
}

function orderPatiliDostlarInstructorFields(
  fields: InstructorFilterField[],
): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    PATILI_DOSTLAR_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizePatiliDostlarFilterOrderKey(field.name);
    const rawKey = normalizeInstructorFilterOrderKey(field.name);
    if (PATILI_DOSTLAR_HIDDEN_FILTER_NAMES.has(key)) return false;
    if (PATILI_DOSTLAR_HIDDEN_FILTER_NAMES.has(rawKey)) return false;
    if (rawKey.includes("musait saat")) return false;
    // Hedef listede olmayan ekstra grup/alanları gösterme.
    return PATILI_DOSTLAR_INSTRUCTOR_FILTER_ORDER_KEYS.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizePatiliDostlarFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizePatiliDostlarFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function isBaslicaOzelliklerGroupName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLocaleLowerCase("tr-TR") === COMMON_GROUP_NAME_KEY;
}

function categoryUsesGlobalBaslicaCommonFields(categorySlug: string): boolean {
  return String(categorySlug ?? "").trim() !== PATILI_DOSTLAR_CATEGORY_SLUG;
}

function resolveOverlappingPriceChoiceIds(
  choices: Array<{ id: number; name: string }>,
  userRange: { min: number; max: number },
): string[] {
  const normalized = {
    min: Math.max(
      INSTITUTION_PRICE_FILTER_MIN,
      Math.min(userRange.min, userRange.max),
    ),
    max: Math.min(
      INSTITUTION_PRICE_FILTER_MAX,
      Math.max(userRange.min, userRange.max),
    ),
  };

  return choices
    .filter((choice) => {
      const choiceRange = parseInstructorPriceRangeBound(choice.name);
      return choiceRange != null && rangesOverlap(choiceRange, normalized);
    })
    .map((choice) => String(choice.id));
}

function buildPatiliBaslicaCommonField(
  def: FeatureDefinitionRow,
  choicesByDefinition: Map<number, FeatureChoiceRow[]>,
): CommonField | null {
  const displayName = getDisplayFeatureName(def.name ?? "");
  const inputType = String(def.input_type ?? "").trim().toLowerCase();
  const defChoices = (choicesByDefinition.get(def.id) ?? [])
    .map((c) => ({ id: c.id, name: String(c.name ?? "").trim() }))
    .filter((c) => Boolean(c.name));
  const orderedChoices = isInstitutionPriceRangeFieldName(displayName)
    ? orderPriceRangeChoicesFromCanonical(defChoices)
    : defChoices;

  if (inputType === "single_select") {
    if (orderedChoices.length === 0) return null;
    return {
      kind: "single_select",
      definitionId: def.id,
      name: displayName,
      placeholder: `${displayName} seçin`,
      choices: orderedChoices,
    };
  }

  if (inputType === "multi_select") {
    if (orderedChoices.length === 0) return null;
    return {
      kind: "multi_select",
      definitionId: def.id,
      name: displayName,
      choices: orderedChoices,
    };
  }

  return null;
}
const CLEAR_SUBCATEGORY_VALUE = "__clear_subcategory__";
const CLEAR_HIGH_SCHOOL_TYPE_VALUE = "__clear_high_school_type__";
const CLEAR_SINGLE_SELECT_VALUE = "__clear__";
const CLEAR_INSTRUCTOR_CATEGORY_VALUE = "__all_categories__";

function describeSupabaseError(err: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
} {
  if (err == null) return { message: "unknown" };
  if (typeof err === "string") return { message: err };
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    name?: string;
  };
  return {
    message: String(e.message ?? "unknown"),
    code: e.code,
    details: e.details,
    hint: e.hint,
    status: e.status,
    name: e.name,
  };
}

/** Detay sayfasındaki kuralla uyumlu: bazı feature isimlerini sidebar'da farklı göster. */
function getDisplayFeatureName(name: string): string {
  const trimmed = (name ?? "").trim();
  const key = normalizeCommonFieldNameKey(trimmed);
  if (key === "fiyat araligi" || key === "aylik ortalama fiyat araligi" || key === "aylik fiyat araligi") {
    return "Aylık Fiyat Aralığı";
  }
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "Kurum Türü";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") return "Eğitim Saatleri";
  if (key === "ortalama sinif mevcudu" || key === "sinif mevcudu") return "Sınıf Mevcudu";
  return trimmed;
}

const CATEGORY_FILTER_SECTION_ICON_MAP: Record<string, LucideIcon> = {
  // Mevcut iconlu başlıklar — değiştirilmez.
  arama: Search,
  konum: MapPin,
  "okul turu": Building2,
  "kurum turu": Building2,
  "hizmet tipi": Users,
  "egitim dili": Languages,
  "egitim saatleri": Clock3,
  "kurum saatleri": Clock3,
  "sinif mevcudu": UsersRound,
  "ortalama sinif mevcudu": UsersRound,
  "aylik fiyat araligi": WalletCards,
  "aylik ortalama fiyat araligi": WalletCards,
  // Bundan sonrası yalnızca daha önce iconsuz olan başlıklar.
  "fiyat araligi": WalletCards,
  "ortalama fiyat araligi": WalletCards,
  kategori: LayoutGrid,
  kategoriler: LayoutGrid,
  "lise turu": School,
  "odeme secenekleri": CreditCard,
  "odeme yontemleri": CreditCard,
  "kurs turleri": Book,
  "egitim turleri": BookOpen,
  "mesleki egitim turleri": BookOpen,
  "sanat turleri": Palette,
  "spor turleri": Dumbbell,
  "yabanci dil turleri": Globe,
  "dil turleri": Globe,
  "ozel egitim turleri": Accessibility,
  "egitim ozellikleri": Sparkles,
  "kurs ozellikleri": ListChecks,
  "fiziki imkanlar": Landmark,
  "fiziksel imkanlar": Landmark,
  "okul imkanlari": DoorOpen,
  "okul imkanlar": DoorOpen,
  aktivite: PartyPopper,
  aktiviteler: PartyPopper,
  "egitim sistemi": Layers,
  "tesis turu": Warehouse,
  "hedef/fayda": Target,
  "hedef fayda": Target,
  "belge turleri": Files,
  "ek belge ve egitimler": FilePlus2,
  "src belgesi turleri": BadgeCheck,
  "surucu belgesi siniflari": IdCard,
  "surucu kursu imkanlari": KeyRound,
  "arac tipleri": Car,
  "arac tipi": Car,
  "arac imkani": KeyRound,
  "arac imkanlari": KeyRound,
  "evcil hayvan turu": PawPrint,
  "evcil hayvan turleri": PawPrint,
  "hizmet turu": List,
  "hizmet turleri": List,
  "hizmet yeri": House,
  "musait gunler": Calendar,
  "calisma saatleri": Clock,
  "ders suresi": Timer,
  "ders verme sikligi": Repeat,
  "egitim seviyesi": GraduationCap,
  "ogrencinin egitim seviyesi": School,
  "ders seviyesi": BarChart3,
  "deneme dersi mevcuttur": Gift,
  "deneme dersi": Gift,
  "ucretsiz deneme dersi": Gift,
  "ucret tipi": Coins,
  brans: GitBranch,
  branslar: GitBranch,
};

function normalizeCategoryFilterSectionTitleKey(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCategoryFilterSectionIcon(title: string): LucideIcon {
  return CATEGORY_FILTER_SECTION_ICON_MAP[normalizeCategoryFilterSectionTitleKey(title)] ?? ListFilter;
}

function CategoryFilterSectionTitle({ title }: { title: string }) {
  const titleKey = normalizeCategoryFilterSectionTitleKey(title);

  if (titleKey === "ogrenci yasi") {
    return (
      <h3 className="category-filter-section-title">
        <Image
          src="/images/identification.svg"
          alt="Öğrenci Yaşı"
          width={20}
          height={20}
          className="category-filter-section-title-icon"
        />
        <span>{title}</span>
      </h3>
    );
  }

  const Icon = getCategoryFilterSectionIcon(title);

  return (
    <h3 className="category-filter-section-title">
      <Icon className="category-filter-section-title-icon" size={20} aria-hidden />
      <span>{title}</span>
    </h3>
  );
}

function CategoryFilterSubsectionTitle({ title }: { title: string }) {
  const Icon = getCategoryFilterSectionIcon(title);

  return (
    <h4 className="category-filter-subsection-title">
      <Icon className="category-filter-section-title-icon" size={20} aria-hidden />
      <span>{title}</span>
    </h4>
  );
}

function normalizeCommonFieldNameKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sınıf Mevcudu + Aylık Fiyat Aralığı → Eğitim Saatleri'nin hemen altına. */
function isPriceRangeCommonField(field: CommonField): boolean {
  if (field.kind !== "single_select" && field.kind !== "multi_select") return false;
  return (
    field.definitionId === INSTITUTION_PRICE_RANGE_DEFINITION_ID ||
    isInstitutionPriceRangeFieldName(field.name)
  );
}

function isStudentAgeCommonField(field: { kind: string }): boolean {
  return field.kind === "student_age_range";
}

function reorderCommonFieldsAfterOkulSaatleri(fields: CommonField[]): CommonField[] {
  if (fields.length === 0) return fields;

  const isKurumSaatleriField = (field: CommonField) => {
    const key = normalizeCommonFieldNameKey(field.name);
    return key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri";
  };

  const isOrtalamaSinifMevcuduField = (field: CommonField) => {
    const key = normalizeCommonFieldNameKey(field.name);
    return key.includes("sinif mevcudu");
  };

  const isAylikFiyatAraligiField = (field: CommonField) => {
    const key = normalizeCommonFieldNameKey(field.name);
    return (
      key.includes("aylik ortalama fiyat") ||
      key.includes("aylik fiyat araligi") ||
      key.includes("fiyat araligi") ||
      key.includes("ortalama fiyat araligi")
    );
  };

  const kurumSaatleriIndex = fields.findIndex(isKurumSaatleriField);
  if (kurumSaatleriIndex === -1) return fields;

  const ortalamaSinifField = fields.find(isOrtalamaSinifMevcuduField);
  const fiyatAraligiField = fields.find(isAylikFiyatAraligiField);
  const fieldsToMove = [ortalamaSinifField, fiyatAraligiField].filter(
    (field): field is CommonField => field != null,
  );
  if (fieldsToMove.length === 0) return fields;

  const moveIds = new Set(fieldsToMove.map((field) => field.definitionId));
  const withoutMoved = fields.filter((field) => !moveIds.has(field.definitionId));
  const anchorIndex = withoutMoved.findIndex(isKurumSaatleriField);
  if (anchorIndex === -1) return fields;

  return [
    ...withoutMoved.slice(0, anchorIndex + 1),
    ...fieldsToMove,
    ...withoutMoved.slice(anchorIndex + 1),
  ];
}

/** Ortak Başlıca “Yabancı Diller” — Dil Türleri / Yabancı Dil Türleri hariç. */
function isHiddenYabanciDillerInstitutionFilter(name: string): boolean {
  const key = normalizeCommonFieldNameKey(name);
  if (!key || key.includes("tur")) return false;
  return key === "yabanci diller";
}

const OKUL_INSTITUTION_FILTER_ORDER = [
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "egitim sistemi",
  "okul imkanlari",
  "fiziki imkanlar",
  "aktivite",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const OKUL_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  OKUL_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeOkulInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (key === "aktiviteler" || key === "aktivite") return "aktivite";
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key.includes("okul imkan")) return "okul imkanlari";
  return key;
}

function getOkulInstitutionFilterSectionTitle(name: string): string {
  if (normalizeOkulInstitutionFilterOrderKey(name) === "aktivite") return "AKTİVİTE";
  return name.toLocaleUpperCase("tr-TR");
}

type OkulDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number };

function orderOkulInstitutionFilterSections(
  sections: OkulDynamicFilterSection[],
): OkulDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aName = a.kind === "common" ? a.field.name : a.group.name;
    const bName = b.kind === "common" ? b.field.name : b.group.name;
    const aRank =
      OKUL_INSTITUTION_FILTER_ORDER_INDEX.get(normalizeOkulInstitutionFilterOrderKey(aName)) ??
      Number.MAX_SAFE_INTEGER;
    const bRank =
      OKUL_INSTITUTION_FILTER_ORDER_INDEX.get(normalizeOkulInstitutionFilterOrderKey(bName)) ??
      Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER = [
  "kurs turleri",
  "ogrenci yasi",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "kurs ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeKursSinavaHazirlikInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  return key;
}

function getKursSinavaHazirlikInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeKursSinavaHazirlikInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  return name.toLocaleUpperCase("tr-TR");
}

type KursSinavaHazirlikDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number };

function getKursSinavaHazirlikSectionOrderName(section: KursSinavaHazirlikDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return STUDENT_AGE_RANGE_LABEL;
}

function orderKursSinavaHazirlikInstitutionFilterSections(
  sections: KursSinavaHazirlikDynamicFilterSection[],
): KursSinavaHazirlikDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeKursSinavaHazirlikInstitutionFilterOrderKey(getKursSinavaHazirlikSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeKursSinavaHazirlikInstitutionFilterOrderKey(getKursSinavaHazirlikSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const SPOR_INSTITUTION_FILTER_ORDER = [
  "spor turleri",
  "ogrenci yasi",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "tesis turu",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "hedef/fayda",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const SPOR_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  SPOR_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeSporInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  return key;
}

function getSporInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeSporInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "hedef/fayda") return "HEDEF/FAYDA";
  return name.toLocaleUpperCase("tr-TR");
}

type SporDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number };

function getSporSectionOrderName(section: SporDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return STUDENT_AGE_RANGE_LABEL;
}

function orderSporInstitutionFilterSections(
  sections: SporDynamicFilterSection[],
): SporDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      SPOR_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeSporInstitutionFilterOrderKey(getSporSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      SPOR_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeSporInstitutionFilterOrderKey(getSporSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const SANAT_INSTITUTION_FILTER_ORDER = [
  "sanat turleri",
  "ogrenci yasi",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const SANAT_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  SANAT_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeSanatInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  return key;
}

function getSanatInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeSanatInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  return name.toLocaleUpperCase("tr-TR");
}

type SanatDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number };

function getSanatSectionOrderName(section: SanatDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return STUDENT_AGE_RANGE_LABEL;
}

function orderSanatInstitutionFilterSections(
  sections: SanatDynamicFilterSection[],
): SanatDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      SANAT_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeSanatInstitutionFilterOrderKey(getSanatSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      SANAT_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeSanatInstitutionFilterOrderKey(getSanatSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const YABANCI_DIL_INSTITUTION_FILTER_ORDER = [
  "yabanci dil turleri",
  "ogrenci yasi",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const YABANCI_DIL_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  YABANCI_DIL_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeYabanciDilInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "kurs ozellikleri") return "egitim ozellikleri";
  return key;
}

function getYabanciDilInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeYabanciDilInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type YabanciDilDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number };

function getYabanciDilSectionOrderName(section: YabanciDilDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return STUDENT_AGE_RANGE_LABEL;
}

function orderYabanciDilInstitutionFilterSections(
  sections: YabanciDilDynamicFilterSection[],
): YabanciDilDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      YABANCI_DIL_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeYabanciDilInstitutionFilterOrderKey(getYabanciDilSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      YABANCI_DIL_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeYabanciDilInstitutionFilterOrderKey(getYabanciDilSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const KISISEL_GELISIM_INSTITUTION_FILTER_ORDER = [
  "egitim turleri",
  "ogrenci yasi",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const KISISEL_GELISIM_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  KISISEL_GELISIM_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeKisiselGelisimInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "kurs ozellikleri") return "egitim ozellikleri";
  return key;
}

function getKisiselGelisimInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeKisiselGelisimInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type KisiselGelisimDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number };

function getKisiselGelisimSectionOrderName(section: KisiselGelisimDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return STUDENT_AGE_RANGE_LABEL;
}

function orderKisiselGelisimInstitutionFilterSections(
  sections: KisiselGelisimDynamicFilterSection[],
): KisiselGelisimDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      KISISEL_GELISIM_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeKisiselGelisimInstitutionFilterOrderKey(getKisiselGelisimSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      KISISEL_GELISIM_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeKisiselGelisimInstitutionFilterOrderKey(getKisiselGelisimSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const MESLEKI_EGITIM_INSTITUTION_FILTER_ORDER = [
  "egitim turleri",
  "ogrenci yasi",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const MESLEKI_EGITIM_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  MESLEKI_EGITIM_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeMeslekiEgitimInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "kurs ozellikleri") return "egitim ozellikleri";
  if (key === "mesleki egitim turleri" || key === "egitim turleri") return "egitim turleri";
  return key;
}

function getMeslekiEgitimInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeMeslekiEgitimInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  if (key === "egitim turleri") return "EĞİTİM TÜRLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type MeslekiEgitimDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number };

function getMeslekiEgitimSectionOrderName(section: MeslekiEgitimDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return STUDENT_AGE_RANGE_LABEL;
}

function orderMeslekiEgitimInstitutionFilterSections(
  sections: MeslekiEgitimDynamicFilterSection[],
): MeslekiEgitimDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      MESLEKI_EGITIM_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeMeslekiEgitimInstitutionFilterOrderKey(getMeslekiEgitimSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      MESLEKI_EGITIM_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeMeslekiEgitimInstitutionFilterOrderKey(getMeslekiEgitimSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const OZEL_EGITIM_INSTITUTION_FILTER_ORDER = [
  "ozel egitim turleri",
  "ogrenci yasi",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const OZEL_EGITIM_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  OZEL_EGITIM_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeOzelEgitimInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "kurs ozellikleri") return "egitim ozellikleri";
  if (key === "ozel egitim turleri") return "ozel egitim turleri";
  return key;
}

function getOzelEgitimInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeOzelEgitimInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  if (key === "ozel egitim turleri") return "ÖZEL EĞİTİM TÜRLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type OzelEgitimDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number };

function getOzelEgitimSectionOrderName(section: OzelEgitimDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  return STUDENT_AGE_RANGE_LABEL;
}

function orderOzelEgitimInstitutionFilterSections(
  sections: OzelEgitimDynamicFilterSection[],
): OzelEgitimDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      OZEL_EGITIM_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeOzelEgitimInstitutionFilterOrderKey(getOzelEgitimSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      OZEL_EGITIM_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeOzelEgitimInstitutionFilterOrderKey(getOzelEgitimSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const SURUCU_KURSU_BELGE_TURU_ORDER = [
  "ek belge ve egitimler",
  "src belgesi turleri",
  "surucu belgesi siniflari",
] as const;

const SURUCU_KURSU_BELGE_TURU_ORDER_INDEX = new Map<string, number>(
  SURUCU_KURSU_BELGE_TURU_ORDER.map((key, index) => [key, index]),
);

function isSurucuKursuBelgeTuruDefinitionName(name: string): boolean {
  const key = normalizeCommonFieldNameKey(name);
  return SURUCU_KURSU_BELGE_TURU_ORDER_INDEX.has(key);
}

const SURUCU_KURSU_INSTITUTION_FILTER_ORDER = [
  "belge turleri",
  "kurum turu",
  "hizmet tipi",
  "aylik fiyat araligi",
  "surucu kursu imkanlari",
  "fiziki imkanlar",
  "kurs ozellikleri",
  "egitim dili",
  "egitim saatleri",
  "sinif mevcudu",
  "odeme yontemleri",
] as const;

const SURUCU_KURSU_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  SURUCU_KURSU_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeSurucuKursuInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "okul durumu" || key === "okul turu" || key === "kurum turu") return "kurum turu";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme yontemleri";
  }
  if (key.includes("sinif mevcudu")) return "sinif mevcudu";
  if (key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "kurs ozellikleri") return "kurs ozellikleri";
  return key;
}

function getSurucuKursuInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeSurucuKursuInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "kurs ozellikleri") return "KURS ÖZELLİKLERİ";
  if (key === "odeme yontemleri") return "ÖDEME YÖNTEMLERİ";
  if (key === "belge turleri") return "BELGE TÜRLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type SurucuKursuDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "belge_turleri"; group: FeatureFilterGroup; originalIndex: number };

function getSurucuKursuSectionOrderName(section: SurucuKursuDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "belge_turleri") return "Belge Türleri";
  return section.group.name;
}

function orderSurucuKursuInstitutionFilterSections(
  sections: SurucuKursuDynamicFilterSection[],
): SurucuKursuDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      SURUCU_KURSU_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeSurucuKursuInstitutionFilterOrderKey(getSurucuKursuSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      SURUCU_KURSU_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeSurucuKursuInstitutionFilterOrderKey(getSurucuKursuSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const PATILI_DOSTLAR_INSTITUTION_FILTER_ORDER = [
  "evcil hayvan turu",
  "hizmet turu",
  "hizmet tipi",
  "hizmet yeri",
  "aylik fiyat araligi",
  "fiziki imkanlar",
  "egitim saatleri",
  "egitim dili",
  "odeme secenekleri",
] as const;

const PATILI_DOSTLAR_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  PATILI_DOSTLAR_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizePatiliDostlarInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (
    key === "evcil hayvan turu" ||
    key === "evcil hayvan turleri" ||
    (key.includes("evcil") && key.includes("hayvan") && key.includes("tur"))
  ) {
    return "evcil hayvan turu";
  }
  if (key === "hizmet tipi" || key === "hizmet tipleri") {
    return "hizmet tipi";
  }
  if (
    key === "hizmet turu" ||
    key === "hizmet turleri" ||
    (key.includes("hizmet") && key.includes("tur") && !key.includes("tip") && !key.includes("yer"))
  ) {
    return "hizmet turu";
  }
  if (key === "hizmet yeri") return "hizmet yeri";
  if (
    key.includes("aylik fiyat araligi") ||
    key.includes("aylik ortalama fiyat") ||
    key === "fiyat araligi" ||
    key.includes("ortalama fiyat araligi")
  ) {
    return "aylik fiyat araligi";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "egitim dili") return "egitim dili";
  if (key === "calisma saatleri" || key === "okul saatleri" || key === "kurum saatleri" || key === "egitim saatleri") {
    return "egitim saatleri";
  }
  if (
    key === "odeme yontemleri" ||
    key === "odeme secenekleri" ||
    (key.includes("odeme") && (key.includes("secenek") || key.includes("yontem")))
  ) {
    return "odeme secenekleri";
  }
  return key;
}

function isHiddenPatiliDostlarPublicInstitutionFilter(name: string): boolean {
  const key = normalizeCommonFieldNameKey(name);
  if (key === "verilen hizmetler" || (key.includes("verilen") && key.includes("hizmet"))) return true;
  if (key === "ogrenci yasi") return true;
  return isHiddenYabanciDillerInstitutionFilter(name);
}

function getPatiliDostlarInstitutionFilterSectionTitle(name: string): string {
  const key = normalizePatiliDostlarInstitutionFilterOrderKey(name);
  if (key === "evcil hayvan turu") return "EVCİL HAYVAN TÜRÜ";
  if (key === "hizmet tipi") return "HİZMET TİPİ";
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "egitim dili") return "EĞİTİM DİLİ";
  if (key === "odeme secenekleri") return "ÖDEME SEÇENEKLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type PatiliDostlarDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number };

function getPatiliDostlarSectionOrderName(section: PatiliDostlarDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  return section.group.name;
}

function orderPatiliDostlarInstitutionFilterSections(
  sections: PatiliDostlarDynamicFilterSection[],
): PatiliDostlarDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      PATILI_DOSTLAR_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizePatiliDostlarInstitutionFilterOrderKey(getPatiliDostlarSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      PATILI_DOSTLAR_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizePatiliDostlarInstitutionFilterOrderKey(getPatiliDostlarSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

function collectFeatureFilterOptionsForDefinition(
  def: FeatureDefinitionRow,
  choicesByDefinition: Map<number, FeatureChoiceRow[]>,
  seenLabels: Set<string>,
  uniquePerDefinition: boolean,
): FeatureFilterOption[] {
  const options: FeatureFilterOption[] = [];
  const inputType = String(def.input_type ?? "").trim().toLowerCase();
  const defName = String(def.name ?? "").trim();
  const seenInDefinition = new Set<string>();

  const takeLabel = (label: string): boolean => {
    const labelKey = label.toLocaleLowerCase("tr-TR");
    if (uniquePerDefinition) {
      if (seenInDefinition.has(labelKey)) return false;
      seenInDefinition.add(labelKey);
      return true;
    }
    if (seenLabels.has(labelKey)) return false;
    seenLabels.add(labelKey);
    return true;
  };

  if (inputType === "boolean") {
    if (!defName) return options;
    if (!takeLabel(defName)) return options;
    options.push({ key: `def:${def.id}`, label: defName });
    return options;
  }

  if (inputType === "single_select" || inputType === "multi_select") {
    const choices = choicesByDefinition.get(def.id) ?? [];
    choices.forEach((choice) => {
      const label = String(choice.name ?? "").trim();
      if (!label) return;
      if (!takeLabel(label)) return;
      options.push({ key: `choice:${choice.id}:def:${def.id}`, label });
    });
  }

  return options;
}

type UseCategoryFilterSidebarModelArgs = {
  /** false: Okul sayfasında paylaşımlı Provider modeli kullanılırken boş model (çift fetch yok). */
  enabled?: boolean;
  config?: CategoryFilterConfig;
  onFilterChange?: (filters: FilterState) => void;
  categorySlug?: string;
  linkedSearch?: string;
  onLinkedSearchChange?: (value: string) => void;
  linkedDistrict?: string;
  onLinkedDistrictChange?: (value: string) => void;
  linkedLocation?: CategoryLocationFilterValue;
  onLinkedLocationChange?: (value: CategoryLocationFilterValue) => void;
  onSchoolFilterPayloadChange?: (payload: SchoolCategoryFilterPayload) => void;
  onInstructorFilterPayloadChange?: (payload: InstructorCategoryFilterPayload) => void;
  filterSchemaSource?: "institution" | "instructor";
};

function useCategoryFilterSidebarModel({
  enabled = true,
  config,
  onFilterChange,
  categorySlug,
  linkedSearch,
  onLinkedSearchChange,
  linkedDistrict,
  onLinkedDistrictChange,
  linkedLocation,
  onLinkedLocationChange,
  onSchoolFilterPayloadChange,
  onInstructorFilterPayloadChange,
  filterSchemaSource = "institution",
}: UseCategoryFilterSidebarModelArgs) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [iller, setIller] = useState<TurkiyeLocationOption[]>([]);
  const [ilceler, setIlceler] = useState<TurkiyeLocationOption[]>([]);
  const [mahalleler, setMahalleler] = useState<TurkiyeLocationOption[]>([]);
  const [defaultIlId, setDefaultIlId] = useState("");
  const [localIlId, setLocalIlId] = useState("");
  const [localIlceId, setLocalIlceId] = useState("");
  const [localMahalleId, setLocalMahalleId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState<PriceRangeSliderValue>(null);

  // DB'den çekilen kategoriye özgü feature group + option verisi
  const [featureGroups, setFeatureGroups] = useState<FeatureFilterGroup[]>([]);
  const [featureGroupsLoading, setFeatureGroupsLoading] = useState(false);
  const [featureGroupsError, setFeatureGroupsError] = useState<string | null>(null);

  const [selectedFeatureOptionsByGroup, setSelectedFeatureOptionsByGroup] = useState<
    Record<number, Set<string>>
  >({});

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(new Set());

  const [subcategoryTypes, setSubcategoryTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [selectedHighSchoolType, setSelectedHighSchoolType] = useState<string>("");

  const [commonFields, setCommonFields] = useState<CommonField[]>([]);
  /** Patili Dostlar: category_slug=patili-dostlar Başlıca Özellikler tanımları (definition bazlı). */
  const [patiliBaslicaFields, setPatiliBaslicaFields] = useState<CommonField[]>([]);
  /** Patili fiyat slider UI state (choice eşlemesi selectedCommonMulti üzerinden gider). */
  const [patiliPriceSliderRange, setPatiliPriceSliderRange] = useState<
    Record<number, PriceRangeSliderValue>
  >({});
  const [selectedCommonSingle, setSelectedCommonSingle] = useState<Record<number, string>>({});
  const [selectedCommonMulti, setSelectedCommonMulti] = useState<Record<number, Set<string>>>({});
  const [selectedCommonRange, setSelectedCommonRange] = useState<
    Record<number, { min: string; max: string }>
  >({});
  const [expandedCommonMultiIds, setExpandedCommonMultiIds] = useState<Set<number>>(new Set());
  const [selectedStudentAgeRange, setSelectedStudentAgeRange] =
    useState<StudentAgeFilterTextPayload | null>(null);

  const [instructorFieldsLoading, setInstructorFieldsLoading] = useState(false);
  const [instructorFieldsError, setInstructorFieldsError] = useState<string | null>(null);
  const [instructorSchemaData, setInstructorSchemaData] = useState<{
    groups: InstructorFeatureGroupRow[];
    definitions: InstructorFeatureDefinitionRow[];
    choices: InstructorFeatureChoiceRow[];
  } | null>(null);
  const [instructorCategories, setInstructorCategories] = useState<InstructorFeatureCategoryRow[]>([]);
  const [instructorCategoriesLoading, setInstructorCategoriesLoading] = useState(false);
  const [instructorCategoriesError, setInstructorCategoriesError] = useState<string | null>(null);
  const [selectedInstructorBoolean, setSelectedInstructorBoolean] = useState<Record<number, boolean>>({});
  const [expandedInstructorMultiIds, setExpandedInstructorMultiIds] = useState<Set<number>>(new Set());
  const [expandedInstructorBooleanGroupIds, setExpandedInstructorBooleanGroupIds] = useState<Set<number>>(
    new Set(),
  );

  const categories = config?.categories || defaultCategories;
  const searchPlaceholder = config?.searchPlaceholder ?? "Kurum adı ara...";
  const hasInstructorFeatureMode = filterSchemaSource === "instructor";
  const effectiveSlug = enabled && !hasInstructorFeatureMode ? String(categorySlug ?? "").trim() : "";
  const showSchoolSubcategoryFilters = effectiveSlug === OKUL_CATEGORY_SLUG;
  const showKursSinavaHazirlikInstitutionFilters =
    effectiveSlug === KURS_SINAVA_HAZIRLIK_CATEGORY_SLUG;
  const showSporInstitutionFilters = effectiveSlug === SPOR_CATEGORY_SLUG;
  const showSanatInstitutionFilters = effectiveSlug === SANAT_CATEGORY_SLUG;
  const showYabanciDilInstitutionFilters = effectiveSlug === YABANCI_DIL_CATEGORY_SLUG;
  const showKisiselGelisimInstitutionFilters = effectiveSlug === KISISEL_GELISIM_CATEGORY_SLUG;
  const showMeslekiEgitimInstitutionFilters = effectiveSlug === MESLEKI_EGITIM_CATEGORY_SLUG;
  const showOzelEgitimInstitutionFilters = effectiveSlug === OZEL_EGITIM_CATEGORY_SLUG;
  const showSurucuKursuInstitutionFilters = effectiveSlug === SURUCU_KURSU_CATEGORY_SLUG;
  const showPatiliDostlarInstitutionFilters = effectiveSlug === PATILI_DOSTLAR_CATEGORY_SLUG;
  const hasDynamicFeatureMode = effectiveSlug.length > 0;
  const isPatiliDostlarCategory = effectiveSlug === PATILI_DOSTLAR_CATEGORY_SLUG;
  const usesGlobalBaslicaCommonFields = categoryUsesGlobalBaslicaCommonFields(effectiveSlug);
  const isLinkedSearch = typeof onLinkedSearchChange === "function";
  const isLinkedDistrict = typeof onLinkedDistrictChange === "function";
  const isLinkedLocation = typeof onLinkedLocationChange === "function";
  const displaySearch = isLinkedSearch ? (linkedSearch ?? "") : search;
  const displayDistrict = isLinkedDistrict ? (linkedDistrict ?? "") : district;
  const usesInstitutionLocationFilters = enabled;
  const displayIlId = usesInstitutionLocationFilters
    ? (isLinkedLocation ? linkedLocation?.ilId || defaultIlId : localIlId || defaultIlId)
    : "";
  const displayIlceId = usesInstitutionLocationFilters
    ? (isLinkedLocation ? (linkedLocation?.ilceId ?? "") : localIlceId)
    : "";
  const displayMahalleId = usesInstitutionLocationFilters
    ? (isLinkedLocation ? (linkedLocation?.mahalleId ?? "") : localMahalleId)
    : "";

  const emitLocation = useCallback(
    (next: CategoryLocationFilterValue) => {
      if (isLinkedLocation) {
        onLinkedLocationChange?.(next);
        return;
      }
      setLocalIlId(next.ilId);
      setLocalIlceId(next.ilceId);
      setLocalMahalleId(next.mahalleId);
    },
    [isLinkedLocation, onLinkedLocationChange],
  );

  useEffect(() => {
    if (!usesInstitutionLocationFilters) {
      setIller([]);
      setDefaultIlId("");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchIller();
        if (cancelled) return;
        setIller(rows);
        const ankaraId = findLocationIdByAd(rows, HOME_DEFAULT_CITY_AD);
        if (ankaraId) setDefaultIlId(ankaraId);
      } catch (error) {
        console.error("İller yüklenemedi:", error);
        if (!cancelled) setIller([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [usesInstitutionLocationFilters]);

  useEffect(() => {
    if (!usesInstitutionLocationFilters) {
      setIlceler([]);
      return;
    }
    const selectedIlId = parseLocationId(displayIlId);
    if (selectedIlId == null) {
      setIlceler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchIlcelerByIlId(selectedIlId);
        if (!cancelled) setIlceler(rows);
      } catch (error) {
        console.error("İlçeler yüklenemedi:", error);
        if (!cancelled) setIlceler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayIlId, usesInstitutionLocationFilters]);

  useEffect(() => {
    if (!usesInstitutionLocationFilters) {
      setMahalleler([]);
      return;
    }
    const selectedIlceId = parseLocationId(displayIlceId);
    if (selectedIlceId == null) {
      setMahalleler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchMahallelerByIlceId(selectedIlceId);
        if (!cancelled) setMahalleler(rows);
      } catch (error) {
        console.error("Mahalleler yüklenemedi:", error);
        if (!cancelled) setMahalleler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayIlceId, usesInstitutionLocationFilters]);

  const handleIlChange = useCallback(
    (value: string) => {
      emitLocation({ ilId: value, ilceId: "", mahalleId: "" });
    },
    [emitLocation],
  );

  const handleIlceChange = useCallback(
    (value: string) => {
      const nextIlceId = value === CATEGORY_ALL_ILCELER_VALUE ? "" : value;
      emitLocation({ ilId: displayIlId, ilceId: nextIlceId, mahalleId: "" });
    },
    [displayIlId, emitLocation],
  );

  const handleMahalleChange = useCallback(
    (value: string) => {
      const nextMahalleId = value === CATEGORY_ALL_MAHALLELER_VALUE ? "" : value;
      emitLocation({ ilId: displayIlId, ilceId: displayIlceId, mahalleId: nextMahalleId });
    },
    [displayIlId, displayIlceId, emitLocation],
  );

  const resetCategoryFeatureFilters = useCallback(() => {
    setSelectedSubcategoryId("");
    setSelectedHighSchoolType("");
    setSelectedCommonSingle({});
    setSelectedCommonMulti({});
    setSelectedCommonRange({});
    setPatiliPriceSliderRange({});
    setSelectedStudentAgeRange(null);
    setSelectedFeatureOptionsByGroup({});
    setExpandedGroupIds(new Set());
    setExpandedCommonMultiIds(new Set());
  }, []);

  const [trackedFeatureFilterSlug, setTrackedFeatureFilterSlug] = useState(effectiveSlug);
  if (trackedFeatureFilterSlug !== effectiveSlug) {
    setTrackedFeatureFilterSlug(effectiveSlug);
    resetCategoryFeatureFilters();
  }

  // Kategoriye özel feature gruplarını + tanımlarını + seçeneklerini yükle.
  useEffect(() => {
    if (!hasDynamicFeatureMode) {
      setFeatureGroups([]);
      setPatiliBaslicaFields([]);
      setPatiliPriceSliderRange({});
      setFeatureGroupsError(null);
      setFeatureGroupsLoading(false);
      return;
    }

    let cancelled = false;
    setFeatureGroupsLoading(true);
    setFeatureGroupsError(null);
    setPatiliBaslicaFields([]);
    setPatiliPriceSliderRange({});

    (async () => {
      const supabase = createSupabaseBrowserClient();

      const { data: groupsData, error: groupsError } = await supabase
        .from("institution_feature_groups")
        .select("id, name, display_order, is_active, category_slug")
        .eq("is_active", true)
        .eq("category_slug", effectiveSlug)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;

      if (groupsError) {
        console.error(
          "[category-filter][feature-groups][error]",
          describeSupabaseError(groupsError),
        );
        setFeatureGroupsError("Filtreler yüklenemedi.");
        setFeatureGroups([]);
        setPatiliBaslicaFields([]);
        setFeatureGroupsLoading(false);
        return;
      }

      const groupRows = ((groupsData ?? []) as FeatureGroupRow[]).filter((g) =>
        Boolean((g.name ?? "").trim()),
      );

      if (groupRows.length === 0) {
        setFeatureGroups([]);
        setPatiliBaslicaFields([]);
        setFeatureGroupsLoading(false);
        return;
      }

      const groupIds = groupRows.map((g) => g.id);
      const { data: definitionsData, error: definitionsError } = await supabase
        .from("institution_feature_definitions")
        .select("id, group_id, name, input_type, display_order, is_active")
        .eq("is_active", true)
        .in("group_id", groupIds)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;

      if (definitionsError) {
        console.error(
          "[category-filter][feature-definitions][error]",
          describeSupabaseError(definitionsError),
        );
        setFeatureGroupsError("Filtreler yüklenemedi.");
        setFeatureGroups([]);
        setPatiliBaslicaFields([]);
        setFeatureGroupsLoading(false);
        return;
      }

      const definitionRows = (definitionsData ?? []) as FeatureDefinitionRow[];
      const definitionIds = definitionRows.map((d) => d.id);

      let choiceRows: FeatureChoiceRow[] = [];
      if (definitionIds.length > 0) {
        const { data: choicesData, error: choicesError } = await supabase
          .from("institution_feature_choices")
          .select("id, feature_definition_id, name, display_order, is_active")
          .eq("is_active", true)
          .in("feature_definition_id", definitionIds)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true });

        if (cancelled) return;

        if (choicesError) {
          console.error(
            "[category-filter][feature-choices][error]",
            describeSupabaseError(choicesError),
          );
          setFeatureGroupsError("Filtreler yüklenemedi.");
          setFeatureGroups([]);
          setPatiliBaslicaFields([]);
          setFeatureGroupsLoading(false);
          return;
        }

        choiceRows = (choicesData ?? []) as FeatureChoiceRow[];
      }

      // Definitions group_id bazlı sınıflandır.
      const definitionsByGroup = new Map<number, FeatureDefinitionRow[]>();
      definitionRows.forEach((def) => {
        if (def.group_id == null) return;
        const arr = definitionsByGroup.get(def.group_id) ?? [];
        arr.push(def);
        definitionsByGroup.set(def.group_id, arr);
      });

      // Choices definition bazlı sınıflandır.
      const choicesByDefinition = new Map<number, FeatureChoiceRow[]>();
      choiceRows.forEach((choice) => {
        if (choice.feature_definition_id == null) return;
        const arr = choicesByDefinition.get(choice.feature_definition_id) ?? [];
        arr.push(choice);
        choicesByDefinition.set(choice.feature_definition_id, arr);
      });

      const builtGroups: FeatureFilterGroup[] = [];
      const patiliBaslicaFieldsList: CommonField[] = [];

      for (const group of groupRows) {
        const defs = definitionsByGroup.get(group.id) ?? [];
        const groupName = String(group.name ?? "").trim();

        if (isPatiliDostlarCategory && isBaslicaOzelliklerGroupName(group.name)) {
          defs.forEach((def) => {
            const field = buildPatiliBaslicaCommonField(def, choicesByDefinition);
            if (field) patiliBaslicaFieldsList.push(field);
          });
          continue;
        }

        if (isHiddenYabanciDillerInstitutionFilter(groupName)) {
          continue;
        }

        const options: FeatureFilterOption[] = [];
        const seenLabels = new Set<string>();
        const uniquePerDefinition = isPatiliDostlarCategory;
        const splitSurucuBelgeTurleri =
          effectiveSlug === SURUCU_KURSU_CATEGORY_SLUG &&
          normalizeCommonFieldNameKey(groupName) === "surucu kursu imkanlari";

        if (splitSurucuBelgeTurleri) {
          const belgeSections: FeatureFilterDefinitionSection[] = [];
          const restOptions: FeatureFilterOption[] = [];

          defs.forEach((def) => {
            const defName = String(def.name ?? "").trim();
            if (isSurucuKursuBelgeTuruDefinitionName(defName)) {
              const defOptions = collectFeatureFilterOptionsForDefinition(
                def,
                choicesByDefinition,
                new Set(),
                true,
              );
              if (defOptions.length === 0) return;
              belgeSections.push({
                definitionId: def.id,
                name: defName,
                options: defOptions,
              });
              return;
            }
            restOptions.push(
              ...collectFeatureFilterOptionsForDefinition(
                def,
                choicesByDefinition,
                seenLabels,
                false,
              ),
            );
          });

          belgeSections.sort((a, b) => {
            const aRank =
              SURUCU_KURSU_BELGE_TURU_ORDER_INDEX.get(normalizeCommonFieldNameKey(a.name)) ??
              Number.MAX_SAFE_INTEGER;
            const bRank =
              SURUCU_KURSU_BELGE_TURU_ORDER_INDEX.get(normalizeCommonFieldNameKey(b.name)) ??
              Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.definitionId - b.definitionId;
          });

          if (restOptions.length === 0 && belgeSections.length === 0) continue;

          builtGroups.push({
            id: group.id,
            name: groupName,
            options: restOptions,
            definitionSections: belgeSections.length > 0 ? belgeSections : undefined,
          });
          continue;
        }

        defs.forEach((def) => {
          options.push(
            ...collectFeatureFilterOptionsForDefinition(
              def,
              choicesByDefinition,
              seenLabels,
              uniquePerDefinition,
            ),
          );
        });

        if (options.length === 0) continue;

        builtGroups.push({
          id: group.id,
          name: groupName,
          options,
        });
      }

      setPatiliBaslicaFields(patiliBaslicaFieldsList);
      setFeatureGroups(builtGroups);
      setFeatureGroupsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, hasDynamicFeatureMode]);

  // Eğitmenler liste sayfası — instructor_feature_* tabanlı filtre şeması.
  useEffect(() => {
    if (!hasInstructorFeatureMode) {
      setInstructorSchemaData(null);
      setInstructorFieldsError(null);
      setInstructorFieldsLoading(false);
      setInstructorCategories([]);
      setInstructorCategoriesLoading(false);
      setInstructorCategoriesError(null);
      return;
    }

    let cancelled = false;
    setInstructorFieldsLoading(true);
    setInstructorFieldsError(null);
    setInstructorCategoriesLoading(true);
    setInstructorCategoriesError(null);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [schemaResult, categoriesResult] = await Promise.all([
        fetchInstructorFeatureFilterSchemaDataClient(supabase),
        fetchInstructorFeatureCategoriesClient(supabase),
      ]);
      if (cancelled) return;

      if (categoriesResult.error) {
        setInstructorCategoriesError("Kategoriler yüklenemedi.");
        setInstructorCategories([]);
      } else {
        setInstructorCategories(categoriesResult.categories);
      }
      setInstructorCategoriesLoading(false);

      if (schemaResult.error) {
        setInstructorFieldsError("Filtreler yüklenemedi.");
        setInstructorSchemaData(null);
      } else {
        setInstructorSchemaData({
          groups: schemaResult.groups,
          definitions: schemaResult.definitions,
          choices: schemaResult.choices,
        });
      }
      setInstructorFieldsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasInstructorFeatureMode]);

  const instructorCategorySlug = String(selectedCategory ?? "").trim();

  const visibleInstructorFields = useMemo(() => {
    if (!instructorSchemaData) return [];
    const fields = buildInstructorFilterFieldsForListingCategory(
      instructorSchemaData.groups,
      instructorSchemaData.definitions,
      instructorSchemaData.choices,
      instructorCategorySlug || null,
    );
    if (instructorCategorySlug === KURS_SINAVA_HAZIRLIK_CATEGORY_SLUG) {
      return orderKursSinavaHazirlikInstructorFields(fields);
    }
    if (instructorCategorySlug === YABANCI_DIL_CATEGORY_SLUG) {
      return orderYabanciDilInstructorFields(fields);
    }
    if (instructorCategorySlug === SANAT_CATEGORY_SLUG) {
      return orderSanatInstructorFields(fields);
    }
    if (instructorCategorySlug === SPOR_CATEGORY_SLUG) {
      return orderSporInstructorFields(fields);
    }
    if (instructorCategorySlug === KISISEL_GELISIM_CATEGORY_SLUG) {
      return orderKisiselGelisimInstructorFields(fields);
    }
    if (instructorCategorySlug === MESLEKI_EGITIM_CATEGORY_SLUG) {
      return orderMeslekiEgitimInstructorFields(fields);
    }
    if (instructorCategorySlug === OZEL_EGITIM_CATEGORY_SLUG) {
      return orderOzelEgitimInstructorFields(fields);
    }
    if (instructorCategorySlug === SURUCU_KURSU_CATEGORY_SLUG) {
      return orderSurucuKursuInstructorFields(fields);
    }
    if (instructorCategorySlug === PATILI_DOSTLAR_CATEGORY_SLUG) {
      return orderPatiliDostlarInstructorFields(fields);
    }
    return fields;
  }, [instructorSchemaData, instructorCategorySlug]);

  const prevInstructorCategorySlugRef = useRef(instructorCategorySlug);
  useEffect(() => {
    if (!hasInstructorFeatureMode) return;
    if (prevInstructorCategorySlugRef.current === instructorCategorySlug) return;
    prevInstructorCategorySlugRef.current = instructorCategorySlug;

    setSelectedInstructorBoolean({});
    setSelectedCommonSingle({});
    setSelectedCommonMulti({});
    setSelectedCommonRange({});
    setExpandedInstructorMultiIds(new Set());
    setExpandedInstructorBooleanGroupIds(new Set());
  }, [hasInstructorFeatureMode, instructorCategorySlug]);

  // Okul Türü — yalnızca Okul sayfasında institution_types (kategoriye bağlı).
  useEffect(() => {
    if (!hasDynamicFeatureMode || !showSchoolSubcategoryFilters) {
      setSubcategoryTypes([]);
      setSelectedSubcategoryId("");
      setSelectedHighSchoolType("");
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();

      const { data: catData, error: catError } = await supabase
        .from("institution_categories")
        .select("id, slug, is_active")
        .eq("is_active", true)
        .eq("slug", effectiveSlug)
        .maybeSingle();

      if (cancelled) return;

      if (catError) {
        console.error(
          "[category-filter][institution-categories][error]",
          describeSupabaseError(catError),
        );
        setSubcategoryTypes([]);
        return;
      }

      const categoryId = (catData as { id: number | null } | null)?.id ?? null;
      if (!categoryId) {
        setSubcategoryTypes([]);
        return;
      }

      const { data: typesData, error: typesError } = await supabase
        .from("institution_types")
        .select("id, name, category_id, display_order, is_active")
        .eq("is_active", true)
        .eq("category_id", categoryId)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (typesError) {
        console.error(
          "[category-filter][institution-types][error]",
          describeSupabaseError(typesError),
        );
        setSubcategoryTypes([]);
        return;
      }

      const types = ((typesData ?? []) as InstitutionTypeRow[])
        .map((row) => ({ id: row.id, name: String(row.name ?? "").trim() }))
        .filter((t) => Boolean(t.name));

      setSubcategoryTypes(types);
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, hasDynamicFeatureMode, showSchoolSubcategoryFilters]);

  useEffect(() => {
    if (selectedSubcategoryId !== String(LISE_INSTITUTION_TYPE_ID)) {
      setSelectedHighSchoolType("");
    }
  }, [selectedSubcategoryId]);

  // "Başlıca Özellikler" feature group + definitions + choices (slug'tan bağımsız).
  // Patili: global Başlıca'nın tamamı açılmaz; yalnız Eğitim Dili alınır.
  useEffect(() => {
    if (!hasDynamicFeatureMode || (!usesGlobalBaslicaCommonFields && !isPatiliDostlarCategory)) {
      setCommonFields([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();

      // Global Başlıca: name eşleşmesi + category_slug boş.
      const { data: groupsData, error: groupsError } = await supabase
        .from("institution_feature_groups")
        .select("id, name, display_order, is_active, category_slug")
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;
      if (groupsError) {
        console.error(
          "[category-filter][common-group][groups-error]",
          describeSupabaseError(groupsError),
        );
        setCommonFields([]);
        return;
      }

      const groups = (groupsData ?? []) as FeatureGroupRow[];
      // Yalnız global Başlıca (category_slug boş). Category-specific Başlıca seçilmesin.
      const commonGroup = groups.find((g) => {
        const nameKey = (g.name ?? "").trim().toLocaleLowerCase("tr-TR");
        if (nameKey !== COMMON_GROUP_NAME_KEY) return false;
        return !String(g.category_slug ?? "").trim();
      });
      if (!commonGroup) {
        setCommonFields([]);
        return;
      }

      const { data: definitionsData, error: definitionsError } = await supabase
        .from("institution_feature_definitions")
        .select("id, group_id, name, slug, input_type, display_order, is_active, unit")
        .eq("is_active", true)
        .eq("group_id", commonGroup.id)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;
      if (definitionsError) {
        console.error(
          "[category-filter][common-group][defs-error]",
          describeSupabaseError(definitionsError),
        );
        setCommonFields([]);
        return;
      }

      const defs = ((definitionsData ?? []) as FeatureDefinitionRow[]).filter((d) =>
        Boolean((d.name ?? "").trim()),
      );

      const defIds = defs.map((d) => d.id);
      let choices: FeatureChoiceRow[] = [];
      if (defIds.length > 0) {
        const { data: choicesData, error: choicesError } = await supabase
          .from("institution_feature_choices")
          .select("id, feature_definition_id, name, display_order, is_active")
          .eq("is_active", true)
          .in("feature_definition_id", defIds)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true });

        if (cancelled) return;
        if (choicesError) {
          console.error(
            "[category-filter][common-group][choices-error]",
            describeSupabaseError(choicesError),
          );
          setCommonFields([]);
          return;
        }
        choices = (choicesData ?? []) as FeatureChoiceRow[];
      }

      const choicesByDef = new Map<number, FeatureChoiceRow[]>();
      choices.forEach((c) => {
        if (c.feature_definition_id == null) return;
        const arr = choicesByDef.get(c.feature_definition_id) ?? [];
        arr.push(c);
        choicesByDef.set(c.feature_definition_id, arr);
      });

      const fields: CommonField[] = [];

      defs.forEach((def) => {
        const displayName = getDisplayFeatureName(def.name ?? "");
        const inputType = String(def.input_type ?? "").trim().toLowerCase();
        const defChoices = (choicesByDef.get(def.id) ?? [])
          .map((c) => ({ id: c.id, name: String(c.name ?? "").trim() }))
          .filter((c) => Boolean(c.name));
        const orderedChoices =
          def.id === INSTITUTION_PRICE_RANGE_DEFINITION_ID || isInstitutionPriceRangeFieldName(displayName)
            ? orderPriceRangeChoicesFromCanonical(defChoices)
            : defChoices;

        if (
          isLegacyStudentAgeMultiSelectFeature({
            slug: def.slug,
            name: def.name,
            input_type: inputType,
          })
        ) {
          return;
        }

        if (isStudentAgeRangeNumberFeature({ slug: def.slug })) {
          return;
        }

        if (
          isHiddenYabanciDillerInstitutionFilter(def.name ?? "") ||
          isHiddenYabanciDillerInstitutionFilter(def.slug ?? "") ||
          isHiddenYabanciDillerInstitutionFilter(displayName)
        ) {
          return;
        }

        if (inputType === "single_select") {
          if (orderedChoices.length === 0) return;
          fields.push({
            kind: "single_select",
            definitionId: def.id,
            name: displayName,
            placeholder: `${displayName} seçin`,
            choices: orderedChoices,
          });
        } else if (inputType === "multi_select") {
          if (orderedChoices.length === 0) return;
          fields.push({
            kind: "multi_select",
            definitionId: def.id,
            name: displayName,
            choices: orderedChoices,
          });
        } else if (inputType === "number") {
          fields.push({
            kind: "number_range",
            definitionId: def.id,
            name: displayName,
            unit: (def.unit ?? "").trim() || null,
          });
        }
        // boolean / text → bu sürümde Başlıca Özellikler bloğunda atla.
      });

      setCommonFields(
        isPatiliDostlarCategory
          ? fields.filter((field) => normalizeCommonFieldNameKey(field.name) === "egitim dili")
          : reorderCommonFieldsAfterOkulSaatleri(fields),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [hasDynamicFeatureMode, usesGlobalBaslicaCommonFields, isPatiliDostlarCategory]);

  const handleFilterChange = (updates: Partial<FilterState>) => {
    const nextSearch = updates.search !== undefined ? updates.search : displaySearch;
    const nextDistrict = updates.district !== undefined ? updates.district : displayDistrict;
    const newFilters = {
      search: nextSearch,
      city,
      district: nextDistrict,
      category: selectedCategory,
      priceRange,
      ...updates,
    };

    if (updates.search !== undefined) {
      if (isLinkedSearch) onLinkedSearchChange?.(updates.search);
      else setSearch(updates.search);
    }
    if (updates.city !== undefined) setCity(updates.city);
    if (updates.district !== undefined) {
      if (isLinkedDistrict) onLinkedDistrictChange?.(updates.district);
      else setDistrict(updates.district);
    }
    if (updates.category !== undefined) setSelectedCategory(updates.category);
    if (updates.priceRange !== undefined) setPriceRange(updates.priceRange);

    onFilterChange?.(newFilters);
  };

  const toggleFeatureOption = (groupId: number, optionKey: string) => {
    setSelectedFeatureOptionsByGroup((prev) => {
      const current = new Set(prev[groupId] ?? new Set<string>());
      if (current.has(optionKey)) current.delete(optionKey);
      else current.add(optionKey);
      return { ...prev, [groupId]: current };
    });
  };

  const toggleGroupExpanded = (groupId: number) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleCommonMulti = (definitionId: number, choiceId: number) => {
    setSelectedCommonMulti((prev) => {
      const current = new Set(prev[definitionId] ?? new Set<string>());
      const key = String(choiceId);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, [definitionId]: current };
    });
  };

  const toggleCommonMultiExpanded = (definitionId: number) => {
    setExpandedCommonMultiIds((prev) => {
      const next = new Set(prev);
      if (next.has(definitionId)) next.delete(definitionId);
      else next.add(definitionId);
      return next;
    });
  };

  const toggleInstructorBoolean = (definitionId: number) => {
    setSelectedInstructorBoolean((prev) => ({
      ...prev,
      [definitionId]: !prev[definitionId],
    }));
  };

  const toggleInstructorMulti = (definitionId: number, choiceId: number) => {
    setSelectedCommonMulti((prev) => {
      const current = new Set(prev[definitionId] ?? new Set<string>());
      const key = String(choiceId);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, [definitionId]: current };
    });
  };

  const toggleInstructorMultiExpanded = (definitionId: number) => {
    setExpandedInstructorMultiIds((prev) => {
      const next = new Set(prev);
      if (next.has(definitionId)) next.delete(definitionId);
      else next.add(definitionId);
      return next;
    });
  };

  const toggleInstructorBooleanGroupExpanded = (groupId: number) => {
    setExpandedInstructorBooleanGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const setInstructorRange = (definitionId: number, edge: "min" | "max", value: string) => {
    setSelectedCommonRange((prev) => {
      const current = prev[definitionId] ?? { min: "", max: "" };
      return { ...prev, [definitionId]: { ...current, [edge]: value } };
    });
  };

  const setCommonRange = (definitionId: number, edge: "min" | "max", value: string) => {
    setSelectedCommonRange((prev) => {
      const current = prev[definitionId] ?? { min: "", max: "" };
      return { ...prev, [definitionId]: { ...current, [edge]: value } };
    });
  };

  const setCommonPriceRange = (definitionId: number, value: PriceRangeSliderValue) => {
    setSelectedCommonRange((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[definitionId];
        return next;
      }
      next[definitionId] = {
        min: String(value.min),
        max: String(value.max),
      };
      return next;
    });
    setSelectedCommonSingle((prev) => {
      if (!(definitionId in prev)) return prev;
      const next = { ...prev };
      delete next[definitionId];
      return next;
    });
    setSelectedCommonMulti((prev) => {
      if (!(definitionId in prev)) return prev;
      const next = { ...prev };
      delete next[definitionId];
      return next;
    });
  };

  const setPatiliPriceRange = (
    definitionId: number,
    choices: Array<{ id: number; name: string }>,
    value: PriceRangeSliderValue,
  ) => {
    setPatiliPriceSliderRange((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[definitionId];
      } else {
        next[definitionId] = value;
      }
      return next;
    });

    setSelectedCommonMulti((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[definitionId];
        return next;
      }

      const overlappingIds = resolveOverlappingPriceChoiceIds(choices, value);
      if (overlappingIds.length === 0) {
        delete next[definitionId];
      } else {
        next[definitionId] = new Set(overlappingIds);
      }
      return next;
    });
  };

  /** Öğrenci yaşı: bağımsız ham metin (ana sayfa ile aynı). */
  const setStudentAgeRange = (value: StudentAgeFilterTextPayload | null) => {
    setSelectedStudentAgeRange(value);
  };

  /** Öğrenci yaşı aralığı legacy commonRange kaydı (artık kullanılmıyor). */
  const setCommonAgeRange = (definitionId: number, value: StudentAgeFilterTextPayload | null) => {
    setSelectedCommonRange((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[definitionId];
        return next;
      }
      next[definitionId] = {
        min: value.min,
        max: value.max,
      };
      return next;
    });
  };

  const onSchoolFilterPayloadChangeRef = useRef(onSchoolFilterPayloadChange);
  onSchoolFilterPayloadChangeRef.current = onSchoolFilterPayloadChange;
  const onInstructorFilterPayloadChangeRef = useRef(onInstructorFilterPayloadChange);
  onInstructorFilterPayloadChangeRef.current = onInstructorFilterPayloadChange;

  const commonSingleKey = useMemo(() => JSON.stringify(selectedCommonSingle), [selectedCommonSingle]);
  const commonRangeKey = useMemo(() => JSON.stringify(selectedCommonRange), [selectedCommonRange]);
  const studentAgeRangeKey = useMemo(
    () =>
      selectedStudentAgeRange
        ? `${selectedStudentAgeRange.min}|${selectedStudentAgeRange.max}`
        : "",
    [selectedStudentAgeRange],
  );

  const commonMultiKey = useMemo(() => {
    return Object.keys(selectedCommonMulti)
      .sort((a, b) => Number(a) - Number(b))
      .map((did) => {
        const keys = Array.from(selectedCommonMulti[Number(did)] ?? new Set<string>()).sort();
        return `${did}:${keys.join(",")}`;
      })
      .join("|");
  }, [selectedCommonMulti]);

  const featureGroupSelectionsKey = useMemo(() => {
    return Object.keys(selectedFeatureOptionsByGroup)
      .sort((a, b) => Number(a) - Number(b))
      .map((gid) => {
        const keys = Array.from(selectedFeatureOptionsByGroup[Number(gid)] ?? new Set<string>()).sort();
        return `${gid}:${keys.join(",")}`;
      })
      .join("|");
  }, [selectedFeatureOptionsByGroup]);

  useEffect(() => {
    const emitPayload = onSchoolFilterPayloadChangeRef.current;
    if (!emitPayload || !hasDynamicFeatureMode) return;

    const rawSub = selectedSubcategoryId.trim();
    const institutionTypeId =
      rawSub && Number.isFinite(Number(rawSub)) && Number(rawSub) > 0 ? Number(rawSub) : null;

    const rawHighSchool = selectedHighSchoolType.trim();
    const highSchoolType =
      institutionTypeId === LISE_INSTITUTION_TYPE_ID && rawHighSchool ? rawHighSchool : null;

    const commonSingle: Record<number, string> = {};
    for (const [k, v] of Object.entries(selectedCommonSingle)) {
      const id = Number(k);
      const sv = String(v ?? "").trim();
      if (!Number.isFinite(id) || !sv || sv === CLEAR_SINGLE_SELECT_VALUE) continue;
      commonSingle[id] = sv;
    }

    const commonMulti: Record<number, string[]> = {};
    for (const [k, set] of Object.entries(selectedCommonMulti)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const arr = Array.from(set ?? []).filter(Boolean);
      if (arr.length === 0) continue;
      commonMulti[id] = arr;
    }

    const commonRange: Record<number, { min: string; max: string }> = {};
    for (const [k, r] of Object.entries(selectedCommonRange)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const minS = String(r?.min ?? "").trim();
      const maxS = String(r?.max ?? "").trim();
      if (!minS && !maxS) continue;
      commonRange[id] = { min: minS, max: maxS };
    }

    const groupSelections: Record<number, string[]> = {};
    for (const [gid, set] of Object.entries(selectedFeatureOptionsByGroup)) {
      const id = Number(gid);
      if (!Number.isFinite(id)) continue;
      const keys = Array.from(set ?? []);
      if (keys.length === 0) continue;
      groupSelections[id] = keys;
    }

    emitPayload({
      institutionTypeId,
      highSchoolType,
      commonSingle,
      commonMulti,
      commonRange,
      groupSelections,
      studentAgeRange: selectedStudentAgeRange,
    });
    // Bağımlılık olarak state'lerin kararlı JSON anahtarları kullanılıyor;
    // state objelerinin kendileri referans-yenileme tetiklediği için eklenmedi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasDynamicFeatureMode,
    selectedSubcategoryId,
    selectedHighSchoolType,
    commonSingleKey,
    commonMultiKey,
    commonRangeKey,
    studentAgeRangeKey,
    featureGroupSelectionsKey,
  ]);

  const instructorBooleanKey = useMemo(
    () => JSON.stringify(selectedInstructorBoolean),
    [selectedInstructorBoolean],
  );
  const instructorFieldsKey = useMemo(
    () => JSON.stringify(visibleInstructorFields),
    [visibleInstructorFields],
  );

  useEffect(() => {
    const emitPayload = onInstructorFilterPayloadChangeRef.current;
    if (!emitPayload || !hasInstructorFeatureMode) return;

    const booleanValues: Record<number, boolean> = {};
    for (const [definitionId, value] of Object.entries(selectedInstructorBoolean)) {
      const id = Number(definitionId);
      if (!Number.isFinite(id) || !value) continue;
      booleanValues[id] = true;
    }

    const booleanDefinitionGroupIds: Record<number, number> = {};
    for (const field of visibleInstructorFields) {
      if (field.kind !== "boolean_group") continue;
      for (const option of field.options) {
        booleanDefinitionGroupIds[option.definitionId] = field.groupId;
      }
    }

    const singleSelect: Record<number, string> = {};
    for (const [k, v] of Object.entries(selectedCommonSingle)) {
      const id = Number(k);
      const sv = String(v ?? "").trim();
      if (!Number.isFinite(id) || !sv || sv === CLEAR_SINGLE_SELECT_VALUE) continue;
      singleSelect[id] = sv;
    }

    const multiSelect: Record<number, string[]> = {};
    for (const [k, set] of Object.entries(selectedCommonMulti)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const arr = Array.from(set ?? []).filter(Boolean);
      if (arr.length === 0) continue;
      multiSelect[id] = arr;
    }

    const numberRange: Record<number, { min: string; max: string }> = {};
    for (const [k, r] of Object.entries(selectedCommonRange)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const minS = String(r?.min ?? "").trim();
      const maxS = String(r?.max ?? "").trim();
      if (!minS && !maxS) continue;
      numberRange[id] = { min: minS, max: maxS };
    }

    emitPayload({
      booleanValues,
      booleanDefinitionGroupIds,
      singleSelect,
      multiSelect,
      numberRange,
      studentAgeRange: selectedStudentAgeRange,
    });
  }, [
    hasInstructorFeatureMode,
    instructorBooleanKey,
    instructorFieldsKey,
    commonSingleKey,
    commonMultiKey,
    commonRangeKey,
    studentAgeRangeKey,
  ]);

  const renderedFeatureGroups = useMemo(() => featureGroups, [featureGroups]);

  /** En az bir filtre aktif mi? Sıfırlama butonunun görünürlüğünü belirler. */
  const hasActiveFilters = useMemo(() => {
    if (String(displaySearch ?? "").trim()) return true;
    if (usesInstitutionLocationFilters) {
      if (String(displayIlceId ?? "").trim()) return true;
      if (String(displayMahalleId ?? "").trim()) return true;
      if (defaultIlId && displayIlId && displayIlId !== defaultIlId) return true;
    }
    if (String(selectedCategory ?? "").trim()) return true;
    if (String(selectedSubcategoryId ?? "").trim()) return true;
    if (String(selectedHighSchoolType ?? "").trim()) return true;
    if (priceRange != null) return true;
    if (isStudentAgeFilterTextActive(selectedStudentAgeRange)) return true;
    for (const v of Object.values(selectedCommonSingle)) {
      const s = String(v ?? "").trim();
      if (s && s !== CLEAR_SINGLE_SELECT_VALUE) return true;
    }
    for (const set of Object.values(selectedCommonMulti)) {
      if ((set?.size ?? 0) > 0) return true;
    }
    for (const range of Object.values(patiliPriceSliderRange)) {
      if (range != null) return true;
    }
    for (const r of Object.values(selectedCommonRange)) {
      if (String(r?.min ?? "").trim() !== "" || String(r?.max ?? "").trim() !== "") return true;
    }
    for (const set of Object.values(selectedFeatureOptionsByGroup)) {
      if ((set?.size ?? 0) > 0) return true;
    }
    if (hasInstructorFeatureMode) {
      if (String(selectedCategory ?? "").trim()) return true;
      for (const value of Object.values(selectedInstructorBoolean)) {
        if (value) return true;
      }
    }
    return false;
  }, [
    displaySearch,
    displayIlId,
    displayIlceId,
    displayMahalleId,
    defaultIlId,
    usesInstitutionLocationFilters,
    selectedCategory,
    selectedSubcategoryId,
    selectedHighSchoolType,
    priceRange,
    selectedCommonSingle,
    selectedCommonMulti,
    selectedCommonRange,
    patiliPriceSliderRange,
    selectedStudentAgeRange,
    selectedFeatureOptionsByGroup,
    hasInstructorFeatureMode,
    selectedInstructorBoolean,
  ]);

  /**
   * Tüm filtre state'ini default değerlere döndürür. Linked search/district için
   * parent state'i de boş değerle bildirir. Sidebar feature payload'u zaten boş
   * state'ten otomatik olarak boş emit edileceği için ekstra çağrı gerekmez.
   */
  const resetAll = useCallback(() => {
    setSearch("");
    setDistrict("");
    setLocalIlId("");
    setLocalIlceId("");
    setLocalMahalleId("");
    setSelectedCategory("");
    setPriceRange(null);
    resetCategoryFeatureFilters();
    setSelectedInstructorBoolean({});
    setExpandedInstructorMultiIds(new Set());
    setExpandedInstructorBooleanGroupIds(new Set());
    if (isLinkedSearch) onLinkedSearchChange?.("");
    if (isLinkedDistrict) onLinkedDistrictChange?.("");
    if (isLinkedLocation) onLinkedLocationChange?.(EMPTY_CATEGORY_LOCATION_FILTER);
    onFilterChange?.({
      search: "",
      city: "",
      district: "",
      category: "",
      priceRange: null,
    });
  }, [
    isLinkedSearch,
    isLinkedDistrict,
    isLinkedLocation,
    onLinkedSearchChange,
    onLinkedDistrictChange,
    onLinkedLocationChange,
    onFilterChange,
    resetCategoryFeatureFilters,
  ]);

  return {
    categories,
    searchPlaceholder,
    hasDynamicFeatureMode,
    hasInstructorFeatureMode,
    usesInstitutionLocationFilters,
    displaySearch,
    displayDistrict,
    displayIlId,
    displayIlceId,
    displayMahalleId,
    iller,
    ilceler,
    mahalleler,
    handleIlChange,
    handleIlceChange,
    handleMahalleChange,
    city,
    district,
    search,
    selectedCategory,
    priceRange,
    featureGroups,
    featureGroupsLoading,
    featureGroupsError,
    selectedFeatureOptionsByGroup,
    expandedGroupIds,
    subcategoryTypes,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    selectedHighSchoolType,
    setSelectedHighSchoolType,
    showSchoolSubcategoryFilters,
    showKursSinavaHazirlikInstitutionFilters,
    showSporInstitutionFilters,
    showSanatInstitutionFilters,
    showYabanciDilInstitutionFilters,
    showKisiselGelisimInstitutionFilters,
    showMeslekiEgitimInstitutionFilters,
    showOzelEgitimInstitutionFilters,
    showSurucuKursuInstitutionFilters,
    showPatiliDostlarInstitutionFilters,
    commonFields,
    patiliBaslicaFields,
    isPatiliDostlarCategory,
    usesGlobalBaslicaCommonFields,
    patiliPriceSliderRange,
    selectedCommonSingle,
    setSelectedCommonSingle,
    selectedCommonMulti,
    selectedCommonRange,
    expandedCommonMultiIds,
    handleFilterChange,
    toggleFeatureOption,
    toggleGroupExpanded,
    toggleCommonMulti,
    toggleCommonMultiExpanded,
    setCommonRange,
    setCommonPriceRange,
    setPatiliPriceRange,
    setCommonAgeRange,
    setStudentAgeRange,
    selectedStudentAgeRange,
    renderedFeatureGroups,
    instructorFields: visibleInstructorFields,
    instructorFieldsLoading,
    instructorFieldsError,
    instructorCategories,
    instructorCategoriesLoading,
    instructorCategoriesError,
    selectedInstructorBoolean,
    expandedInstructorMultiIds,
    expandedInstructorBooleanGroupIds,
    toggleInstructorBoolean,
    toggleInstructorMulti,
    toggleInstructorMultiExpanded,
    toggleInstructorBooleanGroupExpanded,
    setInstructorRange,
    hasActiveFilters,
    resetAll,
  };
}

type CategoryFilterSidebarModel = ReturnType<typeof useCategoryFilterSidebarModel>;

const SchoolCategoryFilterPanelContext = createContext<CategoryFilterSidebarModel | null>(null);
const InstructorCategoryFilterPanelContext = createContext<CategoryFilterSidebarModel | null>(null);

export function InstructorCategoryFilterPanelProvider({
  children,
  config,
  onFilterChange,
  linkedLocation,
  onLinkedLocationChange,
  onInstructorFilterPayloadChange,
}: {
  children: ReactNode;
  config?: CategoryFilterConfig;
  onFilterChange?: (filters: FilterState) => void;
  linkedLocation: CategoryLocationFilterValue;
  onLinkedLocationChange: (value: CategoryLocationFilterValue) => void;
  onInstructorFilterPayloadChange: (payload: InstructorCategoryFilterPayload) => void;
}) {
  const model = useCategoryFilterSidebarModel({
    enabled: true,
    config,
    onFilterChange,
    filterSchemaSource: "instructor",
    linkedLocation,
    onLinkedLocationChange,
    onInstructorFilterPayloadChange,
  });
  return (
    <InstructorCategoryFilterPanelContext.Provider value={model}>
      {children}
    </InstructorCategoryFilterPanelContext.Provider>
  );
}

export function SchoolCategoryFilterPanelProvider({
  children,
  categorySlug,
  linkedSearch,
  onLinkedSearchChange,
  linkedLocation,
  onLinkedLocationChange,
  onSchoolFilterPayloadChange,
}: {
  children: ReactNode;
  categorySlug: string;
  linkedSearch: string;
  onLinkedSearchChange: (value: string) => void;
  linkedLocation: CategoryLocationFilterValue;
  onLinkedLocationChange: (value: CategoryLocationFilterValue) => void;
  onSchoolFilterPayloadChange: (payload: SchoolCategoryFilterPayload) => void;
}) {
  const model = useCategoryFilterSidebarModel({
    enabled: true,
    categorySlug,
    linkedSearch,
    onLinkedSearchChange,
    linkedLocation,
    onLinkedLocationChange,
    onSchoolFilterPayloadChange,
  });
  return (
    <SchoolCategoryFilterPanelContext.Provider value={model}>{children}</SchoolCategoryFilterPanelContext.Provider>
  );
}

export function CategoryFilterPanelProvider({
  children,
  config,
  onFilterChange,
}: {
  children: ReactNode;
  config?: CategoryFilterConfig;
  onFilterChange?: (filters: FilterState) => void;
}) {
  const model = useCategoryFilterSidebarModel({
    enabled: true,
    config,
    onFilterChange,
  });
  return (
    <SchoolCategoryFilterPanelContext.Provider value={model}>{children}</SchoolCategoryFilterPanelContext.Provider>
  );
}

function CategoryFilterSidebarView({
  model,
  mapMarkers,
  mapLoading = false,
}: {
  model: CategoryFilterSidebarModel;
  mapMarkers?: InstitutionMapMarker[];
  mapLoading?: boolean;
}) {
  const {
    categories,
    searchPlaceholder,
    hasDynamicFeatureMode,
    hasInstructorFeatureMode,
    displaySearch,
    displayIlId,
    displayIlceId,
    displayMahalleId,
    iller,
    ilceler,
    mahalleler,
    handleIlChange,
    handleIlceChange,
    handleMahalleChange,
    selectedCategory,
    priceRange,
    featureGroupsLoading,
    featureGroupsError,
    selectedFeatureOptionsByGroup,
    expandedGroupIds,
    subcategoryTypes,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    selectedHighSchoolType,
    setSelectedHighSchoolType,
    showSchoolSubcategoryFilters,
    showKursSinavaHazirlikInstitutionFilters,
    showSporInstitutionFilters,
    showSanatInstitutionFilters,
    showYabanciDilInstitutionFilters,
    showKisiselGelisimInstitutionFilters,
    showMeslekiEgitimInstitutionFilters,
    showOzelEgitimInstitutionFilters,
    showSurucuKursuInstitutionFilters,
    showPatiliDostlarInstitutionFilters,
    commonFields,
    patiliBaslicaFields,
    isPatiliDostlarCategory,
    usesGlobalBaslicaCommonFields,
    patiliPriceSliderRange,
    selectedCommonSingle,
    setSelectedCommonSingle,
    selectedCommonMulti,
    selectedCommonRange,
    expandedCommonMultiIds,
    handleFilterChange,
    toggleFeatureOption,
    toggleGroupExpanded,
    toggleCommonMulti,
    toggleCommonMultiExpanded,
    setCommonRange,
    setCommonPriceRange,
    setPatiliPriceRange,
    setCommonAgeRange,
    setStudentAgeRange,
    selectedStudentAgeRange,
    renderedFeatureGroups,
    instructorFields,
    instructorFieldsLoading,
    instructorFieldsError,
    instructorCategories,
    instructorCategoriesLoading,
    instructorCategoriesError,
    selectedInstructorBoolean,
    expandedInstructorMultiIds,
    expandedInstructorBooleanGroupIds,
    toggleInstructorBoolean,
    toggleInstructorMulti,
    toggleInstructorMultiExpanded,
    toggleInstructorBooleanGroupExpanded,
    setInstructorRange,
  } = model;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const isKursSinavaHazirlikInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === KURS_SINAVA_HAZIRLIK_CATEGORY_SLUG;
  const isYabanciDilInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === YABANCI_DIL_CATEGORY_SLUG;
  const isSanatInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === SANAT_CATEGORY_SLUG;
  const isSporInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === SPOR_CATEGORY_SLUG;
  const isKisiselGelisimInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === KISISEL_GELISIM_CATEGORY_SLUG;
  const isMeslekiEgitimInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === MESLEKI_EGITIM_CATEGORY_SLUG;
  const isOzelEgitimInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === OZEL_EGITIM_CATEGORY_SLUG;
  const isSurucuKursuInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === SURUCU_KURSU_CATEGORY_SLUG;
  const isPatiliDostlarInstructorCategory =
    hasInstructorFeatureMode &&
    String(selectedCategory ?? "").trim() === PATILI_DOSTLAR_CATEGORY_SLUG;
  const patiliHasHizmetYeriField =
    isPatiliDostlarInstructorCategory &&
    instructorFields.some(
      (field) => normalizePatiliDostlarFilterOrderKey(field.name) === "hizmet yeri",
    );
  const usesInjectedAgePriceInstructorOrder =
    isKursSinavaHazirlikInstructorCategory ||
    isYabanciDilInstructorCategory ||
    isSanatInstructorCategory ||
    isSporInstructorCategory ||
    isKisiselGelisimInstructorCategory ||
    isMeslekiEgitimInstructorCategory ||
    isOzelEgitimInstructorCategory ||
    isSurucuKursuInstructorCategory ||
    isPatiliDostlarInstructorCategory;

  const renderInstructorPriceFilterSection = (keySuffix: string) => (
    <div className="category-filter-section" key={`instructor-price-${keySuffix}`}>
      <CategoryFilterSectionTitle title="AYLIK FİYAT ARALIĞI" />
      <PriceRangeSliderFilter
        value={priceRange}
        onChange={(nextRange) => handleFilterChange({ priceRange: nextRange })}
        className="category-filter-price-slider"
      />
    </div>
  );

  const getCommonRangeSliderValue = (definitionId: number): PriceRangeSliderValue => {
    const current = selectedCommonRange[definitionId];
    if (!current) return null;
    const min = Number(String(current.min ?? "").trim());
    const max = Number(String(current.max ?? "").trim());
    if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
    return {
      min: Number.isFinite(min) ? min : INSTITUTION_PRICE_FILTER_MIN,
      max: Number.isFinite(max) ? max : INSTITUTION_PRICE_FILTER_MAX,
    };
  };

  const getCommonAgeRangeSliderValue = (): StudentAgeFilterTextPayload | null => {
    if (!selectedStudentAgeRange) return null;
    const min = String(selectedStudentAgeRange.min ?? "");
    const max = String(selectedStudentAgeRange.max ?? "");
    if (!min.trim() && !max.trim()) return null;
    return { min, max };
  };

  const renderStudentAgeFilterSection = (keySuffix: string) => (
    <div className="category-filter-section" key={`student-age-${keySuffix}`}>
      <CategoryFilterSectionTitle title={STUDENT_AGE_RANGE_LABEL.toLocaleUpperCase("tr-TR")} />
      <AgeRangeSliderFilter
        value={getCommonAgeRangeSliderValue()}
        onChange={setStudentAgeRange}
        className="category-filter-price-slider"
      />
    </div>
  );

  const schoolOrderedDynamicSections = useMemo(() => {
    if (!showSchoolSubcategoryFilters) return [] as OkulDynamicFilterSection[];
    const sections: OkulDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    return orderOkulInstitutionFilterSections(sections);
  }, [showSchoolSubcategoryFilters, commonFields, renderedFeatureGroups]);

  const kursOrderedDynamicSections = useMemo(() => {
    if (!showKursSinavaHazirlikInstitutionFilters) {
      return [] as KursSinavaHazirlikDynamicFilterSection[];
    }
    const sections: KursSinavaHazirlikDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    return orderKursSinavaHazirlikInstitutionFilterSections(sections);
  }, [showKursSinavaHazirlikInstitutionFilters, commonFields, renderedFeatureGroups]);

  const sporOrderedDynamicSections = useMemo(() => {
    if (!showSporInstitutionFilters) {
      return [] as SporDynamicFilterSection[];
    }
    const sections: SporDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    return orderSporInstitutionFilterSections(sections);
  }, [showSporInstitutionFilters, commonFields, renderedFeatureGroups]);

  const sanatOrderedDynamicSections = useMemo(() => {
    if (!showSanatInstitutionFilters) {
      return [] as SanatDynamicFilterSection[];
    }
    const sections: SanatDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    return orderSanatInstitutionFilterSections(sections);
  }, [showSanatInstitutionFilters, commonFields, renderedFeatureGroups]);

  const yabanciDilOrderedDynamicSections = useMemo(() => {
    if (!showYabanciDilInstitutionFilters) {
      return [] as YabanciDilDynamicFilterSection[];
    }
    const sections: YabanciDilDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    return orderYabanciDilInstitutionFilterSections(sections);
  }, [showYabanciDilInstitutionFilters, commonFields, renderedFeatureGroups]);

  const kisiselGelisimOrderedDynamicSections = useMemo(() => {
    if (!showKisiselGelisimInstitutionFilters) {
      return [] as KisiselGelisimDynamicFilterSection[];
    }
    const sections: KisiselGelisimDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    return orderKisiselGelisimInstitutionFilterSections(sections);
  }, [showKisiselGelisimInstitutionFilters, commonFields, renderedFeatureGroups]);

  const meslekiEgitimOrderedDynamicSections = useMemo(() => {
    if (!showMeslekiEgitimInstitutionFilters) {
      return [] as MeslekiEgitimDynamicFilterSection[];
    }
    const sections: MeslekiEgitimDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    return orderMeslekiEgitimInstitutionFilterSections(sections);
  }, [showMeslekiEgitimInstitutionFilters, commonFields, renderedFeatureGroups]);

  const ozelEgitimOrderedDynamicSections = useMemo(() => {
    if (!showOzelEgitimInstitutionFilters) {
      return [] as OzelEgitimDynamicFilterSection[];
    }
    const sections: OzelEgitimDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      sections.push({ kind: "group", group, originalIndex: commonFields.length + index });
    });
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    return orderOzelEgitimInstitutionFilterSections(sections);
  }, [showOzelEgitimInstitutionFilters, commonFields, renderedFeatureGroups]);

  const surucuKursuOrderedDynamicSections = useMemo(() => {
    if (!showSurucuKursuInstitutionFilters) {
      return [] as SurucuKursuDynamicFilterSection[];
    }
    const sections: SurucuKursuDynamicFilterSection[] = [];
    commonFields.forEach((field, index) => {
      if (isStudentAgeCommonField(field)) return;
      sections.push({ kind: "common", field, originalIndex: index });
    });
    renderedFeatureGroups.forEach((group, index) => {
      const originalIndex = commonFields.length + index;
      if ((group.definitionSections?.length ?? 0) > 0) {
        sections.push({ kind: "belge_turleri", group, originalIndex });
      }
      if (group.options.length > 0) {
        sections.push({ kind: "group", group, originalIndex });
      }
    });
    return orderSurucuKursuInstitutionFilterSections(sections);
  }, [showSurucuKursuInstitutionFilters, commonFields, renderedFeatureGroups]);

  const patiliDostlarOrderedDynamicSections = useMemo(() => {
    if (!showPatiliDostlarInstitutionFilters) {
      return [] as PatiliDostlarDynamicFilterSection[];
    }
    const sections: PatiliDostlarDynamicFilterSection[] = [];
    patiliBaslicaFields.forEach((field, index) => {
      if (isHiddenPatiliDostlarPublicInstitutionFilter(field.name)) return;
      if (isStudentAgeCommonField(field)) return;
      if (normalizePatiliDostlarInstitutionFilterOrderKey(field.name) === "egitim dili") return;
      sections.push({ kind: "common", field, originalIndex: index });
    });
    commonFields.forEach((field, index) => {
      if (isHiddenPatiliDostlarPublicInstitutionFilter(field.name)) return;
      if (isStudentAgeCommonField(field)) return;
      sections.push({
        kind: "common",
        field,
        originalIndex: patiliBaslicaFields.length + index,
      });
    });
    renderedFeatureGroups.forEach((group, index) => {
      if (isHiddenPatiliDostlarPublicInstitutionFilter(group.name)) return;
      if (group.options.length === 0) return;
      sections.push({
        kind: "group",
        group,
        originalIndex: patiliBaslicaFields.length + commonFields.length + index,
      });
    });
    return orderPatiliDostlarInstitutionFilterSections(sections);
  }, [
    showPatiliDostlarInstitutionFilters,
    patiliBaslicaFields,
    commonFields,
    renderedFeatureGroups,
  ]);

  const renderInstitutionCommonField = (field: CommonField, title: string) => {
    if (field.kind === "single_select") {
      if (isPriceRangeCommonField(field)) {
        return (
          <div className="category-filter-section" key={`common-${field.definitionId}`}>
            <CategoryFilterSectionTitle title={title} />
            <PriceRangeSliderFilter
              value={getCommonRangeSliderValue(field.definitionId)}
              onChange={(nextRange) => setCommonPriceRange(field.definitionId, nextRange)}
              className="category-filter-price-slider"
            />
          </div>
        );
      }
      const selectedValue = selectedCommonSingle[field.definitionId] ?? "";
      const selectValue = selectedValue ? String(selectedValue) : CLEAR_SINGLE_SELECT_VALUE;
      return (
        <div className="category-filter-section" key={`common-${field.definitionId}`}>
          <CategoryFilterSectionTitle title={title} />
          <div className="category-filter-section-inputs">
            <Select
              value={selectValue}
              onValueChange={(value) =>
                setSelectedCommonSingle((prev) => ({
                  ...prev,
                  [field.definitionId]: value === CLEAR_SINGLE_SELECT_VALUE ? "" : value,
                }))
              }
            >
              <SelectTrigger className="category-filter-select">
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent
                className="select-content home-location-dropdown"
                side="bottom"
                avoidCollisions={false}
              >
                <SelectItem value={CLEAR_SINGLE_SELECT_VALUE} className="select-item">
                  Tümü
                </SelectItem>
                {field.choices.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} className="select-item">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (field.kind === "number_range") {
      if (
        field.definitionId === INSTITUTION_PRICE_RANGE_DEFINITION_ID ||
        isInstitutionPriceRangeFieldName(field.name)
      ) {
        return (
          <div className="category-filter-section" key={`common-${field.definitionId}`}>
            <CategoryFilterSectionTitle title={title} />
            <PriceRangeSliderFilter
              value={getCommonRangeSliderValue(field.definitionId)}
              onChange={(nextRange) => setCommonPriceRange(field.definitionId, nextRange)}
              className="category-filter-price-slider"
            />
          </div>
        );
      }
      const value = selectedCommonRange[field.definitionId] ?? { min: "", max: "" };
      return (
        <div className="category-filter-section" key={`common-${field.definitionId}`}>
          <CategoryFilterSectionTitle title={title} />
          <div className="category-filter-price-inputs">
            <Input
              type="number"
              value={value.min}
              onChange={(e) => setCommonRange(field.definitionId, "min", e.target.value)}
              placeholder="Min"
              min="0"
              className="category-filter-price-input"
            />
            <span className="category-filter-price-separator">-</span>
            <Input
              type="number"
              value={value.max}
              onChange={(e) => setCommonRange(field.definitionId, "max", e.target.value)}
              placeholder="Max"
              min="0"
              className="category-filter-price-input"
            />
          </div>
        </div>
      );
    }

    if (field.kind === "student_age_range" || isStudentAgeCommonField(field)) {
      return null;
    }

    if (field.kind === "multi_select") {
      if (isPriceRangeCommonField(field)) {
        return (
          <div className="category-filter-section" key={`common-${field.definitionId}`}>
            <CategoryFilterSectionTitle title={title} />
            <PriceRangeSliderFilter
              value={getCommonRangeSliderValue(field.definitionId)}
              onChange={(nextRange) => setCommonPriceRange(field.definitionId, nextRange)}
              className="category-filter-price-slider"
            />
          </div>
        );
      }
      const selectedSet = selectedCommonMulti[field.definitionId] ?? new Set<string>();
      const isExpanded = expandedCommonMultiIds.has(field.definitionId);
      const sortedChoices = isPriceRangeCommonField(field)
        ? sortPriceRangeChoicesByMin(field.choices)
        : sortCheckboxOptionsByLabel(field.choices, (c) => c.name);
      const visibleChoices = isExpanded
        ? sortedChoices
        : sortedChoices.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
      const hasMore = sortedChoices.length > FEATURE_OPTIONS_VISIBLE_LIMIT;
      return (
        <div className="category-filter-section" key={`common-${field.definitionId}`}>
          <CategoryFilterSectionTitle title={title} />
          <div className={checkboxListClassName(sortedChoices.length)}>
            {visibleChoices.map((c) => {
              const key = String(c.id);
              const isChecked = selectedSet.has(key);
              return (
                <label
                  key={c.id}
                  className={`category-filter-checkbox-option${
                    isChecked ? " category-filter-checkbox-option--selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCommonMulti(field.definitionId, c.id)}
                    className="category-filter-checkbox-input"
                  />
                  <span className="category-filter-checkbox-label">{c.name}</span>
                </label>
              );
            })}
          </div>
          {hasMore ? (
            <button
              type="button"
              className="category-filter-show-more"
              onClick={() => toggleCommonMultiExpanded(field.definitionId)}
              aria-expanded={isExpanded}
            >
              {isExpanded
                ? "Daha Az Göster"
                : `Daha Fazla Göster (+${sortedChoices.length - FEATURE_OPTIONS_VISIBLE_LIMIT})`}
            </button>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const renderInstitutionFeatureGroup = (group: FeatureFilterGroup, title: string) => {
    const selectedKeys = selectedFeatureOptionsByGroup[group.id] ?? new Set<string>();
    const isExpanded = expandedGroupIds.has(group.id);
    const sortedOptions = sortCheckboxOptionsByLabel(group.options, (o) => o.label);
    const optionsToShow = isExpanded
      ? sortedOptions
      : sortedOptions.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
    const hasMore = sortedOptions.length > FEATURE_OPTIONS_VISIBLE_LIMIT;

    return (
      <div className="category-filter-section" key={`feature-group-${group.id}`}>
        <CategoryFilterSectionTitle title={title} />
        <div className={checkboxListClassName(sortedOptions.length)}>
          {optionsToShow.map((option) => {
            const isChecked = selectedKeys.has(option.key);
            return (
              <label
                key={option.key}
                className={`category-filter-checkbox-option${
                  isChecked ? " category-filter-checkbox-option--selected" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleFeatureOption(group.id, option.key)}
                  className="category-filter-checkbox-input"
                />
                <span className="category-filter-checkbox-label">{option.label}</span>
              </label>
            );
          })}
        </div>
        {hasMore ? (
          <button
            type="button"
            className="category-filter-show-more"
            onClick={() => toggleGroupExpanded(group.id)}
            aria-expanded={isExpanded}
          >
            {isExpanded
              ? "Daha Az Göster"
              : `Daha Fazla Göster (+${sortedOptions.length - FEATURE_OPTIONS_VISIBLE_LIMIT})`}
          </button>
        ) : null}
      </div>
    );
  };

  const renderSurucuKursuBelgeTurleriSection = (group: FeatureFilterGroup) => {
    const sections = group.definitionSections ?? [];
    if (sections.length === 0) return null;
    const selectedKeys = selectedFeatureOptionsByGroup[group.id] ?? new Set<string>();

    return (
      <div className="category-filter-section" key={`belge-turleri-${group.id}`}>
        <CategoryFilterSectionTitle title="BELGE TÜRLERİ" />
        {sections.map((section) => {
          const sortedOptions = sortCheckboxOptionsByLabel(section.options, (o) => o.label);
          const isExpanded = expandedCommonMultiIds.has(section.definitionId);
          const optionsToShow = isExpanded
            ? sortedOptions
            : sortedOptions.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
          const hasMore = sortedOptions.length > FEATURE_OPTIONS_VISIBLE_LIMIT;

          return (
            <div
              className="category-filter-subsection"
              key={`belge-def-${section.definitionId}`}
            >
              <CategoryFilterSubsectionTitle title={section.name.toLocaleUpperCase("tr-TR")} />
              <div className={checkboxListClassName(sortedOptions.length)}>
                {optionsToShow.map((option) => {
                  const isChecked = selectedKeys.has(option.key);
                  return (
                    <label
                      key={option.key}
                      className={`category-filter-checkbox-option${
                        isChecked ? " category-filter-checkbox-option--selected" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleFeatureOption(group.id, option.key)}
                        className="category-filter-checkbox-input"
                      />
                      <span className="category-filter-checkbox-label">{option.label}</span>
                    </label>
                  );
                })}
              </div>
              {hasMore ? (
                <button
                  type="button"
                  className="category-filter-show-more"
                  onClick={() => toggleCommonMultiExpanded(section.definitionId)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded
                    ? "Daha Az Göster"
                    : `Daha Fazla Göster (+${sortedOptions.length - FEATURE_OPTIONS_VISIBLE_LIMIT})`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasAdvancedFilters =
    commonFields.length > 0 ||
    patiliBaslicaFields.length > 0 ||
    renderedFeatureGroups.length > 0 ||
    instructorFields.length > 0;
  const showLoginHint =
    hasDynamicFeatureMode &&
    !hasInstructorFeatureMode &&
    !featureGroupsLoading &&
    isAuthenticated === false &&
    !hasAdvancedFilters;

  const locationIlLabel =
    iller.find((row) => String(row.id) === displayIlId)?.ad ?? "İl seçin";
  const locationIlceLabel = !displayIlId
    ? "İlçe Seçin"
    : ilceler.find((row) => String(row.id) === displayIlceId)?.ad ?? "Tüm İlçeler";
  const locationMahalleLabel = !displayIlceId
    ? "Mahalle Seçin"
    : mahalleler.find((row) => String(row.id) === displayMahalleId)?.ad ?? "Tüm Mahalleler";

  return (
    <aside className="category-filter-sidebar">
      <div className="category-filter-sidebar-card">
        <div className="category-filter-sidebar-header">
          <div className="category-filter-sidebar-header-content">
            <Image
              src="/images/filter.svg"
              alt="Filtreleme"
              width={20}
              height={20}
              className="category-filter-sidebar-header-icon"
            />
            <h2 className="category-filter-sidebar-header-title">Filtreleme</h2>
          </div>
        </div>

        <div className="category-filter-sidebar-content">
          {mapMarkers !== undefined ? (
            <InstitutionMapSearchSection
              markers={mapMarkers}
              loading={mapLoading}
              mapKeyPrefix="category-institution-map"
              showSeparatorAfter
            />
          ) : null}
          <div className="category-filter-section">
            <CategoryFilterSectionTitle title="ARAMA" />
            <div className="category-filter-section-inputs">
              <div className="category-filter-search-wrapper">
                <Search size={18} className="category-filter-search-icon" />
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={displaySearch}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="category-filter-search-input"
                />
              </div>
            </div>
          </div>

          <div className="category-filter-section">
            <CategoryFilterSectionTitle title="KONUM" />
            <div className="category-filter-section-inputs">
                  <SelectMountGate
                    label={locationIlLabel}
                    disabled={iller.length === 0}
                  >
                  <Select
                    value={displayIlId || undefined}
                    onValueChange={handleIlChange}
                    disabled={iller.length === 0}
                  >
                    <SelectTrigger className="category-filter-select">
                      <SelectValue placeholder="İl seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content home-location-dropdown"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      {iller.map((row) => (
                        <SelectItem key={row.id} value={String(row.id)} className="select-item">
                          {row.ad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </SelectMountGate>
                  <SelectMountGate
                    label={locationIlceLabel}
                    disabled={!displayIlId}
                  >
                  <Select
                    value={displayIlceId ? displayIlceId : CATEGORY_ALL_ILCELER_VALUE}
                    onValueChange={handleIlceChange}
                    disabled={!displayIlId}
                  >
                    <SelectTrigger className="category-filter-select">
                      <SelectValue placeholder="İlçe Seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content home-location-dropdown"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <SelectItem value={CATEGORY_ALL_ILCELER_VALUE} className="select-item">
                        Tüm İlçeler
                      </SelectItem>
                      {ilceler.map((row) => (
                        <SelectItem key={row.id} value={String(row.id)} className="select-item">
                          {row.ad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </SelectMountGate>
                  <SelectMountGate
                    label={locationMahalleLabel}
                    disabled={!displayIlceId}
                  >
                  <Select
                    value={displayMahalleId ? displayMahalleId : CATEGORY_ALL_MAHALLELER_VALUE}
                    onValueChange={handleMahalleChange}
                    disabled={!displayIlceId}
                  >
                    <SelectTrigger className="category-filter-select">
                      <SelectValue placeholder="Mahalle Seçin" />
                    </SelectTrigger>
                    <SelectContent
                      className="select-content home-location-dropdown"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <SelectItem value={CATEGORY_ALL_MAHALLELER_VALUE} className="select-item">
                        Tüm Mahalleler
                      </SelectItem>
                      {mahalleler.map((row) => (
                        <SelectItem key={row.id} value={String(row.id)} className="select-item">
                          {row.ad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </SelectMountGate>
            </div>
          </div>

          {showSchoolSubcategoryFilters && subcategoryTypes.length > 0 ? (
            <div className="category-filter-section">
              <CategoryFilterSectionTitle title="OKUL TÜRÜ" />
              <div className="category-filter-section-inputs">
                <Select
                  value={selectedSubcategoryId ? selectedSubcategoryId : CLEAR_SUBCATEGORY_VALUE}
                  onValueChange={(value) =>
                    setSelectedSubcategoryId(value === CLEAR_SUBCATEGORY_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue placeholder="Okul türü seç" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content home-location-dropdown"
                    side="bottom"
                    avoidCollisions={false}
                  >
                    <SelectItem value={CLEAR_SUBCATEGORY_VALUE} className="select-item">
                      Okul türü seç
                    </SelectItem>
                    {subcategoryTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)} className="select-item">
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {showSchoolSubcategoryFilters &&
          selectedSubcategoryId === String(LISE_INSTITUTION_TYPE_ID) ? (
            <div className="category-filter-section">
              <CategoryFilterSectionTitle title="LİSE TÜRÜ" />
              <div className="category-filter-section-inputs">
                <Select
                  value={selectedHighSchoolType ? selectedHighSchoolType : CLEAR_HIGH_SCHOOL_TYPE_VALUE}
                  onValueChange={(value) =>
                    setSelectedHighSchoolType(value === CLEAR_HIGH_SCHOOL_TYPE_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue placeholder="Lise türü seç" />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content home-location-dropdown"
                    side="bottom"
                    avoidCollisions={false}
                  >
                    <SelectItem value={CLEAR_HIGH_SCHOOL_TYPE_VALUE} className="select-item">
                      Lise türü seç
                    </SelectItem>
                    {HIGH_SCHOOL_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.slug} value={option.slug} className="select-item">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {hasInstructorFeatureMode ? (
            <div className="category-filter-section">
              <CategoryFilterSectionTitle title="KATEGORİ" />
              <div className="category-filter-section-inputs">
                <Select
                  value={selectedCategory ? selectedCategory : CLEAR_INSTRUCTOR_CATEGORY_VALUE}
                  onValueChange={(value) =>
                    handleFilterChange({
                      category: value === CLEAR_INSTRUCTOR_CATEGORY_VALUE ? "" : value,
                    })
                  }
                  disabled={instructorCategoriesLoading}
                >
                  <SelectTrigger className="category-filter-select">
                    <SelectValue
                      placeholder={
                        instructorCategoriesLoading ? "Kategoriler yükleniyor..." : "Kategori Seçin"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    className="select-content home-location-dropdown"
                    side="bottom"
                    avoidCollisions={false}
                  >
                    <SelectItem value={CLEAR_INSTRUCTOR_CATEGORY_VALUE} className="select-item">
                      Tüm Kategoriler
                    </SelectItem>
                    {instructorCategories.map((category) => {
                      const slug = String(category.slug ?? "").trim();
                      if (!slug) return null;
                      return (
                        <SelectItem key={category.id} value={slug} className="select-item">
                          {category.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {instructorCategoriesError ? (
                  <p className="category-filter-section-empty">{instructorCategoriesError}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasInstructorFeatureMode && !usesInjectedAgePriceInstructorOrder ? (
            renderInstructorPriceFilterSection("default")
          ) : null}

          {hasDynamicFeatureMode || hasInstructorFeatureMode ? (
            <>
              {!isPatiliDostlarCategory &&
              !usesInjectedAgePriceInstructorOrder &&
              !showKursSinavaHazirlikInstitutionFilters &&
              !showSporInstitutionFilters &&
              !showSanatInstitutionFilters &&
              !showYabanciDilInstitutionFilters &&
              !showKisiselGelisimInstitutionFilters &&
              !showMeslekiEgitimInstitutionFilters &&
              !showOzelEgitimInstitutionFilters &&
              !showSurucuKursuInstitutionFilters
                ? renderStudentAgeFilterSection(hasInstructorFeatureMode ? "instructor" : "school")
                : null}
              {hasInstructorFeatureMode ? (
                <>
                  {instructorFieldsLoading ? (
                    <div className="category-filter-section">
                      <p className="category-filter-section-empty">Filtreler yükleniyor...</p>
                    </div>
                  ) : instructorFieldsError ? (
                    <div className="category-filter-section">
                      <p className="category-filter-section-empty">{instructorFieldsError}</p>
                    </div>
                  ) : (
                    instructorFields.map((field) => {
                      const fieldOrderKey = normalizeInstructorFilterOrderKey(field.name);
                      const wrapOrderedInstructorSpecialSections = (
                        section: ReactNode,
                        sectionKey: string,
                      ): ReactNode => {
                        if (section == null) return section;

                        if (isKursSinavaHazirlikInstructorCategory) {
                          if (fieldOrderKey === "kurs turleri") {
                            return (
                              <Fragment key={`kurs-slot-${sectionKey}`}>
                                {section}
                                {renderStudentAgeFilterSection("kurs-sinava-hazirlik")}
                              </Fragment>
                            );
                          }
                          if (fieldOrderKey === "hizmet yeri") {
                            return (
                              <Fragment key={`kurs-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("kurs-sinava-hazirlik")}
                              </Fragment>
                            );
                          }
                          return section;
                        }

                        if (isYabanciDilInstructorCategory) {
                          if (fieldOrderKey === "yabanci dil turleri") {
                            return (
                              <Fragment key={`yabanci-dil-slot-${sectionKey}`}>
                                {section}
                                {renderStudentAgeFilterSection("yabanci-dil")}
                              </Fragment>
                            );
                          }
                          if (fieldOrderKey === "hizmet yeri") {
                            return (
                              <Fragment key={`yabanci-dil-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("yabanci-dil")}
                              </Fragment>
                            );
                          }
                          return section;
                        }

                        if (isSanatInstructorCategory) {
                          if (fieldOrderKey === "sanat turleri") {
                            return (
                              <Fragment key={`sanat-slot-${sectionKey}`}>
                                {section}
                                {renderStudentAgeFilterSection("sanat")}
                              </Fragment>
                            );
                          }
                          if (fieldOrderKey === "hizmet yeri") {
                            return (
                              <Fragment key={`sanat-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("sanat")}
                              </Fragment>
                            );
                          }
                          return section;
                        }

                        if (isSporInstructorCategory) {
                          if (fieldOrderKey === "spor turleri") {
                            return (
                              <Fragment key={`spor-slot-${sectionKey}`}>
                                {section}
                                {renderStudentAgeFilterSection("spor")}
                              </Fragment>
                            );
                          }
                          if (fieldOrderKey === "hizmet yeri") {
                            return (
                              <Fragment key={`spor-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("spor")}
                              </Fragment>
                            );
                          }
                          return section;
                        }

                        if (isKisiselGelisimInstructorCategory) {
                          const kisiselOrderKey = normalizeKisiselGelisimFilterOrderKey(field.name);
                          if (kisiselOrderKey === "egitim turleri") {
                            return (
                              <Fragment key={`kisisel-gelisim-slot-${sectionKey}`}>
                                {section}
                                {renderStudentAgeFilterSection("kisisel-gelisim")}
                              </Fragment>
                            );
                          }
                          if (kisiselOrderKey === "hizmet yeri") {
                            return (
                              <Fragment key={`kisisel-gelisim-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("kisisel-gelisim")}
                              </Fragment>
                            );
                          }
                          return section;
                        }

                        if (isMeslekiEgitimInstructorCategory) {
                          const meslekiOrderKey = normalizeMeslekiEgitimFilterOrderKey(field.name);
                          if (meslekiOrderKey === "egitim turleri") {
                            return (
                              <Fragment key={`mesleki-egitim-slot-${sectionKey}`}>
                                {section}
                                {renderStudentAgeFilterSection("mesleki-egitim")}
                              </Fragment>
                            );
                          }
                          if (meslekiOrderKey === "hizmet yeri") {
                            return (
                              <Fragment key={`mesleki-egitim-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("mesleki-egitim")}
                              </Fragment>
                            );
                          }
                          return section;
                        }

                        if (isOzelEgitimInstructorCategory) {
                          const ozelOrderKey = normalizeOzelEgitimFilterOrderKey(field.name);
                          if (ozelOrderKey === "ozel egitim turleri") {
                            return (
                              <Fragment key={`ozel-egitim-slot-${sectionKey}`}>
                                {section}
                                {renderStudentAgeFilterSection("ozel-egitim")}
                              </Fragment>
                            );
                          }
                          if (ozelOrderKey === "hizmet yeri") {
                            return (
                              <Fragment key={`ozel-egitim-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("ozel-egitim")}
                              </Fragment>
                            );
                          }
                          return section;
                        }

                        if (isSurucuKursuInstructorCategory) {
                          const surucuOrderKey = normalizeSurucuKursuFilterOrderKey(field.name);
                          if (surucuOrderKey === "arac imkani") {
                            return (
                              <Fragment key={`surucu-kursu-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("surucu-kursu")}
                              </Fragment>
                            );
                          }
                        }

                        if (isPatiliDostlarInstructorCategory) {
                          const patiliOrderKey = normalizePatiliDostlarFilterOrderKey(field.name);
                          const shouldInjectPatiliPrice =
                            patiliOrderKey === "hizmet yeri" ||
                            (!patiliHasHizmetYeriField && patiliOrderKey === "hizmet tipi");
                          if (shouldInjectPatiliPrice) {
                            return (
                              <Fragment key={`patili-dostlar-slot-${sectionKey}`}>
                                {section}
                                {renderInstructorPriceFilterSection("patili-dostlar")}
                              </Fragment>
                            );
                          }
                        }

                        return section;
                      };

                      if (field.kind === "boolean_group") {
                        const isExpanded = expandedInstructorBooleanGroupIds.has(field.groupId);
                        const sortedOptions = sortCheckboxOptionsByLabel(
                          field.options,
                          (option) => option.name,
                        );
                        const visibleOptions = isExpanded
                          ? sortedOptions
                          : sortedOptions.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
                        const hasMore = sortedOptions.length > FEATURE_OPTIONS_VISIBLE_LIMIT;

                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-bool-group-${field.groupId}`}
                          >
                            <CategoryFilterSectionTitle title={field.name.toLocaleUpperCase("tr-TR")} />
                            <div className={checkboxListClassName(sortedOptions.length)}>
                              {visibleOptions.map((option) => {
                                const isChecked = Boolean(
                                  selectedInstructorBoolean[option.definitionId],
                                );
                                return (
                                  <label
                                    key={option.definitionId}
                                    className={`category-filter-checkbox-option${
                                      isChecked ? " category-filter-checkbox-option--selected" : ""
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleInstructorBoolean(option.definitionId)}
                                      className="category-filter-checkbox-input"
                                    />
                                    <span className="category-filter-checkbox-label">
                                      {option.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {hasMore ? (
                              <button
                                type="button"
                                className="category-filter-show-more"
                                onClick={() => toggleInstructorBooleanGroupExpanded(field.groupId)}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded
                                  ? "Daha Az Göster"
                                  : `Daha Fazla Göster (+${sortedOptions.length - FEATURE_OPTIONS_VISIBLE_LIMIT})`}
                              </button>
                            ) : null}
                          </div>,
                          `bool-group-${field.groupId}`,
                        );
                      }

                      if (field.kind === "boolean") {
                        const isChecked = Boolean(selectedInstructorBoolean[field.definitionId]);
                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-bool-${field.definitionId}`}
                          >
                            <CategoryFilterSectionTitle title={field.name.toLocaleUpperCase("tr-TR")} />
                            <div className={checkboxListClassName(1)}>
                              <label
                                className={`category-filter-checkbox-option${
                                  isChecked ? " category-filter-checkbox-option--selected" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleInstructorBoolean(field.definitionId)}
                                  className="category-filter-checkbox-input"
                                />
                                <span className="category-filter-checkbox-label">{field.name}</span>
                              </label>
                            </div>
                          </div>,
                          `bool-${field.definitionId}`,
                        );
                      }

                      if (field.kind === "single_select") {
                        const selectedValue = selectedCommonSingle[field.definitionId] ?? "";
                        const selectValue = selectedValue
                          ? String(selectedValue)
                          : CLEAR_SINGLE_SELECT_VALUE;
                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-single-${field.definitionId}`}
                          >
                            <CategoryFilterSectionTitle title={field.name.toLocaleUpperCase("tr-TR")} />
                            <div className="category-filter-section-inputs">
                              <Select
                                value={selectValue}
                                onValueChange={(value) =>
                                  setSelectedCommonSingle((prev) => ({
                                    ...prev,
                                    [field.definitionId]:
                                      value === CLEAR_SINGLE_SELECT_VALUE ? "" : value,
                                  }))
                                }
                              >
                                <SelectTrigger className="category-filter-select">
                                  <SelectValue placeholder={field.placeholder} />
                                </SelectTrigger>
                                <SelectContent
                                  className="select-content home-location-dropdown"
                                  side="bottom"
                                  avoidCollisions={false}
                                >
                                  <SelectItem
                                    value={CLEAR_SINGLE_SELECT_VALUE}
                                    className="select-item"
                                  >
                                    Tümü
                                  </SelectItem>
                                  {field.choices.map((choice) => (
                                    <SelectItem
                                      key={choice.id}
                                      value={String(choice.id)}
                                      className="select-item"
                                    >
                                      {choice.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>,
                          `single-${field.definitionId}`,
                        );
                      }

                      if (field.kind === "student_age_range" || isStudentAgeCommonField(field)) {
                        return null;
                      }

                      if (field.kind === "multi_select") {
                        const selectedSet =
                          selectedCommonMulti[field.definitionId] ?? new Set<string>();
                        const isExpanded = expandedInstructorMultiIds.has(field.definitionId);
                        const sortedChoices = sortCheckboxOptionsByLabel(
                          field.choices,
                          (choice) => choice.name,
                        );
                        const visibleChoices = isExpanded
                          ? sortedChoices
                          : sortedChoices.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
                        const hasMore = sortedChoices.length > FEATURE_OPTIONS_VISIBLE_LIMIT;
                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-multi-${field.definitionId}`}
                          >
                            <CategoryFilterSectionTitle title={field.name.toLocaleUpperCase("tr-TR")} />
                            <div className={checkboxListClassName(sortedChoices.length)}>
                              {visibleChoices.map((choice) => {
                                const key = String(choice.id);
                                const isChecked = selectedSet.has(key);
                                return (
                                  <label
                                    key={choice.id}
                                    className={`category-filter-checkbox-option${
                                      isChecked ? " category-filter-checkbox-option--selected" : ""
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() =>
                                        toggleInstructorMulti(field.definitionId, choice.id)
                                      }
                                      className="category-filter-checkbox-input"
                                    />
                                    <span className="category-filter-checkbox-label">
                                      {choice.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {hasMore ? (
                              <button
                                type="button"
                                className="category-filter-show-more"
                                onClick={() => toggleInstructorMultiExpanded(field.definitionId)}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded
                                  ? "Daha Az Göster"
                                  : `Daha Fazla Göster (+${sortedChoices.length - FEATURE_OPTIONS_VISIBLE_LIMIT})`}
                              </button>
                            ) : null}
                          </div>,
                          `multi-${field.definitionId}`,
                        );
                      }

                      const value = selectedCommonRange[field.definitionId] ?? { min: "", max: "" };
                      return wrapOrderedInstructorSpecialSections(
                        <div
                          className="category-filter-section"
                          key={`instructor-number-${field.definitionId}`}
                        >
                          <CategoryFilterSectionTitle title={field.name.toLocaleUpperCase("tr-TR")} />
                          <div className="category-filter-price-inputs">
                            <Input
                              type="number"
                              value={value.min}
                              onChange={(e) =>
                                setInstructorRange(field.definitionId, "min", e.target.value)
                              }
                              placeholder="Min"
                              min="0"
                              className="category-filter-price-input"
                            />
                            <span className="category-filter-price-separator">-</span>
                            <Input
                              type="number"
                              value={value.max}
                              onChange={(e) =>
                                setInstructorRange(field.definitionId, "max", e.target.value)
                              }
                              placeholder="Max"
                              min="0"
                              className="category-filter-price-input"
                            />
                          </div>
                        </div>,
                        `number-${field.definitionId}`,
                      );
                    })
                  )}
                </>
              ) : null}

              {showSchoolSubcategoryFilters
                ? schoolOrderedDynamicSections.map((section) =>
                    section.kind === "common"
                      ? renderInstitutionCommonField(
                          section.field,
                          getOkulInstitutionFilterSectionTitle(section.field.name),
                        )
                      : renderInstitutionFeatureGroup(
                          section.group,
                          getOkulInstitutionFilterSectionTitle(section.group.name),
                        ),
                  )
                : showKursSinavaHazirlikInstitutionFilters
                  ? kursOrderedDynamicSections.map((section) => {
                      if (section.kind === "student_age") {
                        return renderStudentAgeFilterSection("kurs-sinava-hazirlik");
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getKursSinavaHazirlikInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getKursSinavaHazirlikInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showSporInstitutionFilters
                  ? sporOrderedDynamicSections.map((section) => {
                      if (section.kind === "student_age") {
                        return renderStudentAgeFilterSection("spor");
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getSporInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getSporInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showSanatInstitutionFilters
                  ? sanatOrderedDynamicSections.map((section) => {
                      if (section.kind === "student_age") {
                        return renderStudentAgeFilterSection("sanat");
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getSanatInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getSanatInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showYabanciDilInstitutionFilters
                  ? yabanciDilOrderedDynamicSections.map((section) => {
                      if (section.kind === "student_age") {
                        return renderStudentAgeFilterSection("yabanci-dil");
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getYabanciDilInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getYabanciDilInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showKisiselGelisimInstitutionFilters
                  ? kisiselGelisimOrderedDynamicSections.map((section) => {
                      if (section.kind === "student_age") {
                        return renderStudentAgeFilterSection("kisisel-gelisim");
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getKisiselGelisimInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getKisiselGelisimInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showMeslekiEgitimInstitutionFilters
                  ? meslekiEgitimOrderedDynamicSections.map((section) => {
                      if (section.kind === "student_age") {
                        return renderStudentAgeFilterSection("mesleki-egitim");
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getMeslekiEgitimInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getMeslekiEgitimInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showOzelEgitimInstitutionFilters
                  ? ozelEgitimOrderedDynamicSections.map((section) => {
                      if (section.kind === "student_age") {
                        return renderStudentAgeFilterSection("ozel-egitim");
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getOzelEgitimInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getOzelEgitimInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showSurucuKursuInstitutionFilters
                  ? surucuKursuOrderedDynamicSections.map((section) => {
                      if (section.kind === "belge_turleri") {
                        return renderSurucuKursuBelgeTurleriSection(section.group);
                      }
                      if (section.kind === "common") {
                        return renderInstitutionCommonField(
                          section.field,
                          getSurucuKursuInstitutionFilterSectionTitle(section.field.name),
                        );
                      }
                      return renderInstitutionFeatureGroup(
                        section.group,
                        getSurucuKursuInstitutionFilterSectionTitle(section.group.name),
                      );
                    })
                : showPatiliDostlarInstitutionFilters
                  ? patiliDostlarOrderedDynamicSections.map((section) => {
                      if (section.kind === "group") {
                        return renderInstitutionFeatureGroup(
                          section.group,
                          getPatiliDostlarInstitutionFilterSectionTitle(section.group.name),
                        );
                      }
                      const field = section.field;
                      const title = getPatiliDostlarInstitutionFilterSectionTitle(field.name);
                      if (
                        field.kind === "multi_select" &&
                        isInstitutionPriceRangeFieldName(field.name)
                      ) {
                        const sliderValue = patiliPriceSliderRange[field.definitionId] ?? null;
                        return (
                          <div
                            className="category-filter-section"
                            key={`patili-baslica-${field.definitionId}`}
                          >
                            <CategoryFilterSectionTitle title={title} />
                            <PriceRangeSliderFilter
                              value={sliderValue}
                              onChange={(nextRange) =>
                                setPatiliPriceRange(field.definitionId, field.choices, nextRange)
                              }
                              className="category-filter-price-slider"
                            />
                          </div>
                        );
                      }
                      return renderInstitutionCommonField(field, title);
                    })
                : hasDynamicFeatureMode && usesGlobalBaslicaCommonFields
                  ? commonFields.map((field) =>
                      renderInstitutionCommonField(
                        field,
                        field.name.toLocaleUpperCase("tr-TR"),
                      ),
                    )
                  : null}

              {hasDynamicFeatureMode ? (
                featureGroupsLoading ? (
                <div className="category-filter-section">
                  <p className="category-filter-section-empty">Filtreler yükleniyor...</p>
                </div>
              ) : featureGroupsError ? (
                <div className="category-filter-section">
                  <p className="category-filter-section-empty">{featureGroupsError}</p>
                </div>
              ) : showSchoolSubcategoryFilters ||
                showKursSinavaHazirlikInstitutionFilters ||
                showSporInstitutionFilters ||
                showSanatInstitutionFilters ||
                showYabanciDilInstitutionFilters ||
                showKisiselGelisimInstitutionFilters ||
                showMeslekiEgitimInstitutionFilters ||
                showOzelEgitimInstitutionFilters ||
                showSurucuKursuInstitutionFilters ||
                showPatiliDostlarInstitutionFilters ||
                renderedFeatureGroups.length === 0 ? null : (
                renderedFeatureGroups.map((group) =>
                  renderInstitutionFeatureGroup(group, group.name.toLocaleUpperCase("tr-TR")),
                )
              )
              ) : null}
            </>
          ) : (
            <>
              <div className="category-filter-section">
                <CategoryFilterSectionTitle title="KATEGORİLER" />
                <div className="category-filter-section-options">
                  {categories.map((cat) => (
                    <label
                      key={cat.value}
                      className={`category-filter-radio-option ${selectedCategory === cat.value ? 'category-filter-radio-option--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={selectedCategory === cat.value}
                        onChange={(e) => handleFilterChange({ category: e.target.value })}
                        className="category-filter-radio-input"
                      />
                      <span className="category-filter-radio-label">{cat.label}</span>
                      <span className="category-filter-radio-count">{cat.count}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="category-filter-section">
                <CategoryFilterSectionTitle title="AYLIK FİYAT ARALIĞI" />
                <PriceRangeSliderFilter
                  value={priceRange}
                  onChange={(nextRange) => handleFilterChange({ priceRange: nextRange })}
                  className="category-filter-price-slider"
                />
              </div>
            </>
          )}

          {showLoginHint ? (
            <p className="category-filter-login-hint" role="note">
              Daha fazla filtreleme yapmak için lütfen giriş yapınız.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export default function CategoryFilterSidebar({
  config,
  onFilterChange,
  categorySlug,
  filterSchemaSource = "institution",
  mapMarkers,
  mapLoading,
}: CategoryFilterSidebarProps) {
  const schoolCtxModel = useContext(SchoolCategoryFilterPanelContext);
  const instructorCtxModel = useContext(InstructorCategoryFilterPanelContext);
  const fallbackModel = useCategoryFilterSidebarModel({
    enabled: schoolCtxModel == null && instructorCtxModel == null,
    config,
    onFilterChange,
    categorySlug,
    filterSchemaSource,
  });
  const model = instructorCtxModel ?? schoolCtxModel ?? fallbackModel;
  return (
    <CategoryFilterSidebarView
      model={model}
      mapMarkers={mapMarkers}
      mapLoading={mapLoading}
    />
  );
}

/**
 * Sonuç alanında, kategoriye özel paylaşımlı filtre modeli aktifken görünür
 * olan "Filtreleri Sıfırla" butonu. Tıklandığında tüm filtre state'i default
 * haline döner ve sonuçlar filtrelenmemiş şekilde listelenir.
 */
export function CategoryFilterResetButton() {
  const ctxModel = useContext(SchoolCategoryFilterPanelContext);
  if (!ctxModel) return null;
  if (!ctxModel.hasActiveFilters) return null;
  return (
    <div className="category-results-reset">
      <button
        type="button"
        className="category-results-reset-btn"
        onClick={ctxModel.resetAll}
        aria-label="Tüm filtreleri sıfırla"
      >
        <RotateCcw size={16} aria-hidden="true" />
        <span>Filtreleri Sıfırla</span>
      </button>
    </div>
  );
}
