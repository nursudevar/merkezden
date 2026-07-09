/**
 * Eğitmenler liste sayfası sol panel filtrelerinin paylaşılan seri hali.
 */
export type InstructorCategoryFilterPayload = {
  /** boolean definitionId → seçili mi */
  booleanValues: Record<number, boolean>;
  /** Çoklu boolean gruplarında definitionId → groupId (grup içi OR için) */
  booleanDefinitionGroupIds: Record<number, number>;
  /** single_select definitionId → seçilen choice id (string) */
  singleSelect: Record<number, string>;
  /** multi_select definitionId → seçilen choice id listesi */
  multiSelect: Record<number, string[]>;
  /** number definitionId → min/max string (boş = sınır yok) */
  numberRange: Record<number, { min: string; max: string }>;
};

export const EMPTY_INSTRUCTOR_CATEGORY_FILTERS: InstructorCategoryFilterPayload = {
  booleanValues: {},
  booleanDefinitionGroupIds: {},
  singleSelect: {},
  multiSelect: {},
  numberRange: {},
};
