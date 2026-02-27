'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Fetches the current institution's display name from public.users.
 * Uses institution_name if present, else first_name, else email, else fallback.
 * @param authUid - Supabase auth user.id (uuid)
 * @returns Institution name string
 */
export async function resolveInstitutionNameFromUsersClient(
  authUid: string
): Promise<string> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('users')
      .select('first_name, email')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (error) {
      console.warn('[resolveInstitutionNameFromUsersClient]', error);
      return 'Kurum Hesabı';
    }

    const row = data as { first_name?: string; email?: string } | null;
    const name = row?.first_name ?? row?.email;
    if (name && String(name).trim()) return String(name).trim();
    return 'Kurum Hesabı';
  } catch (err) {
    console.warn('[resolveInstitutionNameFromUsersClient]', err);
    return 'Kurum Hesabı';
  }
}
