import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const INSTITUTION_EXTRA_CATEGORIES_TABLE = "institution_extra_categories" as const;
export const MAX_INSTITUTION_EXTRA_BRANCHES = 5;

/** Desteklenen ek kategori slug → Türleri grubu adı (ID hardcode yok). */
export const INSTITUTION_EXTRA_BRANCH_GROUP_BY_SLUG: Readonly<Record<string, string>> = {
  "kurs-sinava-hazirlik": "Kurs Türleri",
  spor: "Spor Türleri",
  sanat: "Sanat Türleri",
  "yabanci-dil": "Yabancı Dil Türleri",
  "kisisel-gelisim": "Eğitim Türleri",
  "mesleki-egitim": "Mesleki Eğitim Türleri",
  "ozel-egitim": "Özel Eğitim Türleri",
};

const SUPPORTED_EXTRA_BRANCH_SLUGS = new Set(Object.keys(INSTITUTION_EXTRA_BRANCH_GROUP_BY_SLUG));

const EXCLUDED_EXTRA_BRANCH_SLUGS = new Set(["okul", "surucu-kursu", "patili-dostlar"]);

export type InstitutionExtraBranchCategory = {
  id: number;
  name: string;
  slug: string;
};

export type InstitutionExtraCategoryRelation = {
  categoryId: number;
  displayOrder: number;
};

export type InstitutionExtraBranchBooleanDefinition = {
  id: number;
  name: string;
  display_order: number | null;
};

export type InstitutionExtraBranchSlot = {
  categoryId: number;
  displayOrder: number;
  category: InstitutionExtraBranchCategory;
  groupName: string;
  definitions: InstitutionExtraBranchBooleanDefinition[];
};

export type LoadedInstitutionExtraBranches = {
  relations: InstitutionExtraCategoryRelation[];
  slots: InstitutionExtraBranchSlot[];
  booleanValues: Record<number, boolean>;
};

export type InstitutionExtraBranchSlotInput = {
  categoryId: number;
};

export type PublicInstitutionExtraBranch = {
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  displayOrder: number;
  groupName: string;
  selectedTypeNames: string[];
};

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

function normalizeSlug(value: string): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeGroupName(value: string): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveExtraBranchGroupNameForSlug(slug: string): string | null {
  const key = normalizeSlug(slug);
  return INSTITUTION_EXTRA_BRANCH_GROUP_BY_SLUG[key] ?? null;
}

export function isSupportedExtraBranchSlug(slug: string): boolean {
  return SUPPORTED_EXTRA_BRANCH_SLUGS.has(normalizeSlug(slug));
}

export function isExcludedExtraBranchSlug(slug: string): boolean {
  return EXCLUDED_EXTRA_BRANCH_SLUGS.has(normalizeSlug(slug));
}

export function isAllowedExtraBranchCategory(
  category: Pick<InstitutionExtraBranchCategory, "slug">,
  mainCategoryId?: number | null,
  categoryId?: number | null,
): boolean {
  const slug = normalizeSlug(category.slug);
  if (!slug || isExcludedExtraBranchSlug(slug)) return false;
  if (!isSupportedExtraBranchSlug(slug)) return false;
  if (
    mainCategoryId != null &&
    Number.isFinite(Number(mainCategoryId)) &&
    categoryId != null &&
    Number(categoryId) === Number(mainCategoryId)
  ) {
    return false;
  }
  return true;
}

/** 1. Desteklenen ek kategorileri DB'den yükler; ana kategoriyi hariç tutar. */
export async function fetchSupportedExtraBranchCategoriesClient(
  supabase: SupabaseBrowser,
  options?: { mainCategoryId?: number | null },
): Promise<InstitutionExtraBranchCategory[]> {
  const mainCategoryId = options?.mainCategoryId ?? null;

  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, slug, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<{ id: number; name: string | null; slug: string | null }>)
    .map((row) => {
      const slug = normalizeSlug(String(row.slug ?? ""));
      const name = String(row.name ?? "").trim();
      if (!slug || !name) return null;
      const category: InstitutionExtraBranchCategory = { id: row.id, name, slug };
      if (!isAllowedExtraBranchCategory(category, mainCategoryId, row.id)) return null;
      return category;
    })
    .filter((row): row is InstitutionExtraBranchCategory => row !== null);
}

/** 3. Kurumun mevcut ek kategori relation kayıtlarını display_order ile yükler. */
export async function loadInstitutionExtraCategoryRelationsClient(
  supabase: SupabaseBrowser,
  institutionId: number,
): Promise<InstitutionExtraCategoryRelation[]> {
  const normalizedInstitutionId = Number(institutionId);
  if (!Number.isFinite(normalizedInstitutionId) || normalizedInstitutionId <= 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(INSTITUTION_EXTRA_CATEGORIES_TABLE)
    .select("category_id, display_order")
    .eq("institution_id", normalizedInstitutionId)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("category_id", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<{ category_id: number; display_order: number | null }>)
    .map((row) => {
      const categoryId = Number(row.category_id);
      if (!Number.isFinite(categoryId) || categoryId <= 0) return null;
      const displayOrder = Number(row.display_order);
      return {
        categoryId,
        displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
      };
    })
    .filter((row): row is InstitutionExtraCategoryRelation => row !== null);
}

/** 4. Ek kategori slug'ı için eşlenen Türleri grubunun aktif boolean definition'larını yükler. */
export async function fetchExtraBranchBooleanDefinitionsForSlugClient(
  supabase: SupabaseBrowser,
  categorySlug: string,
): Promise<{
  groupName: string;
  definitions: InstitutionExtraBranchBooleanDefinition[];
}> {
  const slug = normalizeSlug(categorySlug);
  const groupName = resolveExtraBranchGroupNameForSlug(slug);
  if (!groupName) {
    return { groupName: "", definitions: [] };
  }

  const { data: groupsData, error: groupsError } = await supabase
    .from("institution_feature_groups")
    .select("id, name, category_slug, is_active")
    .eq("is_active", true)
    .eq("category_slug", slug);

  if (groupsError) throw groupsError;

  const targetGroupName = normalizeGroupName(groupName);
  const group = ((groupsData ?? []) as Array<{ id: number; name: string | null }>).find(
    (row) => normalizeGroupName(String(row.name ?? "")) === targetGroupName,
  );

  if (!group) {
    return { groupName, definitions: [] };
  }

  const { data: definitionsData, error: definitionsError } = await supabase
    .from("institution_feature_definitions")
    .select("id, name, display_order, input_type, is_active")
    .eq("is_active", true)
    .eq("group_id", group.id)
    .eq("input_type", "boolean")
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (definitionsError) throw definitionsError;

  const definitions = ((definitionsData ?? []) as Array<{
    id: number;
    name: string | null;
    display_order: number | null;
  }>)
    .map((row) => ({
      id: row.id,
      name: String(row.name ?? "").trim(),
      display_order: row.display_order ?? null,
    }))
    .filter((row) => Boolean(row.name));

  return { groupName, definitions };
}

async function fetchCategoryByIdClient(
  supabase: SupabaseBrowser,
  categoryId: number,
): Promise<InstitutionExtraBranchCategory | null> {
  const { data, error } = await supabase
    .from("institution_categories")
    .select("id, name, slug, is_active")
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const slug = normalizeSlug(String((data as { slug: string | null }).slug ?? ""));
  const name = String((data as { name: string | null }).name ?? "").trim();
  if (!slug || !name) return null;

  return { id: Number((data as { id: number }).id), name, slug };
}

async function loadBooleanValuesForDefinitionIdsClient(
  supabase: SupabaseBrowser,
  institutionId: number,
  definitionIds: number[],
): Promise<Record<number, boolean>> {
  const booleanValues: Record<number, boolean> = {};
  if (definitionIds.length === 0) return booleanValues;

  const { data, error } = await supabase
    .from("institution_feature_entries")
    .select("feature_definition_id, boolean_answer")
    .eq("institution_id", institutionId)
    .in("feature_definition_id", definitionIds);

  if (error) throw error;

  for (const row of (data ?? []) as Array<{
    feature_definition_id: number;
    boolean_answer: boolean | null;
  }>) {
    const defId = Number(row.feature_definition_id);
    if (!Number.isFinite(defId)) continue;
    booleanValues[defId] = row.boolean_answer === true;
  }

  return booleanValues;
}

/** Relation + Türleri boolean definition'ları + mevcut entry değerlerini birlikte yükler. */
export async function loadInstitutionExtraBranchesClient(
  supabase: SupabaseBrowser,
  institutionId: number,
): Promise<LoadedInstitutionExtraBranches> {
  const relations = await loadInstitutionExtraCategoryRelationsClient(supabase, institutionId);
  const slots: InstitutionExtraBranchSlot[] = [];
  const allDefinitionIds: number[] = [];

  for (const relation of relations) {
    const category = await fetchCategoryByIdClient(supabase, relation.categoryId);
    if (!category) continue;

    const { groupName, definitions } = await fetchExtraBranchBooleanDefinitionsForSlugClient(
      supabase,
      category.slug,
    );

    definitions.forEach((def) => allDefinitionIds.push(def.id));
    slots.push({
      categoryId: relation.categoryId,
      displayOrder: relation.displayOrder,
      category,
      groupName,
      definitions,
    });
  }

  const booleanValues = await loadBooleanValuesForDefinitionIdsClient(
    supabase,
    institutionId,
    Array.from(new Set(allDefinitionIds)),
  );

  return { relations, slots, booleanValues };
}

async function persistSingleBooleanEntryClient(
  supabase: SupabaseBrowser,
  institutionId: number,
  featureDefinitionId: number,
  value: boolean,
  existingEntryId?: number | null,
): Promise<void> {
  if (existingEntryId) {
    const { error } = await supabase
      .from("institution_feature_entries")
      .update({ boolean_answer: value })
      .eq("id", existingEntryId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("institution_feature_entries").insert({
    institution_id: institutionId,
    feature_definition_id: featureDefinitionId,
    boolean_answer: value,
  });
  if (error) throw error;
}

/** 7. Ek kategorinin eşlenen Türleri grubundaki boolean entry'leri temizler. */
export async function clearExtraBranchEntriesForCategorySlugClient(
  supabase: SupabaseBrowser,
  institutionId: number,
  categorySlug: string,
): Promise<void> {
  const normalizedInstitutionId = Number(institutionId);
  if (!Number.isFinite(normalizedInstitutionId) || normalizedInstitutionId <= 0) return;

  const { definitions } = await fetchExtraBranchBooleanDefinitionsForSlugClient(
    supabase,
    categorySlug,
  );
  const definitionIds = definitions.map((def) => def.id);
  if (definitionIds.length === 0) return;

  const { data: entriesData, error: entriesError } = await supabase
    .from("institution_feature_entries")
    .select("id")
    .eq("institution_id", normalizedInstitutionId)
    .in("feature_definition_id", definitionIds);

  if (entriesError) throw entriesError;

  const entryIds = ((entriesData ?? []) as Array<{ id: number }>)
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));

  if (entryIds.length === 0) return;

  const { error: deleteError } = await supabase
    .from("institution_feature_entries")
    .delete()
    .in("id", entryIds);

  if (deleteError) throw deleteError;
}

/** 8. Ana kategori extra listedeyse yalnızca relation'ı kaldırır; feature entry'lere dokunmaz. */
export async function removeMainCategoryFromExtraBranchesIfPresentClient(
  supabase: SupabaseBrowser,
  institutionId: number,
  mainCategoryId: number,
): Promise<void> {
  const normalizedInstitutionId = Number(institutionId);
  const normalizedMainCategoryId = Number(mainCategoryId);
  if (!Number.isFinite(normalizedInstitutionId) || normalizedInstitutionId <= 0) return;
  if (!Number.isFinite(normalizedMainCategoryId) || normalizedMainCategoryId <= 0) return;

  const { error } = await supabase
    .from(INSTITUTION_EXTRA_CATEGORIES_TABLE)
    .delete()
    .eq("institution_id", normalizedInstitutionId)
    .eq("category_id", normalizedMainCategoryId);

  if (error) throw error;
}

function validateExtraBranchSlotsInput(
  slots: InstitutionExtraBranchSlotInput[],
  mainCategoryId?: number | null,
): InstitutionExtraCategoryRelation[] {
  if (slots.length > MAX_INSTITUTION_EXTRA_BRANCHES) {
    throw new Error(`En fazla ${MAX_INSTITUTION_EXTRA_BRANCHES} ek kategori seçilebilir.`);
  }

  const normalized: InstitutionExtraCategoryRelation[] = [];
  const seenCategoryIds = new Set<number>();

  slots.forEach((slot, index) => {
    const categoryId = Number(slot.categoryId);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      throw new Error("Geçersiz ek kategori seçimi.");
    }
    if (seenCategoryIds.has(categoryId)) {
      throw new Error("Aynı ek kategori birden fazla kez seçilemez.");
    }
    seenCategoryIds.add(categoryId);

    if (
      mainCategoryId != null &&
      Number.isFinite(Number(mainCategoryId)) &&
      categoryId === Number(mainCategoryId)
    ) {
      throw new Error("Ana kategori ek kategori olarak seçilemez.");
    }

    if (index > MAX_INSTITUTION_EXTRA_BRANCHES - 1) {
      throw new Error(`display_order ${index} geçersiz.`);
    }

    normalized.push({ categoryId, displayOrder: index });
  });

  return normalized;
}

/** 5–7. Ek kategori relation'larını kaydeder; kaldırılan kategorilerin Türleri entry'lerini temizler. */
export async function saveInstitutionExtraCategoryRelationsClient(
  supabase: SupabaseBrowser,
  institutionId: number,
  slots: InstitutionExtraBranchSlotInput[],
  options?: {
    mainCategoryId?: number | null;
    previousCategoryIds?: number[];
  },
): Promise<void> {
  const normalizedInstitutionId = Number(institutionId);
  if (!Number.isFinite(normalizedInstitutionId) || normalizedInstitutionId <= 0) {
    throw new Error("Geçersiz kurum kimliği.");
  }

  const normalizedSlots = validateExtraBranchSlotsInput(slots, options?.mainCategoryId);
  const previousCategoryIds = options?.previousCategoryIds ?? [];
  const nextCategoryIdSet = new Set(normalizedSlots.map((slot) => slot.categoryId));

  for (const previousCategoryId of previousCategoryIds) {
    if (nextCategoryIdSet.has(previousCategoryId)) continue;
    const category = await fetchCategoryByIdClient(supabase, previousCategoryId);
    if (!category) continue;
    await clearExtraBranchEntriesForCategorySlugClient(
      supabase,
      normalizedInstitutionId,
      category.slug,
    );
  }

  for (const slot of normalizedSlots) {
    const category = await fetchCategoryByIdClient(supabase, slot.categoryId);
    if (!category || !isAllowedExtraBranchCategory(category, options?.mainCategoryId, category.id)) {
      throw new Error("Seçilen ek kategori desteklenmiyor.");
    }
  }

  const { error: deleteError } = await supabase
    .from(INSTITUTION_EXTRA_CATEGORIES_TABLE)
    .delete()
    .eq("institution_id", normalizedInstitutionId);

  if (deleteError) throw deleteError;

  if (normalizedSlots.length > 0) {
    const { error: insertError } = await supabase.from(INSTITUTION_EXTRA_CATEGORIES_TABLE).insert(
      normalizedSlots.map((slot) => ({
        institution_id: normalizedInstitutionId,
        category_id: slot.categoryId,
        display_order: slot.displayOrder,
      })),
    );
    if (insertError) throw insertError;
  }

  const mainCategoryId = Number(options?.mainCategoryId);
  if (Number.isFinite(mainCategoryId) && mainCategoryId > 0) {
    await removeMainCategoryFromExtraBranchesIfPresentClient(
      supabase,
      normalizedInstitutionId,
      mainCategoryId,
    );
  }
}

/** 6. Tür (boolean) seçimlerini institution_feature_entries'e kaydeder — panel boolean pattern'i. */
export async function saveInstitutionExtraBranchBooleanValuesClient(
  supabase: SupabaseBrowser,
  institutionId: number,
  categorySlug: string,
  booleanValues: Record<number, boolean>,
): Promise<void> {
  const normalizedInstitutionId = Number(institutionId);
  if (!Number.isFinite(normalizedInstitutionId) || normalizedInstitutionId <= 0) {
    throw new Error("Geçersiz kurum kimliği.");
  }

  const slug = normalizeSlug(categorySlug);
  if (!isSupportedExtraBranchSlug(slug)) {
    throw new Error("Desteklenmeyen ek kategori slug'ı.");
  }

  const { definitions } = await fetchExtraBranchBooleanDefinitionsForSlugClient(supabase, slug);
  if (definitions.length === 0) return;

  const definitionIds = definitions.map((def) => def.id);
  const { data: existingEntries, error: existingError } = await supabase
    .from("institution_feature_entries")
    .select("id, feature_definition_id")
    .eq("institution_id", normalizedInstitutionId)
    .in("feature_definition_id", definitionIds);

  if (existingError) throw existingError;

  const existingByDefinitionId = new Map<number, number>();
  for (const row of (existingEntries ?? []) as Array<{ id: number; feature_definition_id: number }>) {
    existingByDefinitionId.set(Number(row.feature_definition_id), Number(row.id));
  }

  for (const definition of definitions) {
    const value = Boolean(booleanValues[definition.id]);
    await persistSingleBooleanEntryClient(
      supabase,
      normalizedInstitutionId,
      definition.id,
      value,
      existingByDefinitionId.get(definition.id),
    );
  }
}

/** Relation + boolean seçimlerini birlikte kaydeder. */
export async function saveInstitutionExtraBranchesClient(
  supabase: SupabaseBrowser,
  institutionId: number,
  slots: InstitutionExtraBranchSlotInput[],
  booleanValuesByCategorySlug: Record<string, Record<number, boolean>>,
  options?: {
    mainCategoryId?: number | null;
    previousCategoryIds?: number[];
  },
): Promise<void> {
  await saveInstitutionExtraCategoryRelationsClient(supabase, institutionId, slots, options);

  for (const slot of slots) {
    const category = await fetchCategoryByIdClient(supabase, slot.categoryId);
    if (!category) continue;
    const values = booleanValuesByCategorySlug[category.slug] ?? booleanValuesByCategorySlug[normalizeSlug(category.slug)] ?? {};
    await saveInstitutionExtraBranchBooleanValuesClient(
      supabase,
      institutionId,
      category.slug,
      values,
    );
  }
}

/** Public kurum profili için yüklenen ek branş verisini görüntüleme modeline dönüştürür. */
export function mapLoadedExtraBranchesForPublicProfile(
  loaded: LoadedInstitutionExtraBranches,
  options?: { mainCategorySlug?: string | null },
): PublicInstitutionExtraBranch[] {
  const mainSlug = normalizeSlug(options?.mainCategorySlug ?? "");

  return loaded.slots
    .filter((slot) => !mainSlug || normalizeSlug(slot.category.slug) !== mainSlug)
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.categoryId - b.categoryId,
    )
    .map((slot) => ({
      categoryId: slot.categoryId,
      categoryName: slot.category.name,
      categorySlug: slot.category.slug,
      displayOrder: slot.displayOrder,
      groupName: slot.groupName,
      selectedTypeNames: slot.definitions
        .filter((definition) => loaded.booleanValues[definition.id] === true)
        .map((definition) => definition.name),
    }));
}
