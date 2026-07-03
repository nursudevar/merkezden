'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePublicInstructorProfilePictureUrl } from '@/lib/publicInstructorDetailClient';
import {
  PUBLIC_INSTRUCTOR_LIST_SELECT,
  getPublicInstructorDetailHref,
  mapPublicInstructorDisplayName,
  buildPublicInstructorLocation,
  type PublicInstructorListRow,
} from '@/lib/publicInstructorSearch';
import { PUBLIC_INSTRUCTORS_TABLE } from '@/lib/publicInstructorClient';

export type AppUserType = 'individual' | 'institution';

export interface AppUserRow {
  id: number;
  user_type: AppUserType | null;
  auth_user_id: string;
}

export interface FavoriteInstitution {
  id: number;
  institution_name: string | null;
  official_email: string | null;
  official_phone: string | null;
  website: string | null;
  logo: string | null;
  city: string | null;
  district: string | null;
  type: string | null;
  categoryName: string | null;
  address: string | null;
  about: string | null;
}

export interface FavoriteInstructor {
  id: number;
  name: string;
  title: string | null;
  branch: string | null;
  school: string | null;
  location: string;
  priceRange: string | null;
  profilePictureUrl: string | null;
  detailUrl: string;
}

export interface ToggleFavoriteResult {
  isFavorited: boolean;
}

type FavoriteInstitutionRow = {
  id: number | string;
  institution_name: string | null;
  official_email: string | null;
  official_phone: string | null;
  website: string | null;
  logo: string | null;
  city: string | null;
  district: string | null;
  type: string | null;
  institution_type_id?: number | null;
  address: string | null;
  about: string | null;
  is_approved?: boolean | null;
};

type FavoritesJoinRow = {
  created_at: string | null;
  institutions: FavoriteInstitutionRow | null;
};

type FavoriteInstructorIdRow = {
  instructor_id: number | string | null;
};

type FavoritesErrorCode =
  | 'AUTH_REQUIRED'
  | 'APP_USER_NOT_FOUND'
  | 'NOT_INDIVIDUAL'
  | 'INDIVIDUAL_PROFILE_NOT_FOUND'
  | 'FAVORITES_FETCH_FAILED'
  | 'FAVORITE_INSERT_FAILED'
  | 'FAVORITE_DELETE_FAILED';

export class FavoritesError extends Error {
  code: FavoritesErrorCode;
  constructor(code: FavoritesErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const NOT_INDIVIDUAL_FAVORITES_MESSAGE =
  'Favoriler yalnızca bireysel hesaplarda kullanılabilir.';

function logSupabaseError(scope: string, error: unknown) {
  if (error == null) {
    console.error(scope, error);
    return;
  }
  if (typeof error === 'object') {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    const hasErrorInfo = Boolean(e.message || e.code || e.details || e.hint);
    if (!hasErrorInfo) {
      return;
    }
    console.error(scope, {
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
    });
    return;
  }
  console.error(scope, error);
}

function isFavoritesPermissionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: string }).code ?? '');
  const message = String((error as { message?: string }).message ?? '').toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    message.includes('permission denied') ||
    message.includes('row-level security')
  );
}

async function fetchCategoryNamesByTypeIds(
  supabase: SupabaseClient,
  typeIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const uniqueIds = [...new Set(typeIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return map;

  const { data, error } = await supabase
    .from('institution_types')
    .select('id, category:institution_categories(name)')
    .in('id', uniqueIds);

  if (error) {
    logSupabaseError('[fetchCategoryNamesByTypeIds]', error);
    return map;
  }

  for (const row of data ?? []) {
    const id = Number((row as { id?: number }).id);
    const categoryJoin = (row as { category?: unknown }).category;
    const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
    if (!categoryRow || typeof categoryRow !== 'object') continue;
    const name = String((categoryRow as { name?: unknown }).name ?? '').trim();
    if (Number.isFinite(id) && name) map.set(id, name);
  }

  return map;
}

export async function getCurrentAuthUser(): Promise<SupabaseAuthUser | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user ?? null;
  if (sessionUser) {
    return sessionUser;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user ?? null;
}

async function getCurrentAppUserRequired(): Promise<AppUserRow> {
  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    throw new FavoritesError('AUTH_REQUIRED', 'Favorilere eklemek için giriş yapmalısınız.');
  }

  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, user_type, auth_user_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (error) {
    logSupabaseError('[getCurrentAppUser]', error);
    throw new FavoritesError('APP_USER_NOT_FOUND', 'Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.');
  }
  if (!data?.id) {
    throw new FavoritesError('APP_USER_NOT_FOUND', 'Kullanıcı kaydı bulunamadı.');
  }

  const user_type = data.user_type === 'individual' || data.user_type === 'institution' ? data.user_type : null;
  return { id: data.id, user_type, auth_user_id: data.auth_user_id };
}

async function getCurrentIndividualProfileIdRequired(): Promise<number> {
  const appUser = await getCurrentAppUserRequired();
  if (appUser.user_type !== 'individual') {
    throw new FavoritesError('NOT_INDIVIDUAL', NOT_INDIVIDUAL_FAVORITES_MESSAGE);
  }

  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('individual_profiles')
    .select('id')
    .eq('user_id', appUser.id)
    .maybeSingle();

  if (error) {
    logSupabaseError('[getCurrentIndividualProfileId]', error);
    throw new FavoritesError(
      'INDIVIDUAL_PROFILE_NOT_FOUND',
      'Bireysel profil bulunamadı. Lütfen profil bilgilerinizi kontrol edin.'
    );
  }
  if (!data?.id) {
    throw new FavoritesError(
      'INDIVIDUAL_PROFILE_NOT_FOUND',
      'Bireysel profil bulunamadı. Lütfen profil bilgilerinizi kontrol edin.'
    );
  }

  return Number(data.id);
}

async function tryGetCurrentIndividualProfileId(): Promise<number | null> {
  const authUser = await getCurrentAuthUser();
  if (!authUser) return null;

  const supabase = createSupabaseBrowserClient();

  const { data: u, error: uErr } = await supabase
    .from('users')
    .select('id, user_type')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (uErr) {
    logSupabaseError('[tryGetCurrentIndividualProfileId][users]', uErr);
    return null;
  }
  if (!u?.id) return null;
  if (u.user_type !== 'individual') return null;

  const { data: p, error: pErr } = await supabase
    .from('individual_profiles')
    .select('id')
    .eq('user_id', u.id)
    .maybeSingle();

  if (pErr) {
    logSupabaseError('[tryGetCurrentIndividualProfileId][individual_profiles]', pErr);
    return null;
  }
  if (!p?.id) return null;

  const profileId = Number(p.id);
  return Number.isFinite(profileId) && profileId > 0 ? profileId : null;
}

export async function getMyFavoriteInstitutionIds(): Promise<number[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const individualProfileId = await tryGetCurrentIndividualProfileId();
  if (!individualProfileId) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select('institution_id')
    .eq('individual_profile_id', individualProfileId);

  if (error) {
    return [];
  }

  const ids = (data ?? [])
    .map((row: { institution_id: number | string | null }) => row?.institution_id)
    .filter((v): v is number | string => v !== null && v !== undefined)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  return ids;
}

export async function getMyFavoriteInstructorIds(): Promise<number[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const individualProfileId = await tryGetCurrentIndividualProfileId();
  if (!individualProfileId) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select('instructor_id')
    .eq('individual_profile_id', individualProfileId);

  if (error) {
    return [];
  }

  const ids = (data ?? [])
    .map((row: { instructor_id: number | string | null }) => row?.instructor_id)
    .filter((v): v is number | string => v !== null && v !== undefined)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  return ids;
}

export async function isInstitutionFavorited(institutionId: number): Promise<boolean> {
  const individualProfileId = await getCurrentIndividualProfileIdRequired();
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('individual_profile_id', individualProfileId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (error) {
    logSupabaseError('[isInstitutionFavorited]', error);
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favori durumu alınamadı.');
  }

  return Boolean(data?.id);
}

export async function isInstructorFavorited(instructorId: number): Promise<boolean> {
  const individualProfileId = await getCurrentIndividualProfileIdRequired();
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('individual_profile_id', individualProfileId)
    .eq('instructor_id', instructorId)
    .maybeSingle();

  if (error) {
    logSupabaseError('[isInstructorFavorited]', error);
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favori durumu alınamadı.');
  }

  return Boolean(data?.id);
}

export async function getMyFavoriteInstitutions(): Promise<FavoriteInstitution[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const individualProfileId = await tryGetCurrentIndividualProfileId();
  if (!individualProfileId) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select(
      `
      created_at,
      institutions (
        id,
        institution_name,
        official_email,
        official_phone,
        website,
        logo,
        city,
        district,
        type,
        address,
        about,
        institution_type_id,
        is_approved
      )
    `
    )
    .eq('individual_profile_id', individualProfileId)
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError('[getMyFavoriteInstitutions]', error);
    if (isFavoritesPermissionError(error)) return [];
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favoriler yüklenemedi. Lütfen tekrar deneyin.');
  }

  const rows: FavoritesJoinRow[] = Array.isArray(data) ? (data as unknown as FavoritesJoinRow[]) : [];
  const institutionRows = rows
    .map((r) => r.institutions)
    .filter((i): i is FavoriteInstitutionRow => i != null)
    .filter((i) => i.is_approved === true);

  const typeIds = institutionRows
    .map((i) => Number(i.institution_type_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const categoryByTypeId = await fetchCategoryNamesByTypeIds(supabase, typeIds);

  const institutions = institutionRows
    .map((i) => {
      const typeId = Number(i.institution_type_id);
      const categoryName =
        Number.isFinite(typeId) && typeId > 0 ? categoryByTypeId.get(typeId) ?? null : null;

      return {
        id: Number(i.id),
        institution_name: i.institution_name ?? null,
        official_email: i.official_email ?? null,
        official_phone: i.official_phone ?? null,
        website: i.website ?? null,
        logo: i.logo ?? null,
        city: i.city ?? null,
        district: i.district ?? null,
        type: i.type ?? null,
        categoryName,
        address: i.address ?? null,
        about: i.about ?? null,
      };
    })
    .filter((i: FavoriteInstitution) => Number.isFinite(i.id));

  return institutions;
}

export async function getMyFavoriteInstructors(): Promise<FavoriteInstructor[]> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const individualProfileId = await tryGetCurrentIndividualProfileId();
  if (!individualProfileId) return [];

  const { data: favoriteRows, error: favoritesError } = await supabase
    .from('user_favorites')
    .select('instructor_id')
    .eq('individual_profile_id', individualProfileId)
    .not('instructor_id', 'is', null);

  if (favoritesError) {
    logSupabaseError('[getMyFavoriteInstructors][favorites]', favoritesError);
    if (isFavoritesPermissionError(favoritesError)) return [];
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favoriler yüklenemedi. Lütfen tekrar deneyin.');
  }

  const instructorIds = ((favoriteRows ?? []) as FavoriteInstructorIdRow[])
    .map((row) => Number(row.instructor_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (instructorIds.length === 0) return [];

  const uniqueIds = [...new Set(instructorIds)];
  const { data: instructorRows, error: instructorsError } = await supabase
    .from(PUBLIC_INSTRUCTORS_TABLE)
    .select(PUBLIC_INSTRUCTOR_LIST_SELECT)
    .in('id', uniqueIds)
    .eq('is_approved', true);

  if (instructorsError) {
    logSupabaseError('[getMyFavoriteInstructors][public_instructors]', instructorsError);
    if (isFavoritesPermissionError(instructorsError)) return [];
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favoriler yüklenemedi. Lütfen tekrar deneyin.');
  }

  const byId = new Map<number, PublicInstructorListRow>();
  for (const row of (instructorRows ?? []) as PublicInstructorListRow[]) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) byId.set(id, row);
  }

  return uniqueIds
    .map((id): FavoriteInstructor | null => {
      const row = byId.get(id);
      if (!row) return null;
      const name = mapPublicInstructorDisplayName(row);
      return {
        id,
        name,
        title: String(row.title ?? '').trim() || null,
        branch: String(row.branch ?? '').trim() || null,
        school: String(row.school ?? '').trim() || null,
        location: buildPublicInstructorLocation(row),
        priceRange: String(row.price_range ?? '').trim() || null,
        profilePictureUrl:
          resolvePublicInstructorProfilePictureUrl(String(row.profile_picture ?? '').trim(), supabase) || null,
        detailUrl: getPublicInstructorDetailHref(row.slug, id),
      };
    })
    .filter((item): item is FavoriteInstructor => item !== null);
}

export async function addFavorite(institutionId: number): Promise<void> {
  const individualProfileId = await getCurrentIndividualProfileIdRequired();
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase.from('user_favorites').insert({
    individual_profile_id: individualProfileId,
    institution_id: institutionId,
    instructor_id: null,
  });

  if (!error) return;

  // Unique constraint already exists; treat duplicate as success.
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') {
    return;
  }

  logSupabaseError('[addFavorite]', error);
  throw new FavoritesError('FAVORITE_INSERT_FAILED', 'Favorilere eklenemedi. Lütfen tekrar deneyin.');
}

export async function addInstructorFavorite(instructorId: number): Promise<void> {
  const individualProfileId = await getCurrentIndividualProfileIdRequired();
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase.from('user_favorites').insert({
    individual_profile_id: individualProfileId,
    institution_id: null,
    instructor_id: instructorId,
  });

  if (!error) return;

  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') {
    return;
  }

  logSupabaseError('[addInstructorFavorite]', error);
  throw new FavoritesError('FAVORITE_INSERT_FAILED', 'Favorilere eklenemedi. Lütfen tekrar deneyin.');
}

export async function removeFavorite(institutionId: number): Promise<void> {
  const individualProfileId = await getCurrentIndividualProfileIdRequired();
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('individual_profile_id', individualProfileId)
    .eq('institution_id', institutionId);

  if (error) {
    logSupabaseError('[removeFavorite]', error);
    throw new FavoritesError('FAVORITE_DELETE_FAILED', 'Favorilerden kaldırılamadı. Lütfen tekrar deneyin.');
  }
}

export async function removeInstructorFavorite(instructorId: number): Promise<void> {
  const individualProfileId = await getCurrentIndividualProfileIdRequired();
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('individual_profile_id', individualProfileId)
    .eq('instructor_id', instructorId);

  if (error) {
    logSupabaseError('[removeInstructorFavorite]', error);
    throw new FavoritesError('FAVORITE_DELETE_FAILED', 'Favorilerden kaldırılamadı. Lütfen tekrar deneyin.');
  }
}

export async function toggleFavorite(institutionId: number): Promise<ToggleFavoriteResult> {
  const already = await isInstitutionFavorited(institutionId);
  if (already) {
    await removeFavorite(institutionId);
    return { isFavorited: false };
  }
  await addFavorite(institutionId);
  return { isFavorited: true };
}

export async function toggleInstructorFavorite(instructorId: number): Promise<ToggleFavoriteResult> {
  const already = await isInstructorFavorited(instructorId);
  if (already) {
    await removeInstructorFavorite(instructorId);
    return { isFavorited: false };
  }
  await addInstructorFavorite(instructorId);
  return { isFavorited: true };
}
