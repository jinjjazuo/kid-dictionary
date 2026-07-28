import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client for server-side use.
 *
 * Uses the service-role key, which bypasses row level security. That is
 * required because the browser holds only the anon key and has read-only
 * access — a client that could write to the cache could poison every child's
 * definitions.
 *
 * Never import this into a client component. There is no cookie or session
 * handling because the application has no authentication.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
