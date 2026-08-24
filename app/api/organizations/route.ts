import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { listOrganizationsForUser } from "@/src/lib/organizations/service";

export const GET = withAuth(async (_request: NextRequest, user) => {
  const organizations = await listOrganizationsForUser(user);
  return NextResponse.json({ organizations });
});
