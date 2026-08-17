import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  applyAuthCookiePersistence,
  AUTH_PERSIST_COOKIE_NAME,
} from '@/lib/auth/rememberMe';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          const persistFlag = cookieStore.get(AUTH_PERSIST_COOKIE_NAME)?.value ?? null;
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, applyAuthCookiePersistence({ ...options }, persistFlag));
          });
        } catch (error) {
        }
      },
    },
  });
}

