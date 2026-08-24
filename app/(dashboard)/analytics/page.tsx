import Link from "next/link";
import { redirect } from "next/navigation";
import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import { organizationDataScope, spaceDataScope } from "@/src/lib/spaces/data-scope";
import { getSafeSpaceDisplayName } from "@/src/lib/spaces/labels";
import { defaultViewerActivityPeriod, getViewerActivityAnalytics } from "@/src/lib/videos/service";
import ViewerActivityDashboard from "@/src/components/dashboard/ViewerActivityDashboard";
import PersonalSpaceAnalytics from "@/src/components/spaces/PersonalSpaceAnalytics";
import { getWorkspaceAnalytics } from "@/src/lib/videos/service";

const STATUS_VALUES = new Set(["all", "measured", "unmeasured"]);

function parsePeriod(fromValue: string | undefined, toValue: string | undefined) {
  const fallback = defaultViewerActivityPeriod();
  const from = fromValue && !Number.isNaN(Date.parse(fromValue)) ? new Date(fromValue).toISOString() : fallback.from;
  const to = toValue && !Number.isNaN(Date.parse(toValue)) ? new Date(toValue).toISOString() : fallback.to;
  const duration = Date.parse(to) - Date.parse(from);
  if (duration <= 0 || duration > 366 * 24 * 60 * 60 * 1000) return fallback;
  return { from, to };
}

function parseMinimumSessions(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 1;
}

type PageProps = { searchParams?: Promise<{ space_id?: string; organization_id?: string; from?: string; to?: string; search?: string; status?: string; minimum_sessions?: string; page?: string }> };

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const user = await guardAuth();
  const params = await searchParams;
  const resolution = await resolveActiveSpaceForUser(user, {
    requestedSpaceId: params?.space_id?.trim() || null,
    requestedOrganizationId: params?.organization_id?.trim() || null,
  });
  if (resolution.requestedSpaceInvalid || resolution.requestedOrganizationInvalid) redirect("/spaces?error=forbidden");
  if (resolution.requiresSelection) redirect("/spaces?error=select_space");

  if (resolution.context.type === "all") {
    const organization = resolution.organization;
    const scope = organization ? organizationDataScope(organization) : null;
    if (!organization || !scope) return <AnalyticsEmptyState title="Connect a ClickUp Workspace" detail="Connect the selected Organization before reading its analytics." />;
    const filters = parsePeriod(params?.from, params?.to);
    const analytics = await getViewerActivityAnalytics(scope, {
      ...filters,
      search: params?.search?.slice(0, 120) ?? "",
      status: params?.status && STATUS_VALUES.has(params.status) ? params.status as "all" | "measured" | "unmeasured" : "all",
      minimum_sessions: parseMinimumSessions(params?.minimum_sessions),
      page: parseMinimumSessions(params?.page),
    });
    const scopeQuery = `?organization_id=${encodeURIComponent(organization.id)}`;
    const filterKey = [filters.from, filters.to, analytics.filters.search, analytics.filters.status, analytics.filters.minimum_sessions, analytics.filters.page].join("|");
    return <ViewerActivityDashboard key={filterKey} analytics={analytics} scopeQuery={scopeQuery} contextLabel={`${organization.name} / All Spaces`} />;
  }

  if (!resolution.access) return <AnalyticsEmptyState title="No accessible Space" detail="Join a Space before opening private analytics." />;
  const access = resolution.access;
  const scope = spaceDataScope(access.space);
  const canManage = access.is_platform_owner || access.membership?.role === "admin";
  if (!scope) return <AnalyticsEmptyState title="Connect a ClickUp Workspace" detail="Connect this Space before reading its analytics." href={`/spaces/${access.space.id}`} />;

  if (!canManage) {
    const personalAnalytics = await getWorkspaceAnalytics(scope, user.id);
    return <PersonalSpaceAnalytics space={{ ...access.space, membership_role: access.membership?.role ?? null, membership_status: access.membership?.status ?? null, is_platform_owner: access.is_platform_owner }} analytics={personalAnalytics} />;
  }

  const filters = parsePeriod(params?.from, params?.to);
  const analytics = await getViewerActivityAnalytics(scope, {
    ...filters,
    search: params?.search?.slice(0, 120) ?? "",
    status: params?.status && STATUS_VALUES.has(params.status) ? params.status as "all" | "measured" | "unmeasured" : "all",
    minimum_sessions: parseMinimumSessions(params?.minimum_sessions),
    page: parseMinimumSessions(params?.page),
  });
  const scopeQuery = `?space_id=${encodeURIComponent(access.space.id)}`;
  const filterKey = [filters.from, filters.to, analytics.filters.search, analytics.filters.status, analytics.filters.minimum_sessions, analytics.filters.page].join("|");
  return <ViewerActivityDashboard key={filterKey} analytics={analytics} scopeQuery={scopeQuery} contextLabel={getSafeSpaceDisplayName(access.space.name, access.organization?.name)} />;
}

function AnalyticsEmptyState({ title, detail, href }: { title: string; detail: string; href?: string }) {
  return <div className="flex min-h-full items-center justify-center bg-[#08081f] px-6 py-12 text-center"><div><h1 className="text-xl font-semibold text-white">{title}</h1><p className="mt-2 max-w-md text-sm leading-6 text-white/40">{detail}</p>{href && <Link href={href} className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white">Back to Space</Link>}</div></div>;
}
