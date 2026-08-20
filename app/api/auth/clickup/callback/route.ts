import { NextResponse } from "next/server";
import { provisionClickUpUser } from "@/src/lib/auth/provisioning";
import { createSignedSessionCookie, SESSION_MAX_AGE_SECONDS } from "@/src/lib/auth/session-cookie";

type ClickUpTokenResponse = {
  access_token?: unknown;
};

type ClickUpTeamsResponse = {
  teams?: unknown;
};

function getCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const state = searchParams.get("state");

  console.info("ClickUp OAuth callback received", {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasError: Boolean(errorParam),
  });

  // Handle explicit OAuth rejection or error from provider
  if (errorParam) {
    console.error("ClickUp OAuth returned an error parameter");
    return NextResponse.redirect(new URL("/login?error=auth_denied", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const expectedState = getCookieFromHeader(request.headers.get("cookie"), "trackup_oauth_state");
  if (!state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(new URL("/login?error=auth_state", request.url));
    response.cookies.delete("trackup_oauth_state");
    return response;
  }

  const clientId = process.env.CLICKUP_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.CLICKUP_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const redirectUri = process.env.CLICKUP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Missing ClickUp OAuth environment variables");
    return NextResponse.redirect(new URL("/login?error=auth_config_error", request.url));
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
        grant_type: "authorization_code",
      }),
    });

    console.info("ClickUp OAuth token exchange completed", {
      status: tokenResponse.status,
      ok: tokenResponse.ok,
    });

    if (!tokenResponse.ok) {
      console.error("Failed to exchange OAuth token with ClickUp");
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
    }

    let tokens: ClickUpTokenResponse;
    try {
      tokens = await tokenResponse.json();
    } catch {
      console.error("ClickUp token response was not valid JSON");
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
    }

    if (typeof tokens.access_token !== "string" || tokens.access_token.length === 0) {
      console.error("No access token present in ClickUp token response");
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
    }

    // 2. Verify at least one ClickUp Workspace was authorized.
    const teamsResponse = await fetch("https://api.clickup.com/api/v2/team", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    console.info("ClickUp authorized Workspaces request completed", {
      status: teamsResponse.status,
      ok: teamsResponse.ok,
    });

    if (!teamsResponse.ok) {
      console.error("Failed to fetch authorized ClickUp Workspaces");
      return NextResponse.redirect(new URL("/login?error=workspace_auth_failed", request.url));
    }

    let teamsData: ClickUpTeamsResponse;
    try {
      teamsData = await teamsResponse.json();
    } catch {
      console.error("ClickUp authorized Workspaces response was not valid JSON");
      return NextResponse.redirect(new URL("/login?error=workspace_auth_failed", request.url));
    }

    if (!Array.isArray(teamsData.teams) || teamsData.teams.length === 0) {
      console.error("ClickUp returned no authorized Workspaces");
      return NextResponse.redirect(new URL("/login?error=no_workspaces", request.url));
    }

    console.info("ClickUp authorized Workspaces verified", {
      workspaceCount: teamsData.teams.length,
    });

    // 3. Fetch authenticated ClickUp user identity
    const userResponse = await fetch("https://api.clickup.com/api/v2/user", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    console.info("ClickUp authorized user request completed", {
      status: userResponse.status,
      ok: userResponse.ok,
    });

    if (!userResponse.ok) {
      console.error("Failed to fetch user identity from ClickUp API");
      return NextResponse.redirect(new URL("/login?error=invalid_identity", request.url));
    }

    const userData = await userResponse.json();

    if (!userData || !userData.user || !userData.user.email) {
      console.error("Invalid or missing user object from ClickUp API");
      return NextResponse.redirect(new URL("/login?error=invalid_identity", request.url));
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
        // Clear any previous session and redirect with inactive message
        const response = NextResponse.redirect(
          new URL("/login?error=account_inactive", request.url)
        );
        response.cookies.delete("trackup_token");
        response.cookies.delete("trackup_user");
        response.cookies.delete("trackup_oauth_state");
        return response;
      }

      if (provisioning.error === "invalid_identity") {
        return NextResponse.redirect(new URL("/login?error=invalid_identity", request.url));
      }

      // database_error
      return NextResponse.redirect(new URL("/login?error=server_error", request.url));
    }

    // 5. Create authenticated session cookies
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    const signedSession = await createSignedSessionCookie(provisioning.user);
    response.cookies.delete("trackup_oauth_state");

    // Store ClickUp OAuth token
    response.cookies.set("trackup_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    // Store signed authenticated user metadata. The role is still reloaded
    // from the database on protected server paths before authorization.
    response.cookies.set(
      "trackup_user",
      signedSession,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      }
    );

    return response;
  } catch {
    console.error("Unexpected error during OAuth callback processing");
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}
