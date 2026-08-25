import { Activity, BarChart3, CheckCircle2, Clock3, Eye, FileVideo, Gauge, Layers3, Play, UsersRound } from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: Gauge },
  { label: "Videos", icon: FileVideo },
  { label: "Analytics", icon: BarChart3, active: true },
  { label: "ClickUp", icon: Layers3 },
  { label: "Team", icon: UsersRound },
  { label: "Settings", icon: Clock3 },
];

const insightItems = [
  { title: "Audience retention", detail: "Visible when persisted playback ranges are sufficient.", icon: UsersRound, tone: "text-violet-300" },
  { title: "Coverage evidence", detail: "Watched, skipped, and replayed states stay provider-aware.", icon: BarChart3, tone: "text-cyan-300" },
  { title: "Session activity", detail: "Review real lifecycle events and last activity timestamps.", icon: Activity, tone: "text-blue-300" },
  { title: "Actionable review", detail: "Open the exact viewer, video, or session detail route.", icon: Play, tone: "text-fuchsia-300" },
];

const timelineBlocks = [
  "bg-violet-500/80", "bg-violet-400/70", "bg-indigo-400/75", "bg-blue-400/75", "bg-violet-500/80", "bg-fuchsia-400/70", "bg-violet-300/70", "bg-indigo-500/80", "bg-cyan-400/75", "bg-violet-500/80", "bg-indigo-400/75", "bg-fuchsia-400/70", "bg-violet-300/65", "bg-cyan-300/70", "bg-violet-500/80", "bg-indigo-400/75", "bg-violet-300/60", "bg-blue-400/70", "bg-fuchsia-400/70", "bg-violet-500/80",
];

export default function AnalyticsShowcase() {
  return (
    <section className="relative px-6 py-16 sm:py-20 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-[90rem] items-center gap-10 xl:grid-cols-[1.16fr_0.84fr] xl:gap-16">
        <div className="relative overflow-hidden rounded-2xl border border-[#29295d] bg-[#080a22] p-3 shadow-[0_30px_100px_rgba(44,29,135,0.2)] sm:p-4">
          <div className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-violet-600/15 blur-[100px]" />
          <div className="relative flex min-h-[22rem] overflow-hidden rounded-xl border border-white/7 bg-[#07091b] sm:min-h-[25rem]">
            <aside className="hidden w-32 shrink-0 border-r border-white/7 bg-[#080a20] p-3 sm:block md:w-36">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><span className="text-violet-300">▶</span>TrackUp</div>
              <nav className="mt-8 space-y-1.5">
                {navItems.map(({ label, icon: Icon, active }) => <div key={label} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[9px] ${active ? "bg-violet-500/20 text-violet-200" : "text-white/35"}`}><Icon size={12} />{label}</div>)}
              </nav>
            </aside>
            <div className="min-w-0 flex-1 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-violet-300/75">Video analytics</p><h3 className="mt-1.5 text-base font-semibold text-white sm:text-lg">Persisted engagement overview</h3></div><span className="rounded-full border border-cyan-300/15 bg-cyan-400/8 px-2 py-1 text-[8px] text-cyan-200/75">Illustrative UI</span></div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[{ label: "Views", value: "—", icon: Eye }, { label: "Viewers", value: "—", icon: UsersRound }, { label: "Watch time", value: "Provider-backed", icon: Clock3 }, { label: "Completion", value: "Not measured", icon: CheckCircle2 }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-lg border border-white/7 bg-white/[0.025] p-2.5"><Icon size={13} className="text-violet-300" /><p className="mt-3 text-[8px] text-white/35">{label}</p><p className="mt-1 truncate text-[11px] font-semibold text-white/80">{value}</p></div>)}
              </div>
              <div className="mt-5 rounded-xl border border-white/7 bg-white/[0.018] p-3.5"><div className="flex items-center justify-between"><p className="text-[9px] font-medium text-white/70">Viewer engagement timeline</p><span className="text-[8px] text-white/30">Stored events</span></div><div className="mt-4 flex h-5 items-end gap-0.5 rounded bg-black/20 p-1">{timelineBlocks.map((color, index) => <span key={index} className={`h-full flex-1 rounded-[2px] ${color}`} />)}</div><div className="mt-2 flex justify-between text-[7px] text-white/25"><span>session start</span><span>playback position</span><span>last activity</span></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[8px] text-white/40"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-violet-400" />Measured</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-fuchsia-400" />Replay event</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-cyan-400" />Lifecycle</span></div></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-white/7 bg-white/[0.018] p-3"><p className="text-[8px] uppercase tracking-[0.15em] text-white/30">Session timeline</p><p className="mt-2 text-[10px] text-white/65">Open a persisted session to inspect its ordered events.</p></div><div className="rounded-xl border border-white/7 bg-white/[0.018] p-3"><p className="text-[8px] uppercase tracking-[0.15em] text-white/30">Coverage</p><p className="mt-2 text-[10px] text-white/65">Unavailable when the provider cannot expose reliable ranges.</p></div></div>
            </div>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/75">Deep insights</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-5xl">Understand engagement <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">with evidence.</span></h2>
          <p className="mt-5 text-sm leading-7 text-white/50 sm:text-base">TrackUp connects video access, sessions, provider events, and analytics detail. The showcase is illustrative; production values are loaded from authorized persisted records and remain unavailable when the provider cannot prove them.</p>
          <div className="mt-8 space-y-4">
            {insightItems.map(({ title, detail, icon: Icon, tone }) => <div key={title} className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-500/10"><Icon size={16} className={tone} /></div><div><h3 className="text-sm font-semibold text-white/90">{title}</h3><p className="mt-1 text-xs leading-5 text-white/40">{detail}</p></div></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
