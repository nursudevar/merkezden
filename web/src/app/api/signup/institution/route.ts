import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const INSTITUTION_VERIFICATION_FILES_BUCKET = "institution-verification-files";
const INSTITUTION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const PUBLIC_USER_LOOKUP_DELAYS_MS = [0, 300, 800];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const INSTITUTION_AUTHORIZED_ROLES = new Set([
  "kurum-sahibi-kurucu",
  "kurum-muduru",
  "pazarlama-kurumsal-iletisim",
  "yonetici-asistan-diger",
]);

type DocumentUpload = {
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

function logInstitutionSignupStep(step: string, details = "", hint = "") {
  console.warn(
    `Institution signup step | step=${step} | code= | message= | details=${details} | hint=${hint}`,
  );
}

function logInstitutionSignupError(params: {
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
    `Institution signup error | step=${params.step} | code=${toLogText(err?.code ?? "")} | message=${toLogText(params.message ?? err?.message ?? "")} | details=${toLogText(params.details ?? err?.details ?? "")} | hint=${toLogText(params.hint ?? err?.hint ?? "")}`,
  );
}

function jsonError(params: {
  status: number;
  step: string;
  field?: string;
  error: string;
  code: string;
  logError?: unknown;
  details?: string;
  hint?: string;
}) {
  const err =
    params.logError && typeof params.logError === "object"
      ? (params.logError as {
          code?: unknown;
          message?: unknown;
          details?: unknown;
          hint?: unknown;
          status?: unknown;
          name?: unknown;
        })
      : null;
  logInstitutionSignupError({
    step: params.step,
    error: params.logError,
    message: String(err?.message ?? params.error),
    details: [
      params.details,
      err?.status != null ? `status=${String(err.status)}` : "",
      err?.name ? `name=${String(err.name)}` : "",
    ]
      .filter(Boolean)
      .join(";"),
    hint: params.hint,
  });
  return NextResponse.json(
    {
      ok: false as const,
      step: params.step,
      field: params.field ?? "",
      error: params.error,
      code: params.code,
    },
    { status: params.status },
  );
}

function describeAuthSignupError(error: unknown): {
  code: string;
  message: string;
  status: string;
  name: string;
} {
  const err =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          message?: unknown;
          status?: unknown;
          name?: unknown;
        })
      : null;
  return {
    code: String(err?.code ?? "").trim() || "auth_signup_failed",
    message: String(err?.message ?? "").trim(),
    status: err?.status == null ? "" : String(err.status),
    name: String(err?.name ?? "").trim(),
  };
}

function supabaseErrorCode(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "").trim();
    if (code) return code;
  }
  return fallback;
}

function parsePositiveId(value: unknown): number | null {
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

function isValidInstitutionTaxNumber(value: string): boolean {
  return /^\d{10}$/.test(value) || /^\d{11}$/.test(value);
}

function documentExtension(file: Pick<DocumentUpload, "name" | "type">): string {
  const fromName = file.name.includes(".") ? (file.name.split(".").pop() ?? "") : "";
  const lower = fromName.toLowerCase();
  if (lower === "pdf" || lower === "jpg" || lower === "jpeg" || lower === "png") return lower;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

function normalizedDocumentMime(mime: string): string {
  const value = String(mime ?? "").trim().toLowerCase();
  if (value === "image/jpg") return "image/jpeg";
  return value;
}

function isAllowedDocumentFile(file: Pick<DocumentUpload, "name" | "type">): boolean {
  const mime = normalizedDocumentMime(file.type);
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(mime)) return true;
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
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
}

function buildInstitutionVerificationPath(
  institutionId: number,
  folder: "tax-certificate" | "trade-registry" | "authorization",
  fileName: string,
): string {
  const safeName = safeStorageFileName(fileName);
  if (!safeName || safeName.includes("..") || safeName.includes("/") || safeName.includes("\\")) {
    throw new Error("invalid storage file name");
  }
  return `institutions/${institutionId}/${folder}/${safeName}`;
}

function readDocumentUpload(value: FormDataEntryValue | null, fallbackName: string): DocumentUpload | null {
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
    name: String(raw.name ?? fallbackName),
    isFileInstance: typeof File !== "undefined" && value instanceof File,
    ctor: String(raw.constructor?.name ?? typeof value),
    arrayBuffer: () => readArrayBuffer.call(value),
  };
}

function describeDocument(file: DocumentUpload | null): string {
  if (!file) return "missing";
  return `isFileInstance=${file.isFileInstance === true};ctor=${file.ctor};size=${file.size};type=${file.type || "empty"};nameLen=${file.name.length}`;
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

type InstitutionLookupRow = {
  id: number | string | null;
  owner_auth_id: string | null;
  user_id: number | string | null;
};

type InstitutionResolveResult =
  | { kind: "missing" }
  | { kind: "owned"; institutionId: number; needsOwnerAuthId: boolean }
  | { kind: "foreign"; reason: "owner_auth_id" | "user_id" }
  | { kind: "lookup_failed"; error: unknown };

function uniqueConstraintName(error: unknown): string {
  const message = String((error as { message?: string } | null)?.message ?? "");
  const match = message.match(/unique constraint "([^"]+)"/i);
  return match?.[1] ?? "";
}

function isUniqueViolation(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? "");
  return code === "23505";
}

function parseInstitutionId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function evaluateInstitutionOwnership(
  row: InstitutionLookupRow | null | undefined,
  authUserId: string,
  publicUserId: number,
): InstitutionResolveResult {
  if (!row) return { kind: "missing" };

  const institutionId = parseInstitutionId(row.id);
  if (!institutionId) return { kind: "missing" };

  const ownerAuthId = String(row.owner_auth_id ?? "").trim();
  const rowUserId = parseInstitutionId(row.user_id);

  if (ownerAuthId && ownerAuthId !== authUserId) {
    return { kind: "foreign", reason: "owner_auth_id" };
  }

  if (rowUserId && rowUserId !== publicUserId) {
    return { kind: "foreign", reason: "user_id" };
  }

  const ownerMatches = ownerAuthId === authUserId;
  const userMatches = rowUserId === publicUserId;
  if (!ownerMatches && !userMatches) {
    return { kind: "foreign", reason: "user_id" };
  }

  return {
    kind: "owned",
    institutionId,
    needsOwnerAuthId: !ownerAuthId && userMatches,
  };
}

async function lookupInstitutionRow(
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>,
  column: "owner_auth_id" | "user_id" | "official_email",
  value: string | number,
): Promise<{ row: InstitutionLookupRow | null; error: unknown | null }> {
  const { data, error } = await serviceSupabase
    .from("institutions")
    .select("id, owner_auth_id, user_id")
    .eq(column, value)
    .maybeSingle();

  if (error) return { row: null, error };
  return { row: (data as InstitutionLookupRow | null) ?? null, error: null };
}

async function resolveExistingInstitution(
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>,
  authUserId: string,
  publicUserId: number,
  officialEmail: string,
): Promise<InstitutionResolveResult> {
  const byOwner = await lookupInstitutionRow(serviceSupabase, "owner_auth_id", authUserId);
  if (byOwner.error) return { kind: "lookup_failed", error: byOwner.error };
  const ownerResult = evaluateInstitutionOwnership(byOwner.row, authUserId, publicUserId);
  if (ownerResult.kind !== "missing") return ownerResult;

  const byUser = await lookupInstitutionRow(serviceSupabase, "user_id", publicUserId);
  if (byUser.error) return { kind: "lookup_failed", error: byUser.error };
  const userResult = evaluateInstitutionOwnership(byUser.row, authUserId, publicUserId);
  if (userResult.kind !== "missing") return userResult;

  const byEmail = await lookupInstitutionRow(serviceSupabase, "official_email", officialEmail);
  if (byEmail.error) return { kind: "lookup_failed", error: byEmail.error };
  return evaluateInstitutionOwnership(byEmail.row, authUserId, publicUserId);
}

function foreignInstitutionError(reason: "owner_auth_id" | "user_id") {
  return jsonError({
    status: 409,
    step: "institution_insert",
    error: "Bu kurum kaydı başka bir hesaba ait.",
    code: reason === "owner_auth_id" ? "institution_owner_conflict" : "institution_user_conflict",
    details: `existing institution belongs to another ${reason === "owner_auth_id" ? "auth user" : "public user"}`,
  });
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

async function assertLocationHierarchy(
  client: ReturnType<typeof createAuthSignupClient>,
  ilId: number,
  ilceId: number,
  mahalleId: number,
): Promise<
  | { ok: true }
  | {
      ok: false;
      step: "il_validation" | "ilce_validation" | "mahalle_validation";
      field: "ilId" | "ilceId" | "mahalleId";
      logError?: unknown;
    }
> {
  const { data: il, error: ilError } = await client.from("iller").select("id").eq("id", ilId).maybeSingle();
  if (ilError || Number(il?.id) !== ilId) {
    return { ok: false, step: "il_validation", field: "ilId", logError: ilError };
  }

  const { data: ilce, error: ilceError } = await client
    .from("ilceler")
    .select("id, il_id")
    .eq("id", ilceId)
    .maybeSingle();
  if (ilceError || Number(ilce?.id) !== ilceId || Number(ilce?.il_id) !== ilId) {
    return { ok: false, step: "ilce_validation", field: "ilceId", logError: ilceError };
  }

  const { data: mahalle, error: mahalleError } = await client
    .from("mahalleler")
    .select("id, ilce_id")
    .eq("id", mahalleId)
    .maybeSingle();
  if (mahalleError || Number(mahalle?.id) !== mahalleId || Number(mahalle?.ilce_id) !== ilceId) {
    return { ok: false, step: "mahalle_validation", field: "mahalleId", logError: mahalleError };
  }

  return { ok: true };
}

async function uploadInstitutionDocument(params: {
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  institutionId: number;
  folder: "tax-certificate" | "trade-registry" | "authorization";
  file: DocumentUpload;
}): Promise<{ path: string | null; error: unknown }> {
  const storageFileName = `${Date.now()}-${safeStorageFileName(params.file.name) || `${Date.now()}.${documentExtension(params.file)}`}`;
  const objectPath = buildInstitutionVerificationPath(params.institutionId, params.folder, storageFileName);
  const bytes = Buffer.from(await params.file.arrayBuffer());
  const contentType = normalizedDocumentMime(params.file.type) || "application/octet-stream";

  const { data, error } = await params.serviceSupabase.storage
    .from(INSTITUTION_VERIFICATION_FILES_BUCKET)
    .upload(objectPath, bytes, {
      upsert: false,
      contentType,
    });

  if (error || !data?.path) {
    return { path: null, error };
  }
  return { path: data.path, error: null };
}

async function removeUploadedObjects(
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>,
  paths: Array<string | null | undefined>,
) {
  const valid = paths.filter((path): path is string => Boolean(path));
  if (valid.length === 0) return;
  await serviceSupabase.storage.from(INSTITUTION_VERIFICATION_FILES_BUCKET).remove(valid);
}

export async function POST(request: Request) {
  logInstitutionSignupStep("route_hit");

  let serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  try {
    serviceSupabase = createSupabaseServiceClient();
  } catch {
    logInstitutionSignupError({
      step: "service_client",
      message: "missing service role configuration",
      hint: "SUPABASE_SERVICE_ROLE_KEY must be set on the server",
    });
    return jsonError({
      status: 500,
      step: "request_parse",
      error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
      code: "service_client_missing",
      hint: "SUPABASE_SERVICE_ROLE_KEY must be set on the server",
    });
  }

  let authSupabase: ReturnType<typeof createAuthSignupClient>;
  try {
    authSupabase = createAuthSignupClient();
  } catch {
    logInstitutionSignupError({
      step: "auth_client",
      message: "missing anon configuration",
    });
    return jsonError({
      status: 500,
      step: "request_parse",
      error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
      code: "auth_client_missing",
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return jsonError({
      status: 400,
      step: "request_parse",
      error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
      code: "formdata_parse_failed",
      logError: error,
      details: "form data parse failed",
    });
  }

  const authorizedPersonName = String(formData.get("authorizedPersonName") ?? "").trim();
  const authorizedPersonRole = String(formData.get("authorizedPersonRole") ?? "").trim();
  const authorizedPersonPhoneRaw = String(formData.get("authorizedPersonPhone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const referenceRaw = String(formData.get("reference") ?? "");
  const reference = referenceRaw.trim() || null;
  const institutionName = String(formData.get("institutionName") ?? "").trim();
  const legalStructure = String(formData.get("legalStructure") ?? "").trim();
  const categoryId = parsePositiveId(formData.get("categoryId"));
  const taxOffice = String(formData.get("taxOffice") ?? "").trim();
  const taxNumber = String(formData.get("taxNumber") ?? "").replace(/\D/g, "");
  const officialPhoneRaw = String(formData.get("officialPhone") ?? "").trim();
  const ilId = parsePositiveId(formData.get("ilId"));
  const ilceId = parsePositiveId(formData.get("ilceId"));
  const mahalleId = parsePositiveId(formData.get("mahalleId"));
  const acceptTerms = String(formData.get("acceptTerms") ?? "").trim() === "true";
  const authorizedPersonPhone = normalizeTurkishMobilePhone(authorizedPersonPhoneRaw);
  const officialPhone = normalizeTurkishMobilePhone(officialPhoneRaw);
  const taxCertificateFile = readDocumentUpload(formData.get("taxCertificateFile"), "tax-certificate");
  const tradeRegistryFile = readDocumentUpload(formData.get("tradeRegistryFile"), "trade-registry");
  const authorizationFile = readDocumentUpload(formData.get("authorizationFile"), "authorization");

  logInstitutionSignupStep(
    "files_parsed",
    `taxCertificate=${describeDocument(taxCertificateFile)};tradeRegistry=${describeDocument(tradeRegistryFile)};authorization=${describeDocument(authorizationFile)}`,
    "file content is not logged",
  );

  if (!acceptTerms) {
    return jsonError({
      status: 400,
      step: "server_validation",
      field: "acceptTerms",
      error: "Devam etmek için koşulları kabul etmelisiniz.",
      code: "accept_terms_required",
    });
  }
  if (!authorizedPersonName) {
    return jsonError({
      status: 400,
      step: "server_validation",
      field: "authorizedPersonName",
      error: "Yetkili ad soyad zorunludur.",
      code: "authorized_person_name_required",
    });
  }
  if (!INSTITUTION_AUTHORIZED_ROLES.has(authorizedPersonRole)) {
    return jsonError({
      status: 400,
      step: "authorized_role_validation",
      field: "authorizedPersonRole",
      error: "Lütfen yetkili görevi seçin.",
      code: "authorized_person_role_invalid",
    });
  }
  if (!authorizedPersonPhone) {
    return jsonError({
      status: 400,
      step: "authorized_phone_validation",
      field: "authorizedPersonPhone",
      error: "Geçerli bir Türkiye telefon numarası girin.",
      code: "authorized_person_phone_invalid",
    });
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return jsonError({
      status: 400,
      step: "server_validation",
      field: "email",
      error: "Geçerli bir e-posta adresi girin.",
      code: "email_invalid",
    });
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return jsonError({
      status: 400,
      step: "server_validation",
      field: "password",
      error: `Şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`,
      code: "password_invalid",
    });
  }
  if (!institutionName) {
    return jsonError({
      status: 400,
      step: "server_validation",
      field: "institutionName",
      error: "Kurum adı zorunludur.",
      code: "institution_name_required",
    });
  }
  if (!legalStructure) {
    return jsonError({
      status: 400,
      step: "server_validation",
      field: "legalStructure",
      error: "Kurum tipi zorunludur.",
      code: "legal_structure_required",
    });
  }
  if (categoryId == null) {
    return jsonError({
      status: 400,
      step: "category_validation",
      field: "categoryId",
      error: "Lütfen bir kategori seçin.",
      code: "category_id_invalid",
    });
  }
  if (!taxOffice) {
    return jsonError({
      status: 400,
      step: "server_validation",
      field: "taxOffice",
      error: "Vergi dairesi zorunludur.",
      code: "tax_office_required",
    });
  }
  if (!isValidInstitutionTaxNumber(taxNumber)) {
    return jsonError({
      status: 400,
      step: "tax_number_validation",
      field: "taxNumber",
      error: "10 haneli VKN veya 11 haneli TCKN girin.",
      code: "tax_number_invalid",
    });
  }
  if (!officialPhone) {
    return jsonError({
      status: 400,
      step: "official_phone_validation",
      field: "officialPhone",
      error: "Geçerli bir Türkiye telefon numarası girin.",
      code: "official_phone_invalid",
    });
  }
  if (ilId == null) {
    return jsonError({
      status: 400,
      step: "il_validation",
      field: "ilId",
      error: "Lütfen il, ilçe ve mahalle seçin.",
      code: "il_id_invalid",
    });
  }
  if (ilceId == null) {
    return jsonError({
      status: 400,
      step: "ilce_validation",
      field: "ilceId",
      error: "Lütfen il, ilçe ve mahalle seçin.",
      code: "ilce_id_invalid",
    });
  }
  if (mahalleId == null) {
    return jsonError({
      status: 400,
      step: "mahalle_validation",
      field: "mahalleId",
      error: "Lütfen il, ilçe ve mahalle seçin.",
      code: "mahalle_id_invalid",
    });
  }
  if (!taxCertificateFile) {
    return jsonError({
      status: 400,
      step: "file_validation",
      field: "taxCertificateFile",
      error: "Vergi levhası yüklemeniz zorunludur.",
      code: "tax_certificate_required",
      hint: "Node FormData entries may not pass instanceof File",
    });
  }
  if (!tradeRegistryFile) {
    return jsonError({
      status: 400,
      step: "file_validation",
      field: "tradeRegistryFile",
      error: "Sicil gazetesi yüklemeniz zorunludur.",
      code: "trade_registry_required",
      hint: "Node FormData entries may not pass instanceof File",
    });
  }

  const requiredFiles: Array<[DocumentUpload, string]> = [
    [taxCertificateFile, "Vergi levhası"],
    [tradeRegistryFile, "Sicil gazetesi"],
  ];
  const optionalFiles: Array<[DocumentUpload, string]> = authorizationFile
    ? [[authorizationFile, "Yetki belgesi"]]
    : [];

  for (const [file, label] of [...requiredFiles, ...optionalFiles]) {
    const field =
      label === "Vergi levhası"
        ? "taxCertificateFile"
        : label === "Sicil gazetesi"
          ? "tradeRegistryFile"
          : "authorizationFile";
    if (!isAllowedDocumentFile(file)) {
      return jsonError({
        status: 400,
        step: "file_validation",
        field,
        error: "Lütfen PDF, JPG, JPEG veya PNG formatında bir belge yükleyin.",
        code: "document_type_invalid",
        details: `label=${label};mime=${file.type || "empty"};size=${file.size}`,
      });
    }
    if (file.size > INSTITUTION_DOCUMENT_MAX_BYTES) {
      return jsonError({
        status: 400,
        step: "file_validation",
        field,
        error: "Belge en fazla 10MB olabilir.",
        code: "document_size_invalid",
        details: `label=${label};size=${file.size}`,
      });
    }
  }

  const { data: categoryRow, error: categoryError } = await authSupabase
    .from("institution_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();
  if (categoryError || Number(categoryRow?.id) !== categoryId) {
    return jsonError({
      status: 400,
      step: "category_validation",
      field: "categoryId",
      error: "Lütfen bir kategori seçin.",
      code: supabaseErrorCode(categoryError, "category_not_found"),
      logError: categoryError,
      details: "category id is not a valid active institution category",
    });
  }

  const locationCheck = await assertLocationHierarchy(authSupabase, ilId, ilceId, mahalleId);
  if (!locationCheck.ok) {
    return jsonError({
      status: 400,
      step: locationCheck.step,
      field: locationCheck.field,
      error: "Lütfen il, ilçe ve mahalle seçimini kontrol edin.",
      code: "location_hierarchy_invalid",
      logError: locationCheck.logError,
    });
  }

  const { data: emailExists, error: emailCheckError } = await authSupabase.rpc("check_email_exists", {
    p_email: email,
  });
  if (emailCheckError) {
    logInstitutionSignupError({
      step: "email_duplicate_check",
      error: emailCheckError,
      message: "email exists check failed",
    });
  }
  if (emailExists === true) {
    return jsonError({
      status: 409,
      step: "email_duplicate_check",
      field: "email",
      error: "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.",
      code: "email-exists",
    });
  }

  const metadata = {
    user_type: "institution",
    company_name: institutionName,
    institution_name: institutionName,
    full_name: institutionName,
    reference,
  };

  logInstitutionSignupStep(
    "auth_signup",
    `metadataKeys=${Object.keys(metadata).join(",")}`,
    "metadata values are not logged; extra form fields are applied in the later service-role UPDATE",
  );

  const { data: signUpData, error: signUpError } = await authSupabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (signUpError) {
    const authInfo = describeAuthSignupError(signUpError);
    if (isLikelyExistingEmailError(signUpError)) {
      return jsonError({
        status: 409,
        step: "email_duplicate_check",
        field: "email",
        error: "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.",
        code: "email-exists",
        logError: signUpError,
      });
    }
    return jsonError({
      status: 400,
      step: "auth_signup",
      error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
      code: authInfo.code,
      logError: signUpError,
      details: `authMessage=${authInfo.message};status=${authInfo.status};name=${authInfo.name}`,
      hint: "sensitive metadata values are not logged",
    });
  }

  const authUserId = signUpData.user?.id;
  if (!authUserId) {
    return jsonError({
      status: 500,
      step: "auth_signup",
      error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
      code: "auth_signup_missing_user",
      details: "auth signup returned without user id",
    });
  }

  logInstitutionSignupStep(
    "auth_signup_complete",
    `hasUser=true;hasSession=${Boolean(signUpData.session?.user?.id)}`,
    "session null must not skip document upload or institution update; email confirmation stays on",
  );

  const uploadedPaths: string[] = [];

  try {
    let publicUserId: number | null = null;
    let publicUserLookupError: unknown = null;

    for (const delayMs of PUBLIC_USER_LOOKUP_DELAYS_MS) {
      if (delayMs > 0) await sleep(delayMs);
      const { data, error } = await serviceSupabase
        .from("users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (error) {
        publicUserLookupError = error;
        logInstitutionSignupError({
          step: "public_user_lookup",
          error,
          message: "public users lookup failed",
          details: `delayMs=${delayMs}`,
        });
        continue;
      }

      const parsedUserId = Number(data?.id);
      if (Number.isFinite(parsedUserId) && parsedUserId > 0) {
        publicUserId = parsedUserId;
        publicUserLookupError = null;
        break;
      }
    }

    if (!publicUserId) {
      return jsonError({
        status: 500,
        step: "public_user_lookup",
        error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
        code: supabaseErrorCode(publicUserLookupError, "public_user_not_found"),
        logError: publicUserLookupError,
        details: "public.users row not found after auth signup",
        hint: "auth user may exist; institution insert did not run; auth user was not deleted",
      });
    }

    logInstitutionSignupStep("public_user_lookup_complete", `hasPublicUserId=true`);
    logInstitutionSignupStep(
      "institution_existing_lookup",
      "order=owner_auth_id,user_id,official_email",
    );

    let existingResult = await resolveExistingInstitution(
      serviceSupabase,
      authUserId,
      publicUserId,
      email,
    );
    if (existingResult.kind === "lookup_failed") {
      return jsonError({
        status: 500,
        step: "institution_insert",
        error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
        code: supabaseErrorCode(existingResult.error, "institution_existing_lookup_failed"),
        logError: existingResult.error,
        details: "existing institution lookup failed",
      });
    }
    if (existingResult.kind === "foreign") {
      return foreignInstitutionError(existingResult.reason);
    }

    let institutionId: number | null = null;
    let usedExisting = false;
    let needsOwnerAuthId = false;

    if (existingResult.kind === "owned") {
      institutionId = existingResult.institutionId;
      usedExisting = true;
      needsOwnerAuthId = existingResult.needsOwnerAuthId;
      logInstitutionSignupStep(
        "institution_existing_found",
        `institutionId=${institutionId};needsOwnerAuthId=${needsOwnerAuthId}`,
      );
    } else {
      logInstitutionSignupStep("institution_insert", "creating new institution row");
      const { data: insertedRow, error: insertError } = await serviceSupabase
        .from("institutions")
        .insert({
          user_id: publicUserId,
          owner_auth_id: authUserId,
          institution_name: institutionName,
          official_email: email,
          source: "auto",
        })
        .select("id")
        .maybeSingle();

      const insertedId = parseInstitutionId(insertedRow?.id);
      if (insertError && isUniqueViolation(insertError)) {
        const constraint = uniqueConstraintName(insertError);
        logInstitutionSignupStep(
          "institution_insert_conflict_relookup",
          `constraint=${constraint || "unknown"}`,
        );
        existingResult = await resolveExistingInstitution(
          serviceSupabase,
          authUserId,
          publicUserId,
          email,
        );
        if (existingResult.kind === "lookup_failed") {
          return jsonError({
            status: 500,
            step: "institution_insert",
            error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
            code: supabaseErrorCode(existingResult.error, "institution_conflict_relookup_failed"),
            logError: existingResult.error,
            details: `unique conflict relookup failed;constraint=${constraint || "unknown"}`,
          });
        }
        if (existingResult.kind === "owned") {
          institutionId = existingResult.institutionId;
          usedExisting = true;
          needsOwnerAuthId = existingResult.needsOwnerAuthId;
          logInstitutionSignupStep(
            "institution_existing_found",
            `institutionId=${institutionId};afterConflict=true;constraint=${constraint || "unknown"}`,
          );
        } else {
          return jsonError({
            status: 409,
            step: "institution_insert",
            error: "Bu kurum bilgileri başka bir kayıtla çakışıyor.",
            code: constraint || "23505",
            logError: insertError,
            details: `unique constraint conflict;constraint=${constraint || "unknown"};owned=${existingResult.kind === "foreign" ? "foreign" : "missing"}`,
            hint: "auth user/public user may exist; this signup did not claim another institution",
          });
        }
      } else if (insertError || !insertedId) {
        return jsonError({
          status: 500,
          step: "institution_insert",
          error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
          code: supabaseErrorCode(insertError, "institution_insert_failed"),
          logError: insertError,
          details: "institutions insert failed after auth signup",
          hint: "auth user/public user may exist; institution row was not created; records were not deleted",
        });
      } else {
        institutionId = insertedId;
      }
    }

    if (!institutionId) {
      return jsonError({
        status: 500,
        step: "institution_insert",
        error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
        code: "institution_id_missing",
        details: "institution id was not obtained after insert",
      });
    }

    if (needsOwnerAuthId) {
      const { error: ownerPatchError } = await serviceSupabase
        .from("institutions")
        .update({ owner_auth_id: authUserId })
        .eq("id", institutionId)
        .eq("user_id", publicUserId)
        .is("owner_auth_id", null);
      if (ownerPatchError) {
        return jsonError({
          status: 500,
          step: "institution_insert",
          error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
          code: supabaseErrorCode(ownerPatchError, "institution_owner_patch_failed"),
          logError: ownerPatchError,
          details: `failed to complete owner_auth_id;institutionId=${institutionId}`,
        });
      }
    }

    logInstitutionSignupStep(
      "institution_ready",
      `institutionId=${institutionId};usedExisting=${usedExisting}`,
    );

    const taxUpload = await uploadInstitutionDocument({
      serviceSupabase,
      institutionId,
      folder: "tax-certificate",
      file: taxCertificateFile,
    });
    if (!taxUpload.path) {
      return jsonError({
        status: 500,
        step: "tax_certificate_upload",
        field: "taxCertificateFile",
        error: "Vergi levhası yüklenirken bir hata oluştu.",
        code: supabaseErrorCode(taxUpload.error, "tax_certificate_upload_failed"),
        logError: taxUpload.error,
        details: `institutionId=${institutionId};bucket=${INSTITUTION_VERIFICATION_FILES_BUCKET}`,
      });
    }
    uploadedPaths.push(taxUpload.path);
    logInstitutionSignupStep(
      "tax_certificate_upload_complete",
      `institutionId=${institutionId};bucket=${INSTITUTION_VERIFICATION_FILES_BUCKET};hasPath=true`,
    );

    const tradeUpload = await uploadInstitutionDocument({
      serviceSupabase,
      institutionId,
      folder: "trade-registry",
      file: tradeRegistryFile,
    });
    if (!tradeUpload.path) {
      await removeUploadedObjects(serviceSupabase, uploadedPaths);
      return jsonError({
        status: 500,
        step: "trade_registry_upload",
        field: "tradeRegistryFile",
        error: "Sicil gazetesi yüklenirken bir hata oluştu.",
        code: supabaseErrorCode(tradeUpload.error, "trade_registry_upload_failed"),
        logError: tradeUpload.error,
        details: `institutionId=${institutionId};bucket=${INSTITUTION_VERIFICATION_FILES_BUCKET}`,
        hint: "uploaded tax certificate will be removed",
      });
    }
    uploadedPaths.push(tradeUpload.path);
    logInstitutionSignupStep(
      "trade_registry_upload_complete",
      `institutionId=${institutionId};bucket=${INSTITUTION_VERIFICATION_FILES_BUCKET};hasPath=true`,
    );

    let authorizationPath: string | null = null;
    if (authorizationFile) {
      const authorizationUpload = await uploadInstitutionDocument({
        serviceSupabase,
        institutionId,
        folder: "authorization",
        file: authorizationFile,
      });
      if (!authorizationUpload.path) {
        await removeUploadedObjects(serviceSupabase, uploadedPaths);
        return jsonError({
          status: 500,
          step: "authorization_upload",
          field: "authorizationFile",
          error: "Yetki belgesi yüklenirken bir hata oluştu.",
          code: supabaseErrorCode(authorizationUpload.error, "authorization_upload_failed"),
          logError: authorizationUpload.error,
          details: `institutionId=${institutionId};bucket=${INSTITUTION_VERIFICATION_FILES_BUCKET}`,
          hint: "uploaded tax certificate and trade registry will be removed",
        });
      }
      authorizationPath = authorizationUpload.path;
      uploadedPaths.push(authorizationPath);
      logInstitutionSignupStep(
        "authorization_upload_complete",
        `institutionId=${institutionId};bucket=${INSTITUTION_VERIFICATION_FILES_BUCKET};hasPath=true`,
      );
    }

    const { data: updatedRow, error: updateError } = await serviceSupabase
      .from("institutions")
      .update({
        authorized_person_name: authorizedPersonName,
        authorized_person_role: authorizedPersonRole,
        authorized_person_phone: authorizedPersonPhone,
        official_email: email,
        reference,
        institution_name: institutionName,
        legal_structure: legalStructure,
        category_id: categoryId,
        tax_office: taxOffice,
        tax_number: taxNumber,
        official_phone: officialPhone,
        il_id: ilId,
        ilce_id: ilceId,
        mahalle_id: mahalleId,
        tax_certificate_document_path: taxUpload.path,
        trade_registry_document_path: tradeUpload.path,
        authorization_document_path: authorizationPath,
      })
      .eq("id", institutionId)
      .select(
        "id, tax_certificate_document_path, trade_registry_document_path, authorization_document_path, legal_structure",
      )
      .maybeSingle();

    if (
      updateError ||
      !updatedRow?.id ||
      !updatedRow.tax_certificate_document_path ||
      !updatedRow.trade_registry_document_path ||
      (authorizationPath && !updatedRow.authorization_document_path)
    ) {
      await removeUploadedObjects(serviceSupabase, uploadedPaths);
      return jsonError({
        status: 500,
        step: "institution_update",
        error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
        code: supabaseErrorCode(updateError, "institution_update_failed"),
        logError: updateError,
        details: `institutionId=${institutionId};hasUpdatedRow=${Boolean(updatedRow?.id)};hasTaxPath=${Boolean(updatedRow?.tax_certificate_document_path)};hasTradePath=${Boolean(updatedRow?.trade_registry_document_path)}`,
        hint: "uploaded institution verification objects will be removed; auth user/institution row were not deleted",
      });
    }

    logInstitutionSignupStep(
      "institution_update_complete",
      `institutionId=${institutionId};hasTaxPath=true;hasTradePath=true;hasAuthorizationPath=${Boolean(updatedRow.authorization_document_path)};hasLegalStructure=${Boolean(updatedRow.legal_structure)}`,
    );
    logInstitutionSignupStep("final_success", `institutionId=${institutionId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    await removeUploadedObjects(serviceSupabase, uploadedPaths);
    return jsonError({
      status: 500,
      step: "institution_update",
      error: "Kurumsal hesap oluşturulurken bir hata oluştu.",
      code: "completion_exception",
      logError: error,
      details: error instanceof Error ? error.message : "unexpected completion exception",
      hint: "auth user/institution row were not deleted; uploaded verification objects will be removed if present",
    });
  }
}
