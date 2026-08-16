import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const INSTRUCTOR_DIPLOMA_FILES_BUCKET = "instructor-diploma-files";
const INSTRUCTOR_DIPLOMA_MAX_BYTES = 10 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const INSTRUCTOR_LOOKUP_DELAYS_MS = [0, 400, 1000, 2000];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_DIPLOMA_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

type DiplomaUpload = {
  size: number;
  type: string;
  name: string;
  isFileInstance: boolean;
  ctor: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function toLogText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function logInstructorSignupStep(step: string, details = "", hint = "") {
  console.warn(
    `Instructor signup step | step=${step} | code= | message= | details=${details} | hint=${hint}`,
  );
}

function logInstructorSignupError(params: {
  step: string;
  error?: unknown;
  message?: string;
  details?: string;
  hint?: string;
}) {
  const err =
    params.error && typeof params.error === "object"
      ? (params.error as {
          code?: unknown;
          message?: unknown;
          details?: unknown;
          hint?: unknown;
        })
      : null;
  console.error(
    `Instructor signup error | step=${params.step} | code=${toLogText(err?.code ?? "")} | message=${toLogText(params.message ?? err?.message ?? "")} | details=${toLogText(params.details ?? err?.details ?? "")} | hint=${toLogText(params.hint ?? err?.hint ?? "")}`,
  );
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

function parseLocationId(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractTurkishMobileNationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function normalizeTurkishMobilePhone(raw: string): string | null {
  const national = extractTurkishMobileNationalDigits(raw);
  if (national.length !== 10 || !national.startsWith("5")) return null;
  return `+90${national}`;
}

function isValidInstructorTcIdentityNumber(value: string): boolean {
  return /^\d{11}$/.test(value.trim());
}

function diplomaExtension(file: Pick<DiplomaUpload, "name" | "type">): string {
  const fromName = file.name.includes(".") ? (file.name.split(".").pop() ?? "") : "";
  const lower = fromName.toLowerCase();
  if (lower === "pdf" || lower === "jpg" || lower === "jpeg" || lower === "png") return lower;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

function normalizedDiplomaMime(mime: string): string {
  const value = String(mime ?? "").trim().toLowerCase();
  if (value === "image/jpg") return "image/jpeg";
  return value;
}

function isAllowedDiplomaFile(file: Pick<DiplomaUpload, "name" | "type">): boolean {
  const mime = normalizedDiplomaMime(file.type);
  if (ALLOWED_DIPLOMA_MIME_TYPES.has(mime)) return true;
  const lower = file.name.toLowerCase();
  return (
    !mime &&
    (lower.endsWith(".pdf") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png"))
  );
}

function safeStorageFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120);
}

function buildInstructorDiplomaPath(instructorId: number, fileName: string): string {
  return `instructors/${instructorId}/diploma/${fileName}`;
}

function readDiplomaUpload(value: FormDataEntryValue | null): DiplomaUpload | null {
  if (value == null || typeof value === "string") return null;
  const raw = value as {
    size?: unknown;
    type?: unknown;
    name?: unknown;
    arrayBuffer?: unknown;
    constructor?: { name?: string };
  };
  if (typeof raw.size !== "number" || raw.size <= 0) return null;
  if (typeof raw.arrayBuffer !== "function") return null;
  const readArrayBuffer = raw.arrayBuffer as () => Promise<ArrayBuffer>;
  return {
    size: raw.size,
    type: String(raw.type ?? ""),
    name: String(raw.name ?? "diploma"),
    isFileInstance: typeof File !== "undefined" && value instanceof File,
    ctor: String(raw.constructor?.name ?? typeof value),
    arrayBuffer: () => readArrayBuffer.call(value),
  };
}

function createAuthSignupClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase anon configuration.");
  }
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyExistingEmailError(error: { code?: string; message?: string } | null): boolean {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  return (
    code === "user_already_exists" ||
    message.includes("user already registered") ||
    message.includes("already been registered") ||
    message.includes("already registered")
  );
}

export async function POST(request: Request) {
  logInstructorSignupStep("route_hit");

  let serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  try {
    serviceSupabase = createSupabaseServiceClient();
  } catch {
    logInstructorSignupError({
      step: "service_client",
      message: "missing service role configuration",
      hint: "SUPABASE_SERVICE_ROLE_KEY must be set on the server",
    });
    return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 500);
  }

  let authSupabase: ReturnType<typeof createAuthSignupClient>;
  try {
    authSupabase = createAuthSignupClient();
  } catch {
    logInstructorSignupError({
      step: "auth_client",
      message: "missing anon configuration",
    });
    return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    logInstructorSignupError({
      step: "formdata_parse",
      error,
      message: "form data parse failed",
    });
    return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 400);
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const categoryId = Number(String(formData.get("categoryId") ?? "").trim());
  const referenceRaw = String(formData.get("reference") ?? "");
  const reference = referenceRaw.trim() || null;
  const identityOrTaxNumber = String(formData.get("identityOrTaxNumber") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const branch = String(formData.get("branch") ?? "").trim();
  const informationAccuracyConfirmed =
    String(formData.get("informationAccuracyConfirmed") ?? "").trim() === "true";
  const acceptTerms = String(formData.get("acceptTerms") ?? "").trim() === "true";
  const ilId = parseLocationId(formData.get("ilId"));
  const ilceId = parseLocationId(formData.get("ilceId"));
  const diplomaFile = readDiplomaUpload(formData.get("diploma"));
  const phone = normalizeTurkishMobilePhone(phoneRaw);

  logInstructorSignupStep(
    "diploma_file_parsed",
    `isFileInstance=${diplomaFile?.isFileInstance === true};ctor=${diplomaFile?.ctor ?? "null"};size=${diplomaFile?.size ?? 0};type=${diplomaFile?.type || "empty"};name=${diplomaFile?.name || "empty"}`,
    "file content is not logged",
  );

  if (!acceptTerms) {
    return jsonError("Devam etmek için koşulları kabul etmelisiniz.", 400);
  }
  if (!firstName || !lastName) {
    return jsonError("Lütfen bireysel eğitmen alanındaki zorunlu alanları kontrol edin.", 400);
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return jsonError("Geçerli bir e-posta adresi girin.", 400);
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`, 400);
  }
  if (!BIRTH_DATE_PATTERN.test(birthDate)) {
    return jsonError("Doğum tarihinizi girmeden devam edemezsiniz.", 400);
  }
  if (!phone) {
    return jsonError("Geçerli bir Türkiye telefon numarası girin.", 400);
  }
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return jsonError("Lütfen bir kategori seçin.", 400);
  }
  if (!isValidInstructorTcIdentityNumber(identityOrTaxNumber)) {
    return jsonError("TC kimlik numarası 11 haneli olmalıdır.", 400);
  }
  if (ilId == null || ilceId == null) {
    return jsonError("Lütfen il ve ilçe seçin.", 400);
  }
  if (!school || !department || !branch) {
    return jsonError("Lütfen bireysel eğitmen alanındaki zorunlu alanları kontrol edin.", 400);
  }
  if (!informationAccuracyConfirmed) {
    return jsonError("Bilgilerin doğruluğunu onaylamadan kayıt oluşturamazsınız.", 400);
  }
  if (!diplomaFile) {
    logInstructorSignupError({
      step: "validate_diploma",
      message: "diploma file missing or not a blob/file",
      hint: "Node FormData entries may not pass instanceof File",
    });
    return jsonError("Diploma / belge yüklemeniz zorunludur.", 400);
  }
  if (!isAllowedDiplomaFile(diplomaFile)) {
    logInstructorSignupError({
      step: "validate_diploma",
      message: "diploma file type invalid",
      details: `mime=${diplomaFile.type || "empty"};size=${diplomaFile.size}`,
    });
    return jsonError("Lütfen PDF, JPG, JPEG veya PNG formatında bir diploma / belge yükleyin.", 400);
  }
  if (diplomaFile.size > INSTRUCTOR_DIPLOMA_MAX_BYTES) {
    return jsonError("Diploma / belge en fazla 10MB olabilir.", 400);
  }

  logInstructorSignupStep(
    "validate_details",
    `hasDiplomaFile=true;diplomaSize=${diplomaFile.size};hasReference=${Boolean(reference)};referenceLength=${reference ? reference.length : 0}`,
  );

  const { data: emailExists, error: emailCheckError } = await authSupabase.rpc(
    "check_email_exists",
    { p_email: email },
  );
  if (emailCheckError) {
    logInstructorSignupError({
      step: "email_exists_check",
      error: emailCheckError,
      message: "email exists check failed",
    });
  }
  if (emailExists === true) {
    logInstructorSignupError({
      step: "email_exists_check",
      message: "email already registered",
    });
    return jsonError("Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.", 409, "email-exists");
  }

  const metadata = {
    user_type: "instructor",
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    birth_date: birthDate,
    phone,
    identity_or_tax_number: identityOrTaxNumber,
    reference,
    category_id: categoryId,
    school,
    department,
    branch,
    il_id: ilId,
    ilce_id: ilceId,
    is_approved: null,
    approved_by: null,
    approved_at: null,
  };

  const { data: signUpData, error: signUpError } = await authSupabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (signUpError) {
    logInstructorSignupError({
      step: "auth_signup",
      error: signUpError,
      message: "auth signup failed",
      details: "auth.signUp returned an error",
    });
    if (isLikelyExistingEmailError(signUpError)) {
      return jsonError("Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.", 409, "email-exists");
    }
    return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 400);
  }

  const authUserId = signUpData.user?.id;
  if (!authUserId) {
    logInstructorSignupError({
      step: "auth_signup",
      message: "auth signup returned without user id",
    });
    return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 500);
  }

  logInstructorSignupStep(
    "auth_signup_complete",
    `hasUser=true;hasSession=${Boolean(signUpData.session?.user?.id)}`,
    "session null must not skip diploma upload or instructor update",
  );

  try {
    let instructorId: number | null = null;
    let lookupError: unknown = null;

    for (const delayMs of INSTRUCTOR_LOOKUP_DELAYS_MS) {
      if (delayMs > 0) await sleep(delayMs);
      const { data, error } = await serviceSupabase
        .from("instructors")
        .select("id, diploma_document_path, owner_auth_id")
        .eq("owner_auth_id", authUserId)
        .maybeSingle();

      if (error) {
        lookupError = error;
        logInstructorSignupError({
          step: "instructor_lookup",
          error,
          message: "instructor lookup failed",
          details: `delayMs=${delayMs}`,
        });
        continue;
      }

      const parsedId = Number(data?.id);
      logInstructorSignupStep(
        "instructor_lookup",
        `hasRow=${Boolean(data?.id)};parsedId=${Number.isFinite(parsedId) ? parsedId : "null"};delayMs=${delayMs}`,
      );
      if (Number.isFinite(parsedId) && parsedId > 0) {
        instructorId = parsedId;
        lookupError = null;
        break;
      }
    }

    if (!instructorId) {
      logInstructorSignupError({
        step: "instructor_lookup",
        error: lookupError,
        message: "instructor row not found after signup",
        hint: "auth user may exist; completion did not run",
      });
      return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 500);
    }

    logInstructorSignupStep("instructor_lookup_complete", `instructorId=${instructorId}`);

    const storageFileName = `${Date.now()}-${safeStorageFileName(diplomaFile.name) || `${Date.now()}.${diplomaExtension(diplomaFile)}`}`;
    const diplomaPath = buildInstructorDiplomaPath(instructorId, storageFileName);
    const diplomaBytes = Buffer.from(await diplomaFile.arrayBuffer());
    const diplomaContentType =
      normalizedDiplomaMime(diplomaFile.type) || "application/octet-stream";

    logInstructorSignupStep(
      "diploma_upload_start",
      `instructorId=${instructorId};bucket=${INSTRUCTOR_DIPLOMA_FILES_BUCKET};byteLength=${diplomaBytes.byteLength};contentType=${diplomaContentType};isFileInstance=${diplomaFile.isFileInstance}`,
      "upload uses service role, not browser session",
    );

    const { data: uploadData, error: uploadError } = await serviceSupabase.storage
      .from(INSTRUCTOR_DIPLOMA_FILES_BUCKET)
      .upload(diplomaPath, diplomaBytes, {
        upsert: false,
        contentType: diplomaContentType,
      });

    if (uploadError || !uploadData?.path) {
      logInstructorSignupError({
        step: "diploma_upload",
        error: uploadError,
        message: "diploma upload failed",
        details: `instructorId=${instructorId};bucket=${INSTRUCTOR_DIPLOMA_FILES_BUCKET};hasPath=${Boolean(uploadData?.path)}`,
      });
      return jsonError("Diploma / belge yüklenirken bir hata oluştu.", 500);
    }

    logInstructorSignupStep(
      "diploma_upload_complete",
      `instructorId=${instructorId};bucket=${INSTRUCTOR_DIPLOMA_FILES_BUCKET};hasPath=true`,
    );

    const confirmedAt = new Date().toISOString();
    const { data: updatedRow, error: updateError } = await serviceSupabase
      .from("instructors")
      .update({
        identity_or_tax_number: identityOrTaxNumber,
        reference,
        phone,
        il_id: ilId,
        ilce_id: ilceId,
        school,
        department,
        branch,
        diploma_document_path: diplomaPath,
        information_accuracy_confirmed: true,
        information_accuracy_confirmed_at: confirmedAt,
      })
      .eq("id", instructorId)
      .eq("owner_auth_id", authUserId)
      .select("id, diploma_document_path, information_accuracy_confirmed, information_accuracy_confirmed_at, reference")
      .maybeSingle();

    if (
      updateError ||
      !updatedRow?.id ||
      !updatedRow.diploma_document_path ||
      updatedRow.information_accuracy_confirmed !== true
    ) {
      logInstructorSignupError({
        step: "instructor_update",
        error: updateError,
        message: "instructor details update failed after diploma upload",
        details: `instructorId=${instructorId};hasUpdatedRow=${Boolean(updatedRow?.id)};confirmed=${String(updatedRow?.information_accuracy_confirmed)}`,
        hint: "uploaded diploma will be removed",
      });
      await serviceSupabase.storage.from(INSTRUCTOR_DIPLOMA_FILES_BUCKET).remove([diplomaPath]);
      return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 500);
    }

    logInstructorSignupStep(
      "instructor_update_complete",
      `instructorId=${instructorId};hasDiplomaPath=${Boolean(updatedRow.diploma_document_path)};confirmed=${updatedRow.information_accuracy_confirmed === true};hasReference=${updatedRow.reference != null};hasConfirmedAt=${Boolean(updatedRow.information_accuracy_confirmed_at)}`,
    );
    logInstructorSignupStep("final_success", `instructorId=${instructorId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logInstructorSignupError({
      step: "completion_exception",
      error,
      message: error instanceof Error ? error.message : "unexpected completion exception",
      hint: "auth user/instructor row were not deleted; diploma/update did not complete",
    });
    return jsonError("Bireysel eğitmen hesabı oluşturulurken bir hata oluştu.", 500);
  }
}
