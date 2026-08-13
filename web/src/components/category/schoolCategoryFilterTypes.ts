/**
 * Okul kategori sayfası sol panel filtrelerinin `useCategoryInstitutions` ile
 * paylaşılan seri hali. Tüm alanlar opsiyonel / boş olabilir.
 */
import type { StudentAgeFilterTextPayload } from "@/lib/institutionStudentAgeFilter";

export type SchoolCategoryFilterPayload = {
  institutionTypeId: number | null;
  /** Yalnızca Alt Kategori = Lise (53) iken kullanılır. */
  highSchoolType: string | null;
  /** Başlıca Özellikler single_select: definitionId → seçilen choice id (string). */
  commonSingle: Record<number, string>;
  /** Başlıca Özellikler multi_select: definitionId → seçilen choice id listesi. */
  commonMulti: Record<number, string[]>;
  /** Başlıca Özellikler number (aralık): definitionId → min/max string (boş = sınır yok). */
  commonRange: Record<number, { min: string; max: string }>;
  /** Kategori-spesifik gruplar: groupId → seçilen anahtarlar (`choice:123:def:456` | `def:456`). */
  groupSelections: Record<number, string[]>;
  /** Öğrenci yaşı (ham metin); ana sayfa ile aynı davranış. */
  studentAgeRange: StudentAgeFilterTextPayload | null;
};

export const EMPTY_SCHOOL_CATEGORY_FILTERS: SchoolCategoryFilterPayload = {
  institutionTypeId: null,
  highSchoolType: null,
  commonSingle: {},
  commonMulti: {},
  commonRange: {},
  groupSelections: {},
  studentAgeRange: null,
};
