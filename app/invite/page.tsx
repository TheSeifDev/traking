import Link from "next/link";

type InviteStatusPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InviteStatusPage({ searchParams }: InviteStatusPageProps) {
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "invalid_token";
  const copy: Record<string, [string, string]> = {
    expired: ["Invitation expired", "Ask the team owner or admin to resend a new invitation."],
    revoked: ["Invitation revoked", "This invitation is no longer active."],
    accepted: ["Invitation already accepted", "This single-use invitation has already been completed."],
    invalid_token: ["Invitation not available", "This invitation link is invalid or no longer recognized."],
  };
  const [title, body] = copy[status] ?? copy.invalid_token;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070720] px-5 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/20 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/70">TrackUp invitation</p>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">{body}</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-violet-300 hover:text-violet-200">Go to sign in</Link>
      </section>
    </main>
  );
}
