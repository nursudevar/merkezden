import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getCurrentUserRole(): Promise<{
  user: { id: string; email?: string } | null;
  userType: 'individual' | 'institution' | null;
}> {
  const supabase = await createSupabaseServerClient();
  
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { user: null, userType: null };
  }

  const { data: row, error: rowErr } = await supabase
    .from('users')
    .select('user_type')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (rowErr) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[getCurrentUserRole] Error fetching user_type:', rowErr);
    }
    return { user: { id: user.id, email: user.email }, userType: null };
  }

  const userType =
    row?.user_type === 'individual' || row?.user_type === 'institution'
      ? row.user_type
      : null;

  return {
    user: { id: user.id, email: user.email },
    userType,
  };
}

