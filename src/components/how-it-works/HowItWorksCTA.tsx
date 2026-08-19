import Link from "next/link";
import { Play } from "lucide-react";

const HowItWorksCTA = () => {
  return (
    <section className="px-6 pb-20 md:px-10">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#7040ff]/30 bg-[#0b0e2b] px-6 py-8 md:px-10 md:py-10">
        {/* Glow */}
        <div className="pointer-events-none absolute -left-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[#713cff]/20 blur-[90px]" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-linear-to-l from-[#3215a0]/20 to-transparent" />

        <div className="relative flex flex-col items-center justify-between gap-8 md:flex-row">
          {/* Text */}
          <div>
            <h2 className="text-xl font-bold md:text-2xl">Ready to See It in Action?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">
              Join hundreds of teams already using TrackUp to track, understand, and improve with confidence.
            </p>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-col items-center gap-4">
            <Link
              href="/login"
              className="flex h-11 items-center gap-2.5 rounded-xl bg-linear-to-r from-[#8b3dff] to-[#5d4cff] px-6 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(105,65,255,0.28)] transition-all hover:-translate-y-px hover:shadow-[0_10px_35px_rgba(105,65,255,0.4)]"
            >
              Continue with ClickUp
            </Link>

            <Link href="#" className="flex items-center gap-2 text-xs font-medium text-white/70 transition-colors hover:text-white">
              <Play size={14} />
              Watch Demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksCTA;