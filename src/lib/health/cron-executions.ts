import { createAdminClient } from "@/utils/supabase/admin";
import type { Database } from "@/src/types/database";
import { writeOwnerLog } from "@/src/lib/observability/logger";

export const CRON_JOB_NAME = "Health DB Cron";
export const CRON_SCHEDULE = "0 3 * * * UTC";
const CRON_SCHEDULE_HEADER = "0 3 * * *";
const MAX_HISTORY = 100;

type CronExecution = Database["public"]["Tables"]["cron_executions"]["Row"];
export type CronHealthStatus = "healthy" | "degraded" | "unknown";

const CRON_FIELDS = "id, job_name, schedule, execution_key, started_at, finished_at, status, http_status, latency_ms, health_status, error_code, created_at";

export function isTrustedVercelCron(request: Request): boolean {
  return request.headers.get("x-vercel-cron-schedule") === CRON_SCHEDULE_HEADER;
}

export function cronExecutionKey(request: Request): string {
  const requestId = request.headers.get("x-vercel-id") ?? request.headers.get("x-vercel-deployment-url") ?? "unknown";
  return `${CRON_SCHEDULE_HEADER}:${requestId}`.slice(0, 240);
}

export function cronJobMetadata() {
  return { name: CRON_JOB_NAME, schedule: CRON_SCHEDULE };
}

export async function startCronExecution(executionKey: string, startedAt: string): Promise<{ record: CronExecution; created: boolean } | null> {
  if (!executionKey) return null;
  try {
    const supabase = createAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("cron_executions")
      .select(CRON_FIELDS)
      .eq("job_name", CRON_JOB_NAME)
      .eq("execution_key", executionKey)
      .maybeSingle();
    if (existingError) return null;
    if (existing) return { record: existing, created: false };

    const { data, error } = await supabase
      .from("cron_executions")
      .insert({ job_name: CRON_JOB_NAME, schedule: CRON_SCHEDULE, execution_key: executionKey, started_at: startedAt, status: "started" })
      .select(CRON_FIELDS)
      .single();
    if (error || !data) return null;
    return { record: data, created: true };
  } catch {
    return null;
  }
}

export async function finishCronExecution(input: {
  id: string;
  status: "succeeded" | "failed";
  finishedAt: string;
  httpStatus: number;
  latencyMs: number;
  healthStatus: CronHealthStatus;
  errorCode?: string | null;
}): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("cron_executions")
      .update({ status: input.status, finished_at: input.finishedAt, http_status: input.httpStatus, latency_ms: input.latencyMs, health_status: input.healthStatus, error_code: input.errorCode ?? null })
      .eq("id", input.id)
      .eq("job_name", CRON_JOB_NAME)
      .eq("status", "started");
    return !error;
  } catch {
    return false;
  }
}

export async function logCronStarted(executionKey: string): Promise<void> {
  await writeOwnerLog({
    level: "INFO",
    category: "SYSTEM",
    action: "cron_started",
    route: "/api/health/db",
    metadata: { job: CRON_JOB_NAME, schedule: CRON_SCHEDULE, execution_key_present: Boolean(executionKey) },
  });
}

export async function logCronExecution(input: {
  status: "succeeded" | "failed";
  httpStatus: number;
  latencyMs: number;
  healthStatus: CronHealthStatus;
  executionKey: string;
  errorCode?: string | null;
}): Promise<void> {
  await writeOwnerLog({
    level: input.status === "succeeded" ? "INFO" : "ERROR",
    category: "SYSTEM",
    action: input.status === "succeeded" ? "cron_completed" : "cron_failed",
    route: "/api/health/db",
    status: input.httpStatus,
    durationMs: input.latencyMs,
    metadata: { job: CRON_JOB_NAME, schedule: CRON_SCHEDULE, execution_status: input.status, health_status: input.healthStatus, execution_key_present: Boolean(input.executionKey), error_code: input.errorCode ?? null },
  });
}

export async function getCronExecutionSnapshot(): Promise<{
  execution_status: "observed" | "not_observed";
  last_execution_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_latency_ms: number | null;
  last_result: "succeeded" | "failed" | "started" | null;
  current_health_status: CronHealthStatus;
  history: Array<Pick<CronExecution, "started_at" | "finished_at" | "status" | "http_status" | "latency_ms" | "health_status" | "error_code">>;
}> {
  try {
    const { data, error } = await createAdminClient()
      .from("cron_executions")
      .select("started_at, finished_at, status, http_status, latency_ms, health_status, error_code")
      .eq("job_name", CRON_JOB_NAME)
      .order("started_at", { ascending: false })
      .limit(MAX_HISTORY);
    if (error || !data || data.length === 0) return emptySnapshot();
    const latest = data[0];
    return {
      execution_status: "observed",
      last_execution_at: latest.started_at,
      last_success_at: data.find((row) => row.status === "succeeded")?.finished_at ?? null,
      last_failure_at: data.find((row) => row.status === "failed")?.finished_at ?? null,
      last_latency_ms: latest.latency_ms,
      last_result: latest.status,
      current_health_status: latest.health_status ?? "unknown",
      history: data,
    };
  } catch {
    return emptySnapshot();
  }
}

function emptySnapshot() {
  return { execution_status: "not_observed" as const, last_execution_at: null, last_success_at: null, last_failure_at: null, last_latency_ms: null, last_result: null, current_health_status: "unknown" as const, history: [] };
}
