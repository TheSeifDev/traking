import { NextResponse } from "next/server";
import { hashInvitationToken, inspectInvitationToken } from "@/src/lib/auth/invitations";
import { createInvitationContextCookie, INVITATION_CONTEXT_COOKIE } from "@/src/lib/auth/invitation-cookie";

export async function POST(request: Request) {
  let token = "";
  try {
    const form = await request.formData();
    const value = form.get("token");
    token = typeof value === "string" ? value : "";
  } catch {
    return NextResponse.redirect(new URL("/invite?status=invalid_token", request.url));
  }

  const invitation = await inspectInvitationToken(token);
  if (!invitation) return NextResponse.redirect(new URL("/invite?status=invalid_token", request.url));
  if (invitation.status === "expired") return NextResponse.redirect(new URL("/invite?status=expired", request.url));
  if (invitation.status === "revoked") return NextResponse.redirect(new URL("/invite?status=revoked", request.url));
  if (invitation.status === "accepted") return NextResponse.redirect(new URL("/invite?status=accepted", request.url));

  const response = NextResponse.redirect(new URL("/api/auth/clickup?redirect=/invite", request.url));
  response.cookies.set(INVITATION_CONTEXT_COOKIE, createInvitationContextCookie(invitation.id, hashInvitationToken(token)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
