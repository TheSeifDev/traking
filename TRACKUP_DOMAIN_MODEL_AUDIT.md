# TrackUp — Organization / Team / User Domain Model Audit

**Date:** 2026-10-01  
**Phase:** Phase A — Audit Only  
**Branch:** `main`  
**Repository Root:** `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking`  
**Status:** Complete Forensic Investigation (No code modified in this phase)

---

## 1. Executive Summary

This audit establishes the forensic baseline for refactoring TrackUp's domain model and UI terminology. 

TrackUp's backend schema already possesses the necessary relational foundations (`profiles`, `organizations`, `organization_members`, `spaces`, `space_members`, and `videos`), but the conceptual model and UI presentation suffer from **four critical sources of confusion and overlap**:
1. **Terminology Conflation**: "User Accounts", "Organization Members", "Team Members", and "Space Members" are used interchangeably across headings, navigation links, and management surfaces.
2. **Misplaced Admin Surface (`/owner/admins`)**: The page `/owner/admins` renders `<TeamMemberManager>`, which queries `/api/owner/users` and lists **every account in the database** (including Viewers). There is currently **no dedicated `/owner/users` page**, meaning the account directory was accidentally assigned to the administrator URL.
3. **Dual Concept for Groups ("Spaces" vs "Teams")**: The database table is `spaces`, but the business requirement is **Teams** (`AI Team`, `Software Team`, `Hardware Team`). The UI exposes "Spaces" everywhere while some pages call them "Teams", confusing users.
4. **Content Scope Ambiguity**: Organization-wide content (`space_id IS NULL`) and Team-specific content (`space_id = team_id`) are not consistently enforced server-side across all read and mutation endpoints.

This audit details the exact current entities, relationships, root causes, affected components, affected routes, and the precise target mapping to achieve a single, coherent domain model.

---

## 2. Current Database Entities & Actual Repository Data

A live inspection of the connected Supabase database revealed the following real records and structure:

### A. `public.profiles` (User Accounts)
Stores global user identity, authentication, and platform role.
- **Current Rows (9 total accounts):**
  1. `4dcace12-b9a4-4042-8eaa-896b0e581a6b`: `username: seif_tanjiro`, `email: seif.tanjiro@gmail.com`, `role: owner`, `is_active: true`
  2. `788b69b4-0539-42e2-b113-fe0459a4a2d4`: `username: hasnaa.code`, `email: hasnaa.code@gmail.com`, `role: admin`, `is_active: true`
  3. `7206dc00-5066-4742-8f0d-e28fd5e9024f`: `username: mariammosbah114`, `email: mariammosbah114@gmail.com`, `role: admin`, `is_active: true`
  4. `c2edf2d9-6b70-4dab-bf77-ec7b15f36a7e`: `username: the.phantoms.dev`, `email: the.phantoms.dev@gmail.com`, `role: viewer`, `is_active: true`
  5. `cdb6b1e5-abf8-42ce-b40a-64d4f877a468`: `username: habibamounir6002`, `email: habibamounir6002@gmail.com`, `role: viewer`, `is_active: true`
  6. `647accf4-747a-409f-9fdb-213c5e935d34`: `username: hmdymrwh341`, `email: hmdymrwh341@gmail.com`, `role: viewer`, `is_active: true`
  7. `8af8ab49-717e-454d-92c7-68733d63c028`: `username: fayzhmhmdrmdanbdalhlym`, `email: fayzhmhmdrmdanbdalhlym@gmail.com`, `role: viewer`, `is_active: true`
  8. `319aca7e-7737-4de1-a770-8e52552001e6`: `username: shaheermohamedaly`, `email: shaheermohamedaly@gmail.com`, `role: viewer`, `is_active: true`
  9. `2e99250c-ff89-438b-ac0e-b30613dbbb49`: `username: safalmoaz16`, `email: safalmoaz16@gmail.com`, `role: viewer`, `is_active: false`

- **Platform Role Distribution:**
  - 1 Owner
  - 2 Admins
  - 6 Viewers (5 active, 1 inactive)

### B. `public.organizations`
Top-level multi-tenant boundary.
- **Current Rows (1 organization):**
  - `id`: `fc118ad2-a8b3-4029-8181-073a532ae34a`
  - `name`: `'PHANTOMS | ORG'`
  - `slug`: `'organization-b4ade04bee1f49d18028e4c4'`

### C. `public.spaces` (The Underlying Entity for "Teams")
Operational sub-groups under an Organization.
- **Current Rows (5 spaces, all in `PHANTOMS | ORG`):**
  1. `b4ade04b-ee1f-49d1-8028-e4c4cbcd292b`: `'PHANTOMS | ORG'` (Legacy organization container space; name collides with Organization name)
  2. `d693ca36-85ad-4d47-9f82-bd73712ce276`: `'AI Team-Phantoms'` -> **AI Team**
  3. `223e7f60-675e-49a1-9153-079bcbf03d06`: `'Software Team'` -> **Software Team**
  4. `aa09b2f0-70a5-436a-865c-3e4f0305ff05`: `'Hardware Team'` -> **Hardware Team**
  5. `78f420b7-a14c-4524-b800-2c1b70d75d48`: `'Media Team'` -> Auxiliary legacy team

### D. `public.organization_members`
Links a User Account (`profiles.id`) to an Organization (`organizations.id`).
- **Current Rows (1 membership):**
  - Profile `4dcace12-b9a4-4042-8eaa-896b0e581a6b` (Owner) in `PHANTOMS | ORG` as `role: 'admin'`, `status: 'active'`.
  - *Finding:* Other 8 profiles exist in `public.profiles` and have team/space memberships, but lack explicit rows in `organization_members`. In the target model, every user participating in PHANTOMS must have an active `organization_members` record.

### E. `public.space_members`
Links a User Account (`profiles.id`) to a Team/Space (`spaces.id`).
- **Current Rows (9 memberships across spaces):**
  - `hasnaa.code` (Admin): in `AI Team` (`d693ca36...`) and legacy container (`b4ade04b...`)
  - `habibamounir6002` (Viewer): in `Software Team` (`223e7f60...`)
  - `seif_tanjiro` (Owner): in legacy container, `AI Team`, `Software Team`, `Media Team`, `Hardware Team`
  - `fayzhmhmdrmdanbdalhlym` (Viewer): in legacy container

### F. `public.videos` (Content Resources)
Content items with dual scoping fields:
- `organization_id` (UUID, NOT NULL)
- `space_id` (UUID, NULLABLE)
- **Current Rows (1 video):**
  - `id`: `48d3d465-5863-4657-8eeb-6fc01de86781`
  - `title`: `'Demon Slayer: Kimetsu no Yaiba Infinity Castle | MAIN TRAILER'`
  - `organization_id`: `fc118ad2-a8b3-4029-8181-073a532ae34a`
  - `space_id`: `b4ade04b-ee1f-49d1-8028-e4c4cbcd292b`

---

## 3. Exact Root Cause of Duplication & Confusion

### Problem 1: Why `/owner/admins` Currently Displays All Accounts

```
User visits http://localhost:3000/owner/admins
                 │
                 ▼
app/owner/admins/page.tsx
                 │ (renders)
                 ▼
<TeamMemberManager currentUserId={user.id} />
                 │ (calls on mount)
                 ▼
fetch("/api/owner/users")
                 │
                 ▼
app/api/owner/users/route.ts
  SELECT * FROM profiles ORDER BY created_at DESC;
                 │ (returns all 9 accounts: Owner, Admin, and 6 Viewers)
                 ▼
UI renders every account, including Viewers!
```

**Root Causes Identified:**
1. **Server-Side:**
   - `app/api/owner/admins/route.ts` only implements `POST` (promote) and `DELETE` (demote). It has **no `GET` handler** to query and return only administrators.
   - `app/api/owner/users/route.ts` is the route that returns all user accounts.
2. **Client-Side:**
   - There was **no `/owner/users` page** in `app/owner/`.
   - `app/owner/admins/page.tsx` was reused to render `<TeamMemberManager>`, which is a full User Account Provisioning and Directory manager.
   - `app/admin/users/page.tsx` ALSO rendered `<TeamMemberManager>` with identical code.
   - Nav bar in `DashboardShell.tsx` had:
     `const ownerTeamNavItem = { label: "Team members", href: "/owner/admins", icon: UsersRound };`
     labeling `/owner/admins` as "Team members" instead of "Administrators".

### Problem 2: Overlapping Concepts: "Team Members", "Members", "Spaces", "Teams"

| Surface / Route | Current Header / Label | Underlying Data Table | What It Actually Manages | Target Clean Concept |
| :--- | :--- | :--- | :--- | :--- |
| `/owner/admins` | "Team Members & Credentials" | `public.profiles` | All User Accounts (Owner, Admin, Viewer) | **Administrators** (`owner` & `admin` only) |
| `/owner/users` (missing) | *None* (page didn't exist) | `public.profiles` | *N/A* | **User Accounts** (All accounts directory & provisioning) |
| `/organizations/[id]/members` | "Organization Members" | `public.organization_members` | Organization Memberships | **Organization Members** (Membership link, NOT account creation) |
| `/spaces` | "Spaces Directory" | `public.spaces` | Teams in the Organization | **Teams** (`AI Team`, `Software Team`, `Hardware Team`) |
| `/spaces/[id]/members` | "Space Members" | `public.space_members` | Team Memberships | **Team Members** (Who belongs to this team) |

### Problem 3: "Spaces" vs "Teams" Dual Entity

- **Fact:** The database table is `spaces`, but users think and work in **Teams**.
- TrackUp currently has exactly three operational teams:
  - **AI Team** (`AI Team-Phantoms`, `d693ca36-85ad-4d47-9f82-bd73712ce276`)
  - **Software Team** (`Software Team`, `223e7f60-675e-49a1-9153-079bcbf03d06`)
  - **Hardware Team** (`Hardware Team`, `aa09b2f0-70a5-436a-865c-3e4f0305ff05`)
- Introducing a second `teams` database table would cause massive destructive migration, schema bloat, and foreign key churn.
- **Solution:** Re-use `spaces` and `space_members` as the single source of truth in PostgreSQL, but standardise 100% of user-facing UI, labels, selectors, navigation, and badges to **Teams**.

### Problem 4: Content Scope & Visibility Enforcement

In `src/lib/videos/service.ts`, `listVideos`:
```ts
let videoQuery = supabase.from("videos").select(...).eq("organization_id", scope.organizationId);
if (scope.type === "space") videoQuery = videoQuery.eq("space_id", scope.spaceId);
```
- If a user requested organization scope (`scope.type === "organization"`), the query did NOT filter `space_id`. A regular viewer could potentially see videos from teams they are not a member of.
- The target visibility rule requires:
  1. If `video.space_id IS NULL`: Organization-wide (visible to all active organization members).
  2. If `video.space_id IS NOT NULL`: Team-specific (visible ONLY if the user is an active member of that team, or is platform Owner).

---

## 4. Target Domain Model & Hierarchy

```
TrackUp Platform
  ├── User Accounts (public.profiles)
  │     ├── seif_tanjiro (OWNER)
  │     ├── hasnaa.code (ADMIN)
  │     ├── mariammosbah114 (ADMIN)
  │     └── viewers... (VIEWER)
  │
  └── Organization: "PHANTOMS | ORG" (public.organizations)
        │
        ├── Organization Membership (public.organization_members)
        │     └── Links User Account ───> Organization (Role: admin | member)
        │
        ├── Organization-wide Content (public.videos where space_id IS NULL)
        │     └── Visible to ALL active Organization members
        │
        └── Teams (Database: public.spaces; UI: Teams)
              ├── AI Team (spaces: d693ca36...)
              │     ├── Team Memberships (public.space_members)
              │     └── Team-specific Content (public.videos where space_id = AI Team)
              │
              ├── Software Team (spaces: 223e7f60...)
              │     ├── Team Memberships (public.space_members)
              │     └── Team-specific Content (public.videos where space_id = Software Team)
              │
              └── Hardware Team (spaces: aa09b2f0...)
                    ├── Team Memberships (public.space_members)
                    └── Team-specific Content (public.videos where space_id = Hardware Team)
```

### Core Tenet: One Account Per Person
- User accounts are **never duplicated** across organizations or teams.
- A person has exactly **one record in `public.profiles`**.
- That account is granted:
  - Global Platform Role: `owner` | `admin` | `viewer`
  - Organization Membership: Record in `public.organization_members`
  - Team Memberships: Records in `public.space_members` (e.g. Ahmed can belong to both `AI Team` and `Software Team` without creating two profiles).

---

## 5. UI Information Architecture (Target Navigation)

The navigation structure in `DashboardShell.tsx` and mobile navigation will be reorganised into clear, non-overlapping groups:

```
[ TrackUp Logo ]

Operations
├── Dashboard        (/dashboard)
│
├── Organization     (/organizations/[id])
│   ├── Overview     (/organizations/[id])
│   ├── Members      (/organizations/[id]/members)
│   └── Settings     (/organizations/[id]/settings)
│
└── Teams            (/spaces or /teams)
    ├── AI Team      (/spaces/d693ca36...)
    ├── Software     (/spaces/223e7f60...)
    └── Hardware     (/spaces/aa09b2f0...)

Content
├── Videos           (/videos)
├── Watch Links      (/watch-links)
└── Analytics        (/analytics)

Platform (Owner Only)
├── User Accounts    (/owner/users)
├── Administrators   (/owner/admins)
└── Audit Logs       (/owner)
```

### Clear Distinction in Counters:
- **"Total Accounts"** = Count of rows in `public.profiles`.
- **"Organization Members"** = Count of active rows in `public.organization_members` for the organization.
- **"[Team Name] Members"** = Count of active rows in `public.space_members` for that specific team.

---

## 6. Audit of Affected Routes, APIs & Components

### A. Routes to Create / Modify

| Route | Change Type | Purpose / Target Behavior |
| :--- | :--- | :--- |
| `app/owner/users/page.tsx` | **CREATE** | Dedicated Owner page: "User Accounts". Displays all accounts, provision new user, reset passwords, toggle active status, and assign teams. |
| `app/owner/admins/page.tsx` | **REVISE** | Dedicated Owner page: "Administrators". Displays ONLY `owner` and `admin` accounts. Allows promoting to Admin or demoting to Viewer. Never shows Viewers. |
| `app/admin/users/page.tsx` | **REVISE** | Update description to clarify it is an Admin/Owner view for team directory, or redirect to appropriate boundary. |
| `app/(dashboard)/spaces/...` | **REVISE UI** | Update page titles, breadcrumbs, buttons, and headers to display "Teams" instead of "Spaces". |
| `app/(dashboard)/organizations/[id]/members/page.tsx` | **REVISE UI** | Emphasise "Organization Membership (Assign Existing Account)" rather than creating accounts. |

### B. API Handlers to Create / Modify

| API Handler | Change Type | Purpose / Target Behavior |
| :--- | :--- | :--- |
| `GET /api/owner/admins` | **ADD** | Returns ONLY accounts with `role IN ('owner', 'admin')`. Enforced server-side. |
| `POST /api/owner/admins` | **RETAIN** | Promotes user to Admin (`changeUserRole(id, 'admin')`). |
| `DELETE /api/owner/admins` | **RETAIN** | Demotes user to Viewer (`changeUserRole(id, 'viewer')`). |
| `GET /api/owner/users` | **RETAIN** | Returns all user accounts (`profiles`) for `/owner/users`. |
| `POST /api/owner/users` | **ENHANCE** | Provisions a new user account and optionally binds to Organization and selected Teams (`space_ids: []`) in one operation. |
| `GET /api/owner/users/[id]/teams` | **ADD** | Returns the team memberships for a given user account. |
| `PUT /api/owner/users/[id]/teams` | **ADD** | Updates the team memberships for a given user account without creating duplicate profiles. |
| `GET /api/videos` | **ENHANCE** | Enforce Server-Side Visibility Rule: Organization members see `space_id IS NULL` + `space_id IN (user's active team memberships)`. Owner sees all. |
| `GET /api/videos/[id]` | **ENHANCE** | Enforce Server-Side Visibility Rule: verify video's `space_id` against caller's team memberships if non-null. |

### C. Components to Create / Modify

| Component | Change Type | Details |
| :--- | :--- | :--- |
| `src/components/dashboard/DashboardShell.tsx` | **REVISE** | Implement target navigation tree: Dashboard, Organization, Teams (AI, Software, Hardware), Content, Owner (Users, Administrators, Audit Logs). |
| `src/components/dashboard/TeamMemberManager.tsx` | **REFACTOR** | Rename/rebrand header from "Team Management" to "User Accounts". Wire to `/owner/users`. Add Team assignment checkboxes during user creation. |
| `src/components/owner/OwnerAdminsManager.tsx` | **CREATE** | Dedicated, lightweight administrator manager component for `/owner/admins`. Calls `GET /api/owner/admins`, displays only Owners/Admins, allows promoting/demoting. |
| `src/components/spaces/SpacesDirectory.tsx` | **REVISE** | Update UI text from "Spaces" to "Teams", display AI Team, Software Team, Hardware Team. |
| `src/components/spaces/SpaceDashboard.tsx` | **REVISE** | Update UI labels from "Space" to "Team". |
| `src/components/spaces/SpaceMembersManager.tsx` | **REVISE** | Update UI labels from "Space Members" to "Team Members". |
| `src/lib/spaces/labels.ts` | **ENHANCE** | Update `getSpaceDisplayName` to cleanly map `'AI Team-Phantoms'` -> `'AI Team'`, `'Software Team'` -> `'Software Team'`, `'Hardware Team'` -> `'Hardware Team'`. |

---

## 7. Exact Visibility & Authorization Implementation Logic

The server-side Content Scope Rule must be implemented in `src/lib/videos/service.ts`:

```ts
/**
 * Resolves visible videos for a user according to the TrackUp Visibility Rule:
 * 1. Must belong to the organization.
 * 2. Organization-wide content (space_id IS NULL) is visible to all organization members.
 * 3. Team-specific content (space_id IS NOT NULL) is visible ONLY if the user is an active member of that space.
 * 4. Platform Owner retains global access to all content.
 */
```

### SQL Visibility Query Representation:
```sql
-- For Platform Owner:
SELECT * FROM videos WHERE organization_id = :org_id;

-- For Organization Member:
SELECT * FROM videos 
WHERE organization_id = :org_id 
  AND (
    space_id IS NULL 
    OR space_id IN (
      SELECT space_id FROM space_members 
      WHERE profile_id = :user_id AND status = 'active'
    )
  );
```

---

## 8. Summary of Tables: Reused vs Changed

| Table | Status | Action |
| :--- | :--- | :--- |
| `public.profiles` | **REUSED** | Single source of truth for all User Accounts. No schema changes needed. |
| `public.organizations` | **REUSED** | Multi-tenant boundary. Real row: `PHANTOMS | ORG`. No schema changes needed. |
| `public.organization_members` | **REUSED** | Relationship table for Organization Membership. No schema changes needed. |
| `public.spaces` | **REUSED AS TEAMS** | Reused directly as Teams (`AI Team`, `Software Team`, `Hardware Team`). No new table created. |
| `public.space_members` | **REUSED AS TEAM MEMBERS** | Relationship table for Team Membership. No schema changes needed. |
| `public.videos` | **REUSED** | Content table with `organization_id` (mandatory) and `space_id` (nullable: null = org-wide, uuid = team-specific). |
| `public.watch_links` | **REUSED** | Links to videos. Scoped via video's organization/space. |

**Database Migration Needed:** **NONE.**  
The database schema already has exact 1:1 parity with the required domain model! The entire refactor is achieved through backend authorization scoping, API endpoints, navigation restructuring, and UI component clarity.

---

## 9. Conclusion & Phase B Readiness

With Phase A (Audit) complete:
1. The domain model is precisely defined.
2. The root cause of `/owner/admins` displaying all accounts is definitively diagnosed (missing `/owner/users` UI, `TeamMemberManager` calling all-users endpoint, missing `GET /api/owner/admins`).
3. Teams are mapped directly to `spaces` without duplicate tables.
4. Content scoping rules (`space_id IS NULL` vs `space_id IS NOT NULL`) are formally defined.
5. All affected routes, APIs, and components are inventoried.

We are ready to proceed with Phase B (Implementation).
