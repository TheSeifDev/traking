/** /admin/users – admin + owner route, with current backend capability made explicit */
import Link from "next/link";
import { guardAdmin } from "@/src/lib/auth/guards";

export default async function AdminUsersPage() {
  const user = await guardAdmin();
  const isOwner = user.role === "owner";

  return (
    <main className="min-h-screen bg-[#070720] px-6 py-12 text-white lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Team access</p>
          <h1 className="mt-2 text-2xl font-bold">Member directory</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">The current backend keeps team profiles global and exposes the directory to the owner only.</p>
        </div>
        <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-5 text-sm text-amber-100/80">
          <p className="font-medium text-amber-100">Admin member management is not available in this MVP.</p>
          <p className="mt-2 text-xs leading-5 text-amber-100/55">Although admins have the users-read permission, <code className="rounded bg-black/20 px-1">listAllUsers()</code> is deliberately owner-only. Pre-provisioning profiles and changing roles or status require the owner-level users-manage permission; the owner flow is available from the controls below.</p>
        </div>
        {isOwner && <Link href="/owner/admins" className="inline-flex rounded-xl bg-violet-600/20 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-600/30">Open owner team controls</Link>}
      </div>
    </main>
  );
}
