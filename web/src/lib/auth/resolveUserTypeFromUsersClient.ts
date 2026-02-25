'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Resolves user_type from public.users by auth uid.
 * @param authUid - Supabase auth user.id (uuid)
 * @returns 'individual' | 'institution' | null
 */
export async function resolveUserTypeFromUsersClient(
  authUid: string
): Promise<'individual' | 'institution' | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('users')
      .select('user_type')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (error) {
      console.warn('[resolveUserTypeFromUsersClient]', error);
      return null;
    }

    const type = data?.user_type;
    if (type === 'individual' || type === 'institution') {
      return type;
    }
    return null;
  } catch (err) {
    console.warn('[resolveUserTypeFromUsersClient]', err);
    return null;
  }
}
