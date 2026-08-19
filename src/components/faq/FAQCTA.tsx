import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";

const FAQCTA = () => {
  return (
    <section className="mb-16 px-6 lg:px-10">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#393476] bg-[#101034]/80 px-6 py-8 sm:px-10 lg:px-12">
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4931df]/10 blur-[100px]" />

        <div className="relative z-10 flex flex-col items-center gap-7 lg:flex-row lg:justify-between">
          {/* Content */}
          <div className="flex items-center gap-5">
            <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#6048dd] bg-[#19164c] text-[#9c70ff] shadow-[0_0_30px_rgba(103,69,255,0.25)] sm:flex">
              <Rocket size={34} strokeWidth={1.6} />
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white">
                Ready to start{" "}
                <span className="bg-linear-to-r from-[#bd4cff] to-[#637cff] bg-clip-text text-transparent">
                  tracking?
                </span>
              </h2>
              <p className="mt-2 max-w-xl text-sm text-white/55">
                Join hundreds of teams who trust TrackUp to understand their
                video engagement.
              </p>
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/login"
            className="group flex h-12 shrink-0 items-center gap-3 rounded-xl bg-linear-to-r from-[#8b3dff] to-[#5d4cff] px-6 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(105,65,255,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(105,65,255,0.45)]"
          >
            <span>Continue with ClickUp</span>
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FAQCTA;