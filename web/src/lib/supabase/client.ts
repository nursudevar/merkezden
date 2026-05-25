'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);

  if (typeof window !== 'undefined') {
    globalThis.__merkezdenSupabaseBrowserClient = browserClient;
  }

  return browserClient;
}

