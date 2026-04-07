import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';
  const signupType = requestUrl.searchParams.get('signup_type');
  const institutionName = requestUrl.searchParams.get('institution_name');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const normalizedSignupType =
        signupType === 'individual' || signupType === 'institution' ? signupType : null;
      if (normalizedSignupType) {
        const metadataToSet: Record<string, string> = { user_type: normalizedSignupType };
        if (normalizedSignupType === 'institution' && institutionName && institutionName.trim()) {
          metadataToSet.institution_name = institutionName.trim();
          metadataToSet.company_name = institutionName.trim();
        }
        await supabase.auth.updateUser({
          data: metadataToSet,
        });

        const { data: authUserResult } = await supabase.auth.getUser();
        const authUserId = authUserResult.user?.id ?? null;
        if (authUserId) {
          const usersUpdatePayload: Record<string, string> = {
            user_type: normalizedSignupType,
          };
          if (normalizedSignupType === 'institution' && institutionName && institutionName.trim()) {
            usersUpdatePayload.company_name = institutionName.trim();
          }

          await supabase
            .from('users')
            .update(usersUpdatePayload)
            .eq('auth_user_id', authUserId);
        }
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback_error', requestUrl.origin));
}

