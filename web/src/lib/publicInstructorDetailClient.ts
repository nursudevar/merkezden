"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTOR_MEDIA_BUCKET } from "@/lib/instructorMediaClient";
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

const normalizeFeatureText = (v: string) =>
  v
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");

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

  const [
    { data: groupsData, error: groupsError },
    { data: definitionsData, error: definitionsError },
    { data: choicesData, error: choicesError },
    { data: entriesData, error: entriesError },
  ] = await Promise.all([
    supabase
      .from("institution_feature_groups")
      .select("id, name, display_order, is_active, category_slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("institution_feature_definitions")
      .select("id, group_id, name, slug, input_type, unit, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("institution_feature_choices")
      .select("id, feature_definition_id, name, is_active")
      .eq("is_active", true)
      .order("id", { ascending: true }),
    supabase
      .from("instructor_feature_entries")
      .select(
        "id, feature_definition_id, value_text, value_number, value_boolean, value_date, selected_choice_id",
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
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_date: string | null;
    selected_choice_id: number | null;
  }>;

  const entryIds = entries.map((e) => e.id);
  let entryChoices: Array<{ instructor_feature_entry_id: number; choice_id: number }> = [];
  if (entryIds.length > 0) {
    const { data: ecData, error: ecError } = await supabase
      .from("instructor_feature_entry_choices")
      .select("instructor_feature_entry_id, choice_id")
      .in("instructor_feature_entry_id", entryIds);
    if (ecError && !isUnauthorizedSupabaseError(ecError)) {
      console.warn("[instructor][detail][feature-choices]", serializeSupabaseError(ecError));
    } else {
      entryChoices = (ecData ?? []) as typeof entryChoices;
    }
  }

  const groups = (groupsData ?? []) as Array<{
    id: number;
    name: string;
    category_slug?: string | null;
  }>;
  const definitions = (definitionsData ?? []) as Array<{
    id: number;
    group_id: number;
    name: string;
    slug: string | null;
    input_type: string;
    unit: string | null;
    display_order: number | null;
  }>;
  const choices = (choicesData ?? []) as Array<{
    id: number;
    feature_definition_id: number;
    name: string | null;
  }>;

  const entriesByFeatureId = new Map(entries.map((e) => [e.feature_definition_id, e]));
  const choiceNameById = new Map<number, string>();
  choices.forEach((c) => {
    const label = String(c.name ?? "").trim();
    if (label) choiceNameById.set(c.id, label);
  });
  const selectedChoiceIdsByEntryId = new Map<number, number[]>();
  entryChoices.forEach((row) => {
    const current = selectedChoiceIdsByEntryId.get(row.instructor_feature_entry_id) ?? [];
    if (!current.includes(row.choice_id)) current.push(row.choice_id);
    selectedChoiceIdsByEntryId.set(row.instructor_feature_entry_id, current);
  });

  const extractValue = (feature: (typeof definitions)[0]): string | string[] | null => {
    const entry = entriesByFeatureId.get(feature.id);
    if (!entry) return null;
    if (feature.input_type === "boolean") return entry.value_boolean === true ? "Evet" : null;
    if (feature.input_type === "single_select") {
      const id = entry.selected_choice_id;
      return id ? choiceNameById.get(id) ?? null : null;
    }
    if (feature.input_type === "multi_select") {
      const labels = (selectedChoiceIdsByEntryId.get(entry.id) ?? [])
        .map((id) => choiceNameById.get(id) ?? "")
        .filter(Boolean);
      return labels.length > 0 ? labels : null;
    }
    if (feature.input_type === "number") {
      if (typeof entry.value_number !== "number" || !Number.isFinite(entry.value_number)) return null;
      const unit = String(feature.unit ?? "").trim();
      return `${entry.value_number}${unit ? ` ${unit}` : ""}`.trim();
    }
    if (feature.input_type === "date") {
      const d = entry.value_date ? String(entry.value_date).slice(0, 10) : "";
      return d || null;
    }
    const text = String(entry.value_text ?? "").trim();
    return text || null;
  };

  const baslicaGroup = groups.find(
    (g) => (g.name ?? "").trim().toLocaleLowerCase("tr-TR") === "başlıca özellikler",
  );
  const academicLines: PublicInstructorFeatureLine[] = [];
  let universityLabel: string | null = null;

  if (baslicaGroup) {
    const features = definitions
      .filter((f) => f.group_id === baslicaGroup.id)
      .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
    const used = new Set<number>();
    for (const feature of features) {
      const value = extractValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      const label = String(feature.name ?? "").trim();
      if (!label) continue;
      used.add(feature.id);
      const textKey = normalizeFeatureText(`${feature.slug ?? ""} ${label}`);
      if (textKey.includes("universite") || textKey.includes("mezun")) {
        universityLabel = Array.isArray(value) ? value.join(", ") : value;
      }
      academicLines.push({
        label,
        value,
        ...(feature.input_type === "multi_select" && Array.isArray(value) ? { isBadgeList: true } : {}),
      });
    }
    for (const feature of features) {
      if (used.has(feature.id)) continue;
      const value = extractValue(feature);
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      const label = String(feature.name ?? "").trim();
      if (!label) continue;
      academicLines.push({
        label,
        value,
        ...(feature.input_type === "multi_select" && Array.isArray(value) ? { isBadgeList: true } : {}),
      });
    }
  }

  const badgeGroups = groups.filter((g) => {
    const nameKey = (g.name ?? "").trim().toLocaleLowerCase("tr-TR");
    return nameKey !== "başlıca özellikler";
  });

  const sections: PublicInstructorFeatureSection[] = badgeGroups
    .map((group) => {
      const badges: string[] = [];
      definitions
        .filter((f) => f.group_id === group.id)
        .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999))
        .forEach((feature) => {
          const entry = entriesByFeatureId.get(feature.id);
          if (!entry) return;
          if (feature.input_type === "boolean") {
            if (entry.value_boolean === true) badges.push(feature.name);
            return;
          }
          if (feature.input_type === "single_select") {
            const label = entry.selected_choice_id
              ? choiceNameById.get(entry.selected_choice_id)
              : null;
            if (label) badges.push(label);
            return;
          }
          if (feature.input_type === "multi_select") {
            (selectedChoiceIdsByEntryId.get(entry.id) ?? []).forEach((choiceId) => {
              const label = choiceNameById.get(choiceId);
              if (label) badges.push(label);
            });
            return;
          }
          if (feature.input_type === "text") {
            const value = String(entry.value_text ?? "").trim();
            if (value) badges.push(`${feature.name}: ${value}`);
            return;
          }
          if (feature.input_type === "number") {
            if (typeof entry.value_number === "number" && Number.isFinite(entry.value_number)) {
              const unit = String(feature.unit ?? "").trim();
              badges.push(`${feature.name}: ${entry.value_number}${unit ? ` ${unit}` : ""}`);
            }
          }
        });
      return { id: group.id, name: group.name, badges: Array.from(new Set(badges)) };
    })
    .filter((s) => s.badges.length > 0);

  return { academicLines, sections, universityLabel };
}
