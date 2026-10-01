/**
 * /api/owner/users/[id]/teams
 *
 * GET  – List team memberships and available teams for a user account (Owner only).
 * PUT  – Update team memberships for a user account (Owner only).
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { createAdminClient } from "@/utils/supabase/admin";
import { USER_ROLES } from "@/src/types/auth";
import { isLegacyOrganizationContainerSpace } from "@/src/lib/spaces/labels";
import { writeOwnerLog } from "@/src/lib/observability/logger";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRole(
  USER_ROLES.OWNER,
  async (_request: NextRequest, _owner, context) => {
    const { id: targetUserId } = await (context as RouteContext).params;
    if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check user exists
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, name, email, role, is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Get default organization
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: "organization_not_found" }, { status: 500 });
    }

    // Get all spaces (teams) for this organization (excluding collision container)
    const { data: spaces, error: spacesErr } = await supabase
      .from("spaces")
      .select("id, name, slug, organization_id")
      .eq("organization_id", org.id)
      .is("archived_at", null)
      .order("name", { ascending: true });

    if (spacesErr) {
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    const visibleTeams = (spaces ?? []).filter((s) => !isLegacyOrganizationContainerSpace(s, org.name));

    // Get user's active team memberships
    const { data: userMemberships, error: memErr } = await supabase
      .from("space_members")
      .select("id, space_id, role, status")
      .eq("profile_id", targetUserId)
      .eq("status", "active");

    if (memErr) {
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    const activeTeamIds = (userMemberships ?? []).map((m) => m.space_id);

    return NextResponse.json({
      user: profile,
      organization: org,
      available_teams: visibleTeams.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      })),
      assigned_team_ids: activeTeamIds,
    });
  },
);

export const PUT = withRole(
  USER_ROLES.OWNER,
  async (request: NextRequest, _owner, context) => {
    const { id: targetUserId } = await (context as RouteContext).params;
    if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).team_ids)) {
      return NextResponse.json({ error: "invalid_body", message: "team_ids must be an array of space UUIDs." }, { status: 400 });
    }

    const rawTeamIds = (body as Record<string, unknown>).team_ids as unknown[];
    const requestedTeamIds = rawTeamIds.filter((t): t is string => typeof t === "string" && /^[0-9a-f-]{36}$/i.test(t.trim()));

    const supabase = createAdminClient();

    // Check target profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role, email")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Load default organization
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: "organization_not_found" }, { status: 500 });
    }

    // Ensure target user has active organization_members entry
    await supabase.from("organization_members").upsert({
      organization_id: org.id,
      profile_id: targetUserId,
      role: profile.role === "admin" ? "admin" : "member",
      status: "active",
      joined_at: new Date().toISOString(),
    }, { onConflict: "organization_id,profile_id" });

    // Validate that requestedTeamIds belong to this organization
    const { data: validSpaces } = await supabase
      .from("spaces")
      .select("id")
      .eq("organization_id", org.id)
      .in("id", requestedTeamIds);

    const validSpaceIds = new Set((validSpaces ?? []).map((s) => s.id));
    const finalTeamIds = requestedTeamIds.filter((id) => validSpaceIds.has(id));

    // Get current space memberships for this user
    const { data: currentMemberships } = await supabase
      .from("space_members")
      .select("id, space_id, status")
      .eq("profile_id", targetUserId);

    const currentMap = new Map((currentMemberships ?? []).map((m) => [m.space_id, m]));
    const nowIso = new Date().toISOString();

    // Activate or insert selected teams
    for (const teamId of finalTeamIds) {
      const existing = currentMap.get(teamId);
      if (existing) {
        if (existing.status !== "active") {
          await supabase
            .from("space_members")
            .update({ status: "active", updated_at: nowIso })
            .eq("id", existing.id);
        }
      } else {
        await supabase
          .from("space_members")
          .insert({
            space_id: teamId,
            profile_id: targetUserId,
            role: profile.role === "admin" ? "admin" : "member",
            status: "active",
            joined_at: nowIso,
          });
      }
    }

    // Remove or deactivate unselected teams
    for (const [spaceId, membership] of currentMap.entries()) {
      if (!finalTeamIds.includes(spaceId) && membership.status === "active") {
        await supabase
          .from("space_members")
          .update({ status: "removed", updated_at: nowIso })
          .eq("id", membership.id);
      }
    }

    void writeOwnerLog({
      level: "INFO",
      category: "AUTH",
      action: "user_teams_updated",
      userId: targetUserId,
      metadata: {
        target_email: profile.email,
        assigned_team_ids: finalTeamIds,
      },
    });

    return NextResponse.json({
      success: true,
      assigned_team_ids: finalTeamIds,
    });
  },
);
