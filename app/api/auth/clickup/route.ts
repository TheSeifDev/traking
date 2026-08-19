import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.CLICKUP_CLIENT_ID;
  const redirectUri = process.env.CLICKUP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing ClickUp OAuth environment variables" },
      { status: 500 }
    );
  }

  const authUrl = `https://app.clickup.com/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&state=trackup_auth`;

  return NextResponse.redirect(authUrl);
}