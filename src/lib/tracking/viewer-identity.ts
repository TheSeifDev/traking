import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUser } from "@/src/lib/auth/session";
import { VIEWER_IDENTITY_COOKIE, verifyViewerIdentityCookie, type ViewerIdentityContext } from "@/src/lib/auth/viewer-identity-cookie";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WatchActor =
  | { kind: "profile"; profileId: string }
  | { kind: "guest"; identityId: string; watchLinkId: string };

export type ViewerIdentityRecord = {
  id: string;
  watch_link_id: string;
  name: string;
  email: string;
  normalized_email: string;
};

export function hashWatchLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeViewerName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 120 ? name : null;
}

export function normalizeViewerEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 320 && EMAIL_PATTERN.test(email) ? email : null;
}

export async function upsertViewerIdentity(
  watchLinkId: string,
  name: string,
  email: string,
): Promise<ViewerIdentityRecord | null> {
  const normalizedName = normalizeViewerName(name);
  const normalizedEmail = normalizeViewerEmail(email);
  if (!normalizedName || !normalizedEmail) return null;

  try {
    const supabase = createAdminClient();
    const { data: activeLink, error: linkError } = await supabase
      .from("watch_links")
      .select("id, expires_at, revoked_at")
      .eq("id", watchLinkId)
      .maybeSingle();
    if (
      linkError ||
      !activeLink ||
      activeLink.revoked_at ||
      (activeLink.expires_at && new Date(activeLink.expires_at) <= new Date())
    ) return null;

    const { data, error } = await supabase
      .from("viewer_identities")
      .upsert(
        {
          watch_link_id: watchLinkId,
          name: normalizedName,
          email: normalizedEmail,
          normalized_email: normalizedEmail,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "watch_link_id,normalized_email" },
      )
      .select("id, watch_link_id, name, email, normalized_email")
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function loadGuestIdentity(context: ViewerIdentityContext): Promise<ViewerIdentityRecord | null> {
  try {
    const supabase = createAdminClient();
    const [{ data: identity }, { data: link }] = await Promise.all([
      supabase
        .from("viewer_identities")
        .select("id, watch_link_id, name, email, normalized_email")
        .eq("id", context.identityId)
        .eq("watch_link_id", context.watchLinkId)
        .maybeSingle(),
      supabase
        .from("watch_links")
        .select("token, expires_at, revoked_at")
        .eq("id", context.watchLinkId)
        .maybeSingle(),
    ]);
    if (!identity || !link || link.revoked_at || (link.expires_at && new Date(link.expires_at) <= new Date())) return null;
    if (hashWatchLinkToken(link.token) !== context.watchLinkTokenHash) return null;
    return identity;
  } catch {
    return null;
  }
}

export async function getGuestViewerIdentity(rawCookie: string | undefined): Promise<ViewerIdentityRecord | null> {
  const context = verifyViewerIdentityCookie(rawCookie);
  return context ? loadGuestIdentity(context) : null;
}

export async function getGuestViewerIdentityForLink(
  rawCookie: string | undefined,
  watchLinkId: string,
): Promise<ViewerIdentityRecord | null> {
  const context = verifyViewerIdentityCookie(rawCookie);
  if (!context || context.watchLinkId !== watchLinkId) return null;
  return loadGuestIdentity(context);
}

export async function resolveWatchActor(request: NextRequest): Promise<WatchActor | null> {
  const user = await getCurrentUser();
  if (user) return { kind: "profile", profileId: user.id };
  const identity = await getGuestViewerIdentity(request.cookies.get(VIEWER_IDENTITY_COOKIE)?.value);
  return identity ? { kind: "guest", identityId: identity.id, watchLinkId: identity.watch_link_id } : null;
}

export { VIEWER_IDENTITY_COOKIE };
