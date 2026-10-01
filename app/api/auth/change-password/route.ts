/**
 * TrackUp Self-Service Password Change Route Handler
 * POST /api/auth/change-password
 *
 * Allows an authenticated user to change their password.
 * Invalidates other active sessions upon success.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/src/lib/auth/api-handler";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
} from "@/src/lib/auth/password";
import { revokeAllUserSessions } from "@/src/lib/auth/session-store";
import { writeOwnerLog } from "@/src/lib/observability/logger";

export const POST = withAuth(async (request, user) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body as Record<string, unknown>;

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "missing_current_password" }, { status: 400 });
  }

  if (typeof newPassword !== "string" || !newPassword) {
    return NextResponse.json({ error: "missing_new_password" }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "new_password_must_differ", message: "New password must be different from current password." },
      { status: 400 }
    );
  }

  // Validate new password policy
  const policy = validatePasswordPolicy(newPassword, user.username, user.email);
  if (!policy.valid) {
    return NextResponse.json(
      { error: "password_policy_violation", message: policy.error },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, password_hash")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.password_hash) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Verify current password
  const valid = await verifyPassword(currentPassword, profile.password_hash);
  if (!valid) {
    void writeOwnerLog({
      level: "WARN",
      category: "AUTH",
      action: "auth_change_password_invalid_current",
      userId: user.id,
      status: 400,
    });
    return NextResponse.json(
      { error: "invalid_current_password", message: "Current password does not match." },
      { status: 400 }
    );
  }

  // Hash new password
  const newHash = await hashPassword(newPassword);
  const nowIso = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      password_hash: newHash,
      password_changed_at: nowIso,
      must_change_password: false,
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }

  // Invalidate all other active sessions for this user
  await revokeAllUserSessions(user.id);

  void writeOwnerLog({
    level: "INFO",
    category: "AUTH",
    action: "auth_password_changed",
    userId: user.id,
    status: 200,
  });

  return NextResponse.json({ success: true }, { status: 200 });
});
