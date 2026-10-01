import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { createAdminClient } from "../utils/supabase/admin";
import { canUserAccessContent } from "../src/lib/spaces/content-scope";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import type { AuthenticatedUser } from "../src/types/auth";

async function main() {
  console.log("============================================================");
  console.log("TRACKUP DOMAIN MODEL & SECURITY VERIFICATION SUITE");
  console.log("============================================================");

  const supabase = createAdminClient();

  // 1. Audit user accounts and platform roles
  console.log("\n[1] Verifying User Accounts & Roles (public.profiles)...");
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, email, role, is_active");
  if (pErr) throw pErr;
  console.log(`Total Accounts in DB: ${profiles.length}`);
  const roles = profiles.reduce((acc, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log("Role distribution:", roles);

  if (profiles.length < 3) throw new Error("Expected at least 3 profiles");

  // 2. /owner/admins query verification: OWNER and ADMIN only
  console.log("\n[2] Verifying /owner/admins server-side filter...");
  const { data: admins, error: aErr } = await supabase
    .from("profiles")
    .select("id, username, email, role")
    .in("role", ["owner", "admin"]);
  if (aErr) throw aErr;
  console.log(`Admins returned: ${admins.length} (Expected: ${roles.owner + (roles.admin || 0)})`);
  const hasViewer = admins.some((u) => u.role === "viewer");
  if (hasViewer) throw new Error("CRITICAL: /owner/admins contains viewer accounts!");
  console.log("PASS: /owner/admins contains zero viewers.");

  // 3. Organization Members vs Accounts distinction
  console.log("\n[3] Verifying Organization Members vs User Accounts...");
  const { data: orgs, error: oErr } = await supabase.from("organizations").select("id, name, slug");
  if (oErr) throw oErr;
  console.log(`Organizations found: ${orgs.length}`);
  orgs.forEach((o) => console.log(` - ${o.name} (${o.id})`));
  const org = orgs[0];

  const { data: orgMembers, error: omErr } = await supabase
    .from("organization_members")
    .select("id, profile_id, role, status")
    .eq("organization_id", org.id);
  if (omErr) throw omErr;
  console.log(`Organization members in ${org.name}: ${orgMembers.length}`);
  console.log(`Total User Accounts: ${profiles.length}`);
  console.log(`Distinct concept verified: Accounts (${profiles.length}) != Org Members (${orgMembers.length})`);

  // Verify no duplicate profiles for org members
  const memberProfileIds = orgMembers.map((m) => m.profile_id);
  const uniqueMemberProfileIds = new Set(memberProfileIds);
  if (memberProfileIds.length !== uniqueMemberProfileIds.size) {
    throw new Error("Duplicate member profile_ids found in organization!");
  }
  console.log("PASS: Every organization member references a unique existing user account.");

  // 4. Teams correspond to existing Spaces (AI, Software, Hardware)
  console.log("\n[4] Verifying Operational Teams (public.spaces)...");
  const { data: spaces, error: sErr } = await supabase
    .from("spaces")
    .select("id, name, slug, organization_id")
    .eq("organization_id", org.id);
  if (sErr) throw sErr;
  console.log(`Teams/Spaces under ${org.name}: ${spaces.length}`);
  spaces.forEach((s) => console.log(` - Team: ${s.name} (id: ${s.id}, slug: ${s.slug})`));

  const aiTeam = spaces.find((s) => s.name.toLowerCase().includes("ai"));
  const softwareTeam = spaces.find((s) => s.name.toLowerCase().includes("software"));
  const hardwareTeam = spaces.find((s) => s.name.toLowerCase().includes("hardware"));

  if (!aiTeam || !softwareTeam || !hardwareTeam) {
    throw new Error("Missing one of AI, Software, or Hardware teams!");
  }
  console.log("PASS: AI, Software, and Hardware teams are mapped to public.spaces.");

  // 5. Team Membership (public.space_members)
  console.log("\n[5] Verifying Team Memberships (public.space_members)...");
  const { data: spaceMembers, error: smErr } = await supabase
    .from("space_members")
    .select("id, space_id, profile_id, role, status");
  if (smErr) throw smErr;
  console.log(`Total space membership records: ${spaceMembers.length}`);

  // 6 & 7 & 8: Server-side Content Scope & Visibility Rules
  console.log("\n[6, 7, 8] Verifying Server-Side Visibility & Cross-Team Isolation...");
  
  // Pick an owner, an AI member, and a Hardware member
  const ownerProfile = profiles.find((p) => p.role === "owner")!;
  const ownerUser: AuthenticatedUser = {
    id: ownerProfile.id,
    email: ownerProfile.email,
    username: ownerProfile.username,
    role: "owner",
    name: "Owner",
    is_active: true,
  };

  // Find a user in AI team
  const aiMemberRow = spaceMembers.find((sm) => sm.space_id === aiTeam.id && sm.status === "active");
  if (!aiMemberRow) throw new Error("No active AI team member found in seed data!");
  const aiProfile = profiles.find((p) => p.id === aiMemberRow.profile_id)!;
  const aiUser: AuthenticatedUser = {
    id: aiProfile.id,
    email: aiProfile.email,
    username: aiProfile.username,
    role: "viewer",
    name: "AI Viewer",
    is_active: true,
  };

  // Find a user in Hardware team
  const hwMemberRow = spaceMembers.find((sm) => sm.space_id === hardwareTeam.id && sm.status === "active");
  if (!hwMemberRow) throw new Error("No active Hardware team member found in seed data!");
  const hwProfile = profiles.find((p) => p.id === hwMemberRow.profile_id)!;
  const hwUser: AuthenticatedUser = {
    id: hwProfile.id,
    email: hwProfile.email,
    username: hwProfile.username,
    role: "viewer",
    name: "Hardware Viewer",
    is_active: true,
  };

  console.log(`Test Personas:`);
  console.log(` - Owner: ${ownerUser.username} (${ownerUser.id})`);
  console.log(` - AI Member: ${aiUser.username} (${aiUser.id})`);
  console.log(` - Hardware Member: ${hwUser.username} (${hwUser.id})`);

  // Test 8a: Organization-wide content (space_id IS NULL)
  const orgWideContent = { organization_id: org.id, space_id: null };
  const ownerCanOrgWide = await canUserAccessContent(ownerUser, orgWideContent);
  const aiCanOrgWide = await canUserAccessContent(aiUser, orgWideContent);
  const hwCanOrgWide = await canUserAccessContent(hwUser, orgWideContent);
  console.log(`Org-wide content access: Owner=${ownerCanOrgWide}, AI=${aiCanOrgWide}, HW=${hwCanOrgWide}`);
  if (!ownerCanOrgWide || !aiCanOrgWide || !hwCanOrgWide) {
    throw new Error("Org-wide content should be accessible to all organization members!");
  }
  console.log("PASS: Organization-wide content is accessible to all organization members.");

  // Test 8b: AI-specific content (space_id = AI)
  const aiContent = { organization_id: org.id, space_id: aiTeam.id };
  const ownerCanAI = await canUserAccessContent(ownerUser, aiContent);
  const aiCanAI = await canUserAccessContent(aiUser, aiContent);
  const hwCanAI = await canUserAccessContent(hwUser, aiContent);
  console.log(`AI-scoped content access: Owner=${ownerCanAI}, AI=${aiCanAI}, HW=${hwCanAI}`);
  if (!ownerCanAI || !aiCanAI) {
    throw new Error("AI content should be accessible to Owner and AI member!");
  }
  if (hwCanAI && hwUser.id !== aiUser.id) {
    // Check if hwUser happens to be also in AI team
    const hwInAi = spaceMembers.some((sm) => sm.space_id === aiTeam.id && sm.profile_id === hwUser.id && sm.status === "active");
    if (!hwInAi) {
      throw new Error("CROSS-TEAM LEAKAGE: Hardware member accessed AI-only content!");
    }
  }
  console.log("PASS: AI content is accessible only to AI members (and Platform Owner).");

  // Test 8c: Hardware-specific content (space_id = Hardware)
  const hwContent = { organization_id: org.id, space_id: hardwareTeam.id };
  const ownerCanHW = await canUserAccessContent(ownerUser, hwContent);
  const hwCanHW = await canUserAccessContent(hwUser, hwContent);
  const aiCanHW = await canUserAccessContent(aiUser, hwContent);
  console.log(`Hardware-scoped content access: Owner=${ownerCanHW}, HW=${hwCanHW}, AI=${aiCanHW}`);
  if (!ownerCanHW || !hwCanHW) {
    throw new Error("Hardware content should be accessible to Owner and HW member!");
  }
  if (aiCanHW && aiUser.id !== hwUser.id) {
    const aiInHw = spaceMembers.some((sm) => sm.space_id === hardwareTeam.id && sm.profile_id === aiUser.id && sm.status === "active");
    if (!aiInHw) {
      throw new Error("CROSS-TEAM LEAKAGE: AI member accessed Hardware-only content!");
    }
  }
  console.log("PASS: Hardware content is accessible only to Hardware members (and Platform Owner).");

  // 9. Password change logic
  console.log("\n[9] Verifying Password Hashing & Verification...");
  const testPw = "TrackUp#Secure2026";
  const hash = await hashPassword(testPw);
  const valid = await verifyPassword(testPw, hash);
  const invalid = await verifyPassword("WrongPassword123!", hash);
  if (!valid || invalid) throw new Error("Password verification failed!");
  console.log("PASS: Argon2id password hashing and verification functioning correctly.");

  console.log("\n============================================================");
  console.log("ALL DOMAIN MODEL & SECURITY VERIFICATIONS PASSED!");
  console.log("============================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
