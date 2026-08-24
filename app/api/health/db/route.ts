import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/src/lib/health/db";
import { cronExecutionKey, finishCronExecution, isTrustedVercelCron, logCronExecution, logCronStarted, startCronExecution } from "@/src/lib/health/cron-executions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function hasValidCronAuthorization(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function responseHeaders() {
  return { "Cache-Control": "no-store" };
}

export async function GET(request: NextRequest) {
  if (!hasValidCronAuthorization(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: responseHeaders() });
  }

  const trustedCron = isTrustedVercelCron(request);
  const executionKey = trustedCron ? cronExecutionKey(request) : "";
  const startedAt = new Date().toISOString();
  const execution = trustedCron ? await startCronExecution(executionKey, startedAt) : null;

  // A repeated delivery with the same Vercel request identity returns the
  // persisted result instead of probing or creating another execution record.
  if (trustedCron && execution && !execution.created && execution.record.status !== "started") {
    const statusCode = execution.record.status === "succeeded" ? 200 : 503;
    return NextResponse.json(
      { status: execution.record.health_status === "healthy" ? "ok" : "degraded", latency_ms: execution.record.latency_ms, execution_evidence: "persisted", idempotent_replay: true },
      { status: statusCode, headers: responseHeaders() },
    );
  }

  if (trustedCron && execution?.created) await logCronStarted(executionKey);
  const health = await checkDatabaseHealth();
  const statusCode = health.status === "degraded" ? 503 : 200;

  if (trustedCron && execution) {
    const executionStatus = health.status === "healthy" ? "succeeded" : "failed";
    await finishCronExecution({
      id: execution.record.id,
      status: executionStatus,
      finishedAt: new Date().toISOString(),
      httpStatus: statusCode,
      latencyMs: health.latency_ms,
      healthStatus: health.status,
      errorCode: health.error,
    });
    await logCronExecution({
      status: executionStatus,
      httpStatus: statusCode,
      latencyMs: health.latency_ms,
      healthStatus: health.status,
      executionKey,
      errorCode: health.error,
    });
  }

  if (health.status === "degraded") {
    return NextResponse.json(
      { status: "degraded", error: health.error, latency_ms: health.latency_ms, ...(trustedCron && execution ? { execution_evidence: "persisted" } : {}) },
      { status: statusCode, headers: responseHeaders() },
    );
  }

  return NextResponse.json(
    { status: "ok", latency_ms: health.latency_ms, ...(trustedCron && execution ? { execution_evidence: "persisted" } : {}) },
    { status: statusCode, headers: responseHeaders() },
  );
}
