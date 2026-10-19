import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  INSTRUCTOR_FEATURE_ENTRIES_TABLE,
  INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE,
} from "@/lib/instructorFeaturesClient";

export const INSTRUCTOR_EXTRA_CATEGORIES_TABLE = "instructor_extra_categories" as const;
export const MAX_INSTRUCTOR_EXTRA_BRANCHES = 5;

/**
 * Desteklenen ek kategori slug → Tür grubu adı.
 * Eşleme kategori slug'ı ve grup adıyla yapılır; definition veya kategori kimliği sabitlenmez.
 */
export const INSTRUCTOR_EXTRA_BRANCH_GROUP_BY_SLUG: Readonly<Record<string, string>> = {
  "kurs-sinava-hazirlik": "Özel Ders Türleri",
  spor: "Spor Türleri",
  sanat: "Sanat Türleri",
  "yabanci-dil": "Yabancı Dil Türleri",
  "kisisel-gelisim": "Eğitim Türleri",
  "mesleki-egitim": "Mesleki Eğitim Türleri",
  "ozel-egitim": "Özel Eğitim Türleri",
  "surucu-kursu": "Eğitim Türleri",
  "patili-dostlar": "Hizmet Türü",
};

const SUPPORTED_EXTRA_BRANCH_SLUGS = new Set(Object.keys(INSTRUCTOR_EXTRA_BRANCH_GROUP_BY_SLUG));

export type InstructorExtraBranchCategory = {
  id: number;
  name: string;
  slug: string;
};

export type InstructorExtraCategoryRelation = {
  categoryId: number;
  displayOrder: number;
};

export type InstructorExtraBranchBooleanDefinition = {
  id: number;
  name: string;
  display_order: number | null;
};

export type InstructorExtraBranchSlot = {
  categoryId: number;
  displayOrder: number;
  category: InstructorExtraBranchCategory;
  groupName: string;
  definitions: InstructorExtraBranchBooleanDefinition[];
};

export type LoadedInstructorExtraBranches = {
  relations: InstructorExtraCategoryRelation[];
  slots: InstructorExtraBranchSlot[];
  booleanValues: Record<number, boolean>;
};

export type PublicInstructorExtraBranch = {
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  displayOrder: number;
  groupName: string;
  selectedTypeNames: string[];
};

export type InstructorExtraBranchSlotInput = {
  categoryId: number;
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
  return INSTRUCTOR_EXTRA_BRANCH_GROUP_BY_SLUG[key] ?? null;
}

export function isSupportedExtraBranchSlug(slug: string): boolean {
  return SUPPORTED_EXTRA_BRANCH_SLUGS.has(normalizeSlug(slug));
}

export function isAllowedExtraBranchCategory(
  category: Pick<InstructorExtraBranchCategory, "slug">,
  mainCategoryId?: number | null,
  categoryId?: number | null,
): boolean {
  const slug = normalizeSlug(category.slug);
  if (!slug || !isSupportedExtraBranchSlug(slug)) return false;
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

export async function fetchSupportedExtraBranchCategoriesClient(
  supabase: SupabaseBrowser,
  options?: { mainCategoryId?: number | null },
): Promise<InstructorExtraBranchCategory[]> {
  const mainCategoryId = options?.mainCategoryId ?? null;

  const { data, error } = await supabase
    .from("instructor_categories")
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
      const category: InstructorExtraBranchCategory = { id: row.id, name, slug };
      if (!isAllowedExtraBranchCategory(category, mainCategoryId, row.id)) return null;
      return category;
    })
    .filter((row): row is InstructorExtraBranchCategory => row !== null);
}

export async function loadInstructorExtraCategoryRelationsClient(
  supabase: SupabaseBrowser,
  instructorId: number,
): Promise<InstructorExtraCategoryRelation[]> {
  const normalizedInstructorId = Number(instructorId);
  if (!Number.isFinite(normalizedInstructorId) || normalizedInstructorId <= 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(INSTRUCTOR_EXTRA_CATEGORIES_TABLE)
    .select("category_id, display_order")
    .eq("instructor_id", normalizedInstructorId)
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
    .filter((row): row is InstructorExtraCategoryRelation => row !== null);
}

export async function fetchExtraBranchBooleanDefinitionsForSlugClient(
  supabase: SupabaseBrowser,
  categorySlug: string,
): Promise<{
  groupName: string;
  definitions: InstructorExtraBranchBooleanDefinition[];
}> {
  const slug = normalizeSlug(categorySlug);
  const groupName = resolveExtraBranchGroupNameForSlug(slug);
  if (!groupName) {
    return { groupName: "", definitions: [] };
  }

  const { data: groupsData, error: groupsError } = await supabase
    .from("instructor_feature_groups")
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
    .from("instructor_feature_definitions")
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
): Promise<InstructorExtraBranchCategory | null> {
  const { data, error } = await supabase
    .from("instructor_categories")
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
  instructorId: number,
  definitionIds: number[],
): Promise<Record<number, boolean>> {
  const booleanValues: Record<number, boolean> = {};
  if (definitionIds.length === 0) return booleanValues;

  const { data, error } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("feature_definition_id, boolean_answer")
    .eq("instructor_id", instructorId)
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

export async function loadInstructorExtraBranchesClient(
  supabase: SupabaseBrowser,
  instructorId: number,
): Promise<LoadedInstructorExtraBranches> {
  const relations = await loadInstructorExtraCategoryRelationsClient(supabase, instructorId);
  const slots: InstructorExtraBranchSlot[] = [];
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
    instructorId,
    Array.from(new Set(allDefinitionIds)),
  );

  return { relations, slots, booleanValues };
}

/** Public eğitmen profili için ek branş verisini görüntüleme modeline dönüştürür. */
export function mapLoadedInstructorExtraBranchesForPublicProfile(
  loaded: LoadedInstructorExtraBranches,
  options?: { mainCategorySlug?: string | null },
): PublicInstructorExtraBranch[] {
  const mainSlug = normalizeSlug(options?.mainCategorySlug ?? "");

  return loaded.slots
    .filter((slot) => {
      const slug = normalizeSlug(slot.category.slug);
      if (!slug || !isSupportedExtraBranchSlug(slug)) return false;
      if (!slot.groupName.trim()) return false;
      if (mainSlug && slug === mainSlug) return false;
      return true;
    })
    .sort(
      (a, b) => a.displayOrder - b.displayOrder || a.categoryId - b.categoryId,
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

async function persistSingleBooleanEntryClient(
  supabase: SupabaseBrowser,
  instructorId: number,
  featureDefinitionId: number,
  value: boolean,
  existingEntryId?: number | null,
): Promise<void> {
  if (existingEntryId) {
    const { error } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
      .update({ boolean_answer: value })
      .eq("id", existingEntryId)
      .eq("instructor_id", instructorId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(INSTRUCTOR_FEATURE_ENTRIES_TABLE).insert({
    instructor_id: instructorId,
    feature_definition_id: featureDefinitionId,
    boolean_answer: value,
  });
  if (error) throw error;
}

export async function clearExtraBranchEntriesForCategorySlugClient(
  supabase: SupabaseBrowser,
  instructorId: number,
  categorySlug: string,
): Promise<void> {
  const normalizedInstructorId = Number(instructorId);
  if (!Number.isFinite(normalizedInstructorId) || normalizedInstructorId <= 0) return;

  const { definitions } = await fetchExtraBranchBooleanDefinitionsForSlugClient(
    supabase,
    categorySlug,
  );
  const definitionIds = definitions.map((def) => def.id);
  if (definitionIds.length === 0) return;

  const { data: entriesData, error: entriesError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("id")
    .eq("instructor_id", normalizedInstructorId)
    .in("feature_definition_id", definitionIds);

  if (entriesError) throw entriesError;

  const entryIds = ((entriesData ?? []) as Array<{ id: number }>)
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));

  if (entryIds.length === 0) return;

  const { error: choicesError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
    .delete()
    .in("instructor_feature_entry_id", entryIds);
  if (choicesError) throw choicesError;

  const { error: deleteError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .delete()
    .in("id", entryIds)
    .eq("instructor_id", normalizedInstructorId);

  if (deleteError) throw deleteError;
}

export async function removeMainCategoryFromExtraBranchesIfPresentClient(
  supabase: SupabaseBrowser,
  instructorId: number,
  mainCategoryId: number,
): Promise<void> {
  const normalizedInstructorId = Number(instructorId);
  const normalizedMainCategoryId = Number(mainCategoryId);
  if (!Number.isFinite(normalizedInstructorId) || normalizedInstructorId <= 0) return;
  if (!Number.isFinite(normalizedMainCategoryId) || normalizedMainCategoryId <= 0) return;

  const { error } = await supabase
    .from(INSTRUCTOR_EXTRA_CATEGORIES_TABLE)
    .delete()
    .eq("instructor_id", normalizedInstructorId)
    .eq("category_id", normalizedMainCategoryId);

  if (error) throw error;
}

function validateExtraBranchSlotsInput(
  slots: InstructorExtraBranchSlotInput[],
  mainCategoryId?: number | null,
): InstructorExtraCategoryRelation[] {
  if (slots.length > MAX_INSTRUCTOR_EXTRA_BRANCHES) {
    throw new Error(`En fazla ${MAX_INSTRUCTOR_EXTRA_BRANCHES} ek kategori seçilebilir.`);
  }

  const normalized: InstructorExtraCategoryRelation[] = [];
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

    normalized.push({ categoryId, displayOrder: index });
  });

  return normalized;
}

export async function saveInstructorExtraCategoryRelationsClient(
  supabase: SupabaseBrowser,
  instructorId: number,
  slots: InstructorExtraBranchSlotInput[],
  options?: {
    mainCategoryId?: number | null;
    previousCategoryIds?: number[];
  },
): Promise<void> {
  const normalizedInstructorId = Number(instructorId);
  if (!Number.isFinite(normalizedInstructorId) || normalizedInstructorId <= 0) {
    throw new Error("Geçersiz eğitmen kimliği.");
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
      normalizedInstructorId,
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
    .from(INSTRUCTOR_EXTRA_CATEGORIES_TABLE)
    .delete()
    .eq("instructor_id", normalizedInstructorId);

  if (deleteError) throw deleteError;

  if (normalizedSlots.length > 0) {
    const { error: insertError } = await supabase.from(INSTRUCTOR_EXTRA_CATEGORIES_TABLE).insert(
      normalizedSlots.map((slot) => ({
        instructor_id: normalizedInstructorId,
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
      normalizedInstructorId,
      mainCategoryId,
    );
  }
}

export async function saveInstructorExtraBranchBooleanValuesClient(
  supabase: SupabaseBrowser,
  instructorId: number,
  categorySlug: string,
  booleanValues: Record<number, boolean>,
): Promise<void> {
  const normalizedInstructorId = Number(instructorId);
  if (!Number.isFinite(normalizedInstructorId) || normalizedInstructorId <= 0) {
    throw new Error("Geçersiz eğitmen kimliği.");
  }

  const slug = normalizeSlug(categorySlug);
  if (!isSupportedExtraBranchSlug(slug)) {
    throw new Error("Desteklenmeyen ek kategori slug'ı.");
  }

  const { definitions } = await fetchExtraBranchBooleanDefinitionsForSlugClient(supabase, slug);
  if (definitions.length === 0) return;

  const definitionIds = definitions.map((def) => def.id);
  const { data: existingEntries, error: existingError } = await supabase
    .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
    .select("id, feature_definition_id")
    .eq("instructor_id", normalizedInstructorId)
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
      normalizedInstructorId,
      definition.id,
      value,
      existingByDefinitionId.get(definition.id),
    );
  }
}

export async function saveInstructorExtraBranchesClient(
  supabase: SupabaseBrowser,
  instructorId: number,
  slots: InstructorExtraBranchSlotInput[],
  booleanValuesByCategorySlug: Record<string, Record<number, boolean>>,
  options?: {
    mainCategoryId?: number | null;
    previousCategoryIds?: number[];
  },
): Promise<void> {
  await saveInstructorExtraCategoryRelationsClient(supabase, instructorId, slots, options);

  for (const slot of slots) {
    const category = await fetchCategoryByIdClient(supabase, slot.categoryId);
    if (!category) continue;
    const values =
      booleanValuesByCategorySlug[category.slug] ??
      booleanValuesByCategorySlug[normalizeSlug(category.slug)] ??
      {};
    await saveInstructorExtraBranchBooleanValuesClient(
      supabase,
      instructorId,
      category.slug,
      values,
    );
  }
}

export async function collectInstructorExtraBranchProtectedDefinitionIds(
  supabase: SupabaseBrowser,
  instructorId: number,
): Promise<number[]> {
  const relations = await loadInstructorExtraCategoryRelationsClient(supabase, instructorId);
  const protectedIds = new Set<number>();

  for (const relation of relations) {
    const category = await fetchCategoryByIdClient(supabase, relation.categoryId);
    if (!category || !isSupportedExtraBranchSlug(category.slug)) continue;

    const { definitions } = await fetchExtraBranchBooleanDefinitionsForSlugClient(
      supabase,
      category.slug,
    );
    for (const definition of definitions) {
      protectedIds.add(definition.id);
    }
  }

  return Array.from(protectedIds);
}
