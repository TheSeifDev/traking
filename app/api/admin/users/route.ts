/**
 * /api/admin/users
 *
 * GET  - List all global user profiles (owner-only in the current model)
 * POST - Pre-provision a profile for a future ClickUp OAuth login
 */
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/src/lib/auth/api-handler";
import { PERMISSIONS } from "@/src/types/permissions";
import { createClickUpInvite, listAllUsers } from "@/src/lib/auth/role-management";

export const GET = withPermission(
  PERMISSIONS.USERS_READ,
  async () => {
    const users = await listAllUsers();
    if (!users) return NextResponse.json({ error: "forbidden_or_error" }, { status: 403 });
    return NextResponse.json({ users });
  },
);

export const POST = withPermission(
  PERMISSIONS.USERS_MANAGE,
  async (request: NextRequest) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const email = typeof input.email === "string" ? input.email : "";
    const name = typeof input.name === "string" ? input.name : null;
    const role = input.role;
    if (name && name.trim().length > 255) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }

    const result = await createClickUpInvite(email, name, role);
    if (!result.success) {
      const status = result.error === "unauthenticated" || result.error === "inactive_account"
        ? 401
        : result.error === "forbidden" || result.error === "owner_email_protected"
            ? 403
            : result.error === "user_exists"
              ? 409
            : result.error === "database_error"
              ? 500
              : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      {
        user: result.user,
        created: result.created,
        message: result.created
          ? "Profile created. The user must sign in with this email through ClickUp."
          : "Existing pre-provisioned profile updated. The user must sign in with this email through ClickUp.",
      },
      { status: result.created ? 201 : 200 },
    );
  },
);
