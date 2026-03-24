'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

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
  address: string | null;
  about: string | null;
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
  address: string | null;
  about: string | null;
};

type FavoritesJoinRow = {
  created_at: string | null;
  institutions: FavoriteInstitutionRow | null;
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
    console.error('[getCurrentAppUser]', error);
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
    throw new FavoritesError('NOT_INDIVIDUAL', 'Favoriler yalnızca bireysel hesaplarda kullanılabilir.');
  }

  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('individual_profiles')
    .select('id')
    .eq('user_id', appUser.id)
    .maybeSingle();

  if (error) {
    console.error('[getCurrentIndividualProfileId]', error);
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
    throw new FavoritesError('APP_USER_NOT_FOUND', 'Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.');
  }
  if (!u?.id) return null;
  if (u.user_type !== 'individual') return null;

  const { data: p, error: pErr } = await supabase
    .from('individual_profiles')
    .select('id')
    .eq('user_id', u.id)
    .maybeSingle();

  if (pErr) {
    throw new FavoritesError(
      'INDIVIDUAL_PROFILE_NOT_FOUND',
      'Bireysel profil bulunamadı. Lütfen profil bilgilerinizi kontrol edin.'
    );
  }
  if (!p?.id) return null;
  return Number(p.id);
}

export async function getMyFavoriteInstitutionIds(): Promise<number[]> {
  const individualProfileId = await tryGetCurrentIndividualProfileId();
  if (!individualProfileId) return [];
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('user_favorites')
    .select('institution_id')
    .eq('individual_profile_id', individualProfileId);

  if (error) {
    console.error('[getMyFavoriteInstitutionIds]', error);
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favoriler yüklenemedi. Lütfen tekrar deneyin.');
  }

  const ids = (data ?? [])
    .map((row: { institution_id: number | string | null }) => row?.institution_id)
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
    console.error('[isInstitutionFavorited]', error);
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favori durumu alınamadı.');
  }

  return Boolean(data?.id);
}

export async function getMyFavoriteInstitutions(): Promise<FavoriteInstitution[]> {
  const individualProfileId = await tryGetCurrentIndividualProfileId();
  if (!individualProfileId) return [];
  const supabase = createSupabaseBrowserClient();

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
        about
      )
    `
    )
    .eq('individual_profile_id', individualProfileId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getMyFavoriteInstitutions]', error);
    throw new FavoritesError('FAVORITES_FETCH_FAILED', 'Favoriler yüklenemedi. Lütfen tekrar deneyin.');
  }

  const rows: FavoritesJoinRow[] = Array.isArray(data) ? (data as unknown as FavoritesJoinRow[]) : [];
  const institutions = rows
    .map((r) => r.institutions)
    .filter((i): i is FavoriteInstitutionRow => Boolean(i))
    .map((i) => ({
      id: Number(i.id),
      institution_name: i.institution_name ?? null,
      official_email: i.official_email ?? null,
      official_phone: i.official_phone ?? null,
      website: i.website ?? null,
      logo: i.logo ?? null,
      city: i.city ?? null,
      district: i.district ?? null,
      type: i.type ?? null,
      address: i.address ?? null,
      about: i.about ?? null,
    }))
    .filter((i: FavoriteInstitution) => Number.isFinite(i.id));

  return institutions;
}

export async function addFavorite(institutionId: number): Promise<void> {
  const individualProfileId = await getCurrentIndividualProfileIdRequired();
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase.from('user_favorites').insert({
    individual_profile_id: individualProfileId,
    institution_id: institutionId,
  });

  if (!error) return;

  // Unique constraint already exists; treat duplicate as success.
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') {
    return;
  }

  console.error('[addFavorite]', error);
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
    console.error('[removeFavorite]', error);
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

