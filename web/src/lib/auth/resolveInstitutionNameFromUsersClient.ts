'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { loadInstitutionRowForAuthUserClient } from '@/lib/auth/loadInstitutionRowForAuthUserClient';

/**
 * Fetches the current institution's display name from public.users.
 * Uses the same institution resolution as the panel (owner_auth_id + users FK fallbacks),
 * then falls back to public.users.
 * @param authUid - Supabase auth user.id (uuid)
 * @returns Institution name string
 */
export async function resolveInstitutionNameFromUsersClient(
  authUid: string
): Promise<string> {
  try {
    const supabase = createSupabaseBrowserClient();

    const { row: instRow } = await loadInstitutionRowForAuthUserClient(authUid, supabase);
    const fromInst = instRow?.institution_name;
    if (fromInst && String(fromInst).trim()) return String(fromInst).trim();

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
