import { Activity, BarChart3, CheckCircle2, Eye, Link2, ShieldCheck, UsersRound } from "lucide-react";
import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";
import Features from "@/src/components/home/Features";
import FinalCTA from "@/src/components/home/FinalCTA";

const capabilities = [
  { label: "Internal TrackUp viewer", detail: "Watch through an authenticated /watch/[token] page", icon: Eye },
  { label: "Persisted sessions", detail: "Connect access and playback activity to the authorized viewer profile", icon: Activity },
  { label: "Provider-aware telemetry", detail: "Record detailed events only when the player exposes reliable callbacks", icon: BarChart3 },
  { label: "Scoped access", detail: "Keep Organizations, Spaces, videos, links, and analytics behind server checks", icon: ShieldCheck },
  { label: "Shareable Watch Links", detail: "Create, copy, open, revoke, and retain historical link state", icon: Link2 },
  { label: "Viewer activity", detail: "Review sessions, events, coverage, and measured outcomes where supported", icon: UsersRound },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050617] text-white">
      <ResponsiveNav />
      <section className="relative px-6 pb-16 pt-32 sm:pt-40 lg:px-10 lg:pb-24">
        <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-[min(80vw,56rem)] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300/75">TrackUp capabilities</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">A reliable path from <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">video share</span> to evidence.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/60 sm:text-lg">TrackUp gives ClickUp-connected teams one controlled place to deliver videos, share internal viewer links, and understand the persisted activity each provider can actually prove.</p>
        </div>
      </section>
      <section className="px-6 pb-10 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(({ label, detail, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><Icon size={18} /></div>
              <h2 className="mt-5 text-sm font-semibold text-white">{label}</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">{detail}</p>
              <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-200/70"><CheckCircle2 size={13} />Built into the current product flow</p>
            </article>
          ))}
        </div>
      </section>
      <Features />
      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.06] p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Measurement boundary</p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">The evidence always follows the provider.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">YouTube IFrame API, Vimeo Player SDK, and native HTML5 direct media can expose detailed playback telemetry when it is received and persisted. Google Drive and Telegram currently provide session-level measurement only. TrackUp keeps unsupported watch time, completion, and coverage values unavailable instead of guessing.</p>
        </div>
      </section>
      <FinalCTA />
      <Footer />
    </main>
  );
}
