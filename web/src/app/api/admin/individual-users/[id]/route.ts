import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/authServer";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

async function isProtectedAdminUser(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userId: number,
  authUserId: string | null
): Promise<boolean> {
  const { data: byPublicUserId } = await supabase
    .from("user_roles")
    .select("role")
    .eq("role", "admin")
    .eq("user_id", userId)
    .limit(1);

  if (Array.isArray(byPublicUserId) && byPublicUserId.length > 0) {
    return true;
  }

  if (!authUserId) {
    return false;
  }

  const { data: byAuthUserId } = await supabase
    .from("user_roles")
    .select("role")
    .eq("role", "admin")
    .eq("auth_user_id", authUserId)
    .limit(1);

  if (Array.isArray(byAuthUserId) && byAuthUserId.length > 0) {
    return true;
  }

  const { data: byLegacyUserId } = await supabase
    .from("user_roles")
    .select("role")
    .eq("role", "admin")
    .eq("user_id", authUserId)
    .limit(1);

  return Array.isArray(byLegacyUserId) && byLegacyUserId.length > 0;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { isAdmin } = await getCurrentUserRole();
  if (!isAdmin) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Geçersiz kullanıcı kimliği." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseServiceClient>;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik. SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı." },
      { status: 500 }
    );
  }

  const { data: userRow, error: userLookupError } = await supabase
    .from("users")
    .select("id, user_type, auth_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (userLookupError) {
    return NextResponse.json({ error: "Kullanıcı bilgisi alınamadı." }, { status: 500 });
  }

  if (!userRow || userRow.user_type !== "individual") {
    return NextResponse.json({ error: "Bireysel kullanıcı bulunamadı." }, { status: 404 });
  }

  const authUserId = userRow.auth_user_id ? String(userRow.auth_user_id) : null;
  if (await isProtectedAdminUser(supabase, userId, authUserId)) {
    return NextResponse.json({ error: "Admin kullanıcılar silinemez." }, { status: 403 });
  }

  const { data: profileRow } = await supabase
    .from("individual_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const profileId = Number(profileRow?.id);
  if (Number.isFinite(profileId)) {
    const { error: favoritesError } = await supabase
      .from("user_favorites")
      .delete()
      .eq("individual_profile_id", profileId);

    if (favoritesError) {
      return NextResponse.json({ error: "Kullanıcı favorileri silinemedi." }, { status: 500 });
    }
  }

  const { error: profileDeleteError } = await supabase
    .from("individual_profiles")
    .delete()
    .eq("user_id", userId);

  if (profileDeleteError) {
    return NextResponse.json({ error: "Kullanıcı profili silinemedi." }, { status: 500 });
  }

  const { data: deletedRows, error: userDeleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("user_type", "individual")
    .select("id");

  if (userDeleteError) {
    return NextResponse.json({ error: "Kullanıcı silinemedi." }, { status: 500 });
  }

  if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
    return NextResponse.json({ error: "Kullanıcı silinemedi." }, { status: 500 });
  }

  if (authUserId) {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(authUserId);
    if (authDeleteError && process.env.NODE_ENV === "development") {
      console.warn("[admin/individual-users DELETE] auth delete failed:", authDeleteError);
    }
  }

  return NextResponse.json({ ok: true });
}
