import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { HostlineEnv } from "../config/env";

export function createSupabaseAdminClient(env: HostlineEnv): SupabaseClient {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase URL and service-role key are required for server-side Hostline persistence"
    );
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );
}
