import { announcementPublicationCutoffIso } from "@/lib/announcementPublication";
import { fetchAllPostgrestPages } from "@/lib/postgrestQueryPages";

type SupabaseLike = {
  from: (table: string) => any;
};

const TRUTHY_TERMS = ["evet", "var", "true", "yes"];
/** PostgREST GET URL limiti — büyük `id.in.(...)` listeleri 400 üretir. */
const IN_CHUNK = 150;

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

async function fetchEntryChoicesByChoiceIds(
  supabase: SupabaseLike,
  table: "institution_feature_entry_choices" | "instructor_feature_entry_choices",
  entryIdColumn: "institution_feature_entry_id" | "instructor_feature_entry_id",
  choiceIds: number[],
): Promise<Array<{ entryId: number; choiceId: number }>> {
  const uniqueChoiceIds = uniqueNumbers(choiceIds).filter((id) => id > 0);
  if (uniqueChoiceIds.length === 0) return [];

  const out: Array<{ entryId: number; choiceId: number }> = [];
  for (let i = 0; i < uniqueChoiceIds.length; i += IN_CHUNK) {
    const choiceChunk = uniqueChoiceIds.slice(i, i + IN_CHUNK);
    const rows = await fetchAllPostgrestPages<Record<string, unknown>>((from, to) =>
      supabase
        .from(table)
        .select(`${entryIdColumn}, choice_id`)
        .in("choice_id", choiceChunk)
        .order(entryIdColumn, { ascending: true })
        .order("choice_id", { ascending: true })
        .range(from, to),
    );
    for (const row of rows) {
      const entryId = Number(row[entryIdColumn]);
      const choiceId = Number(row.choice_id);
      if (!Number.isFinite(entryId) || !Number.isFinite(choiceId)) continue;
      out.push({ entryId, choiceId });
    }
  }
  return out;
}

async function resolveDirectInstitutionIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<number[]> {
  const ids = new Set<number>();
  const select =
    "id, institution_name, type, subheading, about, city, district, address, official_phone, official_email, website, facebook_url, instagram_url, x_url, linkedin_url";

  const rows = await fetchAllPostgrestPages<Record<string, unknown>>((from, to) =>
    supabase
      .from("institutions")
      .select(select)
      .eq("is_approved", true)
      .order("id", { ascending: true })
      .range(from, to),
  );

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

  return uniqueNumbers(ids);
}

export async function resolveInstitutionIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<InstitutionSearchIds> {
  const trimmed = String(searchTerm ?? "").trim();
  if (!trimmed) return { institutionIds: [], institutionTypeIds: [] };

  const [types, groups, defs, choices, entries, announcements] = await Promise.all([
    fetchAllPostgrestPages<{
      id: number;
      name?: string | null;
      category?: { name?: string | null } | Array<{ name?: string | null }> | null;
    }>((from, to) =>
      supabase
        .from("institution_types")
        .select("id, name, category:institution_categories(name)")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{ id: number; name?: string | null }>((from, to) =>
      supabase
        .from("institution_feature_groups")
        .select("id, name")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      group_id: number;
      name?: string | null;
      slug?: string | null;
      input_type?: string | null;
      unit?: string | null;
    }>((from, to) =>
      supabase
        .from("institution_feature_definitions")
        .select("id, group_id, name, slug, input_type, unit")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      feature_definition_id: number;
      name?: string | null;
    }>((from, to) =>
      supabase
        .from("institution_feature_choices")
        .select("id, feature_definition_id, name")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      institution_id: number;
      feature_definition_id: number;
      selected_choice_id: number | null;
      text_answer: string | null;
      number_answer: number | null;
      boolean_answer: boolean | null;
    }>((from, to) =>
      supabase
        .from("institution_feature_entries")
        .select(
          "id, institution_id, feature_definition_id, selected_choice_id, text_answer, number_answer, boolean_answer",
        )
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      institution_id: number | null;
      title?: string | null;
      content?: string | null;
    }>((from, to) =>
      supabase
        .from("announcements")
        .select("id, institution_id, title, content")
        .eq("is_active", true)
        .not("published_at", "is", null)
        .gt("published_at", announcementPublicationCutoffIso())
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const institutionIds = new Set<number>();
  const directInstitutionIds = await resolveDirectInstitutionIdsByProfileSearch(supabase, trimmed);
  directInstitutionIds.forEach((id) => institutionIds.add(id));

  const typeIds = types
    .filter((row) => {
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      return profileTextMatches(row.name, trimmed) || profileTextMatches(category?.name, trimmed);
    })
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));

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

    if (
      matchedDefinitionIds.has(Number(entry.feature_definition_id)) ||
      profileTextMatches(entry.text_answer, trimmed) ||
      profileTextMatches(entry.number_answer, trimmed) ||
      matchesBooleanSearch(entry.boolean_answer, trimmed)
    ) {
      institutionIds.add(institutionId);
    }
  }

  if (matchedChoiceIds.size > 0 && entryIdToInstitutionId.size > 0) {
    const entryChoices = await fetchEntryChoicesByChoiceIds(
      supabase,
      "institution_feature_entry_choices",
      "institution_feature_entry_id",
      Array.from(matchedChoiceIds),
    );
    for (const row of entryChoices) {
      if (!matchedChoiceIds.has(row.choiceId)) continue;
      const institutionId = entryIdToInstitutionId.get(row.entryId);
      if (Number.isFinite(institutionId)) institutionIds.add(institutionId!);
    }
  }

  for (const row of announcements) {
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

async function resolveDirectInstructorIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<number[]> {
  const ids = new Set<number>();
  const select =
    "id, name, surname, full_name, branch, bio, about, school, department, address, email, phone, website, facebook_url, instagram_url, x_url, linkedin_url, lesson_type, service_type, experience_years";

  const rows = await fetchAllPostgrestPages<Record<string, unknown>>((from, to) =>
    supabase
      .from("instructors")
      .select(select)
      .eq("is_active", true)
      .eq("is_approved", true)
      .order("id", { ascending: true })
      .range(from, to),
  );

  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const matches = [
      row.name,
      row.surname,
      row.full_name,
      row.branch,
      row.bio,
      row.about,
      row.school,
      row.department,
      row.address,
      row.email,
      row.phone,
      row.website,
      row.facebook_url,
      row.instagram_url,
      row.x_url,
      row.linkedin_url,
      row.lesson_type,
      row.service_type,
      row.experience_years,
    ].some((value) => profileTextMatches(value, searchTerm));
    if (matches) ids.add(id);
  }

  return uniqueNumbers(ids);
}

export async function resolveInstructorIdsByProfileSearch(
  supabase: SupabaseLike,
  searchTerm: string,
): Promise<number[]> {
  const trimmed = String(searchTerm ?? "").trim();
  if (!trimmed) return [];

  const [groups, defs, choices, entries, announcements] = await Promise.all([
    fetchAllPostgrestPages<{ id: number; name?: string | null }>((from, to) =>
      supabase
        .from("instructor_feature_groups")
        .select("id, name")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      group_id: number;
      name?: string | null;
      slug?: string | null;
      input_type?: string | null;
      unit?: string | null;
    }>((from, to) =>
      supabase
        .from("instructor_feature_definitions")
        .select("id, group_id, name, slug, input_type, unit")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      feature_definition_id: number;
      name?: string | null;
      slug?: string | null;
    }>((from, to) =>
      supabase
        .from("instructor_feature_choices")
        .select("id, feature_definition_id, name, slug")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      instructor_id: number;
      feature_definition_id: number;
      text_answer: string | null;
      number_answer: number | null;
      boolean_answer: boolean | null;
      selected_choice_id: number | null;
    }>((from, to) =>
      supabase
        .from("instructor_feature_entries")
        .select(
          "id, instructor_id, feature_definition_id, text_answer, number_answer, boolean_answer, selected_choice_id",
        )
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPostgrestPages<{
      id: number;
      instructor_id: number | null;
      title?: string | null;
      content?: string | null;
    }>((from, to) =>
      supabase
        .from("instructor_announcements")
        .select("id, instructor_id, title, content")
        .eq("is_active", true)
        .not("published_at", "is", null)
        .gt("published_at", announcementPublicationCutoffIso())
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const instructorIds = new Set<number>();
  const directInstructorIds = await resolveDirectInstructorIdsByProfileSearch(supabase, trimmed);
  directInstructorIds.forEach((id) => instructorIds.add(id));

  const defsById = new Map(defs.map((def) => [Number(def.id), def]));

  const matchedGroupIds = new Set(
    groups.filter((group) => profileTextMatches(group.name, trimmed)).map((group) => Number(group.id)),
  );
  const matchedDefinitionIds = new Set(
    defs
      .filter(
        (def) =>
          matchedGroupIds.has(Number(def.group_id)) ||
          profileTextMatches(def.name, trimmed) ||
          profileTextMatches(def.slug, trimmed),
      )
      .map((def) => Number(def.id)),
  );
  const matchedChoiceIds = new Set(
    choices
      .filter(
        (choice) =>
          profileTextMatches(choice.name, trimmed) || profileTextMatches(choice.slug, trimmed),
      )
      .map((choice) => Number(choice.id)),
  );

  const entryIdToInstructorId = new Map<number, number>();
  for (const entry of entries) {
    const entryId = Number(entry.id);
    const instructorId = Number(entry.instructor_id);
    if (!Number.isFinite(entryId) || !Number.isFinite(instructorId)) continue;
    entryIdToInstructorId.set(entryId, instructorId);

    const def = defsById.get(Number(entry.feature_definition_id));
    const inputType = String(def?.input_type ?? "");

    if (inputType === "boolean") {
      if (
        entry.boolean_answer === true &&
        (matchedDefinitionIds.has(Number(entry.feature_definition_id)) ||
          matchesBooleanSearch(entry.boolean_answer, trimmed))
      ) {
        instructorIds.add(instructorId);
      }
      continue;
    }

    if (profileTextMatches(entry.text_answer, trimmed)) {
      instructorIds.add(instructorId);
    }

    if (
      entry.selected_choice_id != null &&
      matchedChoiceIds.has(Number(entry.selected_choice_id))
    ) {
      instructorIds.add(instructorId);
    }
  }

  if (matchedChoiceIds.size > 0 && entryIdToInstructorId.size > 0) {
    const entryChoices = await fetchEntryChoicesByChoiceIds(
      supabase,
      "instructor_feature_entry_choices",
      "instructor_feature_entry_id",
      Array.from(matchedChoiceIds),
    );
    for (const row of entryChoices) {
      if (!matchedChoiceIds.has(row.choiceId)) continue;
      const instructorId = entryIdToInstructorId.get(row.entryId);
      if (Number.isFinite(instructorId)) instructorIds.add(instructorId!);
    }
  }

  for (const row of announcements) {
    const instructorId = Number(row.instructor_id);
    if (!Number.isFinite(instructorId)) continue;
    if (profileTextMatches(row.title, trimmed) || profileTextMatches(row.content, trimmed)) {
      instructorIds.add(instructorId);
    }
  }

  return uniqueNumbers(instructorIds);
}
