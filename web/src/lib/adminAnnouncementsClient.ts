"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { extractStoragePathFromPublicUrl } from "@/lib/instructorMediaClient";

export const ADMIN_ANNOUNCEMENTS_TABLE = "admin_announcements" as const;
export const ADMIN_ANNOUNCEMENTS_BUCKET = "admin-announcements" as const;

const ADMIN_ANNOUNCEMENT_ROW_SELECT =
  "id, title, content, announcement_tag, link_url, il_id, ilce_id, announcement_image_url, image_path, is_active, published_at, created_at";

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export const ADMIN_ANNOUNCEMENT_ERROR = "Duyuru işlemi sırasında bir hata oluştu.";
export const ADMIN_ANNOUNCEMENT_IMAGE_TYPE_ERROR =
  "Lütfen JPG, JPEG, PNG veya WebP formatında bir görsel seçin.";
export const ADMIN_ANNOUNCEMENT_IMAGE_SIZE_ERROR = "Görsel en fazla 10MB olabilir.";

export type AdminAnnouncementRow = {
  id: string | number;
  title: string;
  content: string;
  announcement_tag: string | null;
  link_url: string | null;
  il_id: number | null;
  ilce_id: number | null;
  announcement_image_url: string | null;
  image_path: string | null;
  is_active: boolean;
  published_at: string | null;
  created_at: string | null;
};

export type AdminAnnouncementWriteInput = {
  title: string;
  content: string;
  link_url: string | null;
  announcement_tag: string;
  is_active: boolean;
  il_id: number | null;
  ilce_id: number | null;
  imageFile: File | null;
  removeImage: boolean;
};

function safeStorageFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120);
}

export function isValidAdminAnnouncementImage(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= IMAGE_MAX_BYTES;
}

export function adminAnnouncementImageError(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return ADMIN_ANNOUNCEMENT_IMAGE_TYPE_ERROR;
  if (file.size > IMAGE_MAX_BYTES) return ADMIN_ANNOUNCEMENT_IMAGE_SIZE_ERROR;
  return null;
}

const ADMIN_ANNOUNCEMENT_STORAGE_PATH = /^announcements\/[^/]+$/;

function resolveAdminAnnouncementStoragePath(
  imagePath: string | null | undefined,
  imageUrl: string | null | undefined,
): string | null {
  const rawPath = String(imagePath ?? "").trim();
  const path = rawPath
    ? rawPath.includes("://")
      ? extractStoragePathFromPublicUrl(rawPath, ADMIN_ANNOUNCEMENTS_BUCKET)
      : rawPath.replace(/^\/+/, "")
    : extractStoragePathFromPublicUrl(String(imageUrl ?? ""), ADMIN_ANNOUNCEMENTS_BUCKET);
  if (!path || path.includes("..") || path.includes("\\") || !ADMIN_ANNOUNCEMENT_STORAGE_PATH.test(path)) {
    return null;
  }
  return path;
}

function adminImageLikePattern(path: string): string {
  return `%${path.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

async function otherAnnouncementReferencesAdminImage(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  path: string,
  imageUrl: string | null,
): Promise<boolean | null> {
  const like = adminImageLikePattern(path);
  const checks = [
    supabase.from(ADMIN_ANNOUNCEMENTS_TABLE).select("id").eq("image_path", path).limit(1),
    supabase.from(ADMIN_ANNOUNCEMENTS_TABLE).select("id").ilike("announcement_image_url", like).limit(1),
    supabase.from("announcements").select("id").ilike("announcement_image_url", like).limit(1),
    supabase.from("instructor_announcements").select("id").eq("image_path", path).limit(1),
    supabase.from("instructor_announcements").select("id").ilike("image_url", like).limit(1),
  ];
  if (imageUrl) {
    checks.push(
      supabase.from(ADMIN_ANNOUNCEMENTS_TABLE).select("id").eq("announcement_image_url", imageUrl).limit(1),
      supabase.from("announcements").select("id").eq("announcement_image_url", imageUrl).limit(1),
      supabase.from("instructor_announcements").select("id").eq("image_url", imageUrl).limit(1),
    );
  }
  for (const query of checks) {
    const { data, error } = await query;
    if (error) {
      console.warn("[admin-announcements] image reference check:", error);
      return null;
    }
    if ((data ?? []).length > 0) return true;
  }
  return false;
}

async function removeUnreferencedAdminAnnouncementImage(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  imagePath: string | null | undefined,
  imageUrl: string | null | undefined,
) {
  const path = resolveAdminAnnouncementStoragePath(imagePath, imageUrl);
  if (!path) return;
  const referenced = await otherAnnouncementReferencesAdminImage(
    supabase,
    path,
    String(imageUrl ?? "").trim() || null,
  );
  if (referenced !== false) return;
  try {
    await removeAdminAnnouncementImageQuietly(supabase, path, null);
  } catch (cleanupError) {
    console.warn("[admin-announcements] image storage remove:", cleanupError);
  }
}

async function removeAdminAnnouncementImageQuietly(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  imagePath: string | null | undefined,
  imageUrl: string | null | undefined,
): Promise<void> {
  let path = String(imagePath ?? "").trim();
  if (!path) {
    path = extractStoragePathFromPublicUrl(String(imageUrl ?? ""), ADMIN_ANNOUNCEMENTS_BUCKET) ?? "";
  }
  if (!path) return;
  const { error } = await supabase.storage.from(ADMIN_ANNOUNCEMENTS_BUCKET).remove([path]);
  if (error) console.warn("[admin-announcements] image storage remove:", error);
}

async function uploadAdminAnnouncementImage(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  file: File,
): Promise<{ imageUrl: string; imagePath: string } | { error: string }> {
  const validationError = adminAnnouncementImageError(file);
  if (validationError) return { error: validationError };

  const timestamp = Date.now();
  const cleanName = safeStorageFileName(file.name) || `${timestamp}.jpg`;
  const imagePath = `announcements/${timestamp}-${cleanName}`;
  const contentType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const { error } = await supabase.storage
    .from(ADMIN_ANNOUNCEMENTS_BUCKET)
    .upload(imagePath, file, { upsert: false, contentType });
  if (error) {
    console.error("[admin-announcements] image upload:", error);
    return { error: ADMIN_ANNOUNCEMENT_ERROR };
  }
  const imageUrl =
    supabase.storage.from(ADMIN_ANNOUNCEMENTS_BUCKET).getPublicUrl(imagePath).data.publicUrl ?? "";
  if (!imageUrl) return { error: ADMIN_ANNOUNCEMENT_ERROR };
  return { imageUrl, imagePath };
}

export async function fetchAdminAnnouncementsClient(
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ items: AdminAnnouncementRow[]; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(ADMIN_ANNOUNCEMENTS_TABLE)
    .select(ADMIN_ANNOUNCEMENT_ROW_SELECT)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin-announcements] fetch:", error);
    return { items: [], error: ADMIN_ANNOUNCEMENT_ERROR };
  }
  return { items: (data as AdminAnnouncementRow[] | null) ?? [], error: null };
}

export async function createAdminAnnouncementClient(
  input: AdminAnnouncementWriteInput,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ row: AdminAnnouncementRow | null; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  let announcement_image_url: string | null = null;
  let image_path: string | null = null;

  if (input.imageFile) {
    const uploaded = await uploadAdminAnnouncementImage(supabase, input.imageFile);
    if ("error" in uploaded) return { row: null, error: uploaded.error };
    announcement_image_url = uploaded.imageUrl;
    image_path = uploaded.imagePath;
  }

  const { data, error } = await supabase
    .from(ADMIN_ANNOUNCEMENTS_TABLE)
    .insert({
      title: input.title,
      content: input.content,
      link_url: input.link_url,
      announcement_tag: input.announcement_tag,
      is_active: input.is_active,
      il_id: input.il_id,
      ilce_id: input.ilce_id,
      announcement_image_url,
      image_path,
    })
    .select(ADMIN_ANNOUNCEMENT_ROW_SELECT)
    .single();

  if (error || !data) {
    console.error("[admin-announcements] create:", error);
    if (image_path) await removeAdminAnnouncementImageQuietly(supabase, image_path, announcement_image_url);
    return { row: null, error: ADMIN_ANNOUNCEMENT_ERROR };
  }

  return { row: data as AdminAnnouncementRow, error: null };
}

export async function updateAdminAnnouncementClient(
  announcementId: string | number,
  existing: Pick<AdminAnnouncementRow, "announcement_image_url" | "image_path">,
  input: AdminAnnouncementWriteInput,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ row: AdminAnnouncementRow | null; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  let announcement_image_url: string | null = existing.announcement_image_url;
  let image_path: string | null = existing.image_path;
  const previousPath = existing.image_path;
  const previousUrl = existing.announcement_image_url;
  let uploadedPath: string | null = null;
  let uploadedUrl: string | null = null;

  if (input.removeImage) {
    announcement_image_url = null;
    image_path = null;
  }

  if (input.imageFile) {
    const uploaded = await uploadAdminAnnouncementImage(supabase, input.imageFile);
    if ("error" in uploaded) return { row: null, error: uploaded.error };
    uploadedUrl = uploaded.imageUrl;
    uploadedPath = uploaded.imagePath;
    announcement_image_url = uploaded.imageUrl;
    image_path = uploaded.imagePath;
  }

  const { data, error } = await supabase
    .from(ADMIN_ANNOUNCEMENTS_TABLE)
    .update({
      title: input.title,
      content: input.content,
      link_url: input.link_url,
      announcement_tag: input.announcement_tag,
      is_active: input.is_active,
      il_id: input.il_id,
      ilce_id: input.ilce_id,
      announcement_image_url,
      image_path,
    })
    .eq("id", announcementId)
    .select(ADMIN_ANNOUNCEMENT_ROW_SELECT)
    .maybeSingle();

  if (error || !data) {
    console.error("[admin-announcements] update:", error);
    if (uploadedPath) await removeAdminAnnouncementImageQuietly(supabase, uploadedPath, uploadedUrl);
    return { row: null, error: ADMIN_ANNOUNCEMENT_ERROR };
  }

  if ((input.removeImage || input.imageFile) && previousPath && previousPath !== image_path) {
    await removeUnreferencedAdminAnnouncementImage(supabase, previousPath, previousUrl);
  }

  return { row: data as AdminAnnouncementRow, error: null };
}

export async function deleteAdminAnnouncementClient(
  announcement: Pick<AdminAnnouncementRow, "id" | "announcement_image_url" | "image_path">,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(ADMIN_ANNOUNCEMENTS_TABLE)
    .delete()
    .eq("id", announcement.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[admin-announcements] delete:", error ?? "no row returned");
    return { error: ADMIN_ANNOUNCEMENT_ERROR };
  }
  await removeUnreferencedAdminAnnouncementImage(
    supabase,
    announcement.image_path,
    announcement.announcement_image_url,
  );
  return { error: null };
}
