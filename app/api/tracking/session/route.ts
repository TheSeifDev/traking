/**
 * /api/tracking/session
 * POST - Create a watch session for the authenticated TrackUp viewer.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { resolveWatchLink, createWatchSession } from "@/src/lib/tracking/service";
import type { CreateSessionPayload } from "@/src/types/tracking";

export const POST = withAuth(async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<CreateSessionPayload>;
  const token = typeof b.watch_link_token === "string" ? b.watch_link_token.trim() : "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const resolved = await resolveWatchLink(token);
  if (!resolved) return NextResponse.json({ error: "invalid_token" }, { status: 404 });

  const session = await createWatchSession(resolved.watch_link_id, user.id);
  if (!session) return NextResponse.json({ error: "session_creation_failed" }, { status: 500 });

  return NextResponse.json(
    { session_id: session.id, session_token: session.sessionToken },
    { status: 201 },
  );
});
