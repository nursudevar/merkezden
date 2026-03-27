'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Resolves public institution detail slug for current institution user.
 * Source of truth: public.institutions.slug via owner_auth_id.
 */
export async function resolveInstitutionSlugFromUsersClient(
  authUid: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('institutions')
      .select('slug')
      .eq('owner_auth_id', authUid)
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
