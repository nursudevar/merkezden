'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Fetches the current institution's display name from public.users.
 * First tries institutions.owner_auth_id (same source used in panel profile),
 * then falls back to public.users.
 * @param authUid - Supabase auth user.id (uuid)
 * @returns Institution name string
 */
export async function resolveInstitutionNameFromUsersClient(
  authUid: string
): Promise<string> {
  try {
    const supabase = createSupabaseBrowserClient();

    // Primary source: institutions table (matches panel profile source).
    const { data: instData, error: instError } = await supabase
      .from('institutions')
      .select('institution_name')
      .eq('owner_auth_id', authUid)
      .maybeSingle();

    if (!instError) {
      const institutionName = (instData as { institution_name?: string } | null)?.institution_name;
      if (institutionName && String(institutionName).trim()) return String(institutionName).trim();
    }

    const { data, error } = await supabase
      .from('users')
      .select('institution_name, first_name, email')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (error) {
      console.warn('[resolveInstitutionNameFromUsersClient]', error);
      return 'Kurum Hesabı';
    }

    const row = data as { institution_name?: string; first_name?: string; email?: string } | null;
    const name = row?.institution_name ?? row?.first_name ?? row?.email;
    if (name && String(name).trim()) return String(name).trim();
    return 'Kurum Hesabı';
  } catch (err) {
    console.warn('[resolveInstitutionNameFromUsersClient]', err);
    return 'Kurum Hesabı';
  }
}
