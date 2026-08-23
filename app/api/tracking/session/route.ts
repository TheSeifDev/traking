/**
 * /api/tracking/session
 * POST - Create a watch session for the authenticated TrackUp viewer.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveWatchLink, createWatchSession } from "@/src/lib/tracking/service";
import { resolveWatchActor } from "@/src/lib/tracking/viewer-identity";
import type { CreateSessionPayload } from "@/src/types/tracking";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const actor = await resolveWatchActor(request);
  if (!actor) return NextResponse.json({ error: "viewer_identity_required" }, { status: 401 });

  const b = body as Partial<CreateSessionPayload>;
  const token = typeof b.watch_link_token === "string" ? b.watch_link_token.trim() : "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const resolved = await resolveWatchLink(token);
  if (!resolved) return NextResponse.json({ error: "invalid_token" }, { status: 404 });

  if (actor.kind === "guest" && actor.watchLinkId !== resolved.watch_link_id) {
    return NextResponse.json({ error: "viewer_identity_mismatch" }, { status: 403 });
  }

  const session = await createWatchSession(resolved.watch_link_id, actor, request.headers.get("user-agent"));
  if (!session) return NextResponse.json({ error: "session_creation_failed" }, { status: 500 });

  return NextResponse.json(
    { session_id: session.id, session_token: session.sessionToken },
    { status: 201 },
  );
}
