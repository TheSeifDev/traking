import Link from "next/link";
import { inspectInvitationToken } from "@/src/lib/auth/invitations";

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusCopy: Record<string, { title: string; body: string }> = {
  invalid_token: { title: "Invitation not available", body: "This invitation link is invalid or no longer recognized." },
  expired: { title: "Invitation expired", body: "Ask the team owner or admin to resend a new invitation." },
  revoked: { title: "Invitation revoked", body: "This invitation is no longer active. Ask the team owner or admin for a new link." },
  accepted: { title: "Invitation already accepted", body: "This single-use invitation has already been completed. You can sign in normally." },
  server_error: { title: "Invitation setup failed", body: "TrackUp could not complete this invitation. Please try again later." },
};

function Card({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070720] px-5 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/20 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/70">TrackUp invitation</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">{body}</p>
        {children}
      </section>
    </main>
  );
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const query = await searchParams;
  const requestedStatus = typeof query.status === "string" ? query.status : "";
  const invitation = requestedStatus ? null : await inspectInvitationToken(token);
  const status = requestedStatus || invitation?.status || "invalid_token";

  if (status !== "pending" || !invitation) {
    const copy = statusCopy[status] ?? statusCopy.invalid_token;
    return (
      <Card title={copy.title} body={copy.body}>
        <div className="mt-6">
          <Link href="/login" className="inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500">
            Go to sign in
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="You are invited to TrackUp"
      body={`You have been invited to join TrackUp with ${invitation.email} as a ${invitation.role}. Sign in using your TrackUp credentials to access your workspace.`}
    >
      <div className="mt-7">
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Sign In to TrackUp
        </Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-white/35">
        This secure invitation expires on {new Date(invitation.expires_at).toLocaleString()} and can be used once.
      </p>
    </Card>
  );
}
