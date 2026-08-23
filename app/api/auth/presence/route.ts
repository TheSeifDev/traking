import { NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { touchAuthenticatedProfile } from "@/src/lib/auth/invitations";

export const POST = withAuth(async (_request, user) => {
  const lastSeenAt = await touchAuthenticatedProfile(user.id);
  if (!lastSeenAt) return NextResponse.json({ error: "presence_unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, last_seen_at: lastSeenAt });
});
