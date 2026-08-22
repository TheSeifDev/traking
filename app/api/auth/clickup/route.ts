import { NextResponse } from "next/server";
import { getAppUrl, getClickUpRedirectUri } from "@/src/lib/app-url";
import { AUTH_RETURN_COOKIE, getSafeAuthReturnPath } from "@/src/lib/auth/redirect";

const CLICKUP_AUTHORIZE_URL = "https://app.clickup.com/api?";

function getClickUpClientId(): { value: string | undefined; source: string } {
  if (process.env.CLICKUP_CLIENT_ID) {
    return { value: process.env.CLICKUP_CLIENT_ID, source: "CLICKUP_CLIENT_ID" };
  }

  return { value: process.env.CLIENT_ID, source: "CLIENT_ID" };
}

function buildClickUpAuthorizeUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): URL {
  const authorizeUrl = new URL(CLICKUP_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  return authorizeUrl;
}

function redactOauthState(authorizeUrl: URL): string {
  const safeUrl = new URL(authorizeUrl.toString());
  safeUrl.searchParams.set("state", "<redacted>");
  return safeUrl.toString();
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = getSafeAuthReturnPath(requestUrl.searchParams.get("redirect"));
  const { value: clientId, source: clientIdSource } = getClickUpClientId();
  const redirectUri = getClickUpRedirectUri();

  if (!clientId) {
    console.error("Missing ClickUp OAuth configuration", {
      hasClientId: Boolean(clientId),
      clientIdSource: clientId ? clientIdSource : null,
      hasRedirectUri: Boolean(redirectUri),
    });
    return NextResponse.redirect(
      new URL("/login?error=auth_config_error", getAppUrl())
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = buildClickUpAuthorizeUrl({ clientId, redirectUri, state });

  console.info("ClickUp OAuth authorization redirect", {
    authorizeUrl: redactOauthState(authorizeUrl),
    clientIdSource,
    redirectUri,
    queryParams: ["client_id", "redirect_uri", "state"],
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(AUTH_RETURN_COOKIE, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set("trackup_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
