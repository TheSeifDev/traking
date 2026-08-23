import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { resendInvitation } from "@/src/lib/auth/invitations";
import { PERMISSIONS } from "@/src/types/permissions";

type RouteContext = { params: Promise<{ invitationId: string }> };

function statusFor(error: string): number {
  if (error === "unauthenticated") return 401;
  if (error === "forbidden" || error === "inactive_account") return 403;
  if (error === "not_found") return 404;
  if (error === "delivery_not_configured") return 503;
  if (error === "delivery_failed") return 502;
  if (error === "already_accepted" || error === "revoked" || error === "expired") return 409;
  return 500;
}

export const POST = withPermission(
  PERMISSIONS.USERS_MANAGE,
  async (_request: NextRequest, _user, context) => {
    const { invitationId } = await (context as RouteContext).params;
    const result = await resendInvitation(invitationId ?? "");
    if (!result.success) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
    return NextResponse.json({ invitation: result.invitation, sent: true, provider: result.provider, messageId: result.messageId });
  },
);
