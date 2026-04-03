"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const INSTITUTION_PROFILE_ROW_SELECT =
  "id, institution_name, official_email, official_phone, website, city, district, address, about, logo, is_verified, institution_type_id";

export type InstitutionProfileRow = {
  id: number;
  institution_name?: string | null;
  official_email?: string | null;
  official_phone?: string | null;
  website?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  about?: string | null;
  logo?: string | null;
  is_verified?: boolean | null;
  institution_type_id?: number | null;
};

function isLikelyMissingColumnError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = String(err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");
  return (
    code === "42703" ||
    msg.includes("does not exist") ||
    (msg.includes("column") && msg.includes("not found"))
  );
}

async function selectInstitutionByColumn(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  column: string,
  value: string | number
): Promise<{ data: InstitutionProfileRow | null; error: { message: string; code?: string } | null }> {
  const { data, error } = await supabase
    .from("institutions")
    .select(INSTITUTION_PROFILE_ROW_SELECT)
    .eq(column, value)
    .maybeSingle();

  if (error) {
    return { data: null, error: { message: error.message, code: error.code } };
  }
  return { data: data as InstitutionProfileRow | null, error: null };
}

async function enrichRowFromUsers(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  authUid: string,
  row: InstitutionProfileRow
): Promise<InstitutionProfileRow> {
  const needsEmail = !(row.official_email ?? "").trim();
  const needsName = !(row.institution_name ?? "").trim();
  if (!needsEmail && !needsName) return row;

  const { data: userRow, error } = await supabase
    .from("users")
    .select("email, institution_name")
    .eq("auth_user_id", authUid)
    .maybeSingle();

  if (error || !userRow) return row;

  const u = userRow as { email?: string | null; institution_name?: string | null };
  return {
    ...row,
    official_email: needsEmail ? (u.email ?? row.official_email) : row.official_email,
    institution_name: needsName ? (u.institution_name ?? row.institution_name) : row.institution_name,
  };
}

/**
 * Loads the institution row for the logged-in corporate user.
 * Tries `owner_auth_id` (Supabase auth uid) first, then common FKs from `public.users.id`
 * (`owner_user_id`, `user_id`, `owner_id`) when the row was created without setting `owner_auth_id`.
 */
export async function loadInstitutionRowForAuthUserClient(
  authUid: string,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>
): Promise<{
  row: InstitutionProfileRow | null;
  error: { message: string } | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  const byAuth = await selectInstitutionByColumn(supabase, "owner_auth_id", authUid);
  if (byAuth.error && !isLikelyMissingColumnError(byAuth.error)) {
    console.error("Institution profile load (owner_auth_id):", byAuth.error);
    return { row: null, error: { message: byAuth.error.message } };
  }
  if (byAuth.data) {
    const enriched = await enrichRowFromUsers(supabase, authUid, byAuth.data);
    return { row: enriched, error: null };
  }

  const { data: userLink, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUid)
    .maybeSingle();

  if (userErr) {
    console.warn("Institution profile load: users lookup", userErr);
    return { row: null, error: null };
  }

  const internalId = (userLink as { id?: string | number } | null)?.id;
  if (internalId === undefined || internalId === null) {
    return { row: null, error: null };
  }

  const fallbackColumns = ["owner_user_id", "user_id", "owner_id"] as const;

  for (const col of fallbackColumns) {
    const res = await selectInstitutionByColumn(supabase, col, internalId);
    if (res.data) {
      const enriched = await enrichRowFromUsers(supabase, authUid, res.data);
      return { row: enriched, error: null };
    }
    if (res.error && isLikelyMissingColumnError(res.error)) {
      continue;
    }
    if (res.error) {
      console.error(`Institution profile load (${col}):`, res.error);
      return { row: null, error: { message: res.error.message } };
    }
  }

  return { row: null, error: null };
}
