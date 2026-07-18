"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTOR_MEDIA_BUCKET } from "@/lib/instructorMediaClient";
import {
  INSTRUCTOR_FEATURE_ENTRIES_TABLE,
  INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE,
  getDisplayInstructorFeatureName,
  isInstructorFeatureGroupVisibleForCategory,
  parseValidTimeHHMM,
} from "@/lib/instructorFeaturesClient";
import {
  fetchPublicInstructorByParamClient,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";

export { fetchPublicInstructorByParamClient, publicInstructorDisplayName };

export type PublicInstructorFeatureLine = {
  label: string;
  value: string | string[];
  isBadgeList?: boolean;
};

export type PublicInstructorFeatureSection = {
  id: number;
  name: string;
  badges: string[];
};

export type PublicInstructorGalleryItem = {
  id: string;
  url: string;
};

export type PublicInstructorAnnouncementItem = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string | null;
};

export function resolvePublicInstructorProfilePictureUrl(
  profilePicture: string | null | undefined,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): string {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const raw = String(profilePicture ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.replace(/^\/+/, "");
  return supabase.storage.from(INSTRUCTOR_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
}

export function buildInstructorProfileSummaryLines(
  row: PublicInstructorRow,
): PublicInstructorFeatureLine[] {
  const lines: Array<{ label: string; value: string | null }> = [
    { label: "Branş", value: row.branch ?? null },
    { label: "Ünvan", value: row.title ?? null },
    { label: "Mezun Olunan Okul", value: row.school ?? null },
    {
      label: "Deneyim Yılı",
      value:
        typeof row.experience_years === "number" && Number.isFinite(row.experience_years)
          ? `${row.experience_years} yıl`
          : null,
    },
    { label: "Eğitim Seviyesi", value: row.education_level ?? null },
  ];

  return lines
    .map((line) => ({ ...line, value: String(line.value ?? "").trim() }))
    .filter((line) => line.value.length > 0)
    .map((line) => ({ label: line.label, value: line.value }));
}

function serializeSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return null;
  const record = err as Record<string, unknown>;
  return {
    message: String(record.message ?? ""),
    code: String(record.code ?? ""),
  };
}

function isUnauthorizedSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const record = err as Record<string, unknown>;
  const code = String(record.code ?? "");
  const message = String(record.message ?? "").toLowerCase();
  return (
    code === "401" ||
    code === "42501" ||
    message.includes("unauthorized") ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

export async function fetchPublicInstructorGalleryClient(
  instructorId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ items: PublicInstructorGalleryItem[]; error: unknown }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("instructor_media")
    .select("id, file_url, file_path, media_type, created_at")
    .eq("instructor_id", instructorId)
    .eq("media_type", "gallery")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[instructor][detail][gallery]", serializeSupabaseError(error));
    return { items: [], error };
  }

  const rows = (data ?? []) as Array<{
    id: number;
    file_url: string | null;
    file_path: string | null;
  }>;

  const items = rows
    .map((row) => {
      const rawUrl = String(row.file_url ?? "").trim();
      if (rawUrl) return { id: String(row.id), url: rawUrl };
      const path = String(row.file_path ?? "").trim().replace(/^\/+/, "");
      if (!path) return null;
      const url = supabase.storage.from(INSTRUCTOR_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl ?? "";
      return url ? { id: String(row.id), url } : null;
    })
    .filter((item): item is PublicInstructorGalleryItem => Boolean(item));

  return { items, error: null };
}

export async function fetchPublicInstructorAnnouncementsClient(
  instructorId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ items: PublicInstructorAnnouncementItem[]; error: unknown }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("instructor_announcements")
    .select("id, title, content, image_url, link_url, created_at")
    .eq("instructor_id", instructorId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[instructor][detail][announcements]", serializeSupabaseError(error));
    return { items: [], error };
  }

  const items = ((data ?? []) as Array<{
    id: number;
    title: string | null;
    content: string | null;
    image_url: string | null;
    link_url: string | null;
    created_at: string | null;
  }>)
    .map((row) => {
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      return {
        id: String(row.id),
        title,
        content: String(row.content ?? "").trim(),
        imageUrl: row.image_url ? String(row.image_url).trim() || null : null,
        linkUrl: row.link_url ? String(row.link_url).trim() || null : null,
        createdAt: row.created_at ? String(row.created_at) : null,
      };
    })
    .filter((item): item is PublicInstructorAnnouncementItem => item !== null);

  return { items, error: null };
}

type DetailFeatureDefinition = {
  id: number;
  group_id: number;
  name: string;
  slug: string | null;
  input_type: string;
  unit: string | null;
  display_order: number | null;
};

type DetailFeatureEntry = {
  id: number;
  feature_definition_id: number;
  text_answer: string | null;
  number_answer: number | null;
  boolean_answer: boolean | null;
  selected_choice_id: number | null;
};

export async function fetchPublicInstructorFeatureDisplayClient(
  instructorId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  academicLines: PublicInstructorFeatureLine[];
  sections: PublicInstructorFeatureSection[];
  universityLabel: string | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const empty = { academicLines: [], sections: [], universityLabel: null };

  const { data: instructorRow, error: instructorError } = await supabase
    .from("instructors")
    .select("category_id")
    .eq("id", instructorId)
    .maybeSingle();

  if (instructorError && !isUnauthorizedSupabaseError(instructorError)) {
    console.warn("[instructor][detail][category]", serializeSupabaseError(instructorError));
  }

  let instructorCategorySlug: string | null = null;
  const categoryId = instructorRow?.category_id;
  if (categoryId != null && Number.isFinite(Number(categoryId))) {
    const { data: catRow } = await supabase
      .from("instructor_categories")
      .select("slug")
      .eq("id", Number(categoryId))
      .maybeSingle();
    const slug = String(catRow?.slug ?? "").trim();
    instructorCategorySlug = slug.length > 0 ? slug : null;
  }

  const [
    { data: groupsData, error: groupsError },
    { data: definitionsData, error: definitionsError },
    { data: choicesData, error: choicesError },
    { data: entriesData, error: entriesError },
  ] = await Promise.all([
    supabase
      .from("instructor_feature_groups")
      .select("id, name, slug, display_order, is_active, category_slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("instructor_feature_definitions")
      .select("id, group_id, name, slug, input_type, unit, display_order, is_active, show_on_detail")
      .eq("is_active", true)
      .eq("show_on_detail", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("instructor_feature_choices")
      .select("id, feature_definition_id, name, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from(INSTRUCTOR_FEATURE_ENTRIES_TABLE)
      .select(
        "id, feature_definition_id, text_answer, number_answer, boolean_answer, selected_choice_id",
      )
      .eq("instructor_id", instructorId),
  ]);

  if (groupsError || definitionsError || choicesError || entriesError) {
    if (
      [groupsError, definitionsError, choicesError, entriesError].some((e) =>
        isUnauthorizedSupabaseError(e),
      )
    ) {
      return empty;
    }
    console.warn("[instructor][detail][features]", {
      groupsError: serializeSupabaseError(groupsError),
      definitionsError: serializeSupabaseError(definitionsError),
      choicesError: serializeSupabaseError(choicesError),
      entriesError: serializeSupabaseError(entriesError),
    });
    return empty;
  }

  const entries = (entriesData ?? []) as DetailFeatureEntry[];
  const entryIds = entries.map((e) => e.id);
  let entryChoices: Array<{ instructor_feature_entry_id: number; choice_id: number }> = [];
  if (entryIds.length > 0) {
    const { data: ecData, error: ecError } = await supabase
      .from(INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE)
      .select("instructor_feature_entry_id, choice_id")
      .in("instructor_feature_entry_id", entryIds);
    if (ecError && !isUnauthorizedSupabaseError(ecError)) {
      console.warn("[instructor][detail][feature-choices]", serializeSupabaseError(ecError));
    } else {
      entryChoices = (ecData ?? []) as typeof entryChoices;
    }
  }

  const groups = ((groupsData ?? []) as Array<{
    id: number;
    name: string;
    slug?: string | null;
    display_order?: number | null;
    category_slug?: string | null;
  }>)
    .filter((g) =>
      isInstructorFeatureGroupVisibleForCategory(
        {
          name: g.name,
          slug: g.slug ?? null,
          category_slug: g.category_slug ?? null,
        },
        instructorCategorySlug,
      ),
    )
    .sort(
      (a, b) =>
        (Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER) -
        (Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER),
    );

  const definitions = (definitionsData ?? []) as DetailFeatureDefinition[];
  const choices = (choicesData ?? []) as Array<{
    id: number;
    feature_definition_id: number;
    name: string | null;
    display_order?: number | null;
  }>;

  const visibleGroupIds = new Set(groups.map((g) => g.id));
  const visibleDefinitions = definitions.filter((d) => visibleGroupIds.has(d.group_id));

  const entriesByFeatureId = new Map(entries.map((e) => [e.feature_definition_id, e]));
  const choiceNameById = new Map<number, string>();
  const choiceOrderById = new Map<number, number>();
  choices.forEach((c) => {
    const label = String(c.name ?? "").trim();
    if (label) choiceNameById.set(c.id, label);
    choiceOrderById.set(
      c.id,
      Number.isFinite(Number(c.display_order)) ? Number(c.display_order) : Number.MAX_SAFE_INTEGER,
    );
  });
  const choiceIdsByEntryId = new Map<number, number[]>();
  entryChoices.forEach((row) => {
    const current = choiceIdsByEntryId.get(row.instructor_feature_entry_id) ?? [];
    if (!current.includes(row.choice_id)) current.push(row.choice_id);
    choiceIdsByEntryId.set(row.instructor_feature_entry_id, current);
  });

  const orderedChoiceLabels = (choiceIds: number[]): string[] => {
    return [...choiceIds]
      .sort(
        (a, b) =>
          (choiceOrderById.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (choiceOrderById.get(b) ?? Number.MAX_SAFE_INTEGER),
      )
      .map((id) => choiceNameById.get(id) ?? "")
      .filter(Boolean);
  };

  const extractValue = (feature: DetailFeatureDefinition): string | string[] | null => {
    const entry = entriesByFeatureId.get(feature.id);
    if (!entry) return null;

    if (feature.input_type === "boolean") {
      return entry.boolean_answer === true ? "Evet" : null;
    }

    if (feature.input_type === "single_select") {
      if (entry.selected_choice_id != null) {
        const label = choiceNameById.get(Number(entry.selected_choice_id));
        return label ?? null;
      }
      const labels = orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []);
      return labels[0] ?? null;
    }

    if (feature.input_type === "multi_select") {
      const labels = orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []);
      return labels.length > 0 ? labels : null;
    }

    if (feature.input_type === "number") {
      if (typeof entry.number_answer !== "number" || !Number.isFinite(entry.number_answer)) return null;
      const unit = String(feature.unit ?? "").trim();
      return `${entry.number_answer}${unit ? ` ${unit}` : ""}`.trim();
    }

    if (feature.input_type === "date") {
      const d = entry.text_answer ? String(entry.text_answer).slice(0, 10) : "";
      return d || null;
    }

    const text = String(entry.text_answer ?? "").trim();
    if (!text) return null;
    const validTime = parseValidTimeHHMM(text);
    if (validTime) return validTime;
    return text;
  };

  const buildLinesForGroup = (groupId: number): PublicInstructorFeatureLine[] => {
    const lines: PublicInstructorFeatureLine[] = [];
    const features = visibleDefinitions
      .filter((f) => f.group_id === groupId)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));

    for (const feature of features) {
      const value = extractValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      const label = getDisplayInstructorFeatureName(String(feature.name ?? "").trim());
      if (!label) continue;
      lines.push({
        label,
        value,
        ...(feature.input_type === "multi_select" && Array.isArray(value) ? { isBadgeList: true } : {}),
      });
    }
    return lines;
  };

  const buildBadgesForGroup = (groupId: number): string[] => {
    const badges: string[] = [];
    const features = visibleDefinitions
      .filter((f) => f.group_id === groupId)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));

    for (const feature of features) {
      const entry = entriesByFeatureId.get(feature.id);
      if (!entry) continue;
      const label = getDisplayInstructorFeatureName(String(feature.name ?? "").trim());

      if (feature.input_type === "boolean") {
        if (entry.boolean_answer === true) badges.push(label);
        continue;
      }

      if (feature.input_type === "single_select") {
        if (entry.selected_choice_id != null) {
          const choiceLabel = choiceNameById.get(Number(entry.selected_choice_id));
          if (choiceLabel) badges.push(choiceLabel);
        } else {
          orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []).forEach((choiceLabel) => {
            badges.push(choiceLabel);
          });
        }
        continue;
      }

      if (feature.input_type === "multi_select") {
        orderedChoiceLabels(choiceIdsByEntryId.get(entry.id) ?? []).forEach((choiceLabel) => {
          badges.push(choiceLabel);
        });
        continue;
      }

      const value = extractValue(feature);
      if (!value) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => badges.push(v));
      } else if (feature.input_type === "text" || feature.input_type === "number" || feature.input_type === "date") {
        badges.push(`${label}: ${value}`);
      }
    }

    return Array.from(new Set(badges));
  };

  const generalGroups = groups.filter((g) => !(g.category_slug ?? "").trim());
  const categoryGroups = groups.filter((g) => Boolean((g.category_slug ?? "").trim()));

  const academicLines: PublicInstructorFeatureLine[] = [];
  for (const group of generalGroups) {
    academicLines.push(...buildLinesForGroup(group.id));
  }

  const sections: PublicInstructorFeatureSection[] = categoryGroups
    .map((group) => ({
      id: group.id,
      name: group.name,
      badges: buildBadgesForGroup(group.id),
    }))
    .filter((s) => s.badges.length > 0);

  return { academicLines, sections, universityLabel: null };
}
