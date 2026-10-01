/**
 * TrackUp Sovereign User Provisioning Engine
 *
 * Provides server-side user provisioning for platform owners.
 * Enforces username/email uniqueness, password policy, and role boundaries.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import { hashPassword, validatePasswordPolicy } from "@/src/lib/auth/password";
import { isValidManagedRole, type AuthenticatedUser, type ManagedRole } from "@/src/types/auth";

export interface CreateTrackUpUserInput {
  username: string;
  email: string;
  password: string;
  role: ManagedRole;
  name?: string | null;
}

export type ProvisioningResult =
  | { success: true; user: AuthenticatedUser }
  | {
      success: false;
      error:
        | "invalid_username"
        | "invalid_email"
        | "invalid_role"
        | "password_policy_violation"
        | "username_taken"
        | "email_taken"
        | "database_error";
      message?: string;
    };

export async function createTrackUpUser(input: CreateTrackUpUserInput): Promise<ProvisioningResult> {
  const { username, email, password, role, name } = input;

  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
    return {
      success: false,
      error: "invalid_username",
      message: "Username must be 3-30 characters containing only letters, numbers, and underscores.",
    };
  }
  const cleanUsername = username.trim().toLowerCase();

  if (typeof email !== "string" || !email.includes("@") || email.trim().length > 255) {
    return {
      success: false,
      error: "invalid_email",
      message: "A valid email address is required.",
    };
  }
  const cleanEmail = email.trim().toLowerCase();

  if (!isValidManagedRole(role)) {
    return {
      success: false,
      error: "invalid_role",
      message: "Role must be 'admin' or 'viewer'.",
    };
  }

  const policy = validatePasswordPolicy(password, cleanUsername, cleanEmail);
  if (!policy.valid || typeof password !== "string") {
    return {
      success: false,
      error: "password_policy_violation",
      message: policy.error || "Password does not meet policy requirements.",
    };
  }

  const cleanName = typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : null;

  try {
    const supabase = createAdminClient();

    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id, username, email")
      .or(`username.ilike.${cleanUsername},email.ilike.${cleanEmail}`)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.username && existingUser.username.toLowerCase() === cleanUsername) {
        return { success: false, error: "username_taken", message: "This username is already taken." };
      }
      return { success: false, error: "email_taken", message: "An account with this email already exists." };
    }

    const passwordHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({
        username: cleanUsername,
        email: cleanEmail,
        name: cleanName,
        password_hash: passwordHash,
        role,
        is_active: true,
        must_change_password: false,
        password_changed_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, username, email, name, role, is_active")
      .single();

    if (insertError || !created) {
      return { success: false, error: "database_error", message: insertError?.message };
    }

    const authenticatedUser: AuthenticatedUser = {
      id: created.id,
      username: created.username,
      email: created.email,
      name: created.name,
      role: created.role,
      is_active: created.is_active,
    };

    return {
      success: true,
      user: authenticatedUser,
    };
  } catch (err) {
    return {
      success: false,
      error: "database_error",
      message: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}
