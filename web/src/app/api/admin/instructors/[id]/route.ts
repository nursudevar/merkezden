import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/authServer";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type InstructorAdminUpdateBody = {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  branch?: string;
  district?: string;
};

function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function normalizeText(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

async function getServiceSupabase() {
  try {
    return createSupabaseServiceClient();
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { isAdmin } = await getCurrentUserRole();
  if (!isAdmin) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const { id } = await context.params;
  const instructorId = Number.parseInt(id, 10);
  if (!Number.isFinite(instructorId)) {
    return NextResponse.json({ error: "Geçersiz eğitmen kimliği." }, { status: 400 });
  }

  const supabase = await getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik. SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı." },
      { status: 500 }
    );
  }

  let body: InstructorAdminUpdateBody;
  try {
    body = (await request.json()) as InstructorAdminUpdateBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const phone = String(body.phone ?? "");
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Geçerli bir telefon numarası girin." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("instructors")
    .update({
      name: normalizeText(body.name),
      surname: normalizeText(body.surname),
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
      branch: normalizeText(body.branch),
      district: normalizeText(body.district),
    })
    .eq("id", instructorId)
    .select("id, name, surname, email, phone, branch, district")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Eğitmen bilgileri güncellenemedi." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Eğitmen bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, instructor: data });
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
  const instructorId = Number.parseInt(id, 10);
  if (!Number.isFinite(instructorId)) {
    return NextResponse.json({ error: "Geçersiz eğitmen kimliği." }, { status: 400 });
  }

  const supabase = await getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik. SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı." },
      { status: 500 }
    );
  }

  const { data: deletedRows, error } = await supabase
    .from("instructors")
    .delete()
    .eq("id", instructorId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Eğitmen silinemedi." }, { status: 500 });
  }

  if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
    return NextResponse.json({ error: "Eğitmen bulunamadı veya silinemedi." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
