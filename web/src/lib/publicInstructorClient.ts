"use client";

/**
 * Herkese açık eğitmen liste/detay sayfaları.
 * Önce public.public_instructors; başarısız olursa public.instructors (yalnızca güvenli sütunlar).
 *
 * Eğitmen paneli formları / güncelleme için instructorProfileClient.ts → public.instructors
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { INSTRUCTORS_TABLE } from "@/lib/instructorProfileClient";

export const PUBLIC_INSTRUCTORS_TABLE = "public_instructors" as const;

/** instructors tablosu ile uyumlu güvenli sütunlar (tc, owner_auth_id vb. yok) */
export const PUBLIC_INSTRUCTOR_ROW_SELECT =
  "id, name, surname, title, branch, school, bio, about, city, district, address, profile_picture, experience_years, education_level, working_hours_start, working_hours_end, website, email, phone, is_approved, is_active";

export const PUBLIC_INSTRUCTOR_ROW_SELECT_WITH_SLUG = `${PUBLIC_INSTRUCTOR_ROW_SELECT}, slug`;

export const PUBLIC_INSTRUCTOR_ROW_SELECT_BASE =
  "id, name, surname, title, branch, school, bio, about, city, district, profile_picture, experience_years, education_level, working_hours_start, working_hours_end, website, is_approved, is_active";

export const PUBLIC_INSTRUCTOR_ROW_SELECT_BASE_WITH_SLUG = `${PUBLIC_INSTRUCTOR_ROW_SELECT_BASE}, slug`;

export type PublicInstructorRow = {
  id: number;
  slug?: string | null;
  name?: string | null;
  surname?: string | null;
  title?: string | null;
  branch?: string | null;
  school?: string | null;
  bio?: string | null;
  about?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  profile_picture?: string | null;
  experience_years?: number | null;
  education_level?: string | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  is_approved?: boolean | null;
  is_active?: boolean | null;
  category_id?: number | null;
  category_name?: string | null;
};

function hasSupabaseResponseError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error !== "object") return true;
  const row = error as { message?: string; code?: string };
  if (row.message || row.code) return true;
  return Object.keys(error as object).length > 0;
}

function describeSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const row = error as { message?: string; code?: string; details?: string };
  return [row.message, row.code, row.details].filter(Boolean).join(" | ") || JSON.stringify(error);
}

export function publicInstructorDisplayName(row: PublicInstructorRow | null): string {
  if (!row) return "Eğitmen";
  const combined = `${String(row.name ?? "").trim()} ${String(row.surname ?? "").trim()}`.trim();
  return combined || "Eğitmen";
}

type InstructorQueryResult = {
  data: PublicInstructorRow | null;
  error: unknown;
};

async function enrichPublicInstructorContact(
  row: PublicInstructorRow,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<PublicInstructorRow> {
  const hasEmail = Boolean(String(row.email ?? "").trim());
  const hasPhone = Boolean(String(row.phone ?? "").trim());
  const hasAddress = Boolean(String(row.address ?? "").trim());
  const hasFacebook = Boolean(String(row.facebook_url ?? "").trim());
  const hasInstagram = Boolean(String(row.instagram_url ?? "").trim());
  const hasX = Boolean(String(row.x_url ?? "").trim());
  const hasLinkedin = Boolean(String(row.linkedin_url ?? "").trim());
  if (hasEmail && hasPhone && hasAddress && hasFacebook && hasInstagram && hasX && hasLinkedin) {
    return row;
  }

  const { data, error } = await supabase
    .from(INSTRUCTORS_TABLE)
    .select("email, phone, address, facebook_url, instagram_url, x_url, linkedin_url")
    .eq("id", row.id)
    .eq("is_active", true)
    .eq("is_approved", true)
    .maybeSingle();

  if (error || !data) return row;

  const contact = data as {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    facebook_url?: string | null;
    instagram_url?: string | null;
    x_url?: string | null;
    linkedin_url?: string | null;
  };
  return {
    ...row,
    email: hasEmail ? row.email : contact.email ?? null,
    phone: hasPhone ? row.phone : contact.phone ?? null,
    address: hasAddress ? row.address : contact.address ?? null,
    facebook_url: hasFacebook ? row.facebook_url : contact.facebook_url ?? null,
    instagram_url: hasInstagram ? row.instagram_url : contact.instagram_url ?? null,
    x_url: hasX ? row.x_url : contact.x_url ?? null,
    linkedin_url: hasLinkedin ? row.linkedin_url : contact.linkedin_url ?? null,
  };
}

async function enrichPublicInstructorCategory(
  row: PublicInstructorRow,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<PublicInstructorRow> {
  if (String(row.category_name ?? "").trim()) return row;

  let categoryId = row.category_id;
  if (categoryId == null || !Number.isFinite(Number(categoryId))) {
    const { data, error } = await supabase
      .from(INSTRUCTORS_TABLE)
      .select("category_id")
      .eq("id", row.id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    if (error || !data) return row;
    categoryId = (data as { category_id?: number | null }).category_id ?? null;
  }

  if (categoryId == null || !Number.isFinite(Number(categoryId))) return row;

  const { data: catData, error: catError } = await supabase
    .from("instructor_categories")
    .select("name")
    .eq("id", Number(categoryId))
    .eq("is_active", true)
    .maybeSingle();

  if (catError || !catData) {
    return { ...row, category_id: Number(categoryId) };
  }

  const categoryName = String((catData as { name?: string | null }).name ?? "").trim();
  if (!categoryName) {
    return { ...row, category_id: Number(categoryId) };
  }

  return {
    ...row,
    category_id: Number(categoryId),
    category_name: categoryName,
  };
}

async function queryPublicInstructorRow(
  table: string,
  select: string,
  param: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<InstructorQueryResult> {
  const trimmed = String(param ?? "").trim();
  const isNumericId = /^\d+$/.test(trimmed);

  let query = supabase.from(table).select(select).eq("is_active", true).eq("is_approved", true);

  if (isNumericId) {
    query = query.eq("id", Number(trimmed));
  } else if (select.includes("slug")) {
    query = query.eq("slug", trimmed);
  } else {
    return { data: null, error: { message: "slug column unavailable" } };
  }

  const { data, error } = await query.maybeSingle();
  return { data: (data as PublicInstructorRow | null) ?? null, error };
}

/** Liste / arama — yalnızca aktif profiller */
export async function fetchPublicInstructorsListClient(options?: {
  limit?: number;
  city?: string;
  supabase?: ReturnType<typeof createSupabaseBrowserClient>;
}): Promise<{
  rows: PublicInstructorRow[];
  error: { message: string } | null;
}> {
  const supabase = options?.supabase ?? createSupabaseBrowserClient();
  const limit = options?.limit ?? 100;
  const city = String(options?.city ?? "").trim();

  const attempts: Array<{ table: string; select: string }> = [
    { table: PUBLIC_INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT },
    { table: INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT },
  ];

  for (const { table, select } of attempts) {
    let query = supabase
      .from(table)
      .select(select)
      .eq("is_active", true)
      .eq("is_approved", true)
      .order("name", { ascending: true })
      .order("surname", { ascending: true })
      .limit(limit);

    if (city) query = query.eq("city", city);

    const { data, error } = await query;
    if (!hasSupabaseResponseError(error)) {
      return { rows: ((data ?? []) as unknown) as PublicInstructorRow[], error: null };
    }
    console.warn(`[public_instructors] list (${table}):`, describeSupabaseError(error));
  }

  return { rows: [], error: { message: "Eğitmen listesi yüklenemedi." } };
}

/** Detay — slug veya sayısal id */
export async function fetchPublicInstructorBySlugClient(
  slug: string,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  row: PublicInstructorRow | null;
  error: { message: string } | null;
}> {
  return fetchPublicInstructorByParamClient(slug, supabaseArg);
}

export async function fetchPublicInstructorByParamClient(
  param: string,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  row: PublicInstructorRow | null;
  error: { message: string } | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const trimmed = String(param ?? "").trim();
  if (!trimmed) return { row: null, error: null };

  const attempts: Array<{ table: string; select: string }> = [
    { table: PUBLIC_INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT_WITH_SLUG },
    { table: PUBLIC_INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT },
    { table: PUBLIC_INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT_BASE_WITH_SLUG },
    { table: PUBLIC_INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT_BASE },
    { table: INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT_WITH_SLUG },
    { table: INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT },
    { table: INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT_BASE_WITH_SLUG },
    { table: INSTRUCTORS_TABLE, select: PUBLIC_INSTRUCTOR_ROW_SELECT_BASE },
  ];

  for (const { table, select } of attempts) {
    const { data, error } = await queryPublicInstructorRow(table, select, trimmed, supabase);
    if (!hasSupabaseResponseError(error) && data) {
      const withContact = await enrichPublicInstructorContact(data, supabase);
      const enriched = await enrichPublicInstructorCategory(withContact, supabase);
      return { row: enriched, error: null };
    }
    if (hasSupabaseResponseError(error)) {
      console.warn(`[public_instructors] detail (${table}):`, describeSupabaseError(error));
    }
  }

  return { row: null, error: { message: "Eğitmen profili yüklenemedi." } };
}
