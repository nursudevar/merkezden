"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  INSTRUCTOR_MEDIA_BUCKET,
  extractStoragePathFromPublicUrl,
  uploadInstructorAnnouncementImageClient,
} from "@/lib/instructorMediaClient";

export const INSTRUCTOR_ANNOUNCEMENTS_TABLE = "instructor_announcements" as const;

const INSTRUCTOR_ANNOUNCEMENT_ROW_SELECT =
  "id, instructor_id, owner_auth_id, title, content, image_url, image_path, link_url, announcement_tag, il_id, ilce_id, is_active, published_at, created_at, updated_at";

export type InstructorAnnouncementRow = {
  id: number;
  instructor_id: number;
  owner_auth_id: string;
  title: string;
  content: string;
  image_url: string | null;
  image_path: string | null;
  link_url: string | null;
  announcement_tag: string | null;
  il_id: number | null;
  ilce_id: number | null;
  is_active: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const INSTRUCTOR_ANNOUNCEMENT_ERROR = "Duyuru işlemi sırasında bir hata oluştu.";
export const INSTRUCTOR_ANNOUNCEMENT_CREATE_SUCCESS = "Duyuru başarıyla eklendi.";
export const INSTRUCTOR_ANNOUNCEMENT_UPDATE_SUCCESS = "Duyuru başarıyla güncellendi.";
export const INSTRUCTOR_ANNOUNCEMENT_DELETE_SUCCESS = "Duyuru başarıyla silindi.";
export const INSTRUCTOR_ANNOUNCEMENT_LINK_URL_ERROR = "Lütfen geçerli bir bağlantı adresi girin.";

export function formatInstructorAnnouncementDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function buildInstructorAnnouncementContentPreview(content: string, maxLen = 120): string {
  const normalized = String(content ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trim()}…`;
}

export function isValidOptionalAnnouncementLinkUrl(url: string): boolean {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return true;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return Boolean(parsed.hostname) && parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function normalizeAnnouncementLinkUrl(url: string): string | null {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const INSTRUCTOR_ANNOUNCEMENT_STORAGE_PATH = /^instructors\/\d+\/announcements\/[^/]+$/;

function resolveInstructorAnnouncementStoragePath(
  imagePath: string | null | undefined,
  imageUrl: string | null | undefined,
): string | null {
  const rawPath = String(imagePath ?? "").trim();
  const path = rawPath
    ? rawPath.includes("://")
      ? extractStoragePathFromPublicUrl(rawPath, INSTRUCTOR_MEDIA_BUCKET)
      : rawPath.replace(/^\/+/, "")
    : extractStoragePathFromPublicUrl(String(imageUrl ?? ""), INSTRUCTOR_MEDIA_BUCKET);
  if (!path || path.includes("..") || path.includes("\\") || !INSTRUCTOR_ANNOUNCEMENT_STORAGE_PATH.test(path)) {
    return null;
  }
  return path;
}

function announcementImageLikePattern(path: string): string {
  return `%${path.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

async function otherAnnouncementReferencesImage(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  path: string,
  imageUrl: string | null,
): Promise<boolean | null> {
  const like = announcementImageLikePattern(path);
  const checks = [
    supabase.from(INSTRUCTOR_ANNOUNCEMENTS_TABLE).select("id").eq("image_path", path).limit(1),
    supabase.from(INSTRUCTOR_ANNOUNCEMENTS_TABLE).select("id").ilike("image_url", like).limit(1),
    supabase.from("announcements").select("id").ilike("announcement_image_url", like).limit(1),
    supabase.from("admin_announcements").select("id").eq("image_path", path).limit(1),
    supabase.from("admin_announcements").select("id").ilike("announcement_image_url", like).limit(1),
  ];
  if (imageUrl) {
    checks.push(
      supabase.from(INSTRUCTOR_ANNOUNCEMENTS_TABLE).select("id").eq("image_url", imageUrl).limit(1),
      supabase.from("announcements").select("id").eq("announcement_image_url", imageUrl).limit(1),
      supabase.from("admin_announcements").select("id").eq("announcement_image_url", imageUrl).limit(1),
    );
  }

  for (const query of checks) {
    const { data, error } = await query;
    if (error) {
      console.warn("[instructor-announcements] image reference check:", error);
      return null;
    }
    if ((data ?? []).length > 0) return true;
  }
  return false;
}

async function removeUnreferencedAnnouncementImage(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  imagePath: string | null | undefined,
  imageUrl: string | null | undefined,
) {
  const path = resolveInstructorAnnouncementStoragePath(imagePath, imageUrl);
  if (!path) return;
  const referenced = await otherAnnouncementReferencesImage(
    supabase,
    path,
    String(imageUrl ?? "").trim() || null,
  );
  if (referenced !== false) return;
  try {
    await removeAnnouncementImageQuietly(supabase, path, null);
  } catch (cleanupError) {
    console.warn("[instructor-announcements] image storage remove:", cleanupError);
  }
}

async function removeAnnouncementImageQuietly(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  imagePath: string | null | undefined,
  imageUrl: string | null | undefined,
): Promise<void> {
  let path = String(imagePath ?? "").trim();
  if (!path) {
    const fromUrl = extractStoragePathFromPublicUrl(String(imageUrl ?? ""), INSTRUCTOR_MEDIA_BUCKET);
    path = fromUrl ?? "";
  }
  if (!path) return;

  const { error } = await supabase.storage.from(INSTRUCTOR_MEDIA_BUCKET).remove([path]);
  if (error) {
    console.warn("[instructor-announcements] image storage remove:", error);
  }
}

export async function fetchInstructorAnnouncementsClient(
  authUid: string,
  instructorId: number,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ items: InstructorAnnouncementRow[]; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(INSTRUCTOR_ANNOUNCEMENTS_TABLE)
    .select(INSTRUCTOR_ANNOUNCEMENT_ROW_SELECT)
    .eq("instructor_id", instructorId)
    .eq("owner_auth_id", authUid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[instructor-announcements] fetch:", error);
    return { items: [], error: INSTRUCTOR_ANNOUNCEMENT_ERROR };
  }

  return { items: (data as InstructorAnnouncementRow[] | null) ?? [], error: null };
}

export type CreateInstructorAnnouncementInput = {
  title: string;
  content: string;
  link_url: string | null;
  announcement_tag: string;
  is_active: boolean;
  il_id: number | null;
  ilce_id: number | null;
  imageFile: File | null;
};

export async function createInstructorAnnouncementClient(
  authUid: string,
  instructorId: number,
  input: CreateInstructorAnnouncementInput,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ row: InstructorAnnouncementRow | null; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();
  let image_url: string | null = null;
  let image_path: string | null = null;

  if (input.imageFile) {
    const uploaded = await uploadInstructorAnnouncementImageClient(
      instructorId,
      input.imageFile,
      supabase,
    );
    if ("error" in uploaded) {
      return { row: null, error: uploaded.error };
    }
    image_url = uploaded.imageUrl;
    image_path = uploaded.imagePath;
  }

  const { data, error } = await supabase
    .from(INSTRUCTOR_ANNOUNCEMENTS_TABLE)
    .insert({
      instructor_id: instructorId,
      owner_auth_id: authUid,
      title: input.title,
      content: input.content,
      image_url,
      image_path,
      link_url: input.link_url,
      announcement_tag: input.announcement_tag,
      is_active: input.is_active,
      il_id: input.il_id,
      ilce_id: input.ilce_id,
    })
    .select(INSTRUCTOR_ANNOUNCEMENT_ROW_SELECT)
    .single();

  if (error || !data) {
    console.error("[instructor-announcements] create:", error);
    if (image_path) {
      await removeAnnouncementImageQuietly(supabase, image_path, image_url);
    }
    return { row: null, error: INSTRUCTOR_ANNOUNCEMENT_ERROR };
  }

  return { row: data as InstructorAnnouncementRow, error: null };
}

export type UpdateInstructorAnnouncementInput = {
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

export async function updateInstructorAnnouncementClient(
  authUid: string,
  instructorId: number,
  announcementId: number,
  existing: Pick<InstructorAnnouncementRow, "image_url" | "image_path">,
  input: UpdateInstructorAnnouncementInput,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ row: InstructorAnnouncementRow | null; error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  let image_url: string | null = existing.image_url;
  let image_path: string | null = existing.image_path;
  const previousPath = existing.image_path;
  const previousUrl = existing.image_url;
  let uploadedPath: string | null = null;
  let uploadedUrl: string | null = null;

  if (input.removeImage) {
    image_url = null;
    image_path = null;
  }

  if (input.imageFile) {
    const uploaded = await uploadInstructorAnnouncementImageClient(
      instructorId,
      input.imageFile,
      supabase,
    );
    if ("error" in uploaded) {
      return { row: null, error: uploaded.error };
    }
    uploadedUrl = uploaded.imageUrl;
    uploadedPath = uploaded.imagePath;
    image_url = uploaded.imageUrl;
    image_path = uploaded.imagePath;
  }

  const { data, error } = await supabase
    .from(INSTRUCTOR_ANNOUNCEMENTS_TABLE)
    .update({
      title: input.title,
      content: input.content,
      link_url: input.link_url,
      announcement_tag: input.announcement_tag,
      is_active: input.is_active,
      il_id: input.il_id,
      ilce_id: input.ilce_id,
      image_url,
      image_path,
    })
    .eq("id", announcementId)
    .eq("instructor_id", instructorId)
    .eq("owner_auth_id", authUid)
    .select(INSTRUCTOR_ANNOUNCEMENT_ROW_SELECT)
    .maybeSingle();

  if (error || !data) {
    console.error("[instructor-announcements] update:", error);
    if (uploadedPath) {
      await removeAnnouncementImageQuietly(supabase, uploadedPath, uploadedUrl);
    }
    return { row: null, error: INSTRUCTOR_ANNOUNCEMENT_ERROR };
  }

  if (input.removeImage || input.imageFile) {
    if (previousPath && previousPath !== image_path) {
      await removeUnreferencedAnnouncementImage(supabase, previousPath, previousUrl);
    } else if (input.removeImage && !input.imageFile && previousPath) {
      await removeUnreferencedAnnouncementImage(supabase, previousPath, previousUrl);
    }
  }

  return { row: data as InstructorAnnouncementRow, error: null };
}

export async function deleteInstructorAnnouncementClient(
  authUid: string,
  instructorId: number,
  announcement: InstructorAnnouncementRow,
  supabaseArg?: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<{ error: string | null }> {
  const supabase = supabaseArg ?? createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from(INSTRUCTOR_ANNOUNCEMENTS_TABLE)
    .delete()
    .eq("id", announcement.id)
    .eq("instructor_id", instructorId)
    .eq("owner_auth_id", authUid)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[instructor-announcements] delete:", error ?? "no row returned");
    return { error: INSTRUCTOR_ANNOUNCEMENT_ERROR };
  }

  await removeUnreferencedAnnouncementImage(
    supabase,
    announcement.image_path,
    announcement.image_url,
  );

  return { error: null };
}
