/**
 * TrackUp Owner User Management Route Handler
 * /api/owner/users
 *
 * GET  - List all user accounts with authentication and role state (Owner only)
 * POST - Provision a new user account directly with credentials and assigned role (Owner only)
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { createAdminClient } from "@/utils/supabase/admin";
import { USER_ROLES, isValidManagedRole, type ManagedRole } from "@/src/types/auth";
import { hashPassword, validatePasswordPolicy } from "@/src/lib/auth/password";
import { writeOwnerLog } from "@/src/lib/observability/logger";

export const GET = withRole(USER_ROLES.OWNER, async () => {
  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select(`
      id,
      username,
      email,
      name,
      role,
      is_active,
      must_change_password,
      last_login_at,
      created_at,
      updated_at,
      last_seen_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }

  return NextResponse.json({ users: users ?? [] }, { status: 200 });
});

export const POST = withRole(USER_ROLES.OWNER, async (request: NextRequest, owner) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { username, email, password, role, name } = body as Record<string, unknown>;

  // 1. Validate username
  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
    return NextResponse.json(
      { error: "invalid_username", message: "Username must be 3-30 characters (letters, numbers, underscores)." },
      { status: 400 }
    );
  }
  const cleanUsername = username.trim().toLowerCase();

  // 2. Validate email
  if (typeof email !== "string" || !email.includes("@") || email.trim().length > 255) {
    return NextResponse.json(
      { error: "invalid_email", message: "A valid email address is required." },
      { status: 400 }
    );
  }
  const cleanEmail = email.trim().toLowerCase();

  // 3. Validate role (must be admin or viewer)
  if (!isValidManagedRole(role)) {
    return NextResponse.json(
      { error: "invalid_role", message: "Role must be 'admin' or 'viewer'." },
      { status: 400 }
    );
  }
  const assignedRole: ManagedRole = role;

  // 4. Validate password against policy
  const policyResult = validatePasswordPolicy(password, cleanUsername, cleanEmail);
  if (!policyResult.valid || typeof password !== "string") {
    return NextResponse.json(
      { error: "password_policy_violation", message: policyResult.error },
      { status: 400 }
    );
  }

  const cleanName = typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : null;

  const supabase = createAdminClient();

  // 5. Uniqueness check for username & email
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id, username, email")
    .or(`username.ilike.${cleanUsername},email.ilike.${cleanEmail}`)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      { error: "user_exists", message: "A user with this username or email already exists." },
      { status: 409 }
    );
  }

  // 6. Hash password with Argon2id
  const passwordHash = await hashPassword(password);
  const nowIso = new Date().toISOString();

  // 7. Insert profile
  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      password_hash: passwordHash,
      role: assignedRole,
      is_active: true,
      must_change_password: true,
      password_changed_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id, username, email, name, role, is_active, must_change_password, created_at")
    .single();

  if (insertError || !newProfile) {
    console.error("Failed to insert profile:", insertError);
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }

  // 8. Associate new user with default organization and spaces
  try {
    const { data: defaultOrg } = await supabase
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultOrg) {
      await supabase.from("organization_members").upsert({
        organization_id: defaultOrg.id,
        profile_id: newProfile.id,
        role: assignedRole === USER_ROLES.ADMIN ? "admin" : "member",
        status: "active",
        joined_at: nowIso,
      }, { onConflict: "organization_id,profile_id" });

      const { data: defaultSpace } = await supabase
        .from("spaces")
        .select("id")
        .eq("organization_id", defaultOrg.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultSpace) {
        await supabase.from("space_members").upsert({
          space_id: defaultSpace.id,
          profile_id: newProfile.id,
          role: assignedRole === USER_ROLES.ADMIN ? "admin" : "member",
          status: "active",
          source: "manual",
          joined_at: nowIso,
        }, { onConflict: "space_id,profile_id" });
      }
    }
  } catch (orgErr) {
    console.warn("Non-fatal: could not auto-bind user to organization:", orgErr);
  }

  // 9. Audit log
  void writeOwnerLog({
    level: "INFO",
    category: "AUTH",
    action: "auth_user_created",
    userId: owner.id,
    status: 201,
    metadata: {
      new_user_id: newProfile.id,
      username: newProfile.username,
      email: newProfile.email,
      role: newProfile.role,
    },
  });

  return NextResponse.json(
    {
      success: true,
      user: newProfile,
    },
    { status: 201 }
  );
});
