'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { loadInstitutionRowForAuthUserClient } from '@/lib/auth/loadInstitutionRowForAuthUserClient';

/**
 * Resolves public institution detail slug for current institution user.
 * Uses the same institution row resolution as the panel, then reads `slug` by id.
 */
export async function resolveInstitutionSlugFromUsersClient(
  authUid: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { row } = await loadInstitutionRowForAuthUserClient(authUid, supabase);
    if (!row?.id) return null;

    const { data, error } = await supabase
      .from('institutions')
      .select('slug')
      .eq('id', row.id)
      .maybeSingle();

    if (error) {
      console.warn('[resolveInstitutionSlugFromUsersClient]', error);
      return null;
    }

    const slug = (data as { slug?: string | null } | null)?.slug ?? null;
    const normalizedSlug = String(slug ?? '').trim();
    return normalizedSlug || null;
  } catch (err) {
    console.warn('[resolveInstitutionSlugFromUsersClient]', err);
    return null;
  }
}
