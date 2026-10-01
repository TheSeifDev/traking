/**
 * TrackUp Owner-Initiated Password Reset Route Handler
 * POST /api/owner/users/[id]/reset-password
 *
 * Allows an authorized Owner to assign a new password to a user account.
 * Immediately revokes all active sessions for the user and requires password change.
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { createAdminClient } from "@/utils/supabase/admin";
import { USER_ROLES } from "@/src/types/auth";
import { hashPassword, validatePasswordPolicy } from "@/src/lib/auth/password";
import { revokeAllUserSessions } from "@/src/lib/auth/session-store";
import { writeOwnerLog } from "@/src/lib/observability/logger";

export const POST = withRole(
  USER_ROLES.OWNER,
  async (request: NextRequest, owner, context) => {
    const routeContext = context as { params: Promise<{ id: string }> | { id: string } };
    const params = await routeContext.params;
    const targetUserId: string = params.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const { password } = body as Record<string, unknown>;

    if (typeof password !== "string" || !password) {
      return NextResponse.json({ error: "missing_password" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch target user
    const { data: targetUser, error: fetchError } = await supabase
      .from("profiles")
      .select("id, username, email, role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // 2. Protect owner account from remote resets by non-self
    if (targetUser.role === USER_ROLES.OWNER && targetUser.id !== owner.id) {
      return NextResponse.json(
        { error: "target_is_owner", message: "Owner password cannot be reset via this endpoint." },
        { status: 403 }
      );
    }

    // 3. Validate password policy
    const policyResult = validatePasswordPolicy(password, targetUser.username, targetUser.email);
    if (!policyResult.valid) {
      return NextResponse.json(
        { error: "password_policy_violation", message: policyResult.error },
        { status: 400 }
      );
    }

    // 4. Hash password
    const newHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        password_hash: newHash,
        password_changed_at: nowIso,
        must_change_password: true,
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq("id", targetUserId);

    if (updateError) {
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    // 5. Invalidate all active sessions for target user
    await revokeAllUserSessions(targetUserId);

    // 6. Audit log
    void writeOwnerLog({
      level: "INFO",
      category: "AUTH",
      action: "auth_user_password_reset_by_owner",
      userId: owner.id,
      status: 200,
      metadata: { target_user_id: targetUserId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  }
);
