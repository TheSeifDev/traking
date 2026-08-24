import { NextResponse } from "next/server";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { defaultViewerActivityPeriod, getViewerActivityAnalytics } from "@/src/lib/videos/service";

const STATUS_VALUES = new Set(["all", "measured", "unmeasured"]);

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parsePeriod(fromValue: string | null, toValue: string | null) {
  const fallback = defaultViewerActivityPeriod();
  const from = fromValue && !Number.isNaN(Date.parse(fromValue)) ? new Date(fromValue).toISOString() : fallback.from;
  const to = toValue && !Number.isNaN(Date.parse(toValue)) ? new Date(toValue).toISOString() : fallback.to;
  const duration = Date.parse(to) - Date.parse(from);
  return duration > 0 && duration <= 366 * 24 * 60 * 60 * 1000 ? { from, to } : fallback;
}

function parseMinimumSessions(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 1;
}

export async function GET(request: Request) {
  const user = await guardAuth();
  const url = new URL(request.url);
  const resolution = await resolveActiveSpaceForUser(user, {
    requestedSpaceId: url.searchParams.get("space_id"),
    requestedOrganizationId: url.searchParams.get("organization_id"),
  });
  if (resolution.requestedSpaceInvalid || resolution.requestedOrganizationInvalid || resolution.requiresSelection) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const scope = resolution.context.type === "all"
    ? resolution.organization ? organizationDataScope(resolution.organization) : null
    : resolution.access ? spaceDataScope(resolution.access.space) : null;
  const canManage = resolution.context.type === "all"
    ? user.role === "owner"
    : Boolean(resolution.access?.is_platform_owner || resolution.access?.membership?.role === "admin");
  if (!scope || !canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const period = parsePeriod(url.searchParams.get("from"), url.searchParams.get("to"));
  const statusValue = url.searchParams.get("status");
  const analytics = await getViewerActivityAnalytics(scope, {
    ...period,
    search: url.searchParams.get("search")?.slice(0, 120) ?? "",
    status: statusValue && STATUS_VALUES.has(statusValue) ? statusValue as "all" | "measured" | "unmeasured" : "all",
    minimum_sessions: parseMinimumSessions(url.searchParams.get("minimum_sessions")),
    page: 1,
    page_size: 1000,
  });

  const rows = [
    ["Viewer ID", "Viewer", "Email or identity", "Sessions", "Videos", "Measured watch time", "Average watch time", "Completion", "Last seen", "Progress", "Telemetry"],
    ...analytics.viewers.map((viewer) => [
      viewer.viewer_id,
      viewer.viewer_name ?? "",
      viewer.viewer_email ?? viewer.viewer_identifier ?? "",
      viewer.total_sessions,
      viewer.videos_watched,
      viewer.total_watch_time_seconds === null ? "Not measured" : `${viewer.total_watch_time_seconds}s`,
      viewer.avg_watch_time_seconds === null ? "Not measured" : `${viewer.avg_watch_time_seconds}s`,
      viewer.avg_completion_percentage === null ? "Not measured" : `${viewer.avg_completion_percentage}%`,
      viewer.last_seen_at ?? "Not recorded",
      viewer.progress_percentage === null ? "Unavailable" : `${viewer.progress_percentage}%`,
      viewer.telemetry_state,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"trackup-viewer-activity.csv\"",
      "Cache-Control": "no-store",
    },
  });
}
