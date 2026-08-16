"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTOR_MEDIA_BUCKET } from "@/lib/instructorMediaClient";
import {
  INSTRUCTOR_FEATURE_ENTRIES_TABLE,
  INSTRUCTOR_FEATURE_ENTRY_CHOICES_TABLE,
  type InstructorFeatureGroupRow,
} from "@/lib/instructorFeaturesClient";
import {
  mapPublicInstructorFeatures,
  type PublicInstructorFeatureLine,
  type PublicInstructorFeatureSection,
} from "@/lib/instructorPublicFeatures";
import {
  fetchPublicInstructorByParamClient,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import {
  buildLocationAdMaps,
  formatAnnouncementLocationLabel,
  lookupLocationAds,
  parseLocationId,
} from "@/lib/turkiyeLocationsClient";

export { fetchPublicInstructorByParamClient, publicInstructorDisplayName };
export type { PublicInstructorFeatureLine, PublicInstructorFeatureSection };

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
  announcementTag: string | null;
  locationLabel: string | null;
  il_id: number | null;
  ilce_id: number | null;
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
    { label: "Mezun Olunan Okul", value: row.school ?? null },
    { label: "Bölüm", value: row.department ?? null },
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
    .select("id, title, content, image_url, link_url, announcement_tag, created_at, il_id, ilce_id")
    .eq("instructor_id", instructorId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[instructor][detail][announcements]", serializeSupabaseError(error));
    return { items: [], error };
  }

  const rows = ((data ?? []) as Array<{
    id: number;
    title: string | null;
    content: string | null;
    image_url: string | null;
    link_url: string | null;
    announcement_tag: string | null;
    created_at: string | null;
    il_id?: number | null;
    ilce_id?: number | null;
  }>);

  const locationMaps = await buildLocationAdMaps(rows);

  const items = rows
    .map((row) => {
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      const il_id = parseLocationId(row.il_id);
      const ilce_id = parseLocationId(row.ilce_id);
      const { ilAd, ilceAd } = lookupLocationAds(il_id, ilce_id, locationMaps);
      return {
        id: String(row.id),
        title,
        content: String(row.content ?? "").trim(),
        imageUrl: row.image_url ? String(row.image_url).trim() || null : null,
        linkUrl: row.link_url ? String(row.link_url).trim() || null : null,
        createdAt: row.created_at ? String(row.created_at) : null,
        announcementTag: row.announcement_tag ? String(row.announcement_tag).trim() || null : null,
        locationLabel: formatAnnouncementLocationLabel(ilAd, ilceAd) || null,
        il_id,
        ilce_id,
      };
    })
    .filter((item): item is PublicInstructorAnnouncementItem => item !== null);

  return { items, error: null };
}

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

  const entries = (entriesData ?? []) as Array<{
    id: number;
    feature_definition_id: number;
    text_answer: string | null;
    number_answer: number | null;
    boolean_answer: boolean | null;
    selected_choice_id: number | null;
  }>;
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

  const rawGroups: InstructorFeatureGroupRow[] = ((groupsData ?? []) as Array<{
    id: number;
    name: string;
    slug?: string | null;
    display_order?: number | null;
    category_slug?: string | null;
  }>).map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug ?? null,
    display_order: g.display_order ?? null,
    category_slug: g.category_slug ?? null,
  }));

  const mapped = mapPublicInstructorFeatures({
    groups: rawGroups,
    definitions: (definitionsData ?? []) as Array<{
      id: number;
      group_id: number;
      name: string;
      slug: string | null;
      input_type: string;
      unit: string | null;
      display_order: number | null;
    }>,
    choices: (choicesData ?? []) as Array<{
      id: number;
      feature_definition_id: number;
      name: string | null;
      display_order?: number | null;
    }>,
    entries,
    entryChoices,
    categorySlug: instructorCategorySlug,
  });

  return {
    academicLines: mapped.academicLines,
    sections: mapped.sections,
    universityLabel: null,
  };
}
