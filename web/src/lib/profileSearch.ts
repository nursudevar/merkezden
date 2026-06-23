type SupabaseLike = {
  from: (table: string) => any;
};

const TRUTHY_TERMS = ["evet", "var", "true", "yes"];
const QUERY_PAGE_SIZE = 1000;
const MAX_QUERY_PAGES = 50;

export function normalizeProfileSearchText(value: string): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function profileTextMatches(value: unknown, searchTerm: string): boolean {
  const needle = normalizeProfileSearchText(searchTerm);
  if (!needle) return false;
  const haystack = normalizeProfileSearchText(String(value ?? ""));
  if (!haystack) return false;
  return haystack.includes(needle) || needle.includes(haystack);
}

export function buildProfileSearchVariants(rawValue: string): string[] {
  const value = String(rawValue ?? "").trim();
  if (!value) return [];
  const normalized = normalizeProfileSearchText(value);
  return Array.from(
    new Set(
      [
        value,
        value.toLocaleLowerCase("tr-TR"),
        value.toLocaleUpperCase("tr-TR"),
        normalized,
        normalized.toLocaleUpperCase("tr-TR"),
      ]
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
}

export function escapeProfileLikeValue(value: string): string {
  return String(value ?? "")
    .replace(/[(),]/g, " ")
    .replace(/[.%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNumbers(values: Iterable<number>): number[] {
  return Array.from(new Set(Array.from(values).filter((id) => Number.isFinite(id))));
}

function matchesBooleanSearch(value: boolean | null | undefined, searchTerm: string): boolean {
  if (value !== true) return false;
  const needle = normalizeProfileSearchText(searchTerm);
  return TRUTHY_TERMS.some((term) => term.includes(needle) || needle.includes(term));
}

type InstitutionSearchIds = {
  institutionIds: number[];
  institutionTypeIds: number[];
};

async function resolveDirectInstitutionIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<number[]> {
  const ids = new Set<number>();
  const select =
    "id, institution_name, type, subheading, about, city, district, address, official_phone, official_email, website, facebook_url, instagram_url, x_url, linkedin_url";

  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const from = page * QUERY_PAGE_SIZE;
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("institutions")
      .select(select)
      .range(from, to);
    if (error) return uniqueNumbers(ids);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      const matches = [
        row.institution_name,
        row.type,
        row.subheading,
        row.about,
        row.city,
        row.district,
        row.address,
        row.official_phone,
        row.official_email,
        row.website,
        row.facebook_url,
        row.instagram_url,
        row.x_url,
        row.linkedin_url,
      ].some((value) => profileTextMatches(value, searchTerm));
      if (matches) ids.add(id);
    }
    if (rows.length < QUERY_PAGE_SIZE) break;
  }

  return uniqueNumbers(ids);
}

export async function resolveInstitutionIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<InstitutionSearchIds> {
  const trimmed = String(searchTerm ?? "").trim();
  if (!trimmed) return { institutionIds: [], institutionTypeIds: [] };

  const [typeRes, groupRes, defRes, choiceRes, entryRes, announcementRes] = await Promise.all([
    supabase
      .from("institution_types")
      .select("id, name, category:institution_categories(name)"),
    supabase
      .from("institution_feature_groups")
      .select("id, name")
      .eq("is_active", true),
    supabase
      .from("institution_feature_definitions")
      .select("id, group_id, name, slug, input_type, unit")
      .eq("is_active", true),
    supabase
      .from("institution_feature_choices")
      .select("id, feature_definition_id, name")
      .eq("is_active", true),
    supabase
      .from("institution_feature_entries")
      .select("id, institution_id, feature_definition_id, selected_choice_id, text_answer, number_answer, boolean_answer"),
    supabase
      .from("announcements")
      .select("institution_id, title, content")
      .eq("is_active", true),
  ]);

  if (typeRes.error || groupRes.error || defRes.error || choiceRes.error || entryRes.error || announcementRes.error) {
    return { institutionIds: [], institutionTypeIds: [] };
  }

  const institutionIds = new Set<number>();
  const directInstitutionIds = await resolveDirectInstitutionIdsByProfileSearch(supabase, trimmed);
  directInstitutionIds.forEach((id) => institutionIds.add(id));

  const typeIds = ((typeRes.data ?? []) as Array<{
    id: number;
    name?: string | null;
    category?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>)
    .filter((row) => {
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      return profileTextMatches(row.name, trimmed) || profileTextMatches(category?.name, trimmed);
    })
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));

  const groups = (groupRes.data ?? []) as Array<{ id: number; name?: string | null }>;
  const defs = (defRes.data ?? []) as Array<{
    id: number;
    group_id: number;
    name?: string | null;
    slug?: string | null;
    input_type?: string | null;
    unit?: string | null;
  }>;
  const choices = (choiceRes.data ?? []) as Array<{
    id: number;
    feature_definition_id: number;
    name?: string | null;
  }>;
  const entries = (entryRes.data ?? []) as Array<{
    id: number;
    institution_id: number;
    feature_definition_id: number;
    selected_choice_id: number | null;
    text_answer: string | null;
    number_answer: number | null;
    boolean_answer: boolean | null;
  }>;

  const matchedGroupIds = new Set(
    groups.filter((group) => profileTextMatches(group.name, trimmed)).map((group) => Number(group.id)),
  );
  const matchedDefinitionIds = new Set(
    defs
      .filter(
        (def) =>
          matchedGroupIds.has(Number(def.group_id)) ||
          profileTextMatches(def.name, trimmed) ||
          profileTextMatches(def.slug, trimmed) ||
          profileTextMatches(def.unit, trimmed),
      )
      .map((def) => Number(def.id)),
  );
  const matchedChoiceIds = new Set(
    choices.filter((choice) => profileTextMatches(choice.name, trimmed)).map((choice) => Number(choice.id)),
  );

  const entryIdToInstitutionId = new Map<number, number>();
  for (const entry of entries) {
    const entryId = Number(entry.id);
    const institutionId = Number(entry.institution_id);
    if (!Number.isFinite(entryId) || !Number.isFinite(institutionId)) continue;
    entryIdToInstitutionId.set(entryId, institutionId);

    const selectedChoiceId = Number(entry.selected_choice_id);
    if (
      matchedDefinitionIds.has(Number(entry.feature_definition_id)) ||
      (Number.isFinite(selectedChoiceId) && matchedChoiceIds.has(selectedChoiceId)) ||
      profileTextMatches(entry.text_answer, trimmed) ||
      profileTextMatches(entry.number_answer, trimmed) ||
      matchesBooleanSearch(entry.boolean_answer, trimmed)
    ) {
      institutionIds.add(institutionId);
    }
  }

  if (matchedChoiceIds.size > 0 && entryIdToInstitutionId.size > 0) {
    const { data: entryChoices } = await supabase
      .from("institution_feature_entry_choices")
      .select("institution_feature_entry_id, choice_id")
      .in("choice_id", uniqueNumbers(matchedChoiceIds));

    for (const row of (entryChoices ?? []) as Array<{ institution_feature_entry_id: number; choice_id: number }>) {
      const choiceId = Number(row.choice_id);
      if (!matchedChoiceIds.has(choiceId)) continue;
      const institutionId = entryIdToInstitutionId.get(Number(row.institution_feature_entry_id));
      if (Number.isFinite(institutionId)) institutionIds.add(institutionId!);
    }
  }

  for (const row of (announcementRes.data ?? []) as Array<{
    institution_id: number | null;
    title?: string | null;
    content?: string | null;
  }>) {
    const institutionId = Number(row.institution_id);
    if (!Number.isFinite(institutionId)) continue;
    if (profileTextMatches(row.title, trimmed) || profileTextMatches(row.content, trimmed)) {
      institutionIds.add(institutionId);
    }
  }

  return {
    institutionIds: uniqueNumbers(institutionIds),
    institutionTypeIds: uniqueNumbers(typeIds),
  };
}

export async function resolveInstructorIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<number[]> {
  const trimmed = String(searchTerm ?? "").trim();
  if (!trimmed) return [];

  const [groupRes, defRes, choiceRes, entryRes, announcementRes] = await Promise.all([
    supabase
      .from("institution_feature_groups")
      .select("id, name")
      .eq("is_active", true),
    supabase
      .from("institution_feature_definitions")
      .select("id, group_id, name, slug, input_type, unit")
      .eq("is_active", true),
    supabase
      .from("institution_feature_choices")
      .select("id, feature_definition_id, name")
      .eq("is_active", true),
    supabase
      .from("instructor_feature_entries")
      .select("id, instructor_id, feature_definition_id, value_text, value_number, value_boolean, value_date, selected_choice_id"),
    supabase
      .from("instructor_announcements")
      .select("instructor_id, title, content")
      .eq("is_active", true),
  ]);

  if (groupRes.error || defRes.error || choiceRes.error || entryRes.error || announcementRes.error) {
    return [];
  }

  const instructorIds = new Set<number>();
  const directInstructorIds = await resolveDirectInstructorIdsByProfileSearch(supabase, trimmed);
  directInstructorIds.forEach((id) => instructorIds.add(id));
  const groups = (groupRes.data ?? []) as Array<{ id: number; name?: string | null }>;
  const defs = (defRes.data ?? []) as Array<{
    id: number;
    group_id: number;
    name?: string | null;
    slug?: string | null;
    unit?: string | null;
  }>;
  const choices = (choiceRes.data ?? []) as Array<{
    id: number;
    feature_definition_id: number;
    name?: string | null;
  }>;
  const entries = (entryRes.data ?? []) as Array<{
    id: number;
    instructor_id: number;
    feature_definition_id: number;
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_date: string | null;
    selected_choice_id: number | null;
  }>;

  const matchedGroupIds = new Set(
    groups.filter((group) => profileTextMatches(group.name, trimmed)).map((group) => Number(group.id)),
  );
  const matchedDefinitionIds = new Set(
    defs
      .filter(
        (def) =>
          matchedGroupIds.has(Number(def.group_id)) ||
          profileTextMatches(def.name, trimmed) ||
          profileTextMatches(def.slug, trimmed) ||
          profileTextMatches(def.unit, trimmed),
      )
      .map((def) => Number(def.id)),
  );
  const matchedChoiceIds = new Set(
    choices.filter((choice) => profileTextMatches(choice.name, trimmed)).map((choice) => Number(choice.id)),
  );

  const entryIdToInstructorId = new Map<number, number>();
  for (const entry of entries) {
    const entryId = Number(entry.id);
    const instructorId = Number(entry.instructor_id);
    if (!Number.isFinite(entryId) || !Number.isFinite(instructorId)) continue;
    entryIdToInstructorId.set(entryId, instructorId);

    const selectedChoiceId = Number(entry.selected_choice_id);
    if (
      matchedDefinitionIds.has(Number(entry.feature_definition_id)) ||
      (Number.isFinite(selectedChoiceId) && matchedChoiceIds.has(selectedChoiceId)) ||
      profileTextMatches(entry.value_text, trimmed) ||
      profileTextMatches(entry.value_number, trimmed) ||
      profileTextMatches(entry.value_date, trimmed) ||
      matchesBooleanSearch(entry.value_boolean, trimmed)
    ) {
      instructorIds.add(instructorId);
    }
  }

  if (matchedChoiceIds.size > 0 && entryIdToInstructorId.size > 0) {
    const { data: entryChoices } = await supabase
      .from("instructor_feature_entry_choices")
      .select("instructor_feature_entry_id, choice_id")
      .in("choice_id", uniqueNumbers(matchedChoiceIds));

    for (const row of (entryChoices ?? []) as Array<{ instructor_feature_entry_id: number; choice_id: number }>) {
      const choiceId = Number(row.choice_id);
      if (!matchedChoiceIds.has(choiceId)) continue;
      const instructorId = entryIdToInstructorId.get(Number(row.instructor_feature_entry_id));
      if (Number.isFinite(instructorId)) instructorIds.add(instructorId!);
    }
  }

  for (const row of (announcementRes.data ?? []) as Array<{
    instructor_id: number | null;
    title?: string | null;
    content?: string | null;
  }>) {
    const instructorId = Number(row.instructor_id);
    if (!Number.isFinite(instructorId)) continue;
    if (profileTextMatches(row.title, trimmed) || profileTextMatches(row.content, trimmed)) {
      instructorIds.add(instructorId);
    }
  }

  return uniqueNumbers(instructorIds);
}

async function resolveDirectInstructorIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<number[]> {
  const ids = new Set<number>();
  const select =
    "id, name, surname, full_name, title, branch, bio, about, school, city, district, address, email, phone, website, facebook_url, instagram_url, x_url, linkedin_url, education_level, lesson_type, service_type, price_range, graduated_university, experience_years";

  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const from = page * QUERY_PAGE_SIZE;
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("instructors")
      .select(select)
      .eq("is_active", true)
      .range(from, to);
    if (error) return uniqueNumbers(ids);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      const matches = [
        row.name,
        row.surname,
        row.full_name,
        row.title,
        row.branch,
        row.bio,
        row.about,
        row.school,
        row.city,
        row.district,
        row.address,
        row.email,
        row.phone,
        row.website,
        row.facebook_url,
        row.instagram_url,
        row.x_url,
        row.linkedin_url,
        row.education_level,
        row.lesson_type,
        row.service_type,
        row.price_range,
        row.graduated_university,
        row.experience_years,
      ].some((value) => profileTextMatches(value, searchTerm));
      if (matches) ids.add(id);
    }
    if (rows.length < QUERY_PAGE_SIZE) break;
  }

  return uniqueNumbers(ids);
}
