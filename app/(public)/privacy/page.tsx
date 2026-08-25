import { ArrowLeft, Database, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";

const sections = [
  {
    title: "Identity and access",
    icon: ShieldCheck,
    body: "TrackUp uses ClickUp OAuth for sign-in. The server provisions or loads the matching TrackUp profile, stores a signed HTTP-only session cookie, and revalidates the profile, active status, and role from the database on protected requests.",
  },
  {
    title: "Video and viewing records",
    icon: Database,
    body: "When a video is added, TrackUp stores the video metadata needed for its scoped library and internal viewer. Authorized viewing can create a watch session and persisted playback events. Detailed position, duration, watch time, completion, and ranges are shown only when the provider supplies reliable telemetry.",
  },
  {
    title: "Security boundaries",
    icon: LockKeyhole,
    body: "Organization, Space, video, Watch Link, session, event, and analytics access is checked server-side. Service-role database access stays on the server. Raw provider access tokens, session capabilities, cookies, and opaque Watch Link tokens are not returned in analytics responses.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050617] text-white">
      <ResponsiveNav />
      <section className="relative px-6 pb-20 pt-32 sm:pt-40 lg:px-10">
        <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-[min(80vw,56rem)] -translate-x-1/2 rounded-full bg-cyan-600/12 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-violet-300 transition hover:text-violet-200"><ArrowLeft size={14} />Back to TrackUp</Link>
          <header className="mt-8 border-b border-white/8 pb-8"><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/75">Privacy and data handling</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">What TrackUp stores and protects</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">This page describes the current application behavior reflected in the TrackUp repository. It is an implementation summary, not a substitute for a formal legal notice or advice.</p></header>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {sections.map(({ title, icon: Icon, body }) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200"><Icon size={19} /></div><h2 className="mt-6 text-lg font-semibold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-white/45">{body}</p></article>)}
          </div>
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><h2 className="text-xl font-semibold text-white">Provider and retention boundaries</h2><div className="mt-4 space-y-3 text-sm leading-6 text-white/45"><p>TrackUp does not treat a page open as proof of playback. Google Drive and Telegram currently provide session-only measurement in the provider registry; YouTube, Vimeo, and native direct media can provide detailed telemetry only when their callbacks are available and persisted.</p><p>Historical records are retained by the current application and may include legacy compatibility fields. Legacy guest-viewer and Organization-container artifacts are not reintroduced as an active authorization path.</p><p>For a security issue, use the project support path and do not publish secrets, cookies, tokens, or private viewer data in a public issue.</p></div><Link href="/contact" className="mt-6 inline-flex items-center rounded-xl border border-violet-300/25 bg-violet-400/10 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15">Contact support</Link></section>
        </div>
      </section>
      <Footer />
    </main>
  );
}
