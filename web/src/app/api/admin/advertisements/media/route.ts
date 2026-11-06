import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/authServer";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const ADVERTISEMENTS_BUCKET = "advertisements";
const MEDIA_PATH_PATTERN =
  /^media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm)$/;

function isExactMediaPath(value: unknown): value is string {
  return typeof value === "string" && MEDIA_PATH_PATTERN.test(value);
}

export async function POST(request: Request) {
  const { user, isAdmin } = await getCurrentUserRole();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  let path: unknown;
  try {
    const body = (await request.json()) as { path?: unknown };
    path = body.path;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (!isExactMediaPath(path)) {
    return NextResponse.json({ error: "Geçersiz dosya yolu." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseServiceClient>;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    console.error("[advertisements] media cleanup unavailable");
    return NextResponse.json({ error: "Medya silinemedi." }, { status: 500 });
  }

  const { data, error: lookupError } = await supabase
    .from("advertisements")
    .select("id")
    .eq("media_path", path)
    .limit(1);

  if (lookupError) {
    console.error("[advertisements] media reference check", lookupError.message);
    return NextResponse.json({ error: "Medya silinemedi." }, { status: 500 });
  }

  if ((data ?? []).length > 0) {
    return NextResponse.json(
      { error: "Dosya bir reklam tarafından kullanılıyor." },
      { status: 409 },
    );
  }

  const { error: removeError } = await supabase.storage.from(ADVERTISEMENTS_BUCKET).remove([path]);
  if (removeError) {
    console.error("[advertisements] media remove", removeError.message);
    return NextResponse.json({ error: "Medya silinemedi." }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
