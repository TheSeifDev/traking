/**
 * /api/auth/logout
 * POST - Clear session cookies and redirect to login
 */
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  );
  response.cookies.delete("trackup_user");
  return response;
}