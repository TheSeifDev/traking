import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { getTrackingSessionSpaceId, recordProviderError } from "@/src/lib/tracking/service";
import { authorizeSpaceMember } from "@/src/lib/spaces/access";
import { isValidSourceType } from "@/src/types/video";

export const POST = withAuth(async (request: NextRequest, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const payload = body as { session_id?: unknown; session_token?: unknown; source_type?: unknown; provider_code?: unknown };
  const sessionId = typeof payload.session_id === "string" ? payload.session_id.trim() : "";
  const sessionToken = typeof payload.session_token === "string" ? payload.session_token.trim() : "";
  const sourceType = isValidSourceType(payload.source_type) ? payload.source_type : null;
  const providerCode = typeof payload.provider_code === "number" ? payload.provider_code : Number(payload.provider_code);
  if (!sessionId || !sessionToken || !sourceType || !Number.isInteger(providerCode)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const spaceId = await getTrackingSessionSpaceId(sessionId, user.id);
  if (!spaceId) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  try {
    await authorizeSpaceMember(spaceId, user);
  } catch {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const recorded = await recordProviderError(sessionId, sessionToken, user.id, sourceType, providerCode);
  if (!recorded) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  return NextResponse.json({ recorded: true });
});
