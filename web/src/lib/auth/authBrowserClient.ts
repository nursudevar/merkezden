"use client";

/**
 * Tarayıcıda Supabase Auth + public.users / institutions ile yapılan ortak okumalar.
 * (Sunucu tarafı: `authServer.getCurrentUserRole`.)
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// --- Kurum (institutions) ----------------------------------------------------

export const INSTITUTION_PROFILE_ROW_SELECT =
  "id, slug, institution_name, official_email, official_phone, website, facebook_url, instagram_url, x_url, linkedin_url, subheading, city, district, address, about, logo, is_approved, category_id, institution_type_id, high_school_type, working_hours_start, working_hours_end";

export type InstitutionProfileRow = {
  id: number;
  slug?: string | null;
  institution_name?: string | null;
  official_email?: string | null;
  official_phone?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  subheading?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  about?: string | null;
  logo?: string | null;
  is_approved?: boolean | null;
  category_id?: number | null;
  institution_type_id?: number | null;
  high_school_type?: string | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
};

export type LoadInstitutionRowOptions = {
  authEmail?: string | null;
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

export async function loadInstitutionRowForAuthUserClient(
  authUid: string,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
  options?: LoadInstitutionRowOptions
): Promise<{
  row: InstitutionProfileRow | null;
  error: { message: string } | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("institutions")
    .select(INSTITUTION_PROFILE_ROW_SELECT)
    .eq("owner_auth_id", authUid)
    .maybeSingle();

  if (error) {
    if (isLikelyMissingColumnError({ message: error.message, code: error.code })) {
      return { row: null, error: { message: error.message } };
    }
    console.error("Institution profile load (owner_auth_id):", error);
    return { row: null, error: { message: error.message || "Kurum profili yüklenemedi." } };
  }

  const byOwner = data as InstitutionProfileRow | null;
  if (byOwner) {
    return { row: byOwner, error: null };
  }

  const email = String(options?.authEmail ?? "").trim();
  if (!email) {
    return { row: null, error: null };
  }

  const { data: byEmail, error: emailErr } = await supabase
    .from("institutions")
    .select(INSTITUTION_PROFILE_ROW_SELECT)
    .eq("official_email", email)
    .limit(1);

  if (emailErr) {
    if (isLikelyMissingColumnError({ message: emailErr.message, code: emailErr.code })) {
      return { row: null, error: { message: emailErr.message } };
    }
    console.error("Institution profile load (official_email):", emailErr);
    return { row: null, error: { message: emailErr.message || "Kurum profili yüklenemedi." } };
  }

  const first =
    Array.isArray(byEmail) && byEmail.length > 0 ? (byEmail[0] as InstitutionProfileRow) : null;
  return { row: first, error: null };
}

export async function loadInstitutionRowByIdClient(
  institutionId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{
  row: InstitutionProfileRow | null;
  error: { message: string } | null;
}> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const normalizedId = Number(institutionId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return { row: null, error: { message: "Geçersiz kurum kimliği." } };
  }

  const { data, error } = await supabase
    .from("institutions")
    .select(INSTITUTION_PROFILE_ROW_SELECT)
    .eq("id", normalizedId)
    .maybeSingle();

  if (error) {
    console.error("Institution profile load (id):", error);
    return { row: null, error: { message: error.message || "Kurum profili yüklenemedi." } };
  }

  return { row: (data as InstitutionProfileRow | null) ?? null, error: null };
}

export async function resolveInstitutionNameFromUsersClient(
  authUid: string,
  authEmail?: string | null
): Promise<string> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { row: instRow } = await loadInstitutionRowForAuthUserClient(authUid, supabase, {
      authEmail,
    });
    const name = instRow?.institution_name;
    if (name && String(name).trim()) return String(name).trim();
    return "Kurum Hesabı";
  } catch (err) {
    console.warn("[authBrowserClient] resolveInstitutionName", err);
    return "Kurum Hesabı";
  }
}

export async function resolveInstitutionSlugFromUsersClient(
  authUid: string,
  authEmail?: string | null
): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { row } = await loadInstitutionRowForAuthUserClient(authUid, supabase, { authEmail });
    if (!row?.id) return null;
    const normalizedSlug = String(row.slug ?? "").trim();
    return normalizedSlug || null;
  } catch (err) {
    console.warn("[authBrowserClient] resolveInstitutionSlug", err);
    return null;
  }
}

// --- Kullanıcı (users) -------------------------------------------------------

export type AppUserType = "individual" | "institution" | "instructor";

export async function resolveUserTypeFromUsersClient(
  authUid: string
): Promise<AppUserType | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("users")
      .select("user_type")
      .eq("auth_user_id", authUid)
      .maybeSingle();

    if (error) {
      console.warn("[authBrowserClient] resolveUserType", error);
      return null;
    }

    const type = data?.user_type;
    if (type === "individual" || type === "institution" || type === "instructor") {
      return type;
    }
    return null;
  } catch (err) {
    console.warn("[authBrowserClient] resolveUserType", err);
    return null;
  }
}

export async function resolveIndividualNameFromUsersClient(authUid: string): Promise<string> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("users")
      .select("first_name, last_name, email")
      .eq("auth_user_id", authUid)
      .maybeSingle();

    if (error) {
      console.warn("[authBrowserClient] resolveIndividualName", error);
      return "Kullanıcı";
    }

    const row = data as { first_name?: string; last_name?: string; email?: string } | null;
    const firstName = (row?.first_name ?? "").trim();
    const lastName = (row?.last_name ?? "").trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) return fullName;
    if (firstName) return firstName;
    if (lastName) return lastName;
    if (row?.email?.trim()) return row.email.trim();
    return "Kullanıcı";
  } catch (err) {
    console.warn("[authBrowserClient] resolveIndividualName", err);
    return "Kullanıcı";
  }
}

export async function resolveIsAdminFromUserRolesClient(authUid: string): Promise<boolean> {
  try {
    const supabase = createSupabaseBrowserClient();

    const queryByColumn = async (column: "user_id" | "auth_user_id"): Promise<boolean | null> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq(column, authUid)
        .eq("role", "admin")
        .limit(1);

      if (error) {
        if (isLikelyMissingColumnError({ message: error.message, code: error.code })) {
          return null;
        }
        console.warn(`[authBrowserClient] resolveIsAdmin (${column})`, error);
        return false;
      }

      return Array.isArray(data) && data.length > 0;
    };

    const byUserId = await queryByColumn("user_id");
    if (byUserId !== null) return byUserId;

    const byAuthUserId = await queryByColumn("auth_user_id");
    return byAuthUserId ?? false;
  } catch (err) {
    console.warn("[authBrowserClient] resolveIsAdmin", err);
    return false;
  }
}
