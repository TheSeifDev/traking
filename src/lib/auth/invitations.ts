import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAppUrl } from "@/src/lib/app-url";
import { AuthError, requirePermission } from "@/src/lib/auth/session";
import { isValidManagedRole, USER_ROLES, type AuthenticatedUser, type InvitationStatus, type InvitationSummary, type ManagedRole, type TeamMember } from "@/src/types/auth";
import { PERMISSIONS } from "@/src/types/permissions";
import { isConfiguredOwnerEmail } from "./rbac";
import { sendTransactionalEmail } from "@/src/lib/email/resend";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InvitationFailureCode =
  | "unauthenticated"
  | "inactive_account"
  | "forbidden"
  | "invalid_email"
  | "invalid_role"
  | "owner_email_protected"
  | "user_exists"
  | "database_error"
  | "delivery_not_configured"
  | "delivery_failed"
  | "not_found"
  | "already_accepted"
  | "revoked"
  | "expired"
  | "email_mismatch"
  | "profile_identity_mismatch"
  | "invalid_token";

type InvitationSuccess = {
  success: true;
  invitation: InvitationSummary;
  user: TeamMember;
  provider: "resend";
  messageId: string;
};

export type CreateInvitationResult =
  | InvitationSuccess
  | { success: false; error: InvitationFailureCode };

export type InvitationMutationResult =
  | { success: true; invitation: InvitationSummary; provider: "resend"; messageId: string }
  | { success: false; error: InvitationFailureCode };

export type InvitationAcceptanceResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; error: InvitationFailureCode };

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createRawToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashToken(rawToken) };
}

function invitationStatus(row: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InvitationStatus {
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return "pending";
}

function toInvitationSummary(row: {
  id: string;
  email: string;
  role: ManagedRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  last_sent_at: string | null;
}): InvitationSummary {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    revoked_at: row.revoked_at,
    last_sent_at: row.last_sent_at,
    status: invitationStatus(row),
  };
}

function toAuthenticatedUser(profile: {
  id: string;
  email: string;
  role: AuthenticatedUser["role"];
  is_active: boolean;
  name: string | null;
  clickup_user_id: string | null;
}): AuthenticatedUser {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    is_active: profile.is_active,
    name: profile.name,
    clickup_user_id: profile.clickup_user_id,
  };
}

function invitationUrl(rawToken: string): string {
  return `${getAppUrl()}/invite/${encodeURIComponent(rawToken)}`;
}

function invitationEmail(input: { name: string | null; role: ManagedRole; url: string }): { html: string; text: string } {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const roleLabel = input.role === USER_ROLES.ADMIN ? "Admin" : "Viewer";
  return {
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17172f;line-height:1.6"><h1>You have been invited to TrackUp</h1><p>${greeting}</p><p>You have been invited to join TrackUp as a <strong>${roleLabel}</strong>.</p><p><a href="${input.url}" style="display:inline-block;background:#6d28d9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Accept invitation</a></p><p>This secure invitation expires in 7 days and can be used once. Sign in to ClickUp with the same email address that received this message.</p></body></html>`,
    text: `${greeting}\n\nYou have been invited to join TrackUp as a ${roleLabel}.\n\nAccept your invitation: ${input.url}\n\nThis secure invitation expires in 7 days and can be used once. Sign in to ClickUp with the same email address that received this message.`,
  };
}

async function sendInvitationEmail(input: { invitationId: string; email: string; name: string | null; role: ManagedRole; rawToken: string }) {
  const message = invitationEmail({ name: input.name, role: input.role, url: invitationUrl(input.rawToken) });
  return sendTransactionalEmail({
    to: input.email,
    subject: "You are invited to TrackUp",
    html: message.html,
    text: message.text,
    idempotencyKey: `trackup-invitation-${input.invitationId}-${input.rawToken.slice(0, 16)}`,
  });
}

async function authorizeManager(permission: typeof PERMISSIONS.USERS_MANAGE | typeof PERMISSIONS.USERS_READ) {
  try {
    return await requirePermission(permission);
  } catch (error) {
    const code = error instanceof AuthError && error.code === "inactive_account"
      ? "inactive_account"
      : "unauthenticated";
    return { error: code as "inactive_account" | "unauthenticated" };
  }
}

async function loadInvitationWithProfile(invitationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, profile_id, email, role, token_hash, created_at, expires_at, accepted_at, revoked_at, last_sent_at, created_by")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !data) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, name, role, is_active, clickup_user_id, created_at, updated_at, last_seen_at")
    .eq("id", data.profile_id)
    .maybeSingle();
  if (profileError || !profile) return null;
  return { invitation: data, profile };
}

function toTeamMember(profile: TeamMember, invitation: InvitationSummary | null): TeamMember {
  return { ...profile, invitation, invitation_status: invitation?.status ?? "not_invited" };
}

export async function listTeamMembers(): Promise<TeamMember[] | null> {
  const requester = await authorizeManager(PERMISSIONS.USERS_READ);
  if ("error" in requester) return null;

  try {
    const supabase = createAdminClient();
    const [{ data: profiles, error: profileError }, { data: invitations, error: invitationError }] = await Promise.all([
      supabase.from("profiles").select("id, clickup_user_id, name, email, role, is_active, created_at, updated_at, last_seen_at").order("created_at", { ascending: true }),
      supabase.from("invitations").select("id, profile_id, email, role, created_at, expires_at, accepted_at, revoked_at, last_sent_at").order("created_at", { ascending: false }),
    ]);
    if (profileError || invitationError || !profiles || !invitations) return null;

    const latestByProfile = new Map<string, InvitationSummary>();
    for (const row of invitations) {
      if (!latestByProfile.has(row.profile_id) && isValidManagedRole(row.role)) {
        latestByProfile.set(row.profile_id, toInvitationSummary(row));
      }
    }

    return profiles.map((profile) => {
      const typedProfile = profile as TeamMember;
      const invitation = latestByProfile.get(profile.id) ?? null;
      return toTeamMember(typedProfile, invitation);
    });
  } catch {
    return null;
  }
}

export async function createInvitation(email: string, name: string | null, requestedRole: unknown): Promise<CreateInvitationResult> {
  const requester = await authorizeManager(PERMISSIONS.USERS_MANAGE);
  if ("error" in requester) return { success: false, error: requester.error };
  if (!isValidManagedRole(requestedRole)) return { success: false, error: "invalid_role" };

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { success: false, error: "invalid_email" };
  if (isConfiguredOwnerEmail(normalizedEmail)) return { success: false, error: "owner_email_protected" };
  const displayName = name?.trim() || null;
  if (displayName && displayName.length > 255) return { success: false, error: "database_error" };

  try {
    const supabase = createAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id, clickup_user_id, name, email, role, is_active, created_at, updated_at, last_seen_at")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existingError) return { success: false, error: "database_error" };
    if (existing?.clickup_user_id) return { success: false, error: "user_exists" };

    let profile = existing;
    if (profile) {
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({ name: displayName || profile.name, role: requestedRole, is_active: false })
        .eq("id", profile.id)
        .select("id, clickup_user_id, name, email, role, is_active, created_at, updated_at, last_seen_at")
        .single();
      if (updateError || !updated) return { success: false, error: "database_error" };
      profile = updated;
    } else {
      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ email: normalizedEmail, name: displayName, role: requestedRole, is_active: false })
        .select("id, clickup_user_id, name, email, role, is_active, created_at, updated_at, last_seen_at")
        .single();
      if (insertError || !created) return { success: false, error: "database_error" };
      profile = created;
    }

    await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("profile_id", profile.id).is("accepted_at", null).is("revoked_at", null);
    const { rawToken, tokenHash } = createRawToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
    const { data: invitation, error: insertInvitationError } = await supabase
      .from("invitations")
      .insert({ profile_id: profile.id, email: normalizedEmail, role: requestedRole, token_hash: tokenHash, expires_at: expiresAt, created_by: requester.id })
      .select("id, profile_id, email, role, created_at, expires_at, accepted_at, revoked_at, last_sent_at")
      .single();
    if (insertInvitationError || !invitation) return { success: false, error: "database_error" };

    const delivery = await sendInvitationEmail({ invitationId: invitation.id, email: normalizedEmail, name: profile.name, role: requestedRole, rawToken });
    if (!delivery.success) {
      await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitation.id).is("accepted_at", null);
      return delivery;
    }

    const sentAt = new Date().toISOString();
    const { data: sentInvitation, error: sentUpdateError } = await supabase
      .from("invitations")
      .update({ last_sent_at: sentAt })
      .eq("id", invitation.id)
      .select("id, profile_id, email, role, created_at, expires_at, accepted_at, revoked_at, last_sent_at")
      .single();
    if (sentUpdateError || !sentInvitation) return { success: false, error: "database_error" };

    const member = toTeamMember(profile as TeamMember, toInvitationSummary(sentInvitation));
    return { success: true, invitation: toInvitationSummary(sentInvitation), user: member, provider: delivery.provider, messageId: delivery.messageId };
  } catch {
    return { success: false, error: "database_error" };
  }
}

export async function resendInvitation(invitationId: string): Promise<InvitationMutationResult> {
  const requester = await authorizeManager(PERMISSIONS.USERS_MANAGE);
  if ("error" in requester) return { success: false, error: requester.error };
  if (!invitationId.trim()) return { success: false, error: "not_found" };

  try {
    const loaded = await loadInvitationWithProfile(invitationId);
    if (!loaded) return { success: false, error: "not_found" };
    const { invitation, profile } = loaded;
    if (invitation.accepted_at) return { success: false, error: "already_accepted" };
    if (invitation.revoked_at) return { success: false, error: "revoked" };
    if (profile.clickup_user_id) return { success: false, error: "user_exists" };

    const supabase = createAdminClient();
    await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitation.id).is("accepted_at", null).is("revoked_at", null);
    const { rawToken, tokenHash } = createRawToken();
    const { data: replacement, error: replacementError } = await supabase
      .from("invitations")
      .insert({ profile_id: profile.id, email: invitation.email, role: invitation.role, token_hash: tokenHash, expires_at: new Date(Date.now() + INVITATION_TTL_MS).toISOString(), created_by: requester.id })
      .select("id, profile_id, email, role, created_at, expires_at, accepted_at, revoked_at, last_sent_at")
      .single();
    if (replacementError || !replacement) return { success: false, error: "database_error" };

    const delivery = await sendInvitationEmail({ invitationId: replacement.id, email: profile.email, name: profile.name, role: replacement.role, rawToken });
    if (!delivery.success) {
      await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", replacement.id).is("accepted_at", null);
      return delivery;
    }
    const { data: sent, error: sentError } = await supabase
      .from("invitations")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", replacement.id)
      .select("id, profile_id, email, role, created_at, expires_at, accepted_at, revoked_at, last_sent_at")
      .single();
    if (sentError || !sent) return { success: false, error: "database_error" };
    return { success: true, invitation: toInvitationSummary(sent), provider: delivery.provider, messageId: delivery.messageId };
  } catch {
    return { success: false, error: "database_error" };
  }
}

export async function revokeInvitation(invitationId: string): Promise<{ success: true } | { success: false; error: InvitationFailureCode }> {
  const requester = await authorizeManager(PERMISSIONS.USERS_MANAGE);
  if ("error" in requester) return { success: false, error: requester.error };
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { success: false, error: "database_error" };
    if (!data) return { success: false, error: "not_found" };
    return { success: true };
  } catch {
    return { success: false, error: "database_error" };
  }
}

export async function acceptInvitationForClickUpUser(input: {
  invitationId: string;
  tokenHash: string;
  email: string;
  clickupUserId: string;
  name: string | null;
}): Promise<InvitationAcceptanceResult> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail || !/^[a-f0-9]{64}$/.test(input.tokenHash)) return { success: false, error: "invalid_token" };
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("accept_invitation", {
      p_invitation_id: input.invitationId,
      p_token_hash: input.tokenHash,
      p_email: normalizedEmail,
      p_clickup_user_id: input.clickupUserId,
      p_name: input.name,
    });
    if (error || !data) {
      const message = error?.message ?? "";
      if (message.includes("invitation_accepted")) return { success: false, error: "already_accepted" };
      if (message.includes("invitation_revoked")) return { success: false, error: "revoked" };
      if (message.includes("invitation_expired")) return { success: false, error: "expired" };
      if (message.includes("invitation_email_mismatch")) return { success: false, error: "email_mismatch" };
      if (message.includes("profile_identity_mismatch")) return { success: false, error: "profile_identity_mismatch" };
      return { success: false, error: "invalid_token" };
    }
    return { success: true, user: toAuthenticatedUser(data) };
  } catch {
    return { success: false, error: "database_error" };
  }
}

export async function inspectInvitationToken(rawToken: string): Promise<InvitationSummary | null> {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 128) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("invitations")
      .select("id, email, role, created_at, expires_at, accepted_at, revoked_at, last_sent_at")
      .eq("token_hash", hashToken(rawToken))
      .maybeSingle();
    if (error || !data || !isValidManagedRole(data.role)) return null;
    return toInvitationSummary(data);
  } catch {
    return null;
  }
}

export function hashInvitationToken(rawToken: string): string {
  return hashToken(rawToken);
}

export async function touchAuthenticatedProfile(profileId: string): Promise<string | null> {
  if (!profileId) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("touch_profile_last_seen", { p_profile_id: profileId });
    if (error || typeof data !== "string") return null;
    return data;
  } catch {
    return null;
  }
}
