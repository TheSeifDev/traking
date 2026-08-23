import { NextResponse } from "next/server";
import { provisionClickUpUser } from "@/src/lib/auth/provisioning";
import { createSignedSessionCookie, SESSION_MAX_AGE_SECONDS } from "@/src/lib/auth/session-cookie";
import { upsertClickUpConnection } from "@/src/lib/clickup/workspace";
import { AUTH_RETURN_COOKIE, getSafeAuthReturnPath } from "@/src/lib/auth/redirect";
import { getClickUpRedirectUri } from "@/src/lib/app-url";
import { acceptInvitationForClickUpUser } from "@/src/lib/auth/invitations";
import { INVITATION_CONTEXT_COOKIE, verifyInvitationContextCookie } from "@/src/lib/auth/invitation-cookie";

type ClickUpTokenResponse = { access_token?: unknown };
type ClickUpTeamsResponse = { teams?: unknown };
type ClickUpTeamIdentity = { id: string; name: string };

function getCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete("trackup_oauth_state");
  response.cookies.delete(AUTH_RETURN_COOKIE);
  response.cookies.delete(INVITATION_CONTEXT_COOKIE);
  response.cookies.delete("trackup_token");
}

function redirectToLogin(request: Request, error: string, returnTo: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  if (returnTo !== "/dashboard") loginUrl.searchParams.set("redirect", returnTo);
  return NextResponse.redirect(loginUrl);
}

function redirectToInvitationError(request: Request, returnTo: string, error: string): NextResponse {
  const inviteUrl = new URL(returnTo.startsWith("/invite/") ? returnTo : "/invite", request.url);
  inviteUrl.searchParams.set("status", error);
  const response = NextResponse.redirect(inviteUrl);
  clearAuthCookies(response);
  return response;
}

function getPrimaryAuthorizedTeam(teams: unknown): ClickUpTeamIdentity | null {
  if (!Array.isArray(teams) || teams.length === 0) return null;
  const primaryTeam = teams[0];
  if (!primaryTeam || typeof primaryTeam !== "object") return null;
  const team = primaryTeam as Record<string, unknown>;
  const rawId = team.id;
  const rawName = team.name;
  if ((typeof rawId !== "string" && typeof rawId !== "number") || typeof rawName !== "string") return null;
  const id = String(rawId).trim();
  const name = rawName.trim();
  return id && name ? { id, name } : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const state = searchParams.get("state");
  const returnTo = getSafeAuthReturnPath(getCookieFromHeader(request.headers.get("cookie"), AUTH_RETURN_COOKIE));
  const invitationContext = verifyInvitationContextCookie(getCookieFromHeader(request.headers.get("cookie"), INVITATION_CONTEXT_COOKIE) ?? undefined);
  const invitationFlow = Boolean(invitationContext) || returnTo.startsWith("/invite/");

  console.info("ClickUp OAuth callback received", {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasError: Boolean(errorParam),
    invitationFlow,
    hasInvitationContext: Boolean(invitationContext),
  });

  if (errorParam) {
    console.error("ClickUp OAuth returned an error parameter");
    return invitationFlow ? redirectToInvitationError(request, returnTo, "auth_denied") : redirectToLogin(request, "auth_denied", returnTo);
  }
  if (!code) return invitationFlow ? redirectToInvitationError(request, returnTo, "missing_code") : redirectToLogin(request, "missing_code", returnTo);

  const expectedState = getCookieFromHeader(request.headers.get("cookie"), "trackup_oauth_state");
  if (!state || !expectedState || state !== expectedState) {
    const response = invitationFlow ? redirectToInvitationError(request, returnTo, "auth_state") : redirectToLogin(request, "auth_state", returnTo);
    response.cookies.delete("trackup_oauth_state");
    response.cookies.delete(AUTH_RETURN_COOKIE);
    response.cookies.delete(INVITATION_CONTEXT_COOKIE);
    return response;
  }
  if (invitationFlow && !invitationContext) return redirectToInvitationError(request, returnTo, "invalid_token");

  const clientId = process.env.CLICKUP_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.CLICKUP_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const redirectUri = getClickUpRedirectUri();
  if (!clientId || !clientSecret) return invitationFlow ? redirectToInvitationError(request, returnTo, "auth_config_error") : redirectToLogin(request, "auth_config_error", returnTo);

  try {
    const tokenResponse = await fetch("https://api.clickup.com/api/v2/oauth/token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    console.info("ClickUp OAuth token exchange completed", { status: tokenResponse.status, ok: tokenResponse.ok, redirectUri });
    if (!tokenResponse.ok) return invitationFlow ? redirectToInvitationError(request, returnTo, "auth_failed") : redirectToLogin(request, "auth_failed", returnTo);

    const tokens: ClickUpTokenResponse = await tokenResponse.json().catch(() => ({}));
    if (typeof tokens.access_token !== "string" || tokens.access_token.length === 0) return invitationFlow ? redirectToInvitationError(request, returnTo, "auth_failed") : redirectToLogin(request, "auth_failed", returnTo);
    const accessToken = tokens.access_token;

    const teamsResponse = await fetch("https://api.clickup.com/api/v2/team", { headers: { Authorization: `Bearer ${accessToken}` } });
    console.info("ClickUp authorized Workspaces request completed", { status: teamsResponse.status, ok: teamsResponse.ok });
    if (!teamsResponse.ok) return invitationFlow ? redirectToInvitationError(request, returnTo, "workspace_auth_failed") : redirectToLogin(request, "workspace_auth_failed", returnTo);
    const teamsData: ClickUpTeamsResponse = await teamsResponse.json().catch(() => ({}));
    if (!Array.isArray(teamsData.teams) || teamsData.teams.length === 0) return invitationFlow ? redirectToInvitationError(request, returnTo, "no_workspaces") : redirectToLogin(request, "no_workspaces", returnTo);

    const userResponse = await fetch("https://api.clickup.com/api/v2/user", { headers: { Authorization: `Bearer ${accessToken}` } });
    console.info("ClickUp authorized user request completed", { status: userResponse.status, ok: userResponse.ok });
    if (!userResponse.ok) return invitationFlow ? redirectToInvitationError(request, returnTo, "invalid_identity") : redirectToLogin(request, "invalid_identity", returnTo);
    const userData: unknown = await userResponse.json();
    const clickupUser = userData && typeof userData === "object" ? (userData as Record<string, unknown>).user : null;
    if (!clickupUser || typeof clickupUser !== "object") return invitationFlow ? redirectToInvitationError(request, returnTo, "invalid_identity") : redirectToLogin(request, "invalid_identity", returnTo);
    const identity = clickupUser as Record<string, unknown>;
    if ((typeof identity.email !== "string" && typeof identity.email !== "undefined") || (typeof identity.id !== "string" && typeof identity.id !== "number")) return invitationFlow ? redirectToInvitationError(request, returnTo, "invalid_identity") : redirectToLogin(request, "invalid_identity", returnTo);
    if (typeof identity.email !== "string" || !identity.email.trim()) return invitationFlow ? redirectToInvitationError(request, returnTo, "invalid_identity") : redirectToLogin(request, "invalid_identity", returnTo);

    const displayName = typeof identity.username === "string" ? identity.username : null;
    const clickupUserId = String(identity.id);
    const provisioning = invitationContext
      ? await acceptInvitationForClickUpUser({ invitationId: invitationContext.invitationId, tokenHash: invitationContext.tokenHash, email: identity.email, clickupUserId, name: displayName })
      : await provisionClickUpUser({ id: clickupUserId, email: identity.email, username: displayName });

    if (!provisioning.success) {
      const error = provisioning.error;
      if (invitationContext) return redirectToInvitationError(request, returnTo, error === "email_mismatch" || error === "profile_identity_mismatch" ? error : error === "expired" || error === "revoked" || error === "already_accepted" ? error : "invalid_token");
      if (error === "inactive_account") {
        const response = redirectToLogin(request, "account_inactive", returnTo);
        response.cookies.delete("trackup_user");
        clearAuthCookies(response);
        return response;
      }
      return redirectToLogin(request, error === "invalid_identity" ? "invalid_identity" : "server_error", returnTo);
    }

    const primaryTeam = getPrimaryAuthorizedTeam(teamsData.teams);
    if (primaryTeam) {
      const persisted = await upsertClickUpConnection(provisioning.user.id, primaryTeam, accessToken);
      if (!persisted) console.error("Failed to persist ClickUp connection — continuing without token cookie");
    } else {
      console.error("ClickUp authorized Workspace shape was invalid — continuing without token cookie");
    }

    const destination = invitationContext ? "/dashboard" : returnTo;
    const response = NextResponse.redirect(new URL(destination, request.url));
    const signedSession = await createSignedSessionCookie(provisioning.user);
    clearAuthCookies(response);
    response.cookies.set("trackup_user", signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    console.error("Unexpected error during OAuth callback processing");
    return invitationFlow ? redirectToInvitationError(request, returnTo, "server_error") : redirectToLogin(request, "server_error", returnTo);
  }
}
