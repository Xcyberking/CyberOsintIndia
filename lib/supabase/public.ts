import { createClient } from '@supabase/supabase-js';

// Cookie-less anon client for public, cacheable pages (home, tools list, announcements, contact).
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
