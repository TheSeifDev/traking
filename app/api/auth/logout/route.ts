/**
 * /api/auth/logout
 * POST - Clear session cookies and redirect to login
 */
import { NextResponse } from "next/server";
import { getAppUrl } from "@/src/lib/app-url";

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/login", getAppUrl())
  );
  response.cookies.delete("trackup_user");
  return response;
}