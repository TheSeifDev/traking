import { NextRequest, NextResponse } from "next/server";
import { createViewerIdentityCookie, VIEWER_IDENTITY_CONTEXT_MAX_AGE_SECONDS } from "@/src/lib/auth/viewer-identity-cookie";
import { hashWatchLinkToken, normalizeViewerEmail, normalizeViewerName, upsertViewerIdentity } from "@/src/lib/tracking/viewer-identity";
import { resolveWatchLink } from "@/src/lib/tracking/service";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  const token = typeof value.watch_link_token === "string" ? value.watch_link_token.trim() : "";
  const name = typeof value.name === "string" ? normalizeViewerName(value.name) : null;
  const email = typeof value.email === "string" ? normalizeViewerEmail(value.email) : null;
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const resolved = await resolveWatchLink(token);
  if (!resolved) return NextResponse.json({ error: "invalid_token" }, { status: 404 });

  const identity = await upsertViewerIdentity(resolved.watch_link_id, name, email);
  if (!identity) return NextResponse.json({ error: "identity_save_failed" }, { status: 500 });

  const response = NextResponse.json({ identified: true });
  response.cookies.set({
    name: "trackup_viewer_identity",
    value: createViewerIdentityCookie(identity.id, resolved.watch_link_id, hashWatchLinkToken(token)),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VIEWER_IDENTITY_CONTEXT_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
