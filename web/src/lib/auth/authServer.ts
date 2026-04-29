import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUserRole(): Promise<{
  user: { id: string; email?: string } | null;
  userType: "individual" | "institution" | null;
  isAdmin: boolean;
}> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { user: null, userType: null, isAdmin: false };
  }

  const { data: row, error: rowErr } = await supabase
    .from("users")
    .select("user_type")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (rowErr) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getCurrentUserRole] Error fetching user_type:", rowErr);
    }
    return { user: { id: user.id, email: user.email }, userType: null, isAdmin: false };
  }

  const userType =
    row?.user_type === "individual" || row?.user_type === "institution" ? row.user_type : null;

  const resolveAdminByColumn = async (column: "user_id" | "auth_user_id"): Promise<boolean | null> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq(column, user.id)
      .eq("role", "admin")
      .limit(1);

    if (error) {
      const msg = String(error.message ?? "").toLowerCase();
      const code = String(error.code ?? "");
      const isMissingColumn = code === "42703" || msg.includes("column") || msg.includes("does not exist");
      if (isMissingColumn) return null;
      if (process.env.NODE_ENV === "development") {
        console.warn(`[getCurrentUserRole] Error fetching admin role by ${column}:`, error);
      }
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  };

  const byUserId = await resolveAdminByColumn("user_id");
  const isAdmin = byUserId === null ? (await resolveAdminByColumn("auth_user_id")) ?? false : byUserId;

  return {
    user: { id: user.id, email: user.email },
    userType,
    isAdmin,
  };
}
