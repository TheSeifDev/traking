import { Check, Link2, Play, TrendingUp } from "lucide-react";
import Link from "next/link";

const FeaturedIntegration = () => {
  return (
    <section className="px-6 pb-16 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-[#a66cff]">☆</span>
          <h2 className="text-sm font-semibold md:text-base">Featured Integration</h2>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#7844ff]/40 bg-[#090b25] p-6 shadow-[0_0_60px_rgba(100,50,255,0.12)] md:p-8">
          <div className="pointer-events-none absolute left-1/4 top-0 h-40 w-80 bg-[#712dff]/15 blur-[100px]" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[280px_1fr]">
            {/* Left */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-[#ff4ca8] via-[#8d42ff] to-[#4d5cff]">
                  <span className="text-xl font-bold text-white">↗</span>
                </div>
                <h3 className="text-2xl font-bold">ClickUp</h3>
                <span className="rounded-md border border-[#783dff]/30 bg-[#642cff]/10 px-2 py-1 text-[9px] text-[#a875ff]">
                  Featured
                </span>
              </div>

              <p className="mt-5 text-xs leading-6 text-white/55">
                Supercharge your workflow with deep ClickUp integration.
              </p>

              <div className="mt-5 space-y-3">
                {[
                  "Link videos to ClickUp tasks",
                  "Search and connect authorized tasks",
                  "Review provider-aware progress in TrackUp",
                  "Save time and stay aligned",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-white/65">
                    <Check size={15} className="text-[#9662ff]" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <Link
                  href="/login"
                  className="flex h-10 items-center gap-2 rounded-lg bg-linear-to-r from-[#8b3dff] to-[#5d4cff] px-4 text-xs font-semibold shadow-[0_8px_25px_rgba(105,65,255,0.3)]"
                >
                  Connect with ClickUp
                </Link>

                <Link
                  href="/how-it-works"
                  className="flex h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-xs text-white/75 transition hover:bg-white/5"
                >
                  <Play size={13} />
                  Learn More
                </Link>
              </div>
            </div>

            {/* Right visual */}
            <div className="min-w-0">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-violet-200/55">Illustrative UI · values are examples, not live workspace telemetry</p>
              <div className="grid items-center gap-3 md:grid-cols-[1fr_60px_1fr]">
              <div className="rounded-xl border border-white/10 bg-[#050817] p-5">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="text-[#ff66c4]">◆</span>
                  ClickUp Task
                </div>

                <div className="mt-6 text-xs font-semibold">
                  Watch: Python OOP - Session 04
                </div>

                <div className="mt-5 space-y-3 border-t border-white/7 pt-4">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">Status</span>
                    <span className="text-blue-400">● In Progress</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">Assignees</span>
                    <span>👤👤👤 +2</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">Due Date</span>
                    <span>May 26, 2024</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">Priority</span>
                    <span>🚩 High</span>
                  </div>
                </div>
              </div>

              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#884eff]/50 bg-[#5722b9]/20 shadow-[0_0_30px_rgba(130,65,255,0.3)]">
                <Link2 size={19} className="text-[#a26aff]" />
              </div>

              <div className="rounded-xl border border-white/10 bg-[#050817] p-5">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <TrendingUp size={14} className="text-[#8f5fff]" />
                  TrackUp Progress
                </div>

                <div className="mt-5 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-[#6840ff] text-sm font-semibold">
                    87%
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-white/40">Watched Time</span>
                    <span>36m 48s / 42m 18s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Completion</span>
                    <span>87%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Last Watched</span>
                    <span>May 18, 2024</span>
                  </div>
                </div>

                <Link href="/features" className="mt-5 flex h-8 w-full items-center justify-center rounded-md bg-[#4120b8] text-[10px] transition hover:bg-[#5430d8]">
                  View Feature Details
                </Link>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedIntegration;