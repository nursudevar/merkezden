'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyAuthCookiePersistence,
  getAllBrowserCookies,
  serializeBrowserCookie,
} from '@/lib/auth/rememberMe';

declare global {
  var __merkezdenSupabaseBrowserClient: SupabaseClient | undefined;
}

let browserClient: SupabaseClient | null =
  typeof window !== 'undefined' ? globalThis.__merkezdenSupabaseBrowserClient ?? null : null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return getAllBrowserCookies();
      },
      setAll(cookiesToSet) {
        if (typeof document === 'undefined') return;
        cookiesToSet.forEach(({ name, value, options }) => {
          const nextOptions = applyAuthCookiePersistence({ ...options });
          document.cookie = serializeBrowserCookie(name, value, nextOptions);
        });
      },
    },
  });

  if (typeof window !== 'undefined') {
    globalThis.__merkezdenSupabaseBrowserClient = browserClient;
  }

  return browserClient;
}
