import { createAdminClient } from "@/utils/supabase/admin";
import type { Json } from "@/src/types/database";

export const OBSERVABILITY_LEVELS = ["INFO", "WARN", "ERROR"] as const;
export type ObservabilityLevel = (typeof OBSERVABILITY_LEVELS)[number];

export const OBSERVABILITY_CATEGORIES = [
  "AUTH",
  "TRACKING",
  "SESSION",
  "VIDEO",
  "ANALYTICS",
  "API",
  "DATABASE",
  "SYSTEM",
  "PROVIDER",
  "SECURITY",
] as const;
export type ObservabilityCategory = (typeof OBSERVABILITY_CATEGORIES)[number];

export interface OwnerLogInput {
  level: ObservabilityLevel;
  category: ObservabilityCategory;
  action: string;
  userId?: string | null;
  videoId?: string | null;
  sessionId?: string | null;
  route?: string | null;
  status?: number | null;
  durationMs?: number | null;
  metadata?: unknown;
}

export interface SafeOwnerLog {
  id: string;
  created_at: string;
  level: ObservabilityLevel;
  category: ObservabilityCategory;
  action: string;
  user_id: string | null;
  video_id: string | null;
  session_id: string | null;
  route: string | null;
  status: number | null;
  duration_ms: number | null;
  metadata: Json;
}

const MAX_ACTION_LENGTH = 120;
const MAX_ROUTE_LENGTH = 240;
const MAX_METADATA_BYTES = 4096;
const MAX_METADATA_KEYS = 20;
const MAX_STRING_LENGTH = 300;
const MAX_DEPTH = 2;
const SECRET_KEY_PATTERN = /(authorization|access.?token|api.?key|capabilit|cookie|credential|password|raw.?header|refresh.?token|secret|session.?token|watch.?token|oauth|bearer)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function truncate(value: string, maxLength = MAX_STRING_LENGTH): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function sanitizeValue(value: unknown, depth: number): Json | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return typeof value === "string" ? truncate(value) : value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    const items = value.slice(0, 12).map((item) => sanitizeValue(item, depth + 1)).filter((item): item is Json => item !== undefined);
    return items;
  }
  if (typeof value !== "object") return undefined;

  const output: Record<string, Json> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (Object.keys(output).length >= MAX_METADATA_KEYS) break;
    const key = truncate(rawKey.trim().toLowerCase(), 60);
    if (!key || SECRET_KEY_PATTERN.test(key)) continue;
    const sanitized = sanitizeValue(rawValue, depth + 1);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

export function sanitizeOwnerMetadata(value: unknown): Record<string, Json> {
  const sanitized = sanitizeValue(value, 0);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) return {};
  try {
    if (new TextEncoder().encode(JSON.stringify(sanitized)).byteLength > MAX_METADATA_BYTES) return {};
  } catch {
    return {};
  }
  return sanitized as Record<string, Json>;
}

function safeNullableId(value: string | null | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

function safeNullableStatus(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function safeNullableDuration(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 86_400_000 ? value : null;
}

export function normalizeOwnerLog(input: OwnerLogInput) {
  return {
    level: input.level,
    category: input.category,
    action: truncate(input.action.trim(), MAX_ACTION_LENGTH),
    user_id: safeNullableId(input.userId),
    video_id: safeNullableId(input.videoId),
    session_id: safeNullableId(input.sessionId),
    route: input.route ? truncate(input.route, MAX_ROUTE_LENGTH) : null,
    status: safeNullableStatus(input.status),
    duration_ms: safeNullableDuration(input.durationMs),
    metadata: sanitizeOwnerMetadata(input.metadata),
  };
}

/**
 * Persists a safe owner-visible record without allowing observability failures to
 * break the request that produced the record. The function never accepts raw
 * errors, headers, cookies, provider tokens, or session capabilities.
 */
export async function writeOwnerLog(input: OwnerLogInput): Promise<boolean> {
  const record = normalizeOwnerLog(input);
  if (!record.action || !OBSERVABILITY_LEVELS.includes(record.level) || !OBSERVABILITY_CATEGORIES.includes(record.category)) return false;

  try {
    const { error } = await createAdminClient().from("owner_logs").insert(record);
    if (error) {
      console.error("owner_log_persist_failed", { code: error.code, category: record.category, action: record.action });
      return false;
    }
    return true;
  } catch {
    console.error("owner_log_persist_exception", { category: record.category, action: record.action });
    return false;
  }
}
