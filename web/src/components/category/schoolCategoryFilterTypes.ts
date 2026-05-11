/**
 * Okul kategori sayfası sol panel filtrelerinin `useCategoryInstitutions` ile
 * paylaşılan seri hali. Tüm alanlar opsiyonel / boş olabilir.
 */
export type SchoolCategoryFilterPayload = {
  institutionTypeId: number | null;
  /** Başlıca Özellikler single_select: definitionId → seçilen choice id (string). */
  commonSingle: Record<number, string>;
  /** Başlıca Özellikler multi_select: definitionId → seçilen choice id listesi. */
  commonMulti: Record<number, string[]>;
  /** Başlıca Özellikler number (aralık): definitionId → min/max string (boş = sınır yok). */
  commonRange: Record<number, { min: string; max: string }>;
  /** Kategori-spesifik gruplar: groupId → seçilen anahtarlar (`choice:123` | `def:456`). */
  groupSelections: Record<number, string[]>;
};

export const EMPTY_SCHOOL_CATEGORY_FILTERS: SchoolCategoryFilterPayload = {
  institutionTypeId: null,
  commonSingle: {},
  commonMulti: {},
  commonRange: {},
  groupSelections: {},
};
