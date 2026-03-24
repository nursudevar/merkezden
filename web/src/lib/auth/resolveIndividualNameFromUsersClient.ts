'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Resolves individual user's full display name from public.users.
 * @param authUid - Supabase auth user.id (uuid)
 * @returns Full name or fallback
 */
export async function resolveIndividualNameFromUsersClient(authUid: string): Promise<string> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (error) {
      console.warn('[resolveIndividualNameFromUsersClient]', error);
      return 'Kullanıcı';
    }

    const row = data as { first_name?: string; last_name?: string; email?: string } | null;
    const firstName = (row?.first_name ?? '').trim();
    const lastName = (row?.last_name ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) return fullName;
    if (firstName) return firstName;
    if (lastName) return lastName;
    if (row?.email?.trim()) return row.email.trim();
    return 'Kullanıcı';
  } catch (err) {
    console.warn('[resolveIndividualNameFromUsersClient]', err);
    return 'Kullanıcı';
  }
}

