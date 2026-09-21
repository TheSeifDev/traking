# TrackUp Production Audit & Implementation Plan
**Auditor:** Hermes Agent  
**Scope:** Full audit + implementation across auth, responsive, perf, SEO, architecture, mobile bug  
**Source root:** `C:\Users\seift\Downloads\Phantoms\2nd\websites\traking`

---

## CRITICAL ISSUES (P0)

### P0-1 — Mobile Registration Bug (also affects desktop, mislabeled as mobile)
**Location:** `app/(dashboard)/layout.tsx:16`

```ts
const user = await guardRole(USER_ROLES.ADMIN, "/");
```

**Root cause:** `(dashboard)` route group requires ADMIN role. `provisionClickUpUser` (in `src/lib/auth/provisioning.ts:96-105`) creates every fresh user with `role: 'viewer'`. After ClickUp OAuth succeeds for a new user:
1. Profile row created with `role='viewer'`, `is_active=true` ✓
2. Signed session cookie set ✓
3. Redirect to `/dashboard`
4. `(dashboard)/layout.tsx` calls `guardRole(ADMIN, "/")` → `requireRole(ADMIN)` → throws `AuthError("forbidden")`
5. `handleAuthError` redirects to `/` (homepage)

The user is silently bounced back to the marketing page. From their POV: "I registered but can't enter the app."

**Why "mobile" framing:** Desktop users can see the URL flicker in the address bar; mobile users just see the home page render and assume registration failed. The members list they "see" is on the admin/owner's dashboard (where they were created), not on their own.

**Why existing test suite missed it:** `verify-rbac.ts` tests permission maps and role hierarchy — it never exercises a `viewer`-role HTTP request against `/(dashboard)`. Coverage gap.

**Impact:** Every fresh user who logs in via mobile or any non-admin email cannot use the product. Owner email works (gets 'owner' role). Any admin email works (gets 'admin' role). Everyone else is broken.

**Fix:** Change `(dashboard)/layout.tsx` to `guardAuth()`. Viewers can enter /dashboard, view analytics, view videos. Management buttons (Add video, Members, Settings) already gate on `canManage = user.role === "owner"` etc. Add explicit per-page admin/owner guards on the management routes that currently rely on the layout.

---

## HIGH PRIORITY (P1)

### P1-1 — Dashboard mobile header overflow
**Location:** `src/components/dashboard/DashboardShell.tsx:210-212`

The mobile dashboard header packs 7+ nav items into `max-w-[62vw]` with a hidden scrollbar. Items get cut off and tap targets are unreliable on small viewports.

**Fix:** Replace with a hamburger drawer pattern on mobile (similar to the public `MobileNav`). Preserve desktop sidebar unchanged.

### P1-2 — Missing SEO infrastructure
**Location:** `app/layout.tsx` (no per-page metadata, no robots, no sitemap)

The public marketing pages (/features, /integrations, /faq, /how-it-works, /use-cases) have no Open Graph, no Twitter cards, no per-page titles, no description, no canonical. No `robots.txt`, no `sitemap.ts`. These pages should rank but have zero SEO surface.

**Fix:**
- Add per-page `metadata` exports on each `(public)/*/page.tsx`
- Add global `openGraph` + `twitter` defaults in `app/layout.tsx`
- Create `app/sitemap.ts` and `app/robots.ts`
- Add JSON-LD `Organization` schema on `/`

### P1-3 — OAuth callback serial network calls
**Location:** `app/api/auth/clickup/callback/route.ts:113,119`

`fetch teams` and `fetch user` are sequential but depend only on `accessToken`. They can run in `Promise.all`.

**Fix:** Parallelize. ~40% reduction in callback latency.

---

## MEDIUM PRIORITY (P2)

### P2-1 — Duplicate `/api/spaces/active` POST on every dashboard mount
**Location:** `src/components/dashboard/DashboardShell.tsx:101-123`

The `useEffect` dependency includes derived values that re-render to the same content, causing duplicate POSTs.

**Fix:** Compare current values to last-sent values, skip identical requests.

### P2-2 — `useEffect` initial data dependencies don't overlap
**Location:** `src/components/dashboard/DashboardOverview.tsx:145`

`useMemo` uses `now` captured at render time via `useState(() => Date.now())`. If a user keeps the tab open across midnight, the date filter is stale. Use `Date.now()` directly inside the memo or refresh on focus.

### P2-3 — Public marketing pages render on mobile but lack responsive table layouts
**Location:** Various `src/components/features/*`, `src/components/faq/*`

Tables that render at all viewport sizes. Acceptable for now; called out for the responsive audit.

---

## LOW PRIORITY (P3)

### P3-1 — `MobileNav.tsx:44-49` ternary is a no-op
Both branches apply the same classes. Cosmetic.

### P3-2 — No `loading.tsx` files
Every page render waits for full data load before showing anything. Adding `loading.tsx` skeletons improves perceived perf but not actual perf.

### P3-3 — `DashboardOverview.tsx:137` freezes `now` at first render
Stale relative timestamps on long-open tabs.

---

## DOMAIN-ORGANIZED TASK LIST

### AUTH (root-cause the P0-1 fix)
- **AUTH-001** Change `(dashboard)/layout.tsx` from `guardRole(ADMIN, "/")` to `guardAuth()`
- **AUTH-002** Add explicit `guardRole(ADMIN)` to admin-only dashboard pages (members, settings, owner/admins)
- **AUTH-003** Add regression test to verify a viewer-role profile can render `/(dashboard)/dashboard/page.tsx`
- **AUTH-004** Parallelize OAuth callback token teams+user fetches

### RESPONSIVE (preserve existing layouts)
- **RESP-001** Replace mobile dashboard header nav with a hamburger drawer
- **RESP-002** Fix `MobileNav.tsx` ternary no-op + visual polish
- **RESP-003** Audit and fix any table overflow on mobile across all analytics pages (no redesign)

### SEO
- **SEO-001** Add global `openGraph` + `twitter` defaults in root layout
- **SEO-002** Add per-page `metadata` on every `(public)/*/page.tsx`
- **SEO-003** Create `app/sitemap.ts`
- **SEO-004** Create `app/robots.ts`
- **SEO-005** Add Organization JSON-LD on `/`

### PERFORMANCE
- **PERF-001** De-duplicate `/api/spaces/active` POSTs in DashboardShell
- **PERF-002** Refresh `now` in DashboardOverview on tab focus

### CODE QUALITY / OBSERVABILITY
- **QUAL-001** Verify scripts: add coverage for viewer-role HTTP access to dashboard
- **QUAL-002** Document the role model change in CLAUDE.md / AGENTS.md

---

## FILES TO BE CHANGED

| File | Change |
|---|---|
| `app/(dashboard)/layout.tsx` | `guardRole(ADMIN)` → `guardAuth()` |
| `app/(dashboard)/organizations/[organizationId]/members/page.tsx` | Add `guardRole(ADMIN)` |
| `app/(dashboard)/organizations/[organizationId]/settings/page.tsx` | Add `guardRole(ADMIN)` |
| `app/(dashboard)/spaces/[spaceId]/members/page.tsx` | Add `guardRole(ADMIN)` |
| `app/(dashboard)/owner/users/[userId]/page.tsx` | Already `guardOwner()` ✓ |
| `app/api/auth/clickup/callback/route.ts` | Parallelize fetches |
| `src/components/dashboard/DashboardShell.tsx` | Mobile drawer; dedup POST |
| `src/components/navigation/MobileNav.tsx` | Fix ternary |
| `app/layout.tsx` | Add OG/Twitter |
| `app/(public)/features/page.tsx` | Add metadata |
| `app/(public)/integrations/page.tsx` | Add metadata |
| `app/(public)/how-it-works/page.tsx` | Add metadata |
| `app/(public)/use-cases/page.tsx` | Add metadata |
| `app/(public)/faq/page.tsx` | Add metadata |
| `app/(public)/privacy/page.tsx` | Add metadata |
| `app/(public)/terms/page.tsx` | Add metadata |
| `app/(public)/contact/page.tsx` | Add metadata |
| `app/sitemap.ts` | NEW |
| `app/robots.ts` | NEW |

---

## VERIFICATION PLAN

1. Run `npm run typecheck` → must pass
2. Run `npm run lint` → must pass
3. Run `npm test` → all verify-*.ts must pass (incl. new AUTH-003 regression)
4. Manually verify (via reproduction session with user):
   - New viewer registration → dashboard renders (was failing)
   - All existing admin/owner flows still work
   - Mobile nav drawer opens/closes
   - Public pages have OG/Twitter meta in HTML source
   - `/sitemap.xml` and `/robots.txt` reachable

---

## RISKS

- **R1:** Changing `(dashboard)` layout from `guardRole(ADMIN)` to `guardAuth()` opens viewer access to the dashboard route. Any admin-only feature not yet guarded at the page level becomes a viewer-accessible feature. **Mitigation:** Audit each `(dashboard)/*/page.tsx` and add explicit `guardRole(ADMIN)` to pages with admin-only operations.
- **R2:** Mobile nav drawer is a UI change. Could affect existing QA-passing desktop behaviour. **Mitigation:** Apply only below `lg` breakpoint; leave desktop sidebar untouched.
- **R3:** Adding metadata may invalidate OG image URLs that Vercel CDN caches. **Mitigation:** Use absolute URLs with the existing `metadataBase`.