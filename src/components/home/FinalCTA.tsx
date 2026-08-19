import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const FinalCTA = () => {
  return (
    <section className="relative px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-300 overflow-hidden rounded-[24px] border border-[#40388a] bg-[#0d0d32]/80 px-6 py-10 shadow-[0_0_80px_rgba(70,50,220,0.08)] sm:px-8 sm:py-12 lg:px-12 lg:py-14">
        
        {/* Background glow */}
        <div className="pointer-events-none absolute left-1/2 -top-35 h-80 w-140 -translate-x-1/2 rounded-full bg-[#4d35ff]/15 blur-[120px]" />
        
        {/* Side glow */}
        <div className="pointer-events-none absolute -right-30 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#693dff]/10 blur-[100px]" />
        
        {/* Grid */}
        <div className="pointer-events-none absolute inset-0 opacity-30 bg-[linear-gradient(rgba(100,85,220,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(100,85,220,0.12)_1px,transparent_1px)] bg-size-[50px_50px] mask-[linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]" />

        {/* Content */}
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          
          {/* Heading */}
          <h2 className="text-2xl font-bold tracking-[-0.035em] text-white sm:text-3xl lg:text-4xl lg:leading-tight">
            Start{" "}
            <span className="bg-linear-to-r from-[#b84cff] via-[#8b5cf6] to-[#6575ff] bg-clip-text text-transparent">
              Tracking
            </span>{" "}
            Smarter Today
          </h2>

          {/* Description */}
          <p className="mt-2 text-sm text-white/60 sm:text-base">
            Turn passive watching into measurable, actionable progress.
          </p>

          {/* CTA */}
          <Link
            href="/login"
            className="group mt-5 flex h-11 items-center gap-2.5 rounded-lg bg-linear-to-r from-[#9b3fff] via-[#813cff] to-[#5c65ff] px-5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(112,55,255,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(112,55,255,0.5)]"
          >
            {/* ClickUp icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6.2 9.4L12 5l5.8 4.4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 13.2c.8 3.2 3.2 5.3 6.5 5.3s5.7-2.1 6.5-5.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>

            <span>Continue with ClickUp</span>

            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>

          {/* Trust points */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/65">
            <TrustPoint text="No credit card required" />
            <TrustPoint text="Setup in minutes" />
            <TrustPoint text="Start with your ClickUp account" />
          </div>
        </div>
      </div>
    </section>
  );
};

const TrustPoint = ({ text }: { text: string }) => {
  return (
    <div className="flex items-center gap-1.5">
      <Check size={14} strokeWidth={2} className="text-white/80" />
      <span>{text}</span>
    </div>
  );
};

export default FinalCTA;