"use client";

/**
 * Herkese açık eğitmen liste/detay sayfaları.
 * Yalnızca public.public_instructors görünümünü kullanın (RLS-safe).
 *
 * Eğitmen paneli formları / güncelleme için instructorProfileClient.ts → public.instructors
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** public.public_instructors — hassas alanlar (tc, owner_auth_id vb.) yok */
export const PUBLIC_INSTRUCTORS_TABLE = "public_instructors" as const;

export const PUBLIC_INSTRUCTOR_ROW_SELECT =
  "id, slug, name, surname, full_name, title, branch, subheading, bio, about, city, district, profile_picture, experience_years, education_level, lesson_type, service_type, price_range, working_hours_start, working_hours_end, website, is_verified, is_active";

export type PublicInstructorRow = {
  id: number;
  slug?: string | null;
  name?: string | null;
  surname?: string | null;
  full_name?: string | null;
  title?: string | null;
  branch?: string | null;
  subheading?: string | null;
  bio?: string | null;
  about?: string | null;
  city?: string | null;
  district?: string | null;
  profile_picture?: string | null;
  experience_years?: number | null;
  education_level?: string | null;
  lesson_type?: string | null;
  service_type?: string | null;
  price_range?: string | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  website?: string | null;
  is_verified?: boolean | null;
  is_active?: boolean | null;
};

export function publicInstructorDisplayName(row: PublicInstructorRow | null): string {
  if (!row) return "Eğitmen";
  const fromFull = String(row.full_name ?? "").trim();
  if (fromFull) return fromFull;
  const combined = `${String(row.name ?? "").trim()} ${String(row.surname ?? "").trim()}`.trim();
  return combined || "Eğitmen";
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

  let query = supabase
    .from(PUBLIC_INSTRUCTORS_TABLE)
    .select(PUBLIC_INSTRUCTOR_ROW_SELECT)
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(limit);

  const city = String(options?.city ?? "").trim();
  if (city) {
    query = query.eq("city", city);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[public_instructors] list:", error);
    return { rows: [], error: { message: error.message } };
  }

  return { rows: (data ?? []) as PublicInstructorRow[], error: null };
}

/** Detay — slug ile */
export async function fetchPublicInstructorBySlugClient(
  slug: string,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  row: PublicInstructorRow | null;
  error: { message: string } | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) {
    return { row: null, error: null };
  }

  const { data, error } = await supabase
    .from(PUBLIC_INSTRUCTORS_TABLE)
    .select(PUBLIC_INSTRUCTOR_ROW_SELECT)
    .eq("slug", normalizedSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[public_instructors] detail:", error);
    return { row: null, error: { message: error.message } };
  }

  return { row: (data as PublicInstructorRow | null) ?? null, error: null };
}
