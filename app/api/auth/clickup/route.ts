import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.CLICKUP_CLIENT_ID || process.env.CLIENT_ID;
  const redirectUri = process.env.CLICKUP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error("Missing ClickUp OAuth configuration");
    return NextResponse.redirect(new URL("/login?error=auth_config_error", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  const state = crypto.randomUUID();
  const authUrl = `https://app.clickup.com/api?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("trackup_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
