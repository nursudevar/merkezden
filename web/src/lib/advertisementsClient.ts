"use client";

import { ADVERTISEMENTS_BUCKET } from "@/lib/advertisementsMediaClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MEDIA_PATH_PATTERN =
  /^media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm)$/;

export type AdvertisementMediaType = "image" | "video";
export type AdvertiserType = "platform" | "institution" | "instructor";
export type AdPlacementType =
  | "home"
  | "institution_category"
  | "instructor_category"
  | "instructor_general";

export type AdvertisementButton = {
  label: string;
  url: string;
};

export type AdvertisementRecord = {
  id: string;
  title: string;
  description: string;
  mediaType: AdvertisementMediaType;
  mediaPath: string;
  buttons: AdvertisementButton[];
  advertiserType: AdvertiserType;
  institutionId: number | null;
  instructorId: number | null;
  institutionName: string | null;
  instructorName: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  assignments: AdAssignmentRecord[];
};

export type AdPlacementRecord = {
  id: string;
  placementKey: string;
  placementType: AdPlacementType;
  institutionCategoryId: number | null;
  instructorCategoryId: number | null;
  institutionCategoryName: string | null;
  instructorCategoryName: string | null;
  isEnabled: boolean;
};

export type AdAssignmentRecord = {
  id: string;
  advertisementId: string;
  placementId: string;
  displayOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  advertisementIsActive?: boolean;
};

export type PlacementTarget =
  | { placementType: "home" }
  | { placementType: "instructor_general" }
  | { placementType: "institution_category"; categoryId: number }
  | { placementType: "instructor_category"; categoryId: number };

export type AdminSaveAdAssignmentInput = {
  placementId: string;
  startsAt: string | null;
  endsAt: string | null;
};

export type AdminSaveAdPayload = {
  id: string | null;
  title: string;
  description: string;
  mediaType: AdvertisementMediaType;
  mediaPath: string;
  buttons: AdvertisementButton[];
  advertiserType: AdvertiserType;
  institutionId: number | null;
  instructorId: number | null;
  isActive: boolean;
  assignments: AdminSaveAdAssignmentInput[];
};

export type AdvertiserOption = {
  id: number;
  name: string;
};

export type AdminReorderAdsPayload = {
  placementId: string;
  assignmentIds: string[];
};

export type PublishedAdvertisement = {
  id: string;
  title: string;
  description: string;
  mediaType: AdvertisementMediaType;
  mediaPath: string;
  buttons: AdvertisementButton[];
};

type QueryResult<T> = { data: T; error: null } | { data: null; error: string };
type MutationResult = { error: string | null };

type SupabaseErrorLike = { message?: string | null };

function db() {
  return createSupabaseBrowserClient();
}

function errorMessage(error: SupabaseErrorLike | null | undefined, fallback: string): string {
  const message = String(error?.message ?? "").trim();
  if (!message || /key|jwt|bearer|service_role|password/i.test(message)) return fallback;
  return message;
}

function logFailure(scope: string, error: SupabaseErrorLike | null | undefined) {
  console.error(`[advertisements] ${scope}`, String(error?.message ?? "").trim() || "unknown error");
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function placementType(value: unknown): AdPlacementType | null {
  if (
    value === "home" ||
    value === "institution_category" ||
    value === "instructor_category" ||
    value === "instructor_general"
  ) {
    return value;
  }
  return null;
}

function mediaType(value: unknown): AdvertisementMediaType | null {
  return value === "video" ? "video" : value === "image" ? "image" : null;
}

function advertiserType(value: unknown): AdvertiserType | null {
  return value === "platform" || value === "institution" || value === "instructor" ? value : null;
}

function buttons(value: unknown): AdvertisementButton[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { label?: unknown; url?: unknown };
    const label = text(record.label);
    const url = text(record.url);
    if (!label || !url) return [];
    return [{ label, url }];
  });
}

function embeddedRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return row as Record<string, unknown>;
}

function embeddedName(value: unknown): string | null {
  return nullableText(embeddedRow(value)?.name);
}

function embeddedInstitutionName(value: unknown): string | null {
  return nullableText(embeddedRow(value)?.institution_name);
}

function embeddedInstructorName(value: unknown): string | null {
  const row = embeddedRow(value);
  if (!row) return null;
  const name = `${text(row.name)} ${text(row.surname)}`.trim();
  return name || null;
}

function embeddedActive(value: unknown): boolean {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return false;
  return (row as { is_active?: unknown }).is_active === true;
}

function mapAssignment(row: Record<string, unknown>, includeActive = false): AdAssignmentRecord | null {
  const id = text(row.id);
  const advertisementId = text(row.advertisement_id);
  const placementId = text(row.placement_id);
  const displayOrder = Number(row.display_order);
  if (!id || !advertisementId || !placementId || !Number.isFinite(displayOrder)) return null;
  return {
    id,
    advertisementId,
    placementId,
    displayOrder,
    startsAt: nullableText(row.starts_at),
    endsAt: nullableText(row.ends_at),
    ...(includeActive ? { advertisementIsActive: embeddedActive(row.advertisement) } : {}),
  };
}

function mapAdvertisement(row: Record<string, unknown>): AdvertisementRecord | null {
  const id = text(row.id);
  const resolvedMediaType = mediaType(row.media_type);
  const mediaPath = text(row.media_path);
  const resolvedAdvertiserType = advertiserType(row.advertiser_type);
  if (!id || !resolvedMediaType || !mediaPath || !resolvedAdvertiserType) return null;
  const assignmentRows = Array.isArray(row.assignments) ? row.assignments : [];
  const assignments = assignmentRows
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const assignment = mapAssignment(item as Record<string, unknown>);
      return assignment ? [assignment] : [];
    })
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));

  return {
    id,
    title: text(row.title),
    description: text(row.description),
    mediaType: resolvedMediaType,
    mediaPath,
    buttons: buttons(row.buttons),
    advertiserType: resolvedAdvertiserType,
    institutionId: positiveId(row.institution_id),
    instructorId: positiveId(row.instructor_id),
    institutionName: embeddedInstitutionName(row.institution),
    instructorName: embeddedInstructorName(row.instructor),
    isActive: row.is_active === true,
    createdAt: nullableText(row.created_at),
    updatedAt: nullableText(row.updated_at),
    assignments,
  };
}

function mapPlacement(row: Record<string, unknown>): AdPlacementRecord | null {
  const id = text(row.id);
  const placementKey = text(row.placement_key);
  const resolvedType = placementType(row.placement_type);
  if (!id || !placementKey || !resolvedType) return null;
  return {
    id,
    placementKey,
    placementType: resolvedType,
    institutionCategoryId: positiveId(row.institution_category_id),
    instructorCategoryId: positiveId(row.instructor_category_id),
    institutionCategoryName: embeddedName(row.institution_category),
    instructorCategoryName: embeddedName(row.instructor_category),
    isEnabled: row.is_enabled === true,
  };
}

function mapPublished(row: Record<string, unknown>): PublishedAdvertisement | null {
  const id = text(row.id);
  const resolvedMediaType = mediaType(row.media_type ?? row.mediaType);
  const mediaPath = text(row.media_path ?? row.mediaPath);
  if (!id || !resolvedMediaType || !mediaPath) return null;
  return {
    id,
    title: text(row.title),
    description: text(row.description),
    mediaType: resolvedMediaType,
    mediaPath,
    buttons: buttons(row.buttons),
  };
}

export function countPlacementOccupancy(
  assignments: ReadonlyArray<Pick<AdAssignmentRecord, "endsAt" | "advertisementIsActive">>,
  nowMs = Date.now(),
): number {
  return assignments.filter((assignment) => {
    if (assignment.advertisementIsActive !== true) return false;
    if (!assignment.endsAt) return true;
    const endsAt = Date.parse(assignment.endsAt);
    return Number.isFinite(endsAt) && endsAt > nowMs;
  }).length;
}

export function getAdvertisementMediaPublicUrl(mediaPath: string): string | null {
  if (!MEDIA_PATH_PATTERN.test(mediaPath)) return null;
  const publicUrl = db().storage.from(ADVERTISEMENTS_BUCKET).getPublicUrl(mediaPath).data.publicUrl;
  return publicUrl || null;
}

export async function fetchAdminAdvertisements(): Promise<QueryResult<AdvertisementRecord[]>> {
  const { data, error } = await db()
    .from("advertisements")
    .select(
      "id, title, description, media_type, media_path, buttons, advertiser_type, institution_id, instructor_id, is_active, created_at, updated_at, assignments:ad_assignments(id, advertisement_id, placement_id, display_order, starts_at, ends_at), institution:institutions(institution_name), instructor:instructors(name, surname)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    logFailure("fetch admin advertisements", error);
    return { data: null, error: errorMessage(error, "Reklamlar alınamadı.") };
  }

  const advertisements = (Array.isArray(data) ? data : []).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const advertisement = mapAdvertisement(row as Record<string, unknown>);
    return advertisement ? [advertisement] : [];
  });
  return { data: advertisements, error: null };
}

export async function fetchAdPlacements(): Promise<QueryResult<AdPlacementRecord[]>> {
  const { data, error } = await db()
    .from("ad_placements")
    .select(
      "id, placement_key, placement_type, institution_category_id, instructor_category_id, is_enabled, institution_category:institution_categories(name), instructor_category:instructor_categories(name)",
    )
    .order("placement_type", { ascending: true });

  if (error) {
    logFailure("fetch placements", error);
    return { data: null, error: errorMessage(error, "Yayın alanları alınamadı.") };
  }

  const placements = (Array.isArray(data) ? data : []).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const placement = mapPlacement(row as Record<string, unknown>);
    return placement ? [placement] : [];
  });
  return { data: placements, error: null };
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function advertiserOptions(
  rows: unknown,
  nameOf: (row: Record<string, unknown>) => string | null,
): AdvertiserOption[] {
  const options: AdvertiserOption[] = [];
  for (const item of Array.isArray(rows) ? rows : []) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = positiveId(row.id);
    const name = nameOf(row);
    if (!id || !name) continue;
    options.push({ id, name });
  }
  return options;
}

export async function searchAdvertiserInstitutions(
  query: string,
): Promise<QueryResult<AdvertiserOption[]>> {
  const term = escapeIlike(query.trim());
  if (term.length < 2) return { data: [], error: null };
  const { data, error } = await db()
    .from("institutions")
    .select("id, institution_name")
    .ilike("institution_name", `%${term}%`)
    .order("institution_name", { ascending: true })
    .limit(20);

  if (error) {
    logFailure("search institutions", error);
    return { data: null, error: errorMessage(error, "Kurumlar alınamadı.") };
  }
  return { data: advertiserOptions(data, embeddedInstitutionName), error: null };
}

export async function searchAdvertiserInstructors(
  query: string,
): Promise<QueryResult<AdvertiserOption[]>> {
  const term = escapeIlike(query.trim());
  if (term.length < 2) return { data: [], error: null };
  const [byName, bySurname] = await Promise.all([
    db().from("instructors").select("id, name, surname").ilike("name", `%${term}%`).limit(20),
    db().from("instructors").select("id, name, surname").ilike("surname", `%${term}%`).limit(20),
  ]);
  const error = byName.error ?? bySurname.error;
  if (error) {
    logFailure("search instructors", error);
    return { data: null, error: errorMessage(error, "Eğitmenler alınamadı.") };
  }

  const merged = new Map<number, AdvertiserOption>();
  for (const option of [
    ...advertiserOptions(byName.data, (row) => embeddedInstructorName(row)),
    ...advertiserOptions(bySurname.data, (row) => embeddedInstructorName(row)),
  ]) {
    merged.set(option.id, option);
  }
  return {
    data: [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "tr")).slice(0, 20),
    error: null,
  };
}

export async function fetchPublicPlacementKey(
  target: PlacementTarget,
): Promise<QueryResult<{ placementKey: string }>> {
  const categoryId =
    target.placementType === "institution_category" || target.placementType === "instructor_category"
      ? target.categoryId
      : null;
  if (categoryId != null && (!Number.isInteger(categoryId) || categoryId <= 0)) {
    return { data: null, error: "Yayın alanı bulunamadı." };
  }

  const { data, error } = await db().rpc("get_public_ad_placement_key", {
    p_placement_type: target.placementType,
    p_category_id: categoryId,
  });
  if (error) {
    logFailure("fetch public placement", error);
    return { data: null, error: errorMessage(error, "Yayın alanı bulunamadı.") };
  }

  const placementKey = typeof data === "string" ? data.trim() : "";
  if (!placementKey) return { data: null, error: "Yayın alanı bulunamadı." };
  return { data: { placementKey }, error: null };
}

export async function fetchPlacementByTarget(
  target: PlacementTarget,
): Promise<QueryResult<Pick<AdPlacementRecord, "id" | "placementKey">>> {
  let query = db()
    .from("ad_placements")
    .select("id, placement_key")
    .eq("placement_type", target.placementType);
  if (target.placementType === "institution_category") {
    query = query.eq("institution_category_id", target.categoryId);
  }
  if (target.placementType === "instructor_category") {
    query = query.eq("instructor_category_id", target.categoryId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    logFailure("fetch placement", error);
    return { data: null, error: errorMessage(error, "Yayın alanı bulunamadı.") };
  }

  const row = data as { id?: unknown; placement_key?: unknown } | null;
  const id = text(row?.id);
  const placementKey = text(row?.placement_key);
  if (!id || !placementKey) return { data: null, error: "Yayın alanı bulunamadı." };
  return { data: { id, placementKey }, error: null };
}

export async function fetchPlacementAssignments(
  placementId: string,
): Promise<QueryResult<AdAssignmentRecord[]>> {
  const { data, error } = await db()
    .from("ad_assignments")
    .select(
      "id, advertisement_id, placement_id, display_order, starts_at, ends_at, advertisement:advertisements(is_active)",
    )
    .eq("placement_id", placementId)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    logFailure("fetch placement assignments", error);
    return { data: null, error: errorMessage(error, "Yayın alanı reklamları alınamadı.") };
  }

  const assignments = (Array.isArray(data) ? data : []).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const assignment = mapAssignment(row as Record<string, unknown>, true);
    return assignment ? [assignment] : [];
  });
  return { data: assignments, error: null };
}

function jsonPlacementId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function saveAdvertisement(payload: AdminSaveAdPayload): Promise<MutationResult> {
  const assignments: Array<{ placement_id: number; starts_at: string | null; ends_at: string | null }> = [];
  for (const assignment of payload.assignments) {
    const placementId = jsonPlacementId(assignment.placementId);
    if (placementId == null) return { error: "Geçersiz yayın alanı kimliği." };
    assignments.push({
      placement_id: placementId,
      starts_at: assignment.startsAt,
      ends_at: assignment.endsAt,
    });
  }

  const { error } = await db().rpc("admin_save_ad", {
    p_id: payload.id,
    p_title: payload.title.trim(),
    p_description: payload.description.trim(),
    p_media_type: payload.mediaType,
    p_media_path: payload.mediaPath.trim(),
    p_buttons: payload.buttons,
    p_advertiser_type: payload.advertiserType,
    p_institution_id: payload.institutionId,
    p_instructor_id: payload.instructorId,
    p_is_active: payload.isActive,
    p_assignments: assignments,
  });

  if (error) {
    logFailure("save advertisement", error);
    return { error: errorMessage(error, "Reklam kaydedilemedi.") };
  }
  return { error: null };
}

export async function reorderPlacementAdvertisements(
  payload: AdminReorderAdsPayload,
): Promise<MutationResult> {
  const assignmentIds = payload.assignmentIds.map((id) => id.trim()).filter(Boolean);
  if (new Set(assignmentIds).size !== assignmentIds.length) {
    return { error: "Sıralama listesi tekrar eden kayıt içeriyor." };
  }

  const { error } = await db().rpc("admin_reorder_ads", {
    p_placement_id: payload.placementId,
    p_assignment_ids: assignmentIds,
  });

  if (error) {
    logFailure("reorder advertisements", error);
    return { error: errorMessage(error, "Sıralama kaydedilemedi.") };
  }
  return { error: null };
}

export async function deleteAdvertisement(advertisementId: string): Promise<MutationResult> {
  const { error } = await db().rpc("admin_delete_ad", {
    p_id: advertisementId,
  });

  if (error) {
    logFailure("delete advertisement", error);
    return { error: errorMessage(error, "Reklam silinemedi.") };
  }
  return { error: null };
}

export async function fetchPublishedAds(
  placementKey: string,
): Promise<QueryResult<PublishedAdvertisement[]>> {
  const { data, error } = await db().rpc("get_published_ads", {
    p_placement_key: placementKey,
  });

  if (error) {
    logFailure("fetch published advertisements", error);
    return { data: null, error: errorMessage(error, "Yayındaki reklamlar alınamadı.") };
  }

  const published = (Array.isArray(data) ? data : []).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const advertisement = mapPublished(row as Record<string, unknown>);
    return advertisement ? [advertisement] : [];
  });
  return { data: published, error: null };
}
