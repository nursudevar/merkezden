"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const ADVERTISEMENTS_BUCKET = "advertisements" as const;
export const ADVERTISEMENT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export type AdvertisementMediaType = "image" | "video";
export type AdvertisementMediaExtension = "jpg" | "jpeg" | "png" | "webp" | "mp4" | "webm";
export type AdvertisementMediaContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "video/mp4"
  | "video/webm";

type AdvertisementMediaRule = {
  mediaType: AdvertisementMediaType;
  contentType: AdvertisementMediaContentType;
  extensions: readonly AdvertisementMediaExtension[];
};

const MEDIA_RULES: readonly AdvertisementMediaRule[] = [
  { mediaType: "image", contentType: "image/jpeg", extensions: ["jpg", "jpeg"] },
  { mediaType: "image", contentType: "image/png", extensions: ["png"] },
  { mediaType: "image", contentType: "image/webp", extensions: ["webp"] },
  { mediaType: "video", contentType: "video/mp4", extensions: ["mp4"] },
  { mediaType: "video", contentType: "video/webm", extensions: ["webm"] },
];

const INVALID_MEDIA_MESSAGE = "Yalnızca JPG, PNG, WEBP, MP4 ve WEBM dosyaları yüklenebilir.";
const FILE_TOO_LARGE_MESSAGE = "Dosya en fazla 10MB olabilir.";
const UPLOAD_FAILED_MESSAGE = "Medya yüklenemedi. Lütfen tekrar deneyin.";
const LANDSCAPE_IMAGE_MESSAGE =
  "Reklam görseli yatay/dikdörtgen olmalıdır. Dikey veya kare görseller kabul edilmez.";
const LANDSCAPE_VIDEO_MESSAGE =
  "Reklam videosu yatay/dikdörtgen olmalıdır. Dikey veya kare videolar kabul edilmez.";
const MEDIA_DIMENSIONS_MESSAGE = "Medya boyutları okunamadı. Lütfen başka bir dosya seçin.";

export type ValidatedAdvertisementMedia = {
  mediaType: AdvertisementMediaType;
  extension: AdvertisementMediaExtension;
  contentType: AdvertisementMediaContentType;
};

export type AdvertisementMediaValidationResult =
  | { ok: true; media: ValidatedAdvertisementMedia }
  | { ok: false; error: string };

export type AdvertisementMediaUploadResult =
  | { path: string; mediaType: AdvertisementMediaType; publicUrl: string }
  | { error: string };

function readExtension(fileName: string): string {
  const baseName = fileName.trim().split(/[/\\]/).pop() ?? "";
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === baseName.length - 1) return "";
  return baseName.slice(dotIndex + 1).toLowerCase();
}

export function validateAdvertisementMediaFile(file: File): AdvertisementMediaValidationResult {
  if (file.size > ADVERTISEMENT_MEDIA_MAX_BYTES) {
    return { ok: false, error: FILE_TOO_LARGE_MESSAGE };
  }

  const extension = readExtension(file.name);
  const contentType = file.type.trim().toLowerCase();
  const rule = MEDIA_RULES.find(
    (candidate) =>
      candidate.contentType === contentType &&
      candidate.extensions.some((allowed) => allowed === extension),
  );

  if (!rule || !extension) {
    return { ok: false, error: INVALID_MEDIA_MESSAGE };
  }

  return {
    ok: true,
    media: {
      mediaType: rule.mediaType,
      extension: extension as AdvertisementMediaExtension,
      contentType: rule.contentType,
    },
  };
}

function readMediaDimensions(
  file: File,
  mediaType: AdvertisementMediaType,
): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const finish = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };
    if (mediaType === "image") {
      const image = new Image();
      image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => finish(null);
      image.src = url;
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => finish({ width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export async function validateAdvertisementMediaOrientation(
  file: File,
  mediaType: AdvertisementMediaType,
): Promise<AdvertisementMediaValidationResult | { ok: true }> {
  const size = await readMediaDimensions(file, mediaType);
  if (!size || size.width <= 0 || size.height <= 0) {
    return { ok: false, error: MEDIA_DIMENSIONS_MESSAGE };
  }
  if (size.width <= size.height) {
    return {
      ok: false,
      error: mediaType === "image" ? LANDSCAPE_IMAGE_MESSAGE : LANDSCAPE_VIDEO_MESSAGE,
    };
  }
  return { ok: true };
}

export async function uploadAdvertisementMedia(file: File): Promise<AdvertisementMediaUploadResult> {
  const validation = validateAdvertisementMediaFile(file);
  if (!validation.ok) return { error: validation.error };
  const orientation = await validateAdvertisementMediaOrientation(file, validation.media.mediaType);
  if (!orientation.ok) return { error: orientation.error };

  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) {
    console.error("[advertisements] uuid unavailable");
    return { error: UPLOAD_FAILED_MESSAGE };
  }

  const path = `media/${uuid.toLowerCase()}.${validation.media.extension}`;

  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.storage.from(ADVERTISEMENTS_BUCKET).upload(path, file, {
      upsert: false,
      contentType: validation.media.contentType,
    });

    if (error) {
      console.error("[advertisements] upload", error.message);
      return { error: UPLOAD_FAILED_MESSAGE };
    }

    const publicUrl = supabase.storage.from(ADVERTISEMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
    if (!publicUrl) return { error: UPLOAD_FAILED_MESSAGE };

    return {
      path,
      mediaType: validation.media.mediaType,
      publicUrl,
    };
  } catch (error) {
    console.error(
      "[advertisements] upload",
      error instanceof Error ? error.message : "unknown error",
    );
    return { error: UPLOAD_FAILED_MESSAGE };
  }
}
