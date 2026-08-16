"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildLocationAdMaps, lookupLocationAds } from "@/lib/turkiyeLocationsClient";

export const FEATURED_ACCOUNTS_TABLE = "featured_accounts" as const;
export const FEATURED_ACCOUNT_TYPE_INSTITUTION = "institution" as const;
export const FEATURED_ACCOUNT_TYPE_INSTRUCTOR = "instructor" as const;

export type FeaturedAccountType =
  | typeof FEATURED_ACCOUNT_TYPE_INSTITUTION
  | typeof FEATURED_ACCOUNT_TYPE_INSTRUCTOR;

type SupabaseBrowser = ReturnType<typeof createSupabaseBrowserClient>;

function getFeaturedAccountIdColumn(
  accountType: FeaturedAccountType,
): "institution_id" | "instructor_id" {
  return accountType === FEATURED_ACCOUNT_TYPE_INSTITUTION ? "institution_id" : "instructor_id";
}

export async function fetchActiveFeaturedAccountIds(
  supabase: SupabaseBrowser,
  accountType: FeaturedAccountType,
): Promise<{ ids: Set<number>; error: string | null }> {
  const idColumn = getFeaturedAccountIdColumn(accountType);
  const { data, error } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .select(idColumn)
    .eq("account_type", accountType)
    .eq("is_active", true);

  if (error) {
    console.error(`[featured-accounts] fetch active ${accountType} ids:`, error);
    return { ids: new Set(), error: String(error.message ?? "fetch failed") };
  }

  const ids = new Set<number>();
  for (const row of (data ?? []) as Array<Record<string, number | string | null>>) {
    const id = Number(row[idColumn]);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return { ids, error: null };
}

export async function fetchActiveFeaturedInstitutionIds(
  supabase: SupabaseBrowser,
): Promise<{ ids: Set<number>; error: string | null }> {
  return fetchActiveFeaturedAccountIds(supabase, FEATURED_ACCOUNT_TYPE_INSTITUTION);
}

export async function fetchActiveFeaturedInstructorIds(
  supabase: SupabaseBrowser,
): Promise<{ ids: Set<number>; error: string | null }> {
  return fetchActiveFeaturedAccountIds(supabase, FEATURED_ACCOUNT_TYPE_INSTRUCTOR);
}

export type FeaturedOrderMap = Map<number, number>;

export async function fetchActiveFeaturedInstitutionOrderMap(
  supabase: SupabaseBrowser,
): Promise<{ orderMap: FeaturedOrderMap; error: string | null }> {
  const { data, error } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .select("institution_id, display_order")
    .eq("account_type", FEATURED_ACCOUNT_TYPE_INSTITUTION)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[featured-accounts] fetch institution order map:", error);
    return { orderMap: new Map(), error: String(error.message ?? "fetch failed") };
  }

  const orderMap: FeaturedOrderMap = new Map();
  for (const row of (data ?? []) as Array<{
    institution_id: number | string | null;
    display_order: number | null;
  }>) {
    const id = Number(row.institution_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    orderMap.set(id, Number(row.display_order) || 0);
  }
  return { orderMap, error: null };
}

export async function fetchActiveFeaturedInstructorOrderMap(
  supabase: SupabaseBrowser,
): Promise<{ orderMap: FeaturedOrderMap; error: string | null }> {
  const { data, error } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .select("instructor_id, display_order")
    .eq("account_type", FEATURED_ACCOUNT_TYPE_INSTRUCTOR)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[featured-accounts] fetch instructor order map:", error);
    return { orderMap: new Map(), error: String(error.message ?? "fetch failed") };
  }

  const orderMap: FeaturedOrderMap = new Map();
  for (const row of (data ?? []) as Array<{
    instructor_id: number | string | null;
    display_order: number | null;
  }>) {
    const id = Number(row.instructor_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    orderMap.set(id, Number(row.display_order) || 0);
  }
  return { orderMap, error: null };
}

export function sortWithFeaturedPriority<T>(
  items: T[],
  getEntityId: (item: T) => number | null,
  featuredOrderMap: FeaturedOrderMap,
): T[] {
  if (featuredOrderMap.size === 0 || items.length <= 1) return items;

  const originalIndex = new Map(items.map((item, index) => [item, index]));

  return [...items].sort((a, b) => {
    const aId = getEntityId(a);
    const bId = getEntityId(b);
    const aFeatured = aId !== null && featuredOrderMap.has(aId);
    const bFeatured = bId !== null && featuredOrderMap.has(bId);

    if (aFeatured && bFeatured) {
      return (featuredOrderMap.get(aId!) ?? 0) - (featuredOrderMap.get(bId!) ?? 0);
    }
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });
}

async function getNextFeaturedDisplayOrder(supabase: SupabaseBrowser): Promise<number> {
  const { data, error } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .select("display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: false })
    .limit(1);

  if (error || !data?.length) return 1;
  const max = Number((data[0] as { display_order: number | null }).display_order);
  return Number.isFinite(max) ? max + 1 : 1;
}

export async function toggleFeaturedAccount(
  supabase: SupabaseBrowser,
  accountType: FeaturedAccountType,
  accountId: number,
  currentlyFeatured: boolean,
): Promise<{ error: string | null }> {
  const normalizedId = Number(accountId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return { error: "Geçersiz hesap id" };
  }

  const idColumn = getFeaturedAccountIdColumn(accountType);

  if (currentlyFeatured) {
    const { error } = await supabase
      .from(FEATURED_ACCOUNTS_TABLE)
      .update({ is_active: false })
      .eq("account_type", accountType)
      .eq(idColumn, normalizedId);
    if (error) {
      console.error(`[featured-accounts] deactivate ${accountType}:`, error);
      return { error: String(error.message ?? "deactivate failed") };
    }
    return { error: null };
  }

  const nextOrder = await getNextFeaturedDisplayOrder(supabase);

  const { data: existing, error: findError } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .select("id")
    .eq("account_type", accountType)
    .eq(idColumn, normalizedId)
    .maybeSingle();

  if (findError) {
    console.error(`[featured-accounts] find ${accountType}:`, findError);
    return { error: String(findError.message ?? "find failed") };
  }

  if (existing) {
    const { error } = await supabase
      .from(FEATURED_ACCOUNTS_TABLE)
      .update({ is_active: true, display_order: nextOrder })
      .eq("account_type", accountType)
      .eq(idColumn, normalizedId);
    if (error) {
      console.error(`[featured-accounts] reactivate ${accountType}:`, error);
      return { error: String(error.message ?? "reactivate failed") };
    }
    return { error: null };
  }

  const insertPayload =
    accountType === FEATURED_ACCOUNT_TYPE_INSTITUTION
      ? {
          account_type: FEATURED_ACCOUNT_TYPE_INSTITUTION,
          institution_id: normalizedId,
          instructor_id: null,
          is_active: true,
          display_order: nextOrder,
        }
      : {
          account_type: FEATURED_ACCOUNT_TYPE_INSTRUCTOR,
          institution_id: null,
          instructor_id: normalizedId,
          is_active: true,
          display_order: nextOrder,
        };

  const { error: insertError } = await supabase.from(FEATURED_ACCOUNTS_TABLE).insert(insertPayload);
  if (insertError) {
    console.error(`[featured-accounts] insert ${accountType}:`, insertError);
    return { error: String(insertError.message ?? "insert failed") };
  }
  return { error: null };
}

export async function toggleFeaturedInstitution(
  supabase: SupabaseBrowser,
  institutionId: number,
  currentlyFeatured: boolean,
): Promise<{ error: string | null }> {
  return toggleFeaturedAccount(
    supabase,
    FEATURED_ACCOUNT_TYPE_INSTITUTION,
    institutionId,
    currentlyFeatured,
  );
}

export async function toggleFeaturedInstructor(
  supabase: SupabaseBrowser,
  instructorId: number,
  currentlyFeatured: boolean,
): Promise<{ error: string | null }> {
  return toggleFeaturedAccount(
    supabase,
    FEATURED_ACCOUNT_TYPE_INSTRUCTOR,
    instructorId,
    currentlyFeatured,
  );
}

export type FeaturedAccountAdminRow = {
  featuredId: string;
  accountType: FeaturedAccountType;
  entityId: number;
  displayOrder: number;
  typeLabel: "Kurum" | "Eğitmen";
  name: string;
  categoryOrBranch: string;
  district: string;
  mediaCount: number | null;
};

function resolveInstitutionCategoryLabel(row: {
  type?: string | null;
  institution_type?: {
    name?: string | null;
    category?: { name?: string | null } | null;
  } | null;
}): string {
  return (
    String(row.institution_type?.category?.name ?? "").trim() ||
    String(row.institution_type?.name ?? "").trim() ||
    String(row.type ?? "").trim() ||
    "-"
  );
}

function resolveInstructorDisplayName(row: {
  name: string | null;
  surname: string | null;
  email: string | null;
}): string {
  const fullName = [row.name, row.surname]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  return String(row.email ?? "").trim() || "-";
}

export async function fetchActiveFeaturedAccountsForAdmin(
  supabase: SupabaseBrowser,
): Promise<{ rows: FeaturedAccountAdminRow[]; error: string | null }> {
  const { data: featuredRows, error: featuredError } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .select("id, account_type, institution_id, instructor_id, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (featuredError) {
    console.error("[featured-accounts] fetch active account list:", featuredError);
    return { rows: [], error: String(featuredError.message ?? "fetch failed") };
  }

  const featured = (featuredRows ?? []) as Array<{
    id: string;
    account_type: string | null;
    institution_id: number | string | null;
    instructor_id: number | string | null;
    display_order: number | null;
  }>;

  if (featured.length === 0) return { rows: [], error: null };

  const institutionIds = featured
    .filter((row) => row.account_type === FEATURED_ACCOUNT_TYPE_INSTITUTION)
    .map((row) => Number(row.institution_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const instructorIds = featured
    .filter((row) => row.account_type === FEATURED_ACCOUNT_TYPE_INSTRUCTOR)
    .map((row) => Number(row.instructor_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const institutionById = new Map<
    number,
    {
      institution_name: string | null;
      type: string | null;
      district: string | null;
      institution_type?: {
        name?: string | null;
        category?: { name?: string | null } | null;
      } | null;
    }
  >();

  if (institutionIds.length > 0) {
    const { data: institutionsData, error: institutionsError } = await supabase
      .from("institutions")
      .select(
        "id, institution_name, type, district, institution_type:institution_types(name, category:institution_categories(name))",
      )
      .in("id", institutionIds);

    if (institutionsError) {
      console.error("[featured-accounts] fetch institutions:", institutionsError);
      return { rows: [], error: String(institutionsError.message ?? "institutions fetch failed") };
    }

    for (const row of (institutionsData ?? []) as Array<{
      id: number;
      institution_name: string | null;
      type: string | null;
      district: string | null;
      institution_type?: {
        name?: string | null;
        category?: { name?: string | null } | null;
      } | null;
    }>) {
      const id = Number(row.id);
      if (Number.isFinite(id)) institutionById.set(id, row);
    }
  }

  const instructorById = new Map<
    number,
    {
      name: string | null;
      surname: string | null;
      email: string | null;
      branch: string | null;
      il_id: number | null;
      ilce_id: number | null;
    }
  >();

  if (instructorIds.length > 0) {
    const { data: instructorsData, error: instructorsError } = await supabase
      .from("instructors")
      .select("id, name, surname, email, branch, il_id, ilce_id")
      .in("id", instructorIds);

    if (instructorsError) {
      console.error("[featured-accounts] fetch instructors:", instructorsError);
      return { rows: [], error: String(instructorsError.message ?? "instructors fetch failed") };
    }

    for (const row of (instructorsData ?? []) as Array<{
      id: number;
      name: string | null;
      surname: string | null;
      email: string | null;
      branch: string | null;
      il_id: number | null;
      ilce_id: number | null;
    }>) {
      const id = Number(row.id);
      if (Number.isFinite(id)) instructorById.set(id, row);
    }
  }

  const instructorLocationMaps = await buildLocationAdMaps([...instructorById.values()]);

  const mediaCountByInstitutionId: Record<number, number> = {};
  if (institutionIds.length > 0) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from("institution_media")
      .select("institution_id")
      .in("institution_id", institutionIds);

    if (mediaError) {
      console.error("[featured-accounts] fetch media counts:", mediaError);
    } else {
      for (const row of (mediaRows ?? []) as Array<{ institution_id: number | null }>) {
        const institutionId = Number(row.institution_id);
        if (!Number.isFinite(institutionId)) continue;
        mediaCountByInstitutionId[institutionId] =
          (mediaCountByInstitutionId[institutionId] ?? 0) + 1;
      }
    }
  }

  const rows: FeaturedAccountAdminRow[] = [];
  for (const row of featured) {
    const featuredId = String(row.id ?? "").trim();
    if (!featuredId) continue;

    const displayOrder = Number(row.display_order) || 0;

    if (row.account_type === FEATURED_ACCOUNT_TYPE_INSTITUTION) {
      const institutionId = Number(row.institution_id);
      const institution = institutionById.get(institutionId);
      if (!Number.isFinite(institutionId) || !institution) continue;
      rows.push({
        featuredId,
        accountType: FEATURED_ACCOUNT_TYPE_INSTITUTION,
        entityId: institutionId,
        displayOrder,
        typeLabel: "Kurum",
        name: String(institution.institution_name ?? "").trim() || "-",
        categoryOrBranch: resolveInstitutionCategoryLabel(institution),
        district: String(institution.district ?? "").trim() || "-",
        mediaCount: mediaCountByInstitutionId[institutionId] ?? 0,
      });
      continue;
    }

    if (row.account_type === FEATURED_ACCOUNT_TYPE_INSTRUCTOR) {
      const instructorId = Number(row.instructor_id);
      const instructor = instructorById.get(instructorId);
      if (!Number.isFinite(instructorId) || !instructor) continue;
      rows.push({
        featuredId,
        accountType: FEATURED_ACCOUNT_TYPE_INSTRUCTOR,
        entityId: instructorId,
        displayOrder,
        typeLabel: "Eğitmen",
        name: resolveInstructorDisplayName(instructor),
        categoryOrBranch: String(instructor.branch ?? "").trim() || "-",
        district: (() => {
          const { ilAd, ilceAd } = lookupLocationAds(
            instructor.il_id,
            instructor.ilce_id,
            instructorLocationMaps,
          );
          return ilceAd || ilAd || "-";
        })(),
        mediaCount: null,
      });
    }
  }

  rows.sort((a, b) => a.displayOrder - b.displayOrder);
  return { rows, error: null };
}

export async function swapFeaturedDisplayOrders(
  supabase: SupabaseBrowser,
  a: { featuredId: string; displayOrder: number },
  b: { featuredId: string; displayOrder: number },
): Promise<{ error: string | null }> {
  const { error: errorA } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .update({ display_order: b.displayOrder })
    .eq("id", a.featuredId);

  if (errorA) {
    console.error("[featured-accounts] swap update A:", errorA);
    return { error: String(errorA.message ?? "swap failed") };
  }

  const { error: errorB } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .update({ display_order: a.displayOrder })
    .eq("id", b.featuredId);

  if (errorB) {
    console.error("[featured-accounts] swap update B:", errorB);
    return { error: String(errorB.message ?? "swap failed") };
  }

  return { error: null };
}

export async function deactivateFeaturedAccountById(
  supabase: SupabaseBrowser,
  featuredAccountId: string,
): Promise<{ error: string | null }> {
  const normalizedId = String(featuredAccountId ?? "").trim();
  if (!normalizedId) return { error: "Geçersiz featured account id" };

  const { error } = await supabase
    .from(FEATURED_ACCOUNTS_TABLE)
    .update({ is_active: false })
    .eq("id", normalizedId);

  if (error) {
    console.error("[featured-accounts] deactivate by id:", error);
    return { error: String(error.message ?? "deactivate failed") };
  }
  return { error: null };
}

export async function deactivateFeaturedInstitution(
  supabase: SupabaseBrowser,
  institutionId: number,
): Promise<{ error: string | null }> {
  return toggleFeaturedInstitution(supabase, institutionId, true);
}
