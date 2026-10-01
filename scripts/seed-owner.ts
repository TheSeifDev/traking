/**
 * TrackUp Initial Owner Seed & Bootstrap Script
 *
 * Provisions the initial platform owner account with sovereign credentials.
 * Can be run in local/CI environments to ensure an owner exists for testing.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createAdminClient } from "../utils/supabase/admin";
import { hashPassword, validatePasswordPolicy } from "../src/lib/auth/password";
import { USER_ROLES } from "../src/types/auth";

export function parseArgs(): { email?: string; username?: string; password?: string } {
  const args = process.argv.slice(2);
  const options: { email?: string; username?: string; password?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--email=")) {
      options.email = arg.slice("--email=".length).replace(/^["']+|["']+$/g, "").trim();
    } else if (arg === "--email" && i + 1 < args.length) {
      options.email = args[++i].replace(/^["']+|["']+$/g, "").trim();
    } else if (arg.startsWith("--username=")) {
      options.username = arg.slice("--username=".length).replace(/^["']+|["']+$/g, "").trim();
    } else if (arg === "--username" && i + 1 < args.length) {
      options.username = args[++i].replace(/^["']+|["']+$/g, "").trim();
    } else if (arg.startsWith("--password=")) {
      options.password = arg.slice("--password=".length).replace(/^["']+|["']+$/g, "");
    } else if (arg === "--password" && i + 1 < args.length) {
      options.password = args[++i].replace(/^["']+|["']+$/g, "");
    }
  }

  return options;
}

export async function seedOwner(options?: {
  email?: string;
  username?: string;
  password?: string;
}): Promise<{ id: string; username: string; email: string; role: string }> {
  const email = (options?.email || process.env.TRACKUP_OWNER_EMAIL || "owner@trackup.dev").trim().toLowerCase();
  const username = (options?.username || "owner").trim().toLowerCase();
  const password = options?.password || "TrackUpOwner2026!";

  // Validate password policy
  const policy = validatePasswordPolicy(password, username, email);
  if (!policy.valid) {
    throw new Error(`Password policy violation: ${policy.error}`);
  }

  const passwordHash = await hashPassword(password);
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Check if owner already exists by email first, or by username
  let { data: existing } = await supabase
    .from("profiles")
    .select("id, username, email, role, is_active")
    .eq("email", email)
    .maybeSingle();

  if (!existing && username) {
    const { data: byUsername } = await supabase
      .from("profiles")
      .select("id, username, email, role, is_active")
      .eq("username", username)
      .maybeSingle();
    existing = byUsername;
  }

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({
        username,
        email,
        password_hash: passwordHash,
        role: USER_ROLES.OWNER,
        is_active: true,
        must_change_password: false,
        password_changed_at: nowIso,
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq("id", existing.id)
      .select("id, username, email, role")
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update existing owner: ${updateError?.message}`);
    }

    return {
      id: updated.id,
      username: updated.username || username,
      email: updated.email,
      role: updated.role,
    };
  }

  // 2. Insert fresh owner
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      username,
      email,
      name: "TrackUp Owner",
      password_hash: passwordHash,
      role: USER_ROLES.OWNER,
      is_active: true,
      must_change_password: false,
      password_changed_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id, username, email, role")
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to insert owner: ${insertError?.message}`);
  }

  // 3. Ensure a primary organization and space exist
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();

  let orgId = org?.id;
  if (!orgId) {
    const { data: newOrg } = await supabase
      .from("organizations")
      .insert({
        name: "TrackUp Core",
        slug: "trackup-core",
        created_by: created.id,
      })
      .select("id")
      .single();
    orgId = newOrg?.id;
  }

  if (orgId) {
    await supabase.from("organization_members").upsert({
      organization_id: orgId,
      profile_id: created.id,
      role: "admin",
      status: "active",
      joined_at: nowIso,
    }, { onConflict: "organization_id,profile_id" });

    const { data: space } = await supabase
      .from("spaces")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    if (!space) {
      const { data: newSpace } = await supabase
        .from("spaces")
        .insert({
          organization_id: orgId,
          name: "Main Space",
          slug: "main-space",
          created_by: created.id,
        })
        .select("id")
        .single();

      if (newSpace) {
        await supabase.from("space_members").upsert({
          space_id: newSpace.id,
          profile_id: created.id,
          role: "admin",
          status: "active",
          source: "manual",
          joined_at: nowIso,
        }, { onConflict: "space_id,profile_id" });
      }
    }
  }

  return {
    id: created.id,
    username: created.username || username,
    email: created.email,
    role: created.role,
  };
}

if (process.argv[1]?.includes("seed-owner")) {
  const cliOptions = parseArgs();
  seedOwner(cliOptions)
    .then((owner) => {
      console.log("Successfully seeded owner account:", {
        id: owner.id,
        username: owner.username,
        email: owner.email,
        role: owner.role,
      });
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err.message || err);
      process.exit(1);
    });
}
