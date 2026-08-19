import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  const clientId = process.env.CLICKUP_CLIENT_ID;
  const clientSecret = process.env.CLICKUP_CLIENT_SECRET;
  const redirectUri = process.env.CLICKUP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Missing ClickUp OAuth environment variables" },
      { status: 500 }
    );
  }

  try {
    const tokenResponse = await fetch("https://app.clickup.com/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Failed to fetch token:", tokens);
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
    }

    const res = NextResponse.redirect(new URL("/dashboard", request.url));
    res.cookies.set("trackup_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}