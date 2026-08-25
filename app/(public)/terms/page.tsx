import { ArrowLeft, CircleAlert, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";

const terms = [
  {
    title: "Authorized use",
    icon: ShieldCheck,
    body: "Use TrackUp only with a ClickUp account and Organization or Space access that you are authorized to use. Owners and administrators are responsible for managing memberships, Watch Links, and the videos they share.",
  },
  {
    title: "Provider behavior",
    icon: CircleAlert,
    body: "TrackUp embeds supported provider surfaces inside its internal viewer. Availability, playback callbacks, duration, and position data remain dependent on the provider and its environment. TrackUp does not promise detailed telemetry for providers or sessions that do not expose it.",
  },
  {
    title: "Analytics interpretation",
    icon: FileText,
    body: "Analytics are derived from persisted sessions and events. A missing or unavailable metric means the current stored evidence is insufficient; it must not be interpreted as proof that playback did or did not occur.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050617] text-white">
      <ResponsiveNav />
      <section className="relative px-6 pb-20 pt-32 sm:pt-40 lg:px-10">
        <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-[min(80vw,56rem)] -translate-x-1/2 rounded-full bg-indigo-600/12 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-violet-300 transition hover:text-violet-200"><ArrowLeft size={14} />Back to TrackUp</Link>
          <header className="mt-8 border-b border-white/8 pb-8"><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/75">Terms of Service</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">Use TrackUp with clear expectations.</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">This concise product notice describes the current application boundaries. A formal agreement, if provided for a deployment, takes precedence over this implementation summary.</p></header>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {terms.map(({ title, icon: Icon, body }) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200"><Icon size={19} /></div><h2 className="mt-6 text-lg font-semibold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-white/45">{body}</p></article>)}
          </div>
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><h2 className="text-xl font-semibold text-white">Account and link responsibility</h2><div className="mt-4 space-y-3 text-sm leading-6 text-white/45"><p>Keep your ClickUp account and TrackUp session secure. Do not share private Watch Link tokens outside their intended audience, and revoke a link when access should end.</p><p>Do not attempt to bypass Organization, Space, role, session-capability, or provider restrictions. TrackUp preserves historical analytics while revoked or expired links fail closed for new access.</p><p>Questions, security reports, and implementation corrections can be sent through the project support route.</p></div><Link href="/contact" className="mt-6 inline-flex items-center rounded-xl border border-violet-300/25 bg-violet-400/10 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15">Contact support</Link></section>
        </div>
      </section>
      <Footer />
    </main>
  );
}
