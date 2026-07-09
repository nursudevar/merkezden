"use client";

/**
 * Eğitmen paneli (/egitmen-paneli) ve oturum açmış eğitmenin kendi profil yönetimi.
 * Yalnızca public.instructors tablosunu kullanın.
 *
 * Herkese açık liste/detay için publicInstructorClient.ts → public.public_instructors
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  inputHHMMToDbTimeOrNull,
  institutionTimeToInputHHMM,
} from "@/lib/institutionHelpers";

/** Panel / private CRUD — public_instructors KULLANMAYIN */
export const INSTRUCTORS_TABLE = "instructors" as const;

export const INSTRUCTOR_PROFILE_ROW_SELECT =
  "id, user_id, owner_auth_id, name, surname, email, phone, tc_identity_no, birth_date, reference, school, bio, about, website, facebook_url, instagram_url, x_url, linkedin_url, city, district, address, title, branch, experience_years, education_level, lesson_type, service_type, working_hours_start, working_hours_end, is_approved, is_active, profile_picture, cv_url, category_id, can_edit_category";

export type InstructorProfileRow = {
  id: number;
  user_id?: number | null;
  owner_auth_id?: string | null;
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  phone?: string | null;
  tc_identity_no?: string | null;
  birth_date?: string | null;
  reference?: string | null;
  school?: string | null;
  bio?: string | null;
  about?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  title?: string | null;
  branch?: string | null;
  experience_years?: number | null;
  education_level?: string | null;
  lesson_type?: string | null;
  service_type?: string | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  is_approved?: boolean | null;
  is_active?: boolean | null;
  profile_picture?: string | null;
  cv_url?: string | null;
  category_id?: number | null;
  can_edit_category?: boolean | null;
};

export type InstructorProfileFormState = {
  name: string;
  surname: string;
  email: string;
  phone: string;
  tc_identity_no: string;
  birth_date: string;
  reference: string;
  title: string;
  branch: string;
  experience_years: string;
  education_level: string;
  school: string;
  bio: string;
  about: string;
  website: string;
  facebook_url: string;
  instagram_url: string;
  x_url: string;
  linkedin_url: string;
  city: string;
  district: string;
  address: string;
  working_hours_start: string;
  working_hours_end: string;
};

export const INSTRUCTOR_PROFILE_CITY = "Ankara" as const;

export const EMPTY_INSTRUCTOR_PROFILE_FORM: InstructorProfileFormState = {
  name: "",
  surname: "",
  email: "",
  phone: "",
  tc_identity_no: "",
  birth_date: "",
  reference: "",
  title: "",
  branch: "",
  experience_years: "",
  education_level: "",
  school: "",
  bio: "",
  about: "",
  website: "",
  facebook_url: "",
  instagram_url: "",
  x_url: "",
  linkedin_url: "",
  city: INSTRUCTOR_PROFILE_CITY,
  district: "",
  address: "",
  working_hours_start: "",
  working_hours_end: "",
};

function formatBirthDateForInput(value: string | null | undefined): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return s;
}

export function mapInstructorRowToFormState(row: InstructorProfileRow): InstructorProfileFormState {
  const exp = row.experience_years;
  return {
    name: String(row.name ?? "").trim(),
    surname: String(row.surname ?? "").trim(),
    email: String(row.email ?? "").trim(),
    phone: String(row.phone ?? "").trim(),
    tc_identity_no: String(row.tc_identity_no ?? "").trim(),
    birth_date: formatBirthDateForInput(row.birth_date),
    reference: String(row.reference ?? "").trim(),
    title: String(row.title ?? "").trim(),
    branch: String(row.branch ?? "").trim(),
    experience_years:
      exp != null && Number.isFinite(Number(exp)) ? String(Number(exp)) : "",
    education_level: String(row.education_level ?? "").trim(),
    school: String(row.school ?? "").trim(),
    bio: String(row.bio ?? "").trim(),
    about: String(row.about ?? "").trim(),
    website: String(row.website ?? "").trim(),
    facebook_url: String(row.facebook_url ?? "").trim(),
    instagram_url: String(row.instagram_url ?? "").trim(),
    x_url: String(row.x_url ?? "").trim(),
    linkedin_url: String(row.linkedin_url ?? "").trim(),
    city: INSTRUCTOR_PROFILE_CITY,
    district: String(row.district ?? "").trim(),
    address: String(row.address ?? "").trim(),
    working_hours_start: institutionTimeToInputHHMM(row.working_hours_start),
    working_hours_end: institutionTimeToInputHHMM(row.working_hours_end),
  };
}

export function buildInstructorProfileUpdatePayload(form: InstructorProfileFormState) {
  const expRaw = form.experience_years.trim();
  let experience_years: number | null = null;
  if (expRaw) {
    const n = Number(expRaw);
    if (Number.isFinite(n)) experience_years = n;
  }

  return {
    name: form.name.trim(),
    surname: form.surname.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || null,
    tc_identity_no: form.tc_identity_no.trim(),
    birth_date: form.birth_date.trim(),
    reference: form.reference.trim() || null,
    title: form.title.trim() || null,
    branch: form.branch.trim() || null,
    experience_years,
    education_level: form.education_level.trim() || null,
    school: form.school.trim() || null,
    bio: form.bio.trim() || null,
    about: form.about.trim() || null,
    website: form.website.trim() || null,
    facebook_url: form.facebook_url.trim() || null,
    instagram_url: form.instagram_url.trim() || null,
    x_url: form.x_url.trim() || null,
    linkedin_url: form.linkedin_url.trim() || null,
    city: INSTRUCTOR_PROFILE_CITY,
    district: form.district.trim() || null,
    address: form.address.trim() || null,
    working_hours_start: inputHHMMToDbTimeOrNull(form.working_hours_start),
    working_hours_end: inputHHMMToDbTimeOrNull(form.working_hours_end),
  };
}

export async function loadInstructorRowForAuthUserClient(
  authUid: string,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  row: InstructorProfileRow | null;
  error: { message: string } | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from(INSTRUCTORS_TABLE)
    .select(INSTRUCTOR_PROFILE_ROW_SELECT)
    .eq("owner_auth_id", authUid)
    .maybeSingle();

  if (error) {
    console.error("Instructor profile load (owner_auth_id):", error);
    return { row: null, error: { message: error.message } };
  }

  return { row: (data as InstructorProfileRow | null) ?? null, error: null };
}

export function instructorDisplayNameFromRow(row: InstructorProfileRow | null): string {
  if (!row) return "Eğitmen";
  const full = `${String(row.name ?? "").trim()} ${String(row.surname ?? "").trim()}`.trim();
  return full || "Eğitmen";
}

export function instructorProfileFormsEqual(
  a: InstructorProfileFormState,
  b: InstructorProfileFormState,
): boolean {
  const keys = Object.keys(EMPTY_INSTRUCTOR_PROFILE_FORM) as (keyof InstructorProfileFormState)[];
  return keys.every((key) => String(a[key] ?? "").trim() === String(b[key] ?? "").trim());
}

const INSTRUCTOR_PROFILE_SAVE_SELECT =
  "id, name, surname, email, phone, tc_identity_no, birth_date, reference, school, bio, about, website, facebook_url, instagram_url, x_url, linkedin_url, city, district, address, title, branch, experience_years, education_level, lesson_type, service_type, working_hours_start, working_hours_end, is_approved, is_active, profile_picture, cv_url";

/** Panel: yalnızca oturum sahibinin instructors satırını günceller. */
export async function updateInstructorProfileForAuthUserClient(
  authUid: string,
  instructorId: number,
  form: InstructorProfileFormState,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  row: InstructorProfileRow | null;
  error: { message: string } | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const payload = buildInstructorProfileUpdatePayload(form);

  const { data, error } = await supabase
    .from(INSTRUCTORS_TABLE)
    .update(payload)
    .eq("id", instructorId)
    .eq("owner_auth_id", authUid)
    .select(INSTRUCTOR_PROFILE_SAVE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[instructors] profile save:", error);
    return { row: null, error: { message: error.message } };
  }

  if (!data) {
    return { row: null, error: { message: "Güncelleme sonrası kayıt alınamadı." } };
  }

  return { row: data as InstructorProfileRow, error: null };
}

export async function resolveInstructorNameFromInstructorsClient(authUid: string): Promise<string> {
  const { row } = await loadInstructorRowForAuthUserClient(authUid);
  return instructorDisplayNameFromRow(row);
}
