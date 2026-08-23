/**
 * /api/admin/users
 *
 * GET  - List global profiles with invitation and last-seen state.
 * POST - Create a disabled pending profile and send a single-use invitation.
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { createInvitation, listTeamMembers } from "@/src/lib/auth/invitations";

function errorStatus(error: string): number {
  if (error === "unauthenticated") return 401;
  if (error === "forbidden" || error === "inactive_account" || error === "owner_email_protected") return 403;
  if (error === "user_exists") return 409;
  if (error === "delivery_not_configured") return 503;
  if (error === "delivery_failed") return 502;
  if (error === "not_found") return 404;
  if (error === "database_error") return 500;
  return 400;
}

export const GET = withPermission(
  PERMISSIONS.USERS_READ,
  async () => {
    const users = await listTeamMembers();
    if (!users) return NextResponse.json({ error: "forbidden_or_error" }, { status: 403 });
    return NextResponse.json({ users });
  },
);

export const POST = withPermission(
  PERMISSIONS.USERS_MANAGE,
  async (request: NextRequest) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const input = body as Record<string, unknown>;
    const email = typeof input.email === "string" ? input.email : "";
    const name = typeof input.name === "string" ? input.name : null;
    if (name && name.trim().length > 255) return NextResponse.json({ error: "invalid_name" }, { status: 400 });

    const result = await createInvitation(email, name, input.role);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });

    return NextResponse.json(
      {
        user: result.user,
        invitation: result.invitation,
        sent: true,
        provider: result.provider,
        messageId: result.messageId,
      },
      { status: 201 },
    );
  },
);
