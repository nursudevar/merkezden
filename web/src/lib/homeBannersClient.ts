"use client";

import { resolveIsAdminFromUserRolesClient } from "@/lib/auth/authBrowserClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const HOMEPAGE_BANNERS_TABLE = "homepage_banners" as const;
export const HOMEPAGE_BANNERS_BUCKET = "homepage-banners" as const;
export const HOMEPAGE_BANNER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const HOMEPAGE_BANNER_VIDEO_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const HOMEPAGE_BANNERS_PUBLIC_MARKER = `/object/public/${HOMEPAGE_BANNERS_BUCKET}/`;

const HOMEPAGE_BANNERS_SELECT =
  "id, image_url, image_path, title, description, media_type, video_url, video_path, display_order, is_active, created_at, updated_at";

export type HomepageBannerMediaType = "image" | "video";

export type HomepageBannerRow = {
  id: string;
  image_url: string;
  image_path: string | null;
  title: string | null;
  description: string | null;
  media_type: HomepageBannerMediaType | null;
  video_url: string | null;
  video_path: string | null;
  display_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PublicHomepageBanner = {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  mediaType: HomepageBannerMediaType;
  videoUrl: string | null;
};

const PUBLIC_HOMEPAGE_BANNERS_SELECT =
  "id, image_url, title, description, display_order, media_type, video_url";

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | string | null;
};

export type HomepageBannerMutationError = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | string | null;
};

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function logHomepageBannerSupabaseError(context: string, error: unknown) {
  if (!error) return;

  const record =
    typeof error === "object" && error !== null ? (error as SupabaseErrorLike) : ({} as SupabaseErrorLike);

  console.error(`[homepage-banners] ${context}`, {
    json: safeJsonStringify(error),
    propertyNames:
      typeof error === "object" && error !== null ? Object.getOwnPropertyNames(error as object) : [],
    code: record.code ?? null,
    message: record.message ?? null,
    details: record.details ?? null,
    hint: record.hint ?? null,
    status: record.status ?? null,
  });
}

export function formatHomepageBannerSupabaseError(
  error: SupabaseErrorLike | null | undefined,
  fallback: string,
): string {
  const message = String(error?.message ?? "").trim();
  const details = String(error?.details ?? "").trim();
  const hint = String(error?.hint ?? "").trim();
  const code = String(error?.code ?? "").trim();

  const primary = message || details || hint;
  if (!primary) return fallback;
  if (code && !primary.includes(code)) {
    return `${primary} (${code})`;
  }
  return primary;
}

function toMutationError(
  error: SupabaseErrorLike | null | undefined,
  fallback: string,
): HomepageBannerMutationError {
  const record = error ?? {};
  return {
    message: formatHomepageBannerSupabaseError(record, fallback),
    code: record.code ?? null,
    details: record.details ?? null,
    hint: record.hint ?? null,
    status: record.status ?? null,
  };
}

export async function verifyHomepageBannerWriteAccess(
  supabase: SupabaseBrowser,
): Promise<{ ok: true; authUserId: string } | { ok: false; error: HomepageBannerMutationError }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    logHomepageBannerSupabaseError("verify session", sessionError);
    return {
      ok: false,
      error: toMutationError(sessionError, "Oturum doğrulanamadı."),
    };
  }

  const authUserId = session?.user?.id ?? null;
  if (!authUserId) {
    return {
      ok: false,
      error: {
        message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
        code: "NO_SESSION",
      },
    };
  }

  const isAdmin = await resolveIsAdminFromUserRolesClient(authUserId);
  if (!isAdmin) {
    return {
      ok: false,
      error: {
        message: "Bu işlem için admin yetkisi gerekir.",
        code: "NOT_ADMIN",
      },
    };
  }

  return { ok: true, authUserId };
}

function buildHomepageBannerInsertPayload(
  input: SaveHomepageBannerInput,
  displayOrder: number,
) {
  const isVideo = input.mediaType === "video";

  return {
    image_url: input.imageUrl.trim(),
    image_path: input.imagePath?.trim() || null,
    title: input.title.trim(),
    description: input.description.trim(),
    media_type: input.mediaType,
    video_url: isVideo ? input.videoUrl?.trim() || null : null,
    video_path: isVideo ? input.videoPath?.trim() || null : null,
    display_order: displayOrder,
    is_active: input.isActive,
  };
}

export function safeHomepageBannerFileName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);
}

export function isValidHomepageBannerImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type);
}

export function isValidHomepageBannerVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_TYPES.has(file.type);
}

export function resolveHomepageBannerMediaType(
  value: string | null | undefined,
): HomepageBannerMediaType {
  return value === "video" ? "video" : "image";
}

export function extractHomepageBannerStoragePath(
  imageUrl: string | null | undefined,
  imagePath: string | null | undefined,
): string | null {
  const directPath = String(imagePath ?? "").trim();
  if (directPath) return directPath;

  const url = String(imageUrl ?? "").trim();
  if (!url) return null;

  const markerIndex = url.indexOf(HOMEPAGE_BANNERS_PUBLIC_MARKER);
  if (markerIndex === -1) return null;

  const rawPath = url.slice(markerIndex + HOMEPAGE_BANNERS_PUBLIC_MARKER.length);
  try {
    return decodeURIComponent(rawPath.split("?")[0] ?? "").trim() || null;
  } catch {
    return rawPath.split("?")[0]?.trim() || null;
  }
}

export async function fetchHomepageBannersForAdmin(
  supabase: SupabaseBrowser,
): Promise<{ rows: HomepageBannerRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from(HOMEPAGE_BANNERS_TABLE)
    .select(HOMEPAGE_BANNERS_SELECT)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logHomepageBannerSupabaseError("fetch admin list", error);
    return { rows: [], error: formatHomepageBannerSupabaseError(error, "Banner listesi alınamadı.") };
  }

  return { rows: (data ?? []) as HomepageBannerRow[], error: null };
}

export async function fetchActiveHomepageBanners(
  supabase: SupabaseBrowser,
): Promise<{ banners: PublicHomepageBanner[]; error: string | null }> {
  const { data, error } = await supabase
    .from(HOMEPAGE_BANNERS_TABLE)
    .select(PUBLIC_HOMEPAGE_BANNERS_SELECT)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logHomepageBannerSupabaseError("fetch active public banners", error);
    return { banners: [], error: formatHomepageBannerSupabaseError(error, "Bannerlar yüklenemedi.") };
  }

  const banners = (data ?? [])
    .map((row) => {
      const record = row as {
        id: string;
        image_url: string | null;
        title: string | null;
        description: string | null;
        media_type: string | null;
        video_url: string | null;
      };
      const imageUrl = String(record.image_url ?? "").trim();
      const title = String(record.title ?? "").trim();
      const description = String(record.description ?? "").trim();
      const mediaType = resolveHomepageBannerMediaType(record.media_type);
      const videoUrl = String(record.video_url ?? "").trim() || null;

      if (!imageUrl || !title) return null;
      if (mediaType === "video" && !videoUrl) return null;

      return {
        id: String(record.id),
        imageUrl,
        title,
        description,
        mediaType,
        videoUrl: mediaType === "video" ? videoUrl : null,
      } satisfies PublicHomepageBanner;
    })
    .filter((row): row is PublicHomepageBanner => row !== null);

  return { banners, error: null };
}

export async function getNextHomepageBannerDisplayOrder(
  supabase: SupabaseBrowser,
): Promise<number> {
  const { data, error } = await supabase
    .from(HOMEPAGE_BANNERS_TABLE)
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);

  if (error) {
    logHomepageBannerSupabaseError("fetch max display_order", error);
    return 0;
  }

  const max = Number((data?.[0] as { display_order: number | null } | undefined)?.display_order);
  return Number.isFinite(max) ? max + 1 : 0;
}

export async function normalizeHomepageBannerDisplayOrders(
  supabase: SupabaseBrowser,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    if (!id) continue;

    const { error } = await supabase
      .from(HOMEPAGE_BANNERS_TABLE)
      .update({ display_order: index })
      .eq("id", id);

    if (error) {
      logHomepageBannerSupabaseError("normalize display_order", error);
      return { error: formatHomepageBannerSupabaseError(error, "Banner sırası güncellenemedi.") };
    }
  }

  return { error: null };
}

export async function deleteHomepageBannerStorageObject(
  supabase: SupabaseBrowser,
  imageUrl: string | null | undefined,
  imagePath: string | null | undefined,
): Promise<void> {
  const path = extractHomepageBannerStoragePath(imageUrl, imagePath);
  if (!path) return;

  const { error } = await supabase.storage.from(HOMEPAGE_BANNERS_BUCKET).remove([path]);
  if (error) {
    logHomepageBannerSupabaseError("storage remove", error);
  }
}

export async function uploadHomepageBannerImage(
  supabase: SupabaseBrowser,
  file: File,
  bannerId?: string | null,
): Promise<{ publicUrl: string; path: string } | { error: string }> {
  if (file.size > HOMEPAGE_BANNER_IMAGE_MAX_BYTES) {
    return { error: "Görsel en fazla 10MB olabilir." };
  }

  if (!isValidHomepageBannerImageFile(file)) {
    return { error: "Yalnızca JPG, PNG ve WEBP görselleri yüklenebilir." };
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const cleanName = safeHomepageBannerFileName(file.name) || `${timestamp}.jpg`;
  const folder = bannerId ? `banners/${bannerId}` : "banners/new";
  const path = `${folder}/${timestamp}-${randomSuffix}-${cleanName}`;

  const { error } = await supabase.storage.from(HOMEPAGE_BANNERS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    logHomepageBannerSupabaseError("upload image", error);
    return { error: formatHomepageBannerSupabaseError(error, "Görsel yüklenemedi.") };
  }

  const publicUrl = supabase.storage.from(HOMEPAGE_BANNERS_BUCKET).getPublicUrl(path).data.publicUrl;
  return { publicUrl, path };
}

export async function uploadHomepageBannerVideo(
  supabase: SupabaseBrowser,
  file: File,
  bannerId?: string | null,
): Promise<{ publicUrl: string; path: string } | { error: string }> {
  if (file.size > HOMEPAGE_BANNER_VIDEO_MAX_BYTES) {
    return { error: "Video en fazla 10MB olabilir." };
  }

  if (!isValidHomepageBannerVideoFile(file)) {
    return { error: "Yalnızca MP4 ve WEBM videoları yüklenebilir." };
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const cleanName = safeHomepageBannerFileName(file.name) || `${timestamp}.mp4`;
  const folder = bannerId ? `banners/${bannerId}` : "banners/new";
  const path = `${folder}/${timestamp}-${randomSuffix}-${cleanName}`;

  const { error } = await supabase.storage.from(HOMEPAGE_BANNERS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    logHomepageBannerSupabaseError("upload video", error);
    return { error: formatHomepageBannerSupabaseError(error, "Video yüklenemedi.") };
  }

  const publicUrl = supabase.storage.from(HOMEPAGE_BANNERS_BUCKET).getPublicUrl(path).data.publicUrl;
  return { publicUrl, path };
}

export type SaveHomepageBannerInput = {
  title: string;
  description: string;
  imageUrl: string;
  imagePath: string | null;
  mediaType: HomepageBannerMediaType;
  videoUrl: string | null;
  videoPath: string | null;
  isActive: boolean;
};

export async function createHomepageBanner(
  supabase: SupabaseBrowser,
  input: SaveHomepageBannerInput,
): Promise<{ success: boolean; error: HomepageBannerMutationError | null }> {
  const access = await verifyHomepageBannerWriteAccess(supabase);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const displayOrder = await getNextHomepageBannerDisplayOrder(supabase);
  const insertPayload = buildHomepageBannerInsertPayload(input, displayOrder);

  const { error } = await supabase.from(HOMEPAGE_BANNERS_TABLE).insert(insertPayload);

  if (error) {
    logHomepageBannerSupabaseError("create insert", error);
    return {
      success: false,
      error: toMutationError(error, "Banner kaydedilemedi."),
    };
  }

  return { success: true, error: null };
}

export async function updateHomepageBanner(
  supabase: SupabaseBrowser,
  bannerId: string,
  input: SaveHomepageBannerInput,
): Promise<{ error: HomepageBannerMutationError | null }> {
  const access = await verifyHomepageBannerWriteAccess(supabase);
  if (!access.ok) {
    return { error: access.error };
  }

  const { error } = await supabase
    .from(HOMEPAGE_BANNERS_TABLE)
    .update({
      image_url: input.imageUrl.trim(),
      image_path: input.imagePath?.trim() || null,
      title: input.title.trim(),
      description: input.description.trim(),
      media_type: input.mediaType,
      video_url: input.mediaType === "video" ? input.videoUrl?.trim() || null : null,
      video_path: input.mediaType === "video" ? input.videoPath?.trim() || null : null,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bannerId);

  if (error) {
    logHomepageBannerSupabaseError("update", error);
    return { error: toMutationError(error, "Banner güncellenemedi.") };
  }

  return { error: null };
}

export async function setHomepageBannerActiveState(
  supabase: SupabaseBrowser,
  bannerId: string,
  isActive: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(HOMEPAGE_BANNERS_TABLE)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", bannerId);

  if (error) {
    logHomepageBannerSupabaseError("toggle active", error);
    return { error: formatHomepageBannerSupabaseError(error, "Banner durumu güncellenemedi.") };
  }

  return { error: null };
}

export async function deleteHomepageBanner(
  supabase: SupabaseBrowser,
  row: Pick<
    HomepageBannerRow,
    "id" | "image_url" | "image_path" | "video_url" | "video_path"
  >,
): Promise<{ error: string | null }> {
  await deleteHomepageBannerStorageObject(supabase, row.image_url, row.image_path);
  await deleteHomepageBannerStorageObject(supabase, row.video_url, row.video_path);

  const { error } = await supabase.from(HOMEPAGE_BANNERS_TABLE).delete().eq("id", row.id);
  if (error) {
    logHomepageBannerSupabaseError("delete", error);
    return { error: formatHomepageBannerSupabaseError(error, "Banner silinemedi.") };
  }

  const { rows: remainingRows, error: fetchError } = await fetchHomepageBannersForAdmin(supabase);
  if (fetchError) {
    return { error: null };
  }

  const normalizeResult = await normalizeHomepageBannerDisplayOrders(
    supabase,
    remainingRows.map((item) => item.id),
  );

  return normalizeResult;
}
