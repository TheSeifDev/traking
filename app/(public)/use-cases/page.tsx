import { ArrowRight, BriefcaseBusiness, ClipboardCheck, GraduationCap, MessageSquareText, PlaySquare, UsersRound } from "lucide-react";
import Link from "next/link";
import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";
import FinalCTA from "@/src/components/home/FinalCTA";

const useCases = [
  {
    title: "Onboarding and training",
    description: "Share a controlled TrackUp viewer link for onboarding material and review the sessions attributed to authorized team profiles.",
    icon: GraduationCap,
    accent: "violet",
  },
  {
    title: "Project updates",
    description: "Deliver a video update alongside the ClickUp workflow your team already uses, while keeping the video resource inside its scoped Space.",
    icon: BriefcaseBusiness,
    accent: "cyan",
  },
  {
    title: "Reviews and approvals",
    description: "Give reviewers an internal viewing surface and inspect the playback events that the selected provider can reliably expose.",
    icon: ClipboardCheck,
    accent: "blue",
  },
  {
    title: "Internal demos",
    description: "Create a reusable Watch Link for a product demo, revoke it when access should close, and retain historical activity for authorized analytics.",
    icon: PlaySquare,
    accent: "fuchsia",
  },
  {
    title: "Team knowledge sharing",
    description: "Organize videos by Organization and Space so members can find the resources available to their current context without a global unscoped library.",
    icon: UsersRound,
    accent: "emerald",
  },
  {
    title: "Playback investigation",
    description: "Open viewer, video, or session detail pages to inspect persisted identity, lifecycle fields, event timelines, and provider limitations.",
    icon: MessageSquareText,
    accent: "amber",
  },
] as const;

const accentClasses: Record<(typeof useCases)[number]["accent"], string> = {
  violet: "bg-violet-500/15 text-violet-200",
  cyan: "bg-cyan-500/15 text-cyan-200",
  blue: "bg-blue-500/15 text-blue-200",
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-200",
  emerald: "bg-emerald-500/15 text-emerald-200",
  amber: "bg-amber-500/15 text-amber-200",
};

export default function UseCasesPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050617] text-white">
      <ResponsiveNav />
      <section className="relative px-6 pb-16 pt-32 sm:pt-40 lg:px-10 lg:pb-24">
        <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-[min(80vw,56rem)] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300/75">Built for internal video work</p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">Make every shared video part of the <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">workflow.</span></h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/60 sm:text-lg">TrackUp helps ClickUp-connected teams share video through a scoped internal viewer and understand the viewing evidence that is actually persisted.</p>
        </div>
      </section>
      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map(({ title, description, icon: Icon, accent }) => (
            <article key={title} className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.15)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-white/[0.05]">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accentClasses[accent]}`}><Icon size={19} /></div>
              <h2 className="mt-6 text-xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/45">{description}</p>
              <div className="mt-6 flex items-center gap-2 text-xs font-medium text-violet-200/75">Scoped workflow <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></div>
            </article>
          ))}
        </div>
      </section>
      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">One controlled path</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Add a video, create a Watch Link, then investigate real activity.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">The application keeps the source provider, viewer identity, session lifecycle, event persistence, analytics, and Organization/Space authorization connected. Unsupported telemetry remains explicitly unavailable.</p>
          </div>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500">Continue with ClickUp <ArrowRight size={16} /></Link>
        </div>
      </section>
      <FinalCTA />
      <Footer />
    </main>
  );
}
