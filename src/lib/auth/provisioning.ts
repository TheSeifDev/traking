import { createAdminClient } from "@/utils/supabase/admin";
import { determineInitialRole } from "./rbac";
import type { AuthenticatedUser } from "@/src/types/auth";

export interface ClickUpUserProfile {
  id: number | string;
  email: string;
  username?: string | null;
  profilePicture?: string | null;
}

export type ProvisioningResult =
  | { success: true; user: AuthenticatedUser; isNewUser: boolean }
  | { success: false; error: "inactive_account" | "invalid_identity" | "database_error" };

/**
 * Provisions or synchronizes a user profile upon successful ClickUp OAuth authentication.
 * 
 * Rules:
 * 1. For a new user, checks if the email matches TRACKUP_OWNER_EMAIL server-side.
 *    If matching -> assigned 'owner'. Otherwise -> assigned 'viewer'.
 * 2. For an existing user, preserves their existing role (admin, owner, viewer).
 *    Never overwrites or downgrades existing roles during authentication.
 * 3. If is_active is false, rejects login without granting access.
 * 4. Never exposes internal errors or secrets.
 */
export async function provisionClickUpUser(
  clickupUser: ClickUpUserProfile
): Promise<ProvisioningResult> {
  if (!clickupUser || !clickupUser.email || typeof clickupUser.email !== "string") {
    return { success: false, error: "invalid_identity" };
  }

  const normalizedEmail = clickupUser.email.trim().toLowerCase();
  const clickupUserId = String(clickupUser.id);
  const displayName = clickupUser.username?.trim() || null;

  try {
    const supabase = createAdminClient();

    // 1. Query for existing profile by clickup_user_id or email
    const { data: existingProfile, error: queryError } = await supabase
      .from("profiles")
      .select("*")
      .or(`clickup_user_id.eq.${clickupUserId},email.eq.${normalizedEmail}`)
      .maybeSingle();

    if (queryError) {
      console.error("Database error while checking user profile");
      return { success: false, error: "database_error" };
    }

    // 2. Handle Existing User
    if (existingProfile) {
      // Check active status
      if (!existingProfile.is_active) {
        return { success: false, error: "inactive_account" };
      }

      // If clickup_user_id or name was missing/updated, keep them synced,
      // but CRITICALLY: preserve the existing role untouched.
      const shouldUpdateDetails =
        !existingProfile.clickup_user_id ||
        (displayName && existingProfile.name !== displayName);

      if (shouldUpdateDetails) {
        await supabase
          .from("profiles")
          .update({
            clickup_user_id: clickupUserId,
            name: displayName || existingProfile.name,
          })
          .eq("id", existingProfile.id);
      }

      const authenticatedUser: AuthenticatedUser = {
        id: existingProfile.id,
        email: existingProfile.email,
        role: existingProfile.role, // Preserved untouched
        is_active: existingProfile.is_active,
        name: displayName || existingProfile.name,
        clickup_user_id: clickupUserId,
      };

      return {
        success: true,
        user: authenticatedUser,
        isNewUser: false,
      };
    }

    // 3. Handle New User Provisioning
    // Determine role server-side: 'owner' if email matches TRACKUP_OWNER_EMAIL, else 'viewer'
    const assignedRole = determineInitialRole(normalizedEmail);

    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        clickup_user_id: clickupUserId,
        name: displayName,
        email: normalizedEmail,
        role: assignedRole,
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !newProfile) {
      console.error("Database error while provisioning new user profile");
      return { success: false, error: "database_error" };
    }

    const authenticatedUser: AuthenticatedUser = {
      id: newProfile.id,
      email: newProfile.email,
      role: newProfile.role,
      is_active: newProfile.is_active,
      name: newProfile.name,
      clickup_user_id: newProfile.clickup_user_id,
    };

    return {
      success: true,
      user: authenticatedUser,
      isNewUser: true,
    };
  } catch {
    console.error("Unexpected error during user provisioning");
    return { success: false, error: "database_error" };
  }
}
