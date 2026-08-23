import { NextResponse } from "next/server";
import { provisionClickUpUser } from "@/src/lib/auth/provisioning";
import { createSignedSessionCookie, SESSION_MAX_AGE_SECONDS } from "@/src/lib/auth/session-cookie";
import { upsertClickUpConnection } from "@/src/lib/clickup/workspace";
import { AUTH_RETURN_COOKIE, getSafeAuthReturnPath } from "@/src/lib/auth/redirect";
import { getClickUpRedirectUri } from "@/src/lib/app-url";

type ClickUpTokenResponse = {
  access_token?: unknown;
};

type ClickUpTeamsResponse = {
  teams?: unknown;
};

type ClickUpTeamIdentity = {
  id: string;
  name: string;
};

function getCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function redirectToLogin(request: Request, error: string, returnTo: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  if (returnTo !== "/dashboard") loginUrl.searchParams.set("redirect", returnTo);
  return NextResponse.redirect(loginUrl);
}

function getPrimaryAuthorizedTeam(teams: unknown): ClickUpTeamIdentity | null {
  if (!Array.isArray(teams) || teams.length === 0) return null;

  const primaryTeam = teams[0];
  if (!primaryTeam || typeof primaryTeam !== "object") return null;

  const team = primaryTeam as Record<string, unknown>;
  const rawId = team.id;
  const rawName = team.name;

  if ((typeof rawId !== "string" && typeof rawId !== "number") || typeof rawName !== "string") {
    return null;
  }

  const id = String(rawId).trim();
  const name = rawName.trim();

  if (!id || !name) return null;
  return { id, name };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const state = searchParams.get("state");
  const returnTo = getSafeAuthReturnPath(
    getCookieFromHeader(request.headers.get("cookie"), AUTH_RETURN_COOKIE),
  );

  console.info("ClickUp OAuth callback received", {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasError: Boolean(errorParam),
  });

  if (errorParam) {
    console.error("ClickUp OAuth returned an error parameter");
    return redirectToLogin(request, "auth_denied", returnTo);
  }

  if (!code) {
    return redirectToLogin(request, "missing_code", returnTo);
  }

  const expectedState = getCookieFromHeader(request.headers.get("cookie"), "trackup_oauth_state");
  if (!state || !expectedState || state !== expectedState) {
    const response = redirectToLogin(request, "auth_state", returnTo);
    response.cookies.delete("trackup_oauth_state");
    response.cookies.delete(AUTH_RETURN_COOKIE);
    return response;
  }

  const clientId = process.env.CLICKUP_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.CLICKUP_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const redirectUri = getClickUpRedirectUri();

  if (!clientId || !clientSecret) {
    console.error("Missing ClickUp OAuth environment variables");
    return redirectToLogin(request, "auth_config_error", returnTo);
  }

  try {
    // 1. Exchange authorization code for ClickUp access token
    const tokenResponse = await fetch("https://api.clickup.com/api/v2/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    console.info("ClickUp OAuth token exchange completed", {
      status: tokenResponse.status,
      ok: tokenResponse.ok,
      redirectUri,
    });

    if (!tokenResponse.ok) {
      console.error("Failed to exchange OAuth token with ClickUp");
      return redirectToLogin(request, "auth_failed", returnTo);
    }

    let tokens: ClickUpTokenResponse;
    try {
      tokens = await tokenResponse.json();
    } catch {
      console.error("ClickUp token response was not valid JSON");
      return redirectToLogin(request, "auth_failed", returnTo);
    }

    if (typeof tokens.access_token !== "string" || tokens.access_token.length === 0) {
      console.error("No access token present in ClickUp token response");
      return redirectToLogin(request, "auth_failed", returnTo);
    }

    const accessToken = tokens.access_token;

    // 2. Verify at least one ClickUp Workspace was authorized.
    const teamsResponse = await fetch("https://api.clickup.com/api/v2/team", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.info("ClickUp authorized Workspaces request completed", {
      status: teamsResponse.status,
      ok: teamsResponse.ok,
    });

    if (!teamsResponse.ok) {
      console.error("Failed to fetch authorized ClickUp Workspaces");
      return redirectToLogin(request, "workspace_auth_failed", returnTo);
    }

    let teamsData: ClickUpTeamsResponse;
    try {
      teamsData = await teamsResponse.json();
    } catch {
      console.error("ClickUp authorized Workspaces response was not valid JSON");
      return redirectToLogin(request, "workspace_auth_failed", returnTo);
    }

    if (!Array.isArray(teamsData.teams) || teamsData.teams.length === 0) {
      console.error("ClickUp returned no authorized Workspaces");
      return redirectToLogin(request, "no_workspaces", returnTo);
    }

    console.info("ClickUp authorized Workspaces verified", {
      workspaceCount: teamsData.teams.length,
    });

    // 3. Fetch authenticated ClickUp user identity
    const userResponse = await fetch("https://api.clickup.com/api/v2/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.info("ClickUp authorized user request completed", {
      status: userResponse.status,
      ok: userResponse.ok,
    });

    if (!userResponse.ok) {
      console.error("Failed to fetch user identity from ClickUp API");
      return redirectToLogin(request, "invalid_identity", returnTo);
    }

    const userData = await userResponse.json();

    if (!userData || !userData.user || !userData.user.email) {
      console.error("Invalid or missing user object from ClickUp API");
      return redirectToLogin(request, "invalid_identity", returnTo);
    }

    // 4. Provision or load existing user profile with RBAC rules
    const provisioning = await provisionClickUpUser(userData.user);

    console.info("TrackUp profile provisioning completed", {
      success: provisioning.success,
      isNewUser: provisioning.success ? provisioning.isNewUser : undefined,
      error: provisioning.success ? undefined : provisioning.error,
    });

    if (!provisioning.success) {
      if (provisioning.error === "inactive_account") {
        const response = redirectToLogin(request, "account_inactive", returnTo);
        response.cookies.delete("trackup_user");
        response.cookies.delete("trackup_oauth_state");
        response.cookies.delete(AUTH_RETURN_COOKIE);
        return response;
      }

      if (provisioning.error === "invalid_identity") {
        return redirectToLogin(request, "invalid_identity", returnTo);
      }

      return redirectToLogin(request, "server_error", returnTo);
    }

    // 5. Persist ClickUp token + workspace to DB (server-side only — never in a cookie).
    //    Use the first authorized workspace for the MVP.
    const primaryTeam = getPrimaryAuthorizedTeam(teamsData.teams);
    if (primaryTeam) {
      const persisted = await upsertClickUpConnection(provisioning.user.id, primaryTeam, accessToken);
      if (!persisted) {
        console.error("Failed to persist ClickUp connection — continuing without token cookie");
      }
    } else {
      console.error("ClickUp authorized Workspace shape was invalid — continuing without token cookie");
    }

    // 6. Create authenticated session cookie (user identity only — NO ClickUp token).
    const response = NextResponse.redirect(new URL(returnTo, request.url));
    const signedSession = await createSignedSessionCookie(provisioning.user);
    response.cookies.delete("trackup_oauth_state");
    response.cookies.delete(AUTH_RETURN_COOKIE);
    // Remove legacy token cookie if it exists from an older deployment.
    response.cookies.delete("trackup_token");

    // Store signed authenticated user metadata. The role is still reloaded
    // from the database on protected server paths before authorization.
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
    return redirectToLogin(request, "server_error", returnTo);
  }
}
