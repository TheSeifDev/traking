import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * Creates a Supabase client for server-side administrative and provisioning tasks.
 * Requires SUPABASE_SERVICE_ROLE_KEY so privileged server operations never
 * silently fall back to the public client key.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase admin configuration environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
