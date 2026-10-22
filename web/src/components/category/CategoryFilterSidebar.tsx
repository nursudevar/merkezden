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
  ChevronDown,
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
import { InstructorCategorySelect } from "@/components/category/InstructorCategorySelect";
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
  PriceRangeSliderFilter,
  type PriceRangeSliderValue,
} from "@/components/filters/PriceRangeSliderFilter";
import { AgeRangeSliderFilter } from "@/components/filters/AgeRangeSliderFilter";
import { FilterNumericStepper } from "@/components/filters/FilterNumericStepper";
import { WorkingHoursTimePicker } from "@/app/panel/WorkingHoursTimePicker";
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
  INSTRUCTOR_DERS_SEVIYESI_LABEL,
  INSTRUCTOR_HIZMET_YERI_LABEL,
  type InstructorFeatureCategoryRow,
  type InstructorFeatureChoiceRow,
  type InstructorFeatureDefinitionRow,
  type InstructorFeatureGroupRow,
  type InstructorFilterField,
} from "@/lib/instructorFeaturesClient";
import {
  LESSON_DURATION_MAX_INPUT_LABEL,
  LESSON_DURATION_MIN_INPUT_LABEL,
  LESSON_DURATION_UNIT_LABEL,
  sanitizeLessonDurationInput,
} from "@/lib/instructorLessonDurationFeature";
import { InstitutionMapSearchSection } from "@/components/map/InstitutionMapSearchSection";
import type { InstitutionMapMarker } from "@/lib/institutionMapMarkers";
import { CategoryFilterMultiSelect } from "./CategoryFilterMultiSelect";
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
  /**
   * Desktop aside + mobile drawer aynı anda mount edildiğinde input id çakışmasını önler.
   * Örn. `"desktop"` | `"drawer"`.
   */
  instanceId?: string;
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
/** Kolon-based Eğitim Saatleri filtre section order adı (feature değil). */
const WORKING_HOURS_FILTER_ORDER_NAME = "Eğitim Saatleri";
/** Kolon-based Aylık Fiyat Aralığı filtre section order adı (feature değil). */
const PRICE_RANGE_FILTER_ORDER_NAME = "Aylık Fiyat Aralığı";
const PATILI_DOSTLAR_CATEGORY_SLUG = "patili-dostlar";
/** Global eğitmen tanımı: Ücretsiz Deneme Dersi (`ucretsiz-deneme-dersi`). */
const INSTRUCTOR_DENEME_DERSI_DEFINITION_ID = 16;
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
  "egitim ozellikleri",
  "hizmet yeri",
  "egitmen profili",
  "egitim dili",
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
  "ders suresi",
  "deneme dersi mevcuttur",
  "fiziki imkanlar",
  "musait saat baslangic",
  "musait saat bitis",
  "musait saat baslangic bitis",
]);


const PATILI_DOSTLAR_INSTRUCTOR_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);


/** Eğitmen public filtre — yalnızca Kurs & Sınava Hazırlık. Yaş ve fiyat Özel Ders Türleri ardına enjekte edilir. */
const KURS_SINAVA_HAZIRLIK_INSTRUCTOR_FILTER_ORDER = [
  "ozel ders turleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

/** Bu kategoride hedef sırada olmayan / UI'da gösterilmeyen Başlıca alanlar. */
const KURS_SINAVA_HAZIRLIK_HIDDEN_FILTER_NAMES = new Set<string>([
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "egitmenin seviyesi",
]);

const KURS_SINAVA_HAZIRLIK_INSTRUCTOR_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

/** Eğitmen public filtre — yalnızca Yabancı Dil. Yaş ve fiyat Yabancı Dil Türleri ardına enjekte edilir. */
const YABANCI_DIL_INSTRUCTOR_FILTER_ORDER = [
  "yabanci dil turleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const YABANCI_DIL_INSTRUCTOR_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

const YABANCI_DIL_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "egitmenin seviyesi",
]);

/** Eğitmen public filtre — yalnızca Sanat. Yaş ve fiyat Sanat Türleri ardına enjekte edilir. */
const SANAT_INSTRUCTOR_FILTER_ORDER = [
  "sanat turleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const SANAT_INSTRUCTOR_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

const SANAT_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "egitmenin seviyesi",
]);

/** Eğitmen public filtre — yalnızca Spor. Yaş ve fiyat Spor Türleri ardına enjekte edilir. */
const SPOR_INSTRUCTOR_FILTER_ORDER = [
  "spor turleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const SPOR_INSTRUCTOR_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

const SPOR_HIDDEN_FILTER_NAMES = new Set(["ogrencinin egitim seviyesi"]);

/** Eğitmen public filtre — yalnızca Kişisel Gelişim şema alan sırası (yaş/fiyat/saat ayrı section). */
const KISISEL_GELISIM_INSTRUCTOR_FILTER_ORDER = [
  "egitim turleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const KISISEL_GELISIM_INSTRUCTOR_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

const KISISEL_GELISIM_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "egitmenin seviyesi",
]);

/** Eğitmen public filtre — yalnızca Mesleki Eğitim. Yaş ve fiyat Eğitim Türleri ardına enjekte edilir. */
const MESLEKI_EGITIM_INSTRUCTOR_FILTER_ORDER = [
  "egitim turleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const MESLEKI_EGITIM_INSTRUCTOR_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

const MESLEKI_EGITIM_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "egitmenin seviyesi",
]);

/** Eğitmen /egitmenler — yalnız Özel Eğitim. Yaş, fiyat ve saat ayrı section olarak enjekte edilir. */
const OZEL_EGITIM_INSTRUCTOR_FILTER_ORDER = [
  "ozel egitim turleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const OZEL_EGITIM_COLLAPSED_INSTRUCTOR_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

const OZEL_EGITIM_INSTRUCTOR_FILTER_ORDER_KEYS = new Set<string>(
  OZEL_EGITIM_INSTRUCTOR_FILTER_ORDER,
);

const OZEL_EGITIM_HIDDEN_FILTER_NAMES = new Set(["ders seviyesi"]);

/** Eğitmen Sürücü Kursu filtresi. Kategori alanından sonraki sıra. */
const SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER = [
  "egitim turleri",
  "arac tipleri",
  "hizmet tipi",
  "hedef fayda",
  "egitim ozellikleri",
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "egitmen profili",
  "egitim dili",
  "deneme dersi mevcuttur",
  "odeme secenekleri",
] as const;

const SURUCU_KURSU_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hizmet yeri",
  "ders seviyesi",
  "ders suresi",
  "musait saat araligi",
  "egitmen profili",
  "egitim dili",
  "odeme secenekleri",
]);

const SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER_KEYS = new Set<string>(
  SURUCU_KURSU_INSTRUCTOR_FILTER_ORDER,
);

const SURUCU_KURSU_HIDDEN_FILTER_NAMES = new Set([
  "ogrencinin egitim seviyesi",
  "egitim seviyesi",
  "kurs ozellikleri",
  "surucu kursu ozellikleri",
  "surucu kursu imkanlari",
  "belge turleri",
  "belge turu",
  "fiziki imkanlar",
  "fiziksel imkanlar",
  "odeme yontemleri",
  "arac imkani",
  "arac imkanlari",
  "hizmet turleri",
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
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "egitim ozellikleri" || key === "kurs ozellikleri") return "egitim ozellikleri";
  if (key === "egitmen profili") return "egitmen profili";
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
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "egitim ozellikleri") return "egitim ozellikleri";
  if (key === "egitmen profili") return "egitmen profili";
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
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "egitim ozellikleri" || key === "kurs ozellikleri") return "egitim ozellikleri";
  return key;
}

/** Eğitmen Sürücü Kursu filtre anahtarı. Eski grup adları yeni başlıklara bağlanmaz. */
function normalizeSurucuKursuFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "egitim turleri" || key === "surucu kursu egitim turleri") return "egitim turleri";
  if (key === "egitim ozellikleri") return "egitim ozellikleri";
  if (
    key === "arac tipleri" ||
    key === "arac tipi" ||
    (key.includes("arac") && key.includes("tip"))
  ) {
    return "arac tipleri";
  }
  if (key === "odeme secenekleri") return "odeme secenekleri";
  return key;
}

function normalizeInstructorFilterOrderKey(name: string): string {
  const key = name
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
  if (
    key === "deneme dersi mevcuttur" ||
    key === "deneme dersi" ||
    key === "ucretsiz deneme dersi" ||
    key === "ucretsiz deneme dersi var" ||
    (key.includes("deneme") && key.includes("ders"))
  ) {
    return "deneme dersi mevcuttur";
  }
  return key;
}

function normalizeKursSinavaHazirlikInstructorFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (key === "ozel ders turleri" || key === "kurs turleri") return "ozel ders turleri";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "kurs ozellikleri" || key === "egitim ozellikleri") return "egitim ozellikleri";
  if (key === "egitmen profili") return "egitmen profili";
  return key;
}

function getKursSinavaHazirlikInstructorFilterSectionTitle(name: string): string {
  const key = normalizeKursSinavaHazirlikInstructorFilterOrderKey(name);
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  if (key === "hedef fayda") return "HEDEF / FAYDA";
  if (key === "odeme secenekleri") return "ÖDEME SEÇENEKLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

function orderKursSinavaHazirlikInstructorFields(
  fields: InstructorFilterField[],
): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    KURS_SINAVA_HAZIRLIK_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeKursSinavaHazirlikInstructorFilterOrderKey(field.name);
    return !KURS_SINAVA_HAZIRLIK_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeKursSinavaHazirlikInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeKursSinavaHazirlikInstructorFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function normalizeYabanciDilInstructorFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (
    key === "yabanci dil turleri" ||
    key === "yabanci dil kurs turleri" ||
    key === "dil turleri"
  ) {
    return "yabanci dil turleri";
  }
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "egitim ozellikleri") return "egitim ozellikleri";
  if (key === "egitmen profili") return "egitmen profili";
  return key;
}

function orderYabanciDilInstructorFields(
  fields: InstructorFilterField[],
): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    YABANCI_DIL_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeYabanciDilInstructorFilterOrderKey(field.name);
    return !YABANCI_DIL_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeYabanciDilInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeYabanciDilInstructorFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function normalizeSanatInstructorFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (key === "sanat turleri" || key === "sanat turu") return "sanat turleri";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "egitim ozellikleri") return "egitim ozellikleri";
  if (key === "egitmen profili") return "egitmen profili";
  return key;
}

function orderSanatInstructorFields(fields: InstructorFilterField[]): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    SANAT_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeSanatInstructorFilterOrderKey(field.name);
    return !SANAT_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeSanatInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeSanatInstructorFilterOrderKey(b.name));
    const aRank = aIndex ?? Number.MAX_SAFE_INTEGER;
    const bRank = bIndex ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
  });
}

function normalizeSporInstructorFilterOrderKey(name: string): string {
  const key = normalizeInstructorFilterOrderKey(name);
  if (
    key === "spor turleri" ||
    key === "spor turu" ||
    (key.includes("spor") && key.includes("tur") && !key.includes("tesis"))
  ) {
    return "spor turleri";
  }
  if (key.includes("hedef") && key.includes("fayda")) return "hedef fayda";
  if (key === "egitim ozellikleri") return "egitim ozellikleri";
  if (key === "egitmen profili") return "egitmen profili";
  return key;
}

function orderSporInstructorFields(fields: InstructorFilterField[]): InstructorFilterField[] {
  const orderIndex = new Map<string, number>(
    SPOR_INSTRUCTOR_FILTER_ORDER.map((key, index) => [key, index]),
  );

  const filtered = fields.filter((field) => {
    if (field.kind === "student_age_range") return false;
    const key = normalizeSporInstructorFilterOrderKey(field.name);
    return !SPOR_HIDDEN_FILTER_NAMES.has(key);
  });

  return [...filtered].sort((a, b) => {
    const aIndex = orderIndex.get(normalizeSporInstructorFilterOrderKey(a.name));
    const bIndex = orderIndex.get(normalizeSporInstructorFilterOrderKey(b.name));
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
    if (OZEL_EGITIM_HIDDEN_FILTER_NAMES.has(key)) return false;
    return OZEL_EGITIM_INSTRUCTOR_FILTER_ORDER_KEYS.has(key);
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

function buildPatiliBaslicaCommonField(
  def: FeatureDefinitionRow,
  choicesByDefinition: Map<number, FeatureChoiceRow[]>,
): CommonField | null {
  const displayName = getDisplayFeatureName(def.name ?? "");
  const inputType = String(def.input_type ?? "").trim().toLowerCase();
  const defChoices = (choicesByDefinition.get(def.id) ?? [])
    .map((c) => ({ id: c.id, name: String(c.name ?? "").trim() }))
    .filter((c) => Boolean(c.name));
  const orderedChoices = defChoices;

  {
    const priceKey = normalizeCommonFieldNameKey(displayName);
    if (
      priceKey.includes("aylik fiyat araligi") ||
      priceKey.includes("aylik ortalama fiyat") ||
      priceKey === "fiyat araligi" ||
      priceKey.includes("ortalama fiyat araligi")
    ) {
      return null;
    }
  }

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
const CLEAR_SINGLE_SELECT_VALUE = "__clear__";

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
  "musait saat araligi": Clock3,
  "kurum saatleri": Clock3,
  "okul saatleri": Clock3,
  "calisma saatleri": Clock3,
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
  "ozel ders turleri": Book,
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
  "hedef / fayda": Target,
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
  "ders suresi": Timer,
  "ders verme sikligi": Repeat,
  "egitim seviyesi": GraduationCap,
  "ogrencinin egitim seviyesi": School,
  "ders seviyesi": BarChart3,
  "deneme dersi mevcuttur": Gift,
  "deneme dersi": Gift,
  "deneme dersi var": Gift,
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

function CategoryFilterCollapse({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = getCategoryFilterSectionIcon(title);

  return (
    <div
      className={`category-filter-collapse${open ? " category-filter-collapse--open" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <button
        type="button"
        className="category-filter-collapse__header"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="category-filter-collapse__title">
          <Icon className="category-filter-collapse__title-icon" size={20} aria-hidden />
          <span>{title}</span>
        </span>
        <ChevronDown className="category-filter-collapse__chevron" size={18} aria-hidden />
      </button>
      <div className="category-filter-collapse__content" hidden={!open}>
        {children}
      </div>
    </div>
  );
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

function isStudentAgeCommonField(field: { kind: string }): boolean {
  return field.kind === "student_age_range";
}

/** Ortak Başlıca “Yabancı Diller” — Dil Türleri / Yabancı Dil Türleri hariç. */
function isHiddenYabanciDillerInstitutionFilter(name: string): boolean {
  const key = normalizeCommonFieldNameKey(name);
  if (!key || key.includes("tur")) return false;
  return key === "yabanci diller";
}

const OKUL_INSTITUTION_FILTER_ORDER = [
  "egitim saatleri",
  "ogrenci yasi",
  "yabanci dil",
  "aylik fiyat araligi",
  "egitim sistemi",
  "aktivite",
  "fiziki imkanlar",
  "hedef/fayda",
  "okul imkanlari",
  "sinif mevcudu",
  "egitim dili",
  "kurum turu",
  "hizmet tipi",
  "odeme secenekleri",
] as const;

const OKUL_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  OKUL_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

/** Okul kurum filtresi — başlangıçta kapalı sekmeler. */
const OKUL_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "hedef/fayda",
  "okul imkanlari",
  "sinif mevcudu",
  "egitim dili",
  "kurum turu",
  "hizmet tipi",
  "odeme secenekleri",
]);

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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key.includes("okul imkan")) return "okul imkanlari";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  if (key === "ogrenci yasi") return "ogrenci yasi";
  return key;
}

function getOkulInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeOkulInstitutionFilterOrderKey(name);
  if (key === "aktivite") return "AKTİVİTELER";
  if (key === "hedef/fayda") return "HEDEF/FAYDA";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  return name.toLocaleUpperCase("tr-TR");
}

type OkulDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getOkulSectionOrderName(section: OkulDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
}

function orderOkulInstitutionFilterSections(
  sections: OkulDynamicFilterSection[],
): OkulDynamicFilterSection[] {
  return [...sections].sort((a, b) => {
    const aRank =
      OKUL_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeOkulInstitutionFilterOrderKey(getOkulSectionOrderName(a)),
      ) ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      OKUL_INSTITUTION_FILTER_ORDER_INDEX.get(
        normalizeOkulInstitutionFilterOrderKey(getOkulSectionOrderName(b)),
      ) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.originalIndex - b.originalIndex;
  });
}

const KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER = [
  "kurs turleri",
  "ogrenci yasi",
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  KURS_SINAVA_HAZIRLIK_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

/** Kurs kurum filtresi — başlangıçta kapalı sekmeler. */
const KURS_SINAVA_HAZIRLIK_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
]);

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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "kurs ozellikleri" || key === "egitim ozellikleri") return "egitim ozellikleri";
  return key;
}

function getKursSinavaHazirlikInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeKursSinavaHazirlikInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "hedef/fayda") return "HEDEF / FAYDA";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type KursSinavaHazirlikDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getKursSinavaHazirlikSectionOrderName(section: KursSinavaHazirlikDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
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
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "tesis turu",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const SPOR_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "tesis turu",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
]);

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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
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
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getSporSectionOrderName(section: SporDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
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
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const SANAT_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  SANAT_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

/** Sanat kurum filtresi — başlangıçta kapalı sekmeler. */
const SANAT_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
]);

function normalizeSanatInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  if (key === "sanat turu" || key === "sanat turleri") return "sanat turleri";
  if (key === "kurs ozellikleri" || key === "egitim ozellikleri") return "egitim ozellikleri";
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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
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
  if (key === "hedef/fayda") return "HEDEF/FAYDA";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type SanatDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getSanatSectionOrderName(section: SanatDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
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
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const YABANCI_DIL_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  YABANCI_DIL_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

/** Yabancı Dil kurum filtresi — başlangıçta kapalı sekmeler. */
const YABANCI_DIL_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
]);

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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  if (key === "kurs ozellikleri" || key === "egitim ozellikleri") return "egitim ozellikleri";
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
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getYabanciDilSectionOrderName(section: YabanciDilDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
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
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "kurum turu",
  "egitim dili",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const KISISEL_GELISIM_COLLAPSED_FILTER_KEYS = new Set<string>([
  "fiziki imkanlar",
  "kurum turu",
  "egitim dili",
  "sinif mevcudu",
  "odeme secenekleri",
]);

const KISISEL_GELISIM_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  KISISEL_GELISIM_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

function normalizeKisiselGelisimInstitutionFilterOrderKey(name: string): string {
  const key = normalizeCommonFieldNameKey(name);
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
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
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getKisiselGelisimSectionOrderName(section: KisiselGelisimDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
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
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const MESLEKI_EGITIM_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  MESLEKI_EGITIM_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

/** Mesleki Eğitim kurum filtresi — başlangıçta kapalı sekmeler. */
const MESLEKI_EGITIM_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
]);

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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "kurs ozellikleri") return "egitim ozellikleri";
  if (key === "mesleki egitim turleri" || key === "egitim turleri") return "egitim turleri";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  return key;
}

function getMeslekiEgitimInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeMeslekiEgitimInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  if (key === "egitim turleri") return "MESLEKİ EĞİTİM TÜRLERİ";
  if (key === "hedef/fayda") return "HEDEF / FAYDA";
  return name.toLocaleUpperCase("tr-TR");
}

type MeslekiEgitimDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getMeslekiEgitimSectionOrderName(section: MeslekiEgitimDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
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
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
] as const;

const OZEL_EGITIM_COLLAPSED_FILTER_KEYS = new Set<string>([
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme secenekleri",
]);

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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "kurs ozellikleri") return "egitim ozellikleri";
  if (key === "ozel egitim turleri") return "ozel egitim turleri";
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
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
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getOzelEgitimSectionOrderName(section: OzelEgitimDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "group") return section.group.name;
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
  return WORKING_HOURS_FILTER_ORDER_NAME;
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
  "egitim turleri",
  "ogrenci yasi",
  "egitim saatleri",
  "hizmet tipi",
  "aylik fiyat araligi",
  "hedef/fayda",
  "egitim ozellikleri",
  "arac imkanlari",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme yontemleri",
] as const;

const SURUCU_KURSU_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  SURUCU_KURSU_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

/** Sürücü Kursu kurum filtresi — başlangıçta kapalı sekmeler. */
const SURUCU_KURSU_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "arac imkanlari",
  "fiziki imkanlar",
  "egitim dili",
  "kurum turu",
  "sinif mevcudu",
  "odeme yontemleri",
]);

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
  if (
    key === "calisma saatleri" ||
    key === "okul saatleri" ||
    key === "kurum saatleri" ||
    key === "egitim saatleri"
  ) {
    return "egitim saatleri";
  }
  if (key === "fiziksel imkanlar" || (key.includes("fizik") && key.includes("imkan"))) {
    return "fiziki imkanlar";
  }
  if (key.includes("hedef") && key.includes("fayda")) return "hedef/fayda";
  if (key === "egitim ozellikleri" || key === "kurs ozellikleri") return "egitim ozellikleri";
  if (key === "egitim turleri" || key === "egitim turu") return "egitim turleri";
  if (
    key === "arac imkanlari" ||
    key === "arac imkani" ||
    (key.includes("arac") && key.includes("imkan"))
  ) {
    return "arac imkanlari";
  }
  if (key === "egitim dili") return "egitim dili";
  if (key === "ogrenci yasi") return "ogrenci yasi";
  if (key === "belge turleri" || key === "belge turu") return "belge turleri";
  return key;
}

function getSurucuKursuInstitutionFilterSectionTitle(name: string): string {
  const key = normalizeSurucuKursuInstitutionFilterOrderKey(name);
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "sinif mevcudu") return "SINIF MEVCUDU";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  if (key === "egitim turleri") return "EĞİTİM TÜRLERİ";
  if (key === "hedef/fayda") return "HEDEF/FAYDA";
  if (key === "arac imkanlari") return "ARAÇ İMKANLARI";
  if (key === "egitim dili") return "EĞİTİM DİLİ";
  if (key === "ogrenci yasi") return "ÖĞRENCİ YAŞI";
  if (key === "fiziki imkanlar") return "FİZİKİ İMKANLAR";
  if (key === "kurum turu") return "KURUM TÜRÜ";
  if (key === "odeme yontemleri") return "ÖDEME YÖNTEMLERİ";
  if (key === "belge turleri") return "BELGE TÜRLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type SurucuKursuDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "belge_turleri"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "student_age"; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getSurucuKursuSectionOrderName(section: SurucuKursuDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "belge_turleri") return "Belge Türleri";
  if (section.kind === "student_age") return STUDENT_AGE_RANGE_LABEL;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
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
  "egitim saatleri",
  "aylik fiyat araligi",
  "egitim ozellikleri",
  "fiziki imkanlar",
  "egitim dili",
  "odeme secenekleri",
] as const;

const PATILI_DOSTLAR_INSTITUTION_FILTER_ORDER_INDEX = new Map<string, number>(
  PATILI_DOSTLAR_INSTITUTION_FILTER_ORDER.map((key, index) => [key, index]),
);

/** Patili Dostlar kurum filtresi — başlangıçta kapalı sekmeler. */
const PATILI_DOSTLAR_INSTITUTION_COLLAPSED_FILTER_KEYS = new Set<string>([
  "fiziki imkanlar",
  "egitim dili",
  "odeme secenekleri",
]);

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
  if (key === "egitim ozellikleri") return "egitim ozellikleri";
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
  if (key === "ogrenci yasi") return true;
  return isHiddenYabanciDillerInstitutionFilter(name);
}

function getPatiliDostlarInstitutionFilterSectionTitle(name: string): string {
  const key = normalizePatiliDostlarInstitutionFilterOrderKey(name);
  if (key === "evcil hayvan turu") return "EVCİL HAYVAN TÜRÜ";
  if (key === "hizmet tipi") return "HİZMET TİPİ";
  if (key === "aylik fiyat araligi") return "AYLIK FİYAT ARALIĞI";
  if (key === "egitim saatleri") return "EĞİTİM SAATLERİ";
  if (key === "egitim ozellikleri") return "EĞİTİM ÖZELLİKLERİ";
  if (key === "egitim dili") return "EĞİTİM DİLİ";
  if (key === "odeme secenekleri") return "ÖDEME SEÇENEKLERİ";
  return name.toLocaleUpperCase("tr-TR");
}

type PatiliDostlarDynamicFilterSection =
  | { kind: "common"; field: CommonField; originalIndex: number }
  | { kind: "group"; group: FeatureFilterGroup; originalIndex: number }
  | { kind: "working_hours"; originalIndex: number }
  | { kind: "price_range"; originalIndex: number };

function getPatiliDostlarSectionOrderName(section: PatiliDostlarDynamicFilterSection): string {
  if (section.kind === "common") return section.field.name;
  if (section.kind === "working_hours") return WORKING_HOURS_FILTER_ORDER_NAME;
  if (section.kind === "price_range") return PRICE_RANGE_FILTER_ORDER_NAME;
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
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<Set<string>>(new Set());
  const [selectedHighSchoolTypes, setSelectedHighSchoolTypes] = useState<Set<string>>(new Set());

  const [commonFields, setCommonFields] = useState<CommonField[]>([]);
  /** Patili Dostlar: category_slug=patili-dostlar Başlıca Özellikler tanımları (definition bazlı). */
  const [patiliBaslicaFields, setPatiliBaslicaFields] = useState<CommonField[]>([]);
  const [selectedCommonSingle, setSelectedCommonSingle] = useState<Record<number, string>>({});
  const [selectedCommonMulti, setSelectedCommonMulti] = useState<Record<number, Set<string>>>({});
  const [selectedCommonRange, setSelectedCommonRange] = useState<
    Record<number, { min: string; max: string }>
  >({});
  const [expandedCommonMultiIds, setExpandedCommonMultiIds] = useState<Set<number>>(new Set());
  const [selectedStudentAgeRange, setSelectedStudentAgeRange] =
    useState<StudentAgeFilterTextPayload | null>(null);
  const [workingHoursStart, setWorkingHoursStart] = useState("");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("");
  /** Ham rakam string; boş = o sınır yok. Bir alan diğerini asla temizlemez. */
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const handlePriceMinChange = useCallback((rawValue: string) => {
    setPriceMin(String(rawValue ?? "").replace(/[^\d]/g, ""));
  }, []);

  const handlePriceMaxChange = useCallback((rawValue: string) => {
    setPriceMax(String(rawValue ?? "").replace(/[^\d]/g, ""));
  }, []);

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
    setSelectedSubcategoryIds(new Set());
    setSelectedHighSchoolTypes(new Set());
    setSelectedCommonSingle({});
    setSelectedCommonMulti({});
    setSelectedCommonRange({});
    setSelectedStudentAgeRange(null);
    setWorkingHoursStart("");
    setWorkingHoursEnd("");
    setPriceMin("");
    setPriceMax("");
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
            setFeatureGroupsError(null);
      setFeatureGroupsLoading(false);
      return;
    }

    let cancelled = false;
    setFeatureGroupsLoading(true);
    setFeatureGroupsError(null);
    setPatiliBaslicaFields([]);
    
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
      setSelectedSubcategoryIds(new Set());
      setSelectedHighSchoolTypes(new Set());
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
    if (!selectedSubcategoryIds.has(String(LISE_INSTITUTION_TYPE_ID))) {
      setSelectedHighSchoolTypes(new Set());
    }
  }, [selectedSubcategoryIds]);

  const toggleSchoolSubcategory = useCallback((typeId: number) => {
    const key = String(typeId);
    setSelectedSubcategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleHighSchoolType = useCallback((slug: string) => {
    setSelectedHighSchoolTypes((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const selectedSubcategoryIdsKey = useMemo(
    () => Array.from(selectedSubcategoryIds).sort().join(","),
    [selectedSubcategoryIds],
  );
  const selectedHighSchoolTypesKey = useMemo(
    () => Array.from(selectedHighSchoolTypes).sort().join(","),
    [selectedHighSchoolTypes],
  );

  // Global Başlıca Özellikler (category_slug boş). Patili kendi Başlıca tanımını kullanır.
  useEffect(() => {
    if (!hasDynamicFeatureMode || !usesGlobalBaslicaCommonFields) {
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
        const orderedChoices = defChoices;

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

        {
          const hoursKey = normalizeCommonFieldNameKey(displayName);
          if (
            hoursKey === "egitim saatleri" ||
            hoursKey === "okul saatleri" ||
            hoursKey === "kurum saatleri" ||
            hoursKey === "calisma saatleri"
          ) {
            return;
          }
        }

        {
          const priceKey = normalizeCommonFieldNameKey(displayName);
          if (
            priceKey.includes("aylik fiyat araligi") ||
            priceKey.includes("aylik ortalama fiyat") ||
            priceKey === "fiyat araligi" ||
            priceKey.includes("ortalama fiyat araligi")
          ) {
            return;
          }
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

      setCommonFields(fields);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasDynamicFeatureMode, usesGlobalBaslicaCommonFields]);

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

  /** Öğrenci yaşı: bağımsız ham metin (ana sayfa ile aynı). */
  const setStudentAgeRange = (value: StudentAgeFilterTextPayload | null) => {
    setSelectedStudentAgeRange(value);
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
  const workingHoursKey = useMemo(
    () => `${String(workingHoursStart ?? "").trim()}|${String(workingHoursEnd ?? "").trim()}`,
    [workingHoursStart, workingHoursEnd],
  );
  const priceRangeKey = useMemo(
    () => `${String(priceMin ?? "").trim()}|${String(priceMax ?? "").trim()}`,
    [priceMin, priceMax],
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

    const institutionTypeIds = Array.from(selectedSubcategoryIds)
      .map((raw) => Number(String(raw).trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    const highSchoolTypes = institutionTypeIds.includes(LISE_INSTITUTION_TYPE_ID)
      ? Array.from(selectedHighSchoolTypes)
          .map((slug) => String(slug ?? "").trim())
          .filter(Boolean)
      : [];

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
      institutionTypeIds,
      highSchoolTypes,
      commonSingle,
      commonMulti,
      commonRange,
      groupSelections,
      studentAgeRange: selectedStudentAgeRange,
      workingHoursStart: String(workingHoursStart ?? "").trim(),
      workingHoursEnd: String(workingHoursEnd ?? "").trim(),
      priceMin: String(priceMin ?? "").trim(),
      priceMax: String(priceMax ?? "").trim(),
    });
    // Bağımlılık olarak state'lerin kararlı JSON anahtarları kullanılıyor;
    // state objelerinin kendileri referans-yenileme tetiklediği için eklenmedi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasDynamicFeatureMode,
    selectedSubcategoryIdsKey,
    selectedHighSchoolTypesKey,
    commonSingleKey,
    commonMultiKey,
    commonRangeKey,
    studentAgeRangeKey,
    workingHoursKey,
    priceRangeKey,
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
      workingHoursStart: String(workingHoursStart ?? "").trim(),
      workingHoursEnd: String(workingHoursEnd ?? "").trim(),
    });
  }, [
    hasInstructorFeatureMode,
    instructorBooleanKey,
    instructorFieldsKey,
    commonSingleKey,
    commonMultiKey,
    commonRangeKey,
    studentAgeRangeKey,
    workingHoursKey,
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
    if (selectedSubcategoryIds.size > 0) return true;
    if (selectedHighSchoolTypes.size > 0) return true;
    if (priceRange != null) return true;
    if (isStudentAgeFilterTextActive(selectedStudentAgeRange)) return true;
    if (String(workingHoursStart ?? "").trim() || String(workingHoursEnd ?? "").trim()) return true;
    if (String(priceMin ?? "").trim() || String(priceMax ?? "").trim()) return true;
    for (const v of Object.values(selectedCommonSingle)) {
      const s = String(v ?? "").trim();
      if (s && s !== CLEAR_SINGLE_SELECT_VALUE) return true;
    }
    for (const set of Object.values(selectedCommonMulti)) {
      if ((set?.size ?? 0) > 0) return true;
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
    selectedSubcategoryIds,
    selectedHighSchoolTypes,
    priceRange,
    selectedCommonSingle,
    selectedCommonMulti,
    selectedCommonRange,
    selectedStudentAgeRange,
    workingHoursStart,
    workingHoursEnd,
    priceMin,
    priceMax,
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
    selectedSubcategoryIds,
    selectedHighSchoolTypes,
    toggleSchoolSubcategory,
    toggleHighSchoolType,
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
    setStudentAgeRange,
    selectedStudentAgeRange,
    workingHoursStart,
    workingHoursEnd,
    setWorkingHoursStart,
    setWorkingHoursEnd,
    priceMin,
    priceMax,
    handlePriceMinChange,
    handlePriceMaxChange,
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
  instanceId = "default",
}: {
  model: CategoryFilterSidebarModel;
  mapMarkers?: InstitutionMapMarker[];
  mapLoading?: boolean;
  instanceId?: string;
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
    selectedSubcategoryIds,
    selectedHighSchoolTypes,
    toggleSchoolSubcategory,
    toggleHighSchoolType,
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
    setStudentAgeRange,
    selectedStudentAgeRange,
    workingHoursStart,
    workingHoursEnd,
    setWorkingHoursStart,
    setWorkingHoursEnd,
    priceMin,
    priceMax,
    handlePriceMinChange,
    handlePriceMaxChange,
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

  const renderInstructorPriceFilterSection = (
    keySuffix: string,
    title: string = "AYLIK FİYAT ARALIĞI",
  ) => (
    <div className="category-filter-section" key={`instructor-price-${keySuffix}`}>
      <CategoryFilterSectionTitle title={title} />
      <PriceRangeSliderFilter
        value={priceRange}
        onChange={(nextRange) => handleFilterChange({ priceRange: nextRange })}
        className="category-filter-price-slider"
        steppers
      />
    </div>
  );

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
        steppers
      />
    </div>
  );

  const renderWorkingHoursFilterSection = (keySuffix: string) => (
    <div className="category-filter-section" key={`working-hours-${keySuffix}`}>
      <CategoryFilterSectionTitle title="EĞİTİM SAATLERİ" />
      <div className="category-filter-working-hours-range">
        <WorkingHoursTimePicker
          value={workingHoursStart}
          onChange={setWorkingHoursStart}
          ariaLabel="Eğitim saatleri başlangıç"
          placeholder="Başlangıç"
        />
        <span className="category-filter-price-separator" aria-hidden>
          —
        </span>
        <WorkingHoursTimePicker
          value={workingHoursEnd}
          onChange={setWorkingHoursEnd}
          ariaLabel="Eğitim saatleri bitiş"
          placeholder="Bitiş"
        />
      </div>
    </div>
  );

  const renderInstructorAvailableHoursFilterSection = (keySuffix: string) => (
    <div className="category-filter-section" key={`instructor-available-hours-${keySuffix}`}>
      <CategoryFilterSectionTitle title="Müsait Saat Aralığı" />
      <div className="category-filter-working-hours-range">
        <WorkingHoursTimePicker
          value={workingHoursStart}
          onChange={setWorkingHoursStart}
          ariaLabel="Müsait saat aralığı başlangıç"
          placeholder="Başlangıç"
        />
        <span className="category-filter-price-separator" aria-hidden>
          —
        </span>
        <WorkingHoursTimePicker
          value={workingHoursEnd}
          onChange={setWorkingHoursEnd}
          ariaLabel="Müsait saat aralığı bitiş"
          placeholder="Bitiş"
        />
      </div>
    </div>
  );

  const renderPriceRangeFilterSection = (keySuffix: string) => {
    const minId = `category-price-min-${keySuffix}-${instanceId}`;
    const maxId = `category-price-max-${keySuffix}-${instanceId}`;
    return (
      <div className="category-filter-section" key={`price-range-${keySuffix}-${instanceId}`}>
        <CategoryFilterSectionTitle title="AYLIK FİYAT ARALIĞI" />
        <div className="price-range-slider-inputs category-filter-price-inputs">
          <label className="price-range-slider-field" htmlFor={minId}>
            <span className="price-range-slider-label">Minimum Fiyat</span>
            <FilterNumericStepper
              id={minId}
              name={minId}
              value={priceMin}
              onValueChange={handlePriceMinChange}
              placeholder="Min"
              ariaLabel="Aylık fiyat minimum"
              className="price-range-slider-input category-filter-price-input"
            />
          </label>
          <label className="price-range-slider-field" htmlFor={maxId}>
            <span className="price-range-slider-label">Maksimum Fiyat</span>
            <FilterNumericStepper
              id={maxId}
              name={maxId}
              value={priceMax}
              onValueChange={handlePriceMaxChange}
              placeholder="Max"
              ariaLabel="Aylık fiyat maksimum"
              className="price-range-slider-input category-filter-price-input"
            />
          </label>
        </div>
      </div>
    );
  };

  const schoolOrderedDynamicSections = useMemo(() => {
    if (!showSchoolSubcategoryFilters) return [] as OkulDynamicFilterSection[];
    const sections: OkulDynamicFilterSection[] = [];
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 2,
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length + 1) + 1,
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length + 1) + 1,
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length + 1) + 1,
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length + 1) + 1,
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length + 1) + 1,
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length + 1) + 1,
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
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length + 1) + 1,
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
    sections.push({
      kind: "student_age",
      originalIndex: commonFields.length + renderedFeatureGroups.length,
    });
    sections.push({
      kind: "working_hours",
      originalIndex: commonFields.length + renderedFeatureGroups.length + 1,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (commonFields.length + renderedFeatureGroups.length) + 2,
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
    sections.push({
      kind: "working_hours",
      originalIndex: patiliBaslicaFields.length + commonFields.length + renderedFeatureGroups.length,
    });
    sections.push({
      kind: "price_range",
      originalIndex: (patiliBaslicaFields.length + commonFields.length + renderedFeatureGroups.length) + 1,
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
      const value = selectedCommonRange[field.definitionId] ?? { min: "", max: "" };
      return (
        <div className="category-filter-section" key={`common-${field.definitionId}`}>
          <CategoryFilterSectionTitle title={title} />
          <div className="category-filter-price-inputs">
            <FilterNumericStepper
              type="number"
              value={value.min}
              onValueChange={(next) => setCommonRange(field.definitionId, "min", next)}
              placeholder="Min"
              ariaLabel="Minimum"
              className="category-filter-price-input"
            />
            <span className="category-filter-price-separator">-</span>
            <FilterNumericStepper
              type="number"
              value={value.max}
              onValueChange={(next) => setCommonRange(field.definitionId, "max", next)}
              placeholder="Max"
              ariaLabel="Maksimum"
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
      const selectedSet = selectedCommonMulti[field.definitionId] ?? new Set<string>();
      const isExpanded = expandedCommonMultiIds.has(field.definitionId);
      const sortedChoices = sortCheckboxOptionsByLabel(field.choices, (c) => c.name);
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
  const instructorCategorySelectLabel = (() => {
    if (instructorCategoriesLoading) return "Kategoriler yükleniyor...";
    const slug = String(selectedCategory ?? "").trim();
    if (!slug) return "Tüm Kategoriler";
    const match = instructorCategories.find(
      (category) => String(category.slug ?? "").trim() === slug,
    );
    return String(match?.name ?? "").trim() || "Kategori Seçin";
  })();

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
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={displaySearch}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="category-filter-search-input"
                />
                <button type="button" className="category-filter-search-button" aria-label="Ara">
                  <Search className="category-filter-search-button-icon" aria-hidden />
                </button>
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
                    value={displayIlId || ""}
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
    <div className={checkboxListClassName(subcategoryTypes.length)}>
      {sortCheckboxOptionsByLabel(subcategoryTypes, (t) => t.name).map((type) => {
        const isChecked = selectedSubcategoryIds.has(String(type.id));

        return (
          <label
            key={type.id}
            className={`category-filter-checkbox-option${
              isChecked ? " category-filter-checkbox-option--selected" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleSchoolSubcategory(type.id)}
              className="category-filter-checkbox-input"
            />
            <span className="category-filter-checkbox-label">{type.name}</span>
          </label>
        );
      })}
    </div>
  </div>
) : null}


          {showSchoolSubcategoryFilters &&
          selectedSubcategoryIds.has(String(LISE_INSTITUTION_TYPE_ID)) ? (
            <div className="category-filter-section">
              <CategoryFilterSectionTitle title="LİSE TÜRÜ" />
              <div className="category-filter-section-inputs">
                <CategoryFilterMultiSelect
                  options={sortCheckboxOptionsByLabel(
                    [...HIGH_SCHOOL_TYPE_OPTIONS],
                    (o) => o.label,
                  ).map((option) => ({
                    value: option.slug,
                    label: option.label,
                  }))}
                  selectedValues={Array.from(selectedHighSchoolTypes)}
                  onToggleValue={toggleHighSchoolType}
                  placeholder="Lise türü seç"
                  ariaLabel="Lise türü seçimi"
                  selectedCountNoun="tür"
                />
              </div>
            </div>
          ) : null}

          {hasInstructorFeatureMode ? (
            <div className="category-filter-section">
              <CategoryFilterSectionTitle title="KATEGORİ" />
              <div className="category-filter-section-inputs">
                <SelectMountGate
                  label={instructorCategorySelectLabel}
                  disabled={instructorCategoriesLoading}
                >
                  <InstructorCategorySelect
                    value={String(selectedCategory ?? "").trim()}
                    disabled={instructorCategoriesLoading}
                    placeholder={
                      instructorCategoriesLoading ? "Kategoriler yükleniyor..." : "Kategori Seçin"
                    }
                    options={instructorCategories.flatMap((category) => {
                      const slug = String(category.slug ?? "").trim();
                      const label = String(category.name ?? "").trim();
                      if (!slug || !label) return [];
                      return [{ value: slug, label }];
                    })}
                    onChange={(next) => handleFilterChange({ category: next })}
                  />
                </SelectMountGate>
                {instructorCategoriesError ? (
                  <p className="category-filter-section-empty">{instructorCategoriesError}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasInstructorFeatureMode && !usesInjectedAgePriceInstructorOrder ? (
            <>
              {renderInstructorPriceFilterSection("default")}
              {renderInstructorAvailableHoursFilterSection("default")}
            </>
          ) : null}

          {hasDynamicFeatureMode || hasInstructorFeatureMode ? (
            <>
              {!isPatiliDostlarCategory &&
              !usesInjectedAgePriceInstructorOrder &&
              !showSchoolSubcategoryFilters &&
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
                      const fieldOrderKey = isKursSinavaHazirlikInstructorCategory
                        ? normalizeKursSinavaHazirlikInstructorFilterOrderKey(field.name)
                        : normalizeInstructorFilterOrderKey(field.name);
                      const instructorFieldSectionTitle = isKursSinavaHazirlikInstructorCategory
                        ? getKursSinavaHazirlikInstructorFilterSectionTitle(field.name)
                        : field.name.toLocaleUpperCase("tr-TR");
                      const wrapSurucuKursuInstructorCollapse = (
                        node: ReactNode,
                        orderKey: string,
                        title: string,
                        sectionKey: string,
                      ): ReactNode => {
                        if (!SURUCU_KURSU_COLLAPSED_FILTER_KEYS.has(orderKey)) return node;
                        return (
                          <CategoryFilterCollapse
                            key={`surucu-collapse-${orderKey}-${sectionKey}`}
                            title={title}
                            className="category-filter-collapse--surucu"
                          >
                            {node}
                          </CategoryFilterCollapse>
                        );
                      };
                      const wrapOrderedInstructorSpecialSections = (
                        section: ReactNode,
                        sectionKey: string,
                      ): ReactNode => {
                        if (section == null) return section;

                        if (isKursSinavaHazirlikInstructorCategory) {
                          const wrapKursSinavaHazirlikInstructorCollapse = (
                            node: ReactNode,
                            orderKey: string,
                            title: string,
                            collapseKey: string,
                          ): ReactNode => {
                            if (!KURS_SINAVA_HAZIRLIK_INSTRUCTOR_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                              return node;
                            }
                            return (
                              <CategoryFilterCollapse
                                key={`kurs-instructor-collapse-${orderKey}-${collapseKey}`}
                                title={title}
                                className="category-filter-collapse--surucu"
                              >
                                {node}
                              </CategoryFilterCollapse>
                            );
                          };
                          const wrapped = wrapKursSinavaHazirlikInstructorCollapse(
                            section,
                            fieldOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (fieldOrderKey === "ozel ders turleri") {
                            return (
                              <Fragment key={`kurs-slot-${sectionKey}`}>
                                {wrapped}
                                {renderStudentAgeFilterSection("kurs-sinava-hazirlik")}
                                {renderInstructorPriceFilterSection(
                                  "kurs-sinava-hazirlik",
                                  "FİYAT ARALIĞI",
                                )}
                              </Fragment>
                            );
                          }
                          if (fieldOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`kurs-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapKursSinavaHazirlikInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("kurs-sinava-hazirlik"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        if (isYabanciDilInstructorCategory) {
                          const yabanciOrderKey = normalizeYabanciDilInstructorFilterOrderKey(field.name);
                          const wrapYabanciDilInstructorCollapse = (
                            node: ReactNode,
                            orderKey: string,
                            title: string,
                            collapseKey: string,
                          ): ReactNode => {
                            if (!YABANCI_DIL_INSTRUCTOR_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                              return node;
                            }
                            return (
                              <CategoryFilterCollapse
                                key={`yabanci-dil-instructor-collapse-${orderKey}-${collapseKey}`}
                                title={title}
                                className="category-filter-collapse--surucu"
                              >
                                {node}
                              </CategoryFilterCollapse>
                            );
                          };
                          const wrapped = wrapYabanciDilInstructorCollapse(
                            section,
                            yabanciOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (yabanciOrderKey === "yabanci dil turleri") {
                            return (
                              <Fragment key={`yabanci-dil-slot-${sectionKey}`}>
                                {wrapped}
                                {renderStudentAgeFilterSection("yabanci-dil")}
                                {renderInstructorPriceFilterSection("yabanci-dil", "FİYAT ARALIĞI")}
                              </Fragment>
                            );
                          }
                          if (yabanciOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`yabanci-dil-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapYabanciDilInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("yabanci-dil"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        if (isSanatInstructorCategory) {
                          const sanatOrderKey = normalizeSanatInstructorFilterOrderKey(field.name);
                          const wrapSanatInstructorCollapse = (
                            node: ReactNode,
                            orderKey: string,
                            title: string,
                            collapseKey: string,
                          ): ReactNode => {
                            if (!SANAT_INSTRUCTOR_COLLAPSED_FILTER_KEYS.has(orderKey)) return node;
                            return (
                              <CategoryFilterCollapse
                                key={`sanat-instructor-collapse-${orderKey}-${collapseKey}`}
                                title={title}
                                className="category-filter-collapse--surucu"
                              >
                                {node}
                              </CategoryFilterCollapse>
                            );
                          };
                          const wrapped = wrapSanatInstructorCollapse(
                            section,
                            sanatOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (sanatOrderKey === "sanat turleri") {
                            return (
                              <Fragment key={`sanat-slot-${sectionKey}`}>
                                {wrapped}
                                {renderStudentAgeFilterSection("sanat")}
                                {renderInstructorPriceFilterSection("sanat", "FİYAT ARALIĞI")}
                              </Fragment>
                            );
                          }
                          if (sanatOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`sanat-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapSanatInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("sanat"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        if (isSporInstructorCategory) {
                          const sporOrderKey = normalizeSporInstructorFilterOrderKey(field.name);
                          const wrapSporInstructorCollapse = (
                            node: ReactNode,
                            orderKey: string,
                            title: string,
                            collapseKey: string,
                          ): ReactNode => {
                            if (!SPOR_INSTRUCTOR_COLLAPSED_FILTER_KEYS.has(orderKey)) return node;
                            return (
                              <CategoryFilterCollapse
                                key={`spor-instructor-collapse-${orderKey}-${collapseKey}`}
                                title={title}
                                className="category-filter-collapse--surucu"
                              >
                                {node}
                              </CategoryFilterCollapse>
                            );
                          };
                          const wrapped = wrapSporInstructorCollapse(
                            section,
                            sporOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (sporOrderKey === "spor turleri") {
                            return (
                              <Fragment key={`spor-slot-${sectionKey}`}>
                                {wrapped}
                                {renderStudentAgeFilterSection("spor")}
                                {renderInstructorPriceFilterSection("spor", "FİYAT ARALIĞI")}
                              </Fragment>
                            );
                          }
                          if (sporOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`spor-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapSporInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("spor"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        if (isKisiselGelisimInstructorCategory) {
                          const kisiselOrderKey = normalizeKisiselGelisimFilterOrderKey(field.name);
                          const wrapKisiselGelisimInstructorCollapse = (
                            node: ReactNode,
                            orderKey: string,
                            title: string,
                            collapseKey: string,
                          ): ReactNode => {
                            if (!KISISEL_GELISIM_INSTRUCTOR_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                              return node;
                            }
                            return (
                              <CategoryFilterCollapse
                                key={`kisisel-gelisim-instructor-collapse-${orderKey}-${collapseKey}`}
                                title={title}
                                className="category-filter-collapse--surucu"
                              >
                                {node}
                              </CategoryFilterCollapse>
                            );
                          };
                          const wrapped = wrapKisiselGelisimInstructorCollapse(
                            section,
                            kisiselOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (kisiselOrderKey === "egitim turleri") {
                            return (
                              <Fragment key={`kisisel-gelisim-slot-${sectionKey}`}>
                                {wrapped}
                                {renderStudentAgeFilterSection("kisisel-gelisim")}
                                {renderInstructorPriceFilterSection(
                                  "kisisel-gelisim",
                                  "FİYAT ARALIĞI",
                                )}
                              </Fragment>
                            );
                          }
                          if (kisiselOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`kisisel-gelisim-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapKisiselGelisimInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("kisisel-gelisim"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        if (isMeslekiEgitimInstructorCategory) {
                          const meslekiOrderKey = normalizeMeslekiEgitimFilterOrderKey(field.name);
                          const wrapMeslekiEgitimInstructorCollapse = (
                            node: ReactNode,
                            orderKey: string,
                            title: string,
                            collapseKey: string,
                          ): ReactNode => {
                            if (!MESLEKI_EGITIM_INSTRUCTOR_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                              return node;
                            }
                            return (
                              <CategoryFilterCollapse
                                key={`mesleki-egitim-instructor-collapse-${orderKey}-${collapseKey}`}
                                title={title}
                                className="category-filter-collapse--surucu"
                              >
                                {node}
                              </CategoryFilterCollapse>
                            );
                          };
                          const wrapped = wrapMeslekiEgitimInstructorCollapse(
                            section,
                            meslekiOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (meslekiOrderKey === "egitim turleri") {
                            return (
                              <Fragment key={`mesleki-egitim-slot-${sectionKey}`}>
                                {wrapped}
                                {renderStudentAgeFilterSection("mesleki-egitim")}
                                {renderInstructorPriceFilterSection("mesleki-egitim", "FİYAT ARALIĞI")}
                              </Fragment>
                            );
                          }
                          if (meslekiOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`mesleki-egitim-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapMeslekiEgitimInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("mesleki-egitim"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        if (isOzelEgitimInstructorCategory) {
                          const ozelOrderKey = normalizeOzelEgitimFilterOrderKey(field.name);
                          const wrapOzelEgitimInstructorCollapse = (
                            node: ReactNode,
                            orderKey: string,
                            title: string,
                            collapseKey: string,
                          ): ReactNode => {
                            if (!OZEL_EGITIM_COLLAPSED_INSTRUCTOR_FILTER_KEYS.has(orderKey)) return node;
                            return (
                              <CategoryFilterCollapse
                                key={`ozel-egitim-collapse-${orderKey}-${collapseKey}`}
                                title={title}
                                className="category-filter-collapse--surucu"
                              >
                                {node}
                              </CategoryFilterCollapse>
                            );
                          };
                          const wrapped = wrapOzelEgitimInstructorCollapse(
                            section,
                            ozelOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (ozelOrderKey === "ozel egitim turleri") {
                            return (
                              <Fragment key={`ozel-egitim-slot-${sectionKey}`}>
                                {wrapped}
                                {wrapOzelEgitimInstructorCollapse(
                                  renderStudentAgeFilterSection("ozel-egitim"),
                                  "ogrenci yasi",
                                  "ÖĞRENCİ YAŞI",
                                  "age",
                                )}
                                {wrapOzelEgitimInstructorCollapse(
                                  renderInstructorPriceFilterSection("ozel-egitim", "FİYAT ARALIĞI"),
                                  "fiyat araligi",
                                  "FİYAT ARALIĞI",
                                  "price",
                                )}
                              </Fragment>
                            );
                          }
                          if (ozelOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`ozel-egitim-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapOzelEgitimInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("ozel-egitim"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        if (isSurucuKursuInstructorCategory) {
                          const surucuOrderKey = normalizeSurucuKursuFilterOrderKey(field.name);
                          const wrapped = wrapSurucuKursuInstructorCollapse(
                            section,
                            surucuOrderKey,
                            instructorFieldSectionTitle,
                            sectionKey,
                          );
                          if (surucuOrderKey === "arac tipleri") {
                            return (
                              <Fragment key={`surucu-kursu-slot-${sectionKey}`}>
                                {wrapped}
                                {wrapSurucuKursuInstructorCollapse(
                                  renderStudentAgeFilterSection("surucu-kursu"),
                                  "ogrenci yasi",
                                  "ÖĞRENCİ YAŞI",
                                  "age",
                                )}
                                {wrapSurucuKursuInstructorCollapse(
                                  renderInstructorPriceFilterSection("surucu-kursu", "FİYAT ARALIĞI"),
                                  "fiyat araligi",
                                  "FİYAT ARALIĞI",
                                  "price",
                                )}
                              </Fragment>
                            );
                          }
                          if (surucuOrderKey === "ders suresi") {
                            return (
                              <Fragment key={`surucu-kursu-hours-${sectionKey}`}>
                                {wrapped}
                                {wrapSurucuKursuInstructorCollapse(
                                  renderInstructorAvailableHoursFilterSection("surucu-kursu"),
                                  "musait saat araligi",
                                  "MÜSAİT SAAT ARALIĞI",
                                  "hours",
                                )}
                              </Fragment>
                            );
                          }
                          return wrapped;
                        }

                        
if (isPatiliDostlarInstructorCategory) {
  const patiliOrderKey = normalizePatiliDostlarFilterOrderKey(field.name);

  const wrapPatiliCollapse = (
    node: ReactNode,
    orderKey: string,
    title: string,
    collapseKey: string,
  ): ReactNode => {
    if (!PATILI_DOSTLAR_INSTRUCTOR_COLLAPSED_FILTER_KEYS.has(orderKey)) {
      return node;
    }

    return (
      <CategoryFilterCollapse
        key={`patili-instructor-collapse-${orderKey}-${collapseKey}`}
        title={title}
        className="category-filter-collapse--surucu"
      >
        {node}
      </CategoryFilterCollapse>
    );
  };

  const wrapped = wrapPatiliCollapse(
    section,
    patiliOrderKey,
    instructorFieldSectionTitle,
    sectionKey,
  );

  const injectHours =
    patiliOrderKey === "hizmet yeri" ||
    (!patiliHasHizmetYeriField && patiliOrderKey === "hizmet tipi");

  if (injectHours) {
    return (
      <Fragment key={`patili-dostlar-hours-${sectionKey}`}>
        {wrapped}
        {wrapPatiliCollapse(
          renderInstructorAvailableHoursFilterSection("patili-dostlar"),
          "musait saat araligi",
          "MÜSAİT SAAT ARALIĞI",
          "hours",
        )}
      </Fragment>
    );
  }

  return wrapped;
}


                        return section;
                      };

                      if (field.kind === "boolean_group") {
                        const isExpanded = expandedInstructorBooleanGroupIds.has(field.groupId);
                        const sortedOptions =
                          field.name === INSTRUCTOR_HIZMET_YERI_LABEL ||
                          field.name === INSTRUCTOR_DERS_SEVIYESI_LABEL ||
                          isSurucuKursuInstructorCategory ||
                          isOzelEgitimInstructorCategory
                            ? field.options
                            : sortCheckboxOptionsByLabel(field.options, (option) => option.name);
                        const visibleOptions = isExpanded
                          ? sortedOptions
                          : sortedOptions.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
                        const hasMore = sortedOptions.length > FEATURE_OPTIONS_VISIBLE_LIMIT;

                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-bool-group-${field.groupId}`}
                          >
                            <CategoryFilterSectionTitle title={instructorFieldSectionTitle} />
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
                        const isDenemeDersiFilter =
                          field.definitionId === INSTRUCTOR_DENEME_DERSI_DEFINITION_ID;
                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-bool-${field.definitionId}`}
                          >
                            <CategoryFilterSectionTitle
                              title={
                                isDenemeDersiFilter ? "DENEME DERSİ VAR" : instructorFieldSectionTitle
                              }
                            />
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
                                <span className="category-filter-checkbox-label">
                                  {isDenemeDersiFilter ? "Var" : field.name}
                                </span>
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
                            <CategoryFilterSectionTitle title={instructorFieldSectionTitle} />
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

                      if (field.kind === "lesson_duration_range") {
                        const value = selectedCommonRange[field.definitionId] ?? { min: "", max: "" };
                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-lesson-duration-${field.definitionId}`}
                          >
                            <CategoryFilterSectionTitle title={instructorFieldSectionTitle} />
                            <div className="category-filter-price-inputs">
                              <FilterNumericStepper
                                type="number"
                                value={value.min}
                                onValueChange={(next) =>
                                  setInstructorRange(
                                    field.definitionId,
                                    "min",
                                    sanitizeLessonDurationInput(next),
                                  )
                                }
                                placeholder={LESSON_DURATION_MIN_INPUT_LABEL}
                                ariaLabel="Ders süresi minimum"
                                className="category-filter-price-input"
                              />
                              <span className="category-filter-price-separator" aria-hidden>
                                —
                              </span>
                              <FilterNumericStepper
                                type="number"
                                value={value.max}
                                onValueChange={(next) =>
                                  setInstructorRange(
                                    field.definitionId,
                                    "max",
                                    sanitizeLessonDurationInput(next),
                                  )
                                }
                                placeholder={LESSON_DURATION_MAX_INPUT_LABEL}
                                ariaLabel="Ders süresi maksimum"
                                className="category-filter-price-input"
                              />
                            </div>
                            <span className="category-filter-price-separator">
                              {LESSON_DURATION_UNIT_LABEL}
                            </span>
                          </div>,
                          `lesson-duration-${field.definitionId}`,
                        );
                      }

                      if (field.kind === "multi_select") {
                        const selectedSet =
                          selectedCommonMulti[field.definitionId] ?? new Set<string>();
                        const isExpanded = expandedInstructorMultiIds.has(field.definitionId);
                        const sortedChoices =
                          isSurucuKursuInstructorCategory &&
                          normalizeSurucuKursuFilterOrderKey(field.name) === "egitmen profili"
                            ? field.choices
                            : sortCheckboxOptionsByLabel(field.choices, (choice) => choice.name);
                        const visibleChoices = isExpanded
                          ? sortedChoices
                          : sortedChoices.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
                        const hasMore = sortedChoices.length > FEATURE_OPTIONS_VISIBLE_LIMIT;
                        return wrapOrderedInstructorSpecialSections(
                          <div
                            className="category-filter-section"
                            key={`instructor-multi-${field.definitionId}`}
                          >
                            <CategoryFilterSectionTitle title={instructorFieldSectionTitle} />
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
                          <CategoryFilterSectionTitle title={instructorFieldSectionTitle} />
                          <div className="category-filter-price-inputs">
                            <FilterNumericStepper
                              type="number"
                              value={value.min}
                              onValueChange={(next) =>
                                setInstructorRange(field.definitionId, "min", next)
                              }
                              placeholder="Min"
                              ariaLabel="Minimum"
                              className="category-filter-price-input"
                            />
                            <span className="category-filter-price-separator">-</span>
                            <FilterNumericStepper
                              type="number"
                              value={value.max}
                              onValueChange={(next) =>
                                setInstructorRange(field.definitionId, "max", next)
                              }
                              placeholder="Max"
                              ariaLabel="Maksimum"
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
                ? schoolOrderedDynamicSections.map((section) => {
                    const orderName = getOkulSectionOrderName(section);
                    const orderKey = normalizeOkulInstitutionFilterOrderKey(orderName);
                    const sectionNode =
                      section.kind === "student_age"
                        ? renderStudentAgeFilterSection("school")
                        : section.kind === "price_range"
                          ? renderPriceRangeFilterSection("okul")
                          : section.kind === "working_hours"
                            ? renderWorkingHoursFilterSection("okul")
                            : section.kind === "common"
                              ? renderInstitutionCommonField(
                                  section.field,
                                  getOkulInstitutionFilterSectionTitle(section.field.name),
                                )
                              : renderInstitutionFeatureGroup(
                                  section.group,
                                  getOkulInstitutionFilterSectionTitle(section.group.name),
                                );
                    if (!OKUL_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                      return sectionNode;
                    }
                    return (
                      <CategoryFilterCollapse
                        key={`okul-collapse-${orderKey}`}
                        title={getOkulInstitutionFilterSectionTitle(orderName)}
                      >
                        {sectionNode}
                      </CategoryFilterCollapse>
                    );
                  })
                : showKursSinavaHazirlikInstitutionFilters
                  ? kursOrderedDynamicSections.map((section) => {
                      const orderName = getKursSinavaHazirlikSectionOrderName(section);
                      const orderKey = normalizeKursSinavaHazirlikInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("kurs-sinava-hazirlik")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("kurs-sinava-hazirlik")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("kurs-sinava-hazirlik")
                              : section.kind === "common"
                                ? renderInstitutionCommonField(
                                    section.field,
                                    getKursSinavaHazirlikInstitutionFilterSectionTitle(section.field.name),
                                  )
                                : renderInstitutionFeatureGroup(
                                    section.group,
                                    getKursSinavaHazirlikInstitutionFilterSectionTitle(section.group.name),
                                  );
                      if (!KURS_SINAVA_HAZIRLIK_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                        return sectionNode;
                      }
                      return (
                        <CategoryFilterCollapse
                          key={`kurs-sinava-hazirlik-collapse-${orderKey}`}
                          title={getKursSinavaHazirlikInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showSporInstitutionFilters
                  ? sporOrderedDynamicSections.map((section) => {
                      const orderName = getSporSectionOrderName(section);
                      const orderKey = normalizeSporInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("spor")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("spor")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("spor")
                              : section.kind === "common"
                                ? renderInstitutionCommonField(
                                    section.field,
                                    getSporInstitutionFilterSectionTitle(section.field.name),
                                  )
                                : renderInstitutionFeatureGroup(
                                    section.group,
                                    getSporInstitutionFilterSectionTitle(section.group.name),
                                  );
                      if (!SPOR_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                        return sectionNode;
                      }
                      return (
                        <CategoryFilterCollapse
                          key={`spor-collapse-${orderKey}`}
                          title={getSporInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showSanatInstitutionFilters
                  ? sanatOrderedDynamicSections.map((section) => {
                      const orderName = getSanatSectionOrderName(section);
                      const orderKey = normalizeSanatInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("sanat")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("sanat")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("sanat")
                              : section.kind === "common"
                                ? renderInstitutionCommonField(
                                    section.field,
                                    getSanatInstitutionFilterSectionTitle(section.field.name),
                                  )
                                : renderInstitutionFeatureGroup(
                                    section.group,
                                    getSanatInstitutionFilterSectionTitle(section.group.name),
                                  );
                      if (!SANAT_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                        return sectionNode;
                      }
                      return (
                        <CategoryFilterCollapse
                          key={`sanat-collapse-${orderKey}`}
                          title={getSanatInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showYabanciDilInstitutionFilters
                  ? yabanciDilOrderedDynamicSections.map((section) => {
                      const orderName = getYabanciDilSectionOrderName(section);
                      const orderKey = normalizeYabanciDilInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("yabanci-dil")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("yabanci-dil")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("yabanci-dil")
                              : section.kind === "common"
                                ? renderInstitutionCommonField(
                                    section.field,
                                    getYabanciDilInstitutionFilterSectionTitle(section.field.name),
                                  )
                                : renderInstitutionFeatureGroup(
                                    section.group,
                                    getYabanciDilInstitutionFilterSectionTitle(section.group.name),
                                  );
                      if (!YABANCI_DIL_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                        return sectionNode;
                      }
                      return (
                        <CategoryFilterCollapse
                          key={`yabanci-dil-collapse-${orderKey}`}
                          title={getYabanciDilInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showKisiselGelisimInstitutionFilters
                  ? kisiselGelisimOrderedDynamicSections.map((section) => {
                      const orderName = getKisiselGelisimSectionOrderName(section);
                      const orderKey = normalizeKisiselGelisimInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("kisisel-gelisim")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("kisisel-gelisim")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("kisisel-gelisim")
                              : section.kind === "common"
                                ? renderInstitutionCommonField(
                                    section.field,
                                    getKisiselGelisimInstitutionFilterSectionTitle(section.field.name),
                                  )
                                : renderInstitutionFeatureGroup(
                                    section.group,
                                    getKisiselGelisimInstitutionFilterSectionTitle(section.group.name),
                                  );
                      if (!KISISEL_GELISIM_COLLAPSED_FILTER_KEYS.has(orderKey)) return sectionNode;
                      return (
                        <CategoryFilterCollapse
                          key={`kisisel-gelisim-collapse-${orderKey}`}
                          title={getKisiselGelisimInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showMeslekiEgitimInstitutionFilters
                  ? meslekiEgitimOrderedDynamicSections.map((section) => {
                      const orderName = getMeslekiEgitimSectionOrderName(section);
                      const orderKey = normalizeMeslekiEgitimInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("mesleki-egitim")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("mesleki-egitim")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("mesleki-egitim")
                              : section.kind === "common"
                                ? renderInstitutionCommonField(
                                    section.field,
                                    getMeslekiEgitimInstitutionFilterSectionTitle(section.field.name),
                                  )
                                : renderInstitutionFeatureGroup(
                                    section.group,
                                    getMeslekiEgitimInstitutionFilterSectionTitle(section.group.name),
                                  );
                      if (!MESLEKI_EGITIM_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                        return sectionNode;
                      }
                      return (
                        <CategoryFilterCollapse
                          key={`mesleki-egitim-collapse-${orderKey}`}
                          title={getMeslekiEgitimInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showOzelEgitimInstitutionFilters
                  ? ozelEgitimOrderedDynamicSections.map((section) => {
                      const orderName = getOzelEgitimSectionOrderName(section);
                      const orderKey = normalizeOzelEgitimInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("ozel-egitim")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("ozel-egitim")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("ozel-egitim")
                              : section.kind === "common"
                                ? renderInstitutionCommonField(
                                    section.field,
                                    getOzelEgitimInstitutionFilterSectionTitle(section.field.name),
                                  )
                                : renderInstitutionFeatureGroup(
                                    section.group,
                                    getOzelEgitimInstitutionFilterSectionTitle(section.group.name),
                                  );
                      if (!OZEL_EGITIM_COLLAPSED_FILTER_KEYS.has(orderKey)) return sectionNode;
                      return (
                        <CategoryFilterCollapse
                          key={`ozel-egitim-collapse-${orderKey}`}
                          title={getOzelEgitimInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showSurucuKursuInstitutionFilters
                  ? surucuKursuOrderedDynamicSections.map((section) => {
                      const orderName = getSurucuKursuSectionOrderName(section);
                      const orderKey = normalizeSurucuKursuInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "student_age"
                          ? renderStudentAgeFilterSection("surucu-kursu")
                          : section.kind === "price_range"
                            ? renderPriceRangeFilterSection("surucu-kursu")
                            : section.kind === "working_hours"
                              ? renderWorkingHoursFilterSection("surucu-kursu")
                              : section.kind === "belge_turleri"
                                ? renderSurucuKursuBelgeTurleriSection(section.group)
                                : section.kind === "common"
                                  ? renderInstitutionCommonField(
                                      section.field,
                                      getSurucuKursuInstitutionFilterSectionTitle(section.field.name),
                                    )
                                  : renderInstitutionFeatureGroup(
                                      section.group,
                                      getSurucuKursuInstitutionFilterSectionTitle(section.group.name),
                                    );
                      if (!SURUCU_KURSU_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                        return sectionNode;
                      }
                      return (
                        <CategoryFilterCollapse
                          key={`surucu-kursu-collapse-${orderKey}`}
                          title={getSurucuKursuInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : showPatiliDostlarInstitutionFilters
                  ? patiliDostlarOrderedDynamicSections.map((section) => {
                      const orderName = getPatiliDostlarSectionOrderName(section);
                      const orderKey = normalizePatiliDostlarInstitutionFilterOrderKey(orderName);
                      const sectionNode =
                        section.kind === "price_range"
                          ? renderPriceRangeFilterSection("patili-dostlar")
                          : section.kind === "working_hours"
                            ? renderWorkingHoursFilterSection("patili-dostlar")
                            : section.kind === "group"
                              ? renderInstitutionFeatureGroup(
                                  section.group,
                                  getPatiliDostlarInstitutionFilterSectionTitle(section.group.name),
                                )
                              : renderInstitutionCommonField(
                                  section.field,
                                  getPatiliDostlarInstitutionFilterSectionTitle(section.field.name),
                                );
                      if (!PATILI_DOSTLAR_INSTITUTION_COLLAPSED_FILTER_KEYS.has(orderKey)) {
                        return sectionNode;
                      }
                      return (
                        <CategoryFilterCollapse
                          key={`patili-dostlar-collapse-${orderKey}`}
                          title={getPatiliDostlarInstitutionFilterSectionTitle(orderName)}
                        >
                          {sectionNode}
                        </CategoryFilterCollapse>
                      );
                    })
                : hasDynamicFeatureMode && usesGlobalBaslicaCommonFields
                  ? (
                      <>
                        {commonFields.map((field) =>
                          renderInstitutionCommonField(
                            field,
                            field.name.toLocaleUpperCase("tr-TR"),
                          ),
                        )}
                        {renderWorkingHoursFilterSection("generic")}
                        {renderPriceRangeFilterSection("generic")}
                      </>
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
                  steppers
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
  instanceId = "default",
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
      instanceId={instanceId}
    />
  );
}

/**
 * Sonuç alanında, kategoriye özel paylaşımlı filtre modeli aktifken görünür
 * olan "Filtreleri Sıfırla" butonu. Tıklandığında tüm filtre state'i default
 * haline döner ve sonuçlar filtrelenmemiş şekilde listelenir.
 */
export function CategoryFilterResetButton() {
  const schoolCtxModel = useContext(SchoolCategoryFilterPanelContext);
  const instructorCtxModel = useContext(InstructorCategoryFilterPanelContext);
  const ctxModel = instructorCtxModel ?? schoolCtxModel;
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
