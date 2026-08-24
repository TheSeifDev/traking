import { createAdminClient } from "@/utils/supabase/admin";

export type DatabaseHealthStatus = "healthy" | "degraded";

export interface DatabaseHealthResult {
  status: DatabaseHealthStatus;
  checked_at: string;
  latency_ms: number;
  error: "database_unavailable" | null;
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

/**
 * Performs the smallest application-level read needed to confirm that the
 * configured Supabase/Postgres endpoint is reachable. This function must stay
 * read-only and must never be used by tracking or analytics code.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").select("id", { head: true });
    const latencyMs = elapsedMilliseconds(startedAt);

    if (error) {
      return {
        status: "degraded",
        checked_at: checkedAt,
        latency_ms: latencyMs,
        error: "database_unavailable",
      };
    }

    return {
      status: "healthy",
      checked_at: checkedAt,
      latency_ms: latencyMs,
      error: null,
    };
  } catch {
    return {
      status: "degraded",
      checked_at: checkedAt,
      latency_ms: elapsedMilliseconds(startedAt),
      error: "database_unavailable",
    };
  }
}
