import { ArrowRight, BriefcaseBusiness, ClipboardCheck, GraduationCap, MessageSquareText, PlaySquare, UsersRound } from "lucide-react";
import Link from "next/link";

const useCases = [
  {
    title: "Onboarding & Training",
    description: "Share controlled viewer links for onboarding material and review authorized session activity.",
    icon: GraduationCap,
    accent: "violet",
  },
  {
    title: "Project Updates",
    description: "Deliver video updates alongside the ClickUp workflow your team already uses.",
    icon: BriefcaseBusiness,
    accent: "amber",
  },
  {
    title: "Reviews & Approvals",
    description: "Give reviewers an internal viewing surface and inspect provider-backed playback events.",
    icon: ClipboardCheck,
    accent: "fuchsia",
  },
  {
    title: "Product / Demos",
    description: "Create a reusable Watch Link for a demo and retain authorized historical activity.",
    icon: PlaySquare,
    accent: "blue",
  },
  {
    title: "Client Updates",
    description: "Keep shared resources and viewer access organized by the right Organization and Space.",
    icon: UsersRound,
    accent: "cyan",
  },
  {
    title: "Playback Investigation",
    description: "Open viewer, video, or session detail pages to inspect real events and limitations.",
    icon: MessageSquareText,
    accent: "emerald",
  },
] as const;

const accentClasses: Record<(typeof useCases)[number]["accent"], string> = {
  violet: "border-violet-300/20 bg-violet-500/12 text-violet-200",
  amber: "border-amber-300/20 bg-amber-500/12 text-amber-200",
  fuchsia: "border-fuchsia-300/20 bg-fuchsia-500/12 text-fuchsia-200",
  blue: "border-blue-300/20 bg-blue-500/12 text-blue-200",
  cyan: "border-cyan-300/20 bg-cyan-500/12 text-cyan-200",
  emerald: "border-emerald-300/20 bg-emerald-500/12 text-emerald-200",
};

export default function UseCasesPreview() {
  return (
    <section className="relative px-5 pb-8 pt-10 sm:px-6 sm:pb-12 sm:pt-14 lg:px-10 lg:pb-16">
      <div className="mx-auto max-w-[90rem]">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/75">Use cases</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl">
            TrackUp for every <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">team and workflow.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-white/45 sm:text-sm">
            Put controlled video access and provider-aware activity evidence where your team already works.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {useCases.map(({ title, description, icon: Icon, accent }) => (
            <article key={title} className="group flex min-h-48 flex-col rounded-xl border border-white/9 bg-[#080b22]/85 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.14)] transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-[#0c1030] sm:min-h-52">
              <div className={`flex size-9 items-center justify-center rounded-lg border ${accentClasses[accent]}`}>
                <Icon size={16} strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 text-[12px] font-semibold leading-4 text-white">{title}</h3>
              <p className="mt-2 text-[10px] leading-4 text-white/45">{description}</p>
              <Link href="/use-cases" className="mt-auto flex items-center gap-1 pt-4 text-[9px] font-medium text-violet-200/75 transition group-hover:text-violet-100">
                Learn more <ArrowRight size={11} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
