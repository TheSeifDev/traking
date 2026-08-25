import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle, Play, Eye, CheckCircle2 } from "lucide-react";

const heroFeatures = [
  "Scoped Viewer Links",
  "ClickUp Integration",
  "Provider-Aware Analytics",
];

const Hero = () => {
  return (
    <section className="relative overflow-hidden">
      {/* ================= AMBIENT BACKGROUND ================= */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* subtle grid texture, faded toward the edges */}
        <div className="absolute inset-0 opacity-40 mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent_100%)] bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[56px_56px]" />
        
        {/* glow behind the copy */}
        <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-[#6d3cff]/25 blur-[140px]" />
        
        {/* glow behind the product image */}
        <div className="absolute right-0 top-1/3 h-140 w-140 -translate-y-1/2 rounded-full bg-[#3c6cff]/20 blur-[150px]" />
      </div>

      <style>{`
        @keyframes trackup-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes trackup-float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(8px); }
        }
      `}</style>

      {/* تعديل: min-h-screen وإضافة padding-top حتى يظهر المحتوى تحت الناف بار مباشرة */}
      <div className="mx-auto grid min-h-screen w-full max-w-360 grid-cols-1 items-center gap-12 px-6 pb-16 pt-24 md:px-10 lg:grid-cols-[1fr_1.15fr] lg:gap-8 lg:px-12 lg:pb-20 lg:pt-28">

        {/* ================= LEFT SIDE ================= */}
        <div className="relative z-10 max-w-175">
          {/* Heading */}
          <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl lg:text-[64px] xl:text-[72px]">
            Turn Videos Into{" "}
            <span className="block bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">
              Actionable Insights
            </span>
          </h1>

          {/* Description */}
          <p className="mt-7 max-w-162.5 text-base leading-7 text-white/65 sm:text-lg">
            Track real viewing sessions with ClickUp-connected access and
            provider-aware playback evidence, while unsupported metrics stay
            explicitly unavailable.
          </p>

          {/* Features */}
          <div className="mt-8 flex flex-wrap gap-3">
            {heroFeatures.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/3 px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/6"
              >
                <CheckCircle size={16} strokeWidth={2} className="text-[#8f7bff]" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="mt-9 flex flex-wrap items-center gap-4">

            {/* Primary CTA */}
            <Link
              href="/login"
              className="group relative flex h-12 items-center gap-3 overflow-hidden rounded-xl bg-linear-to-r from-[#963cff] to-[#6258ff] px-6 text-sm font-semibold text-white shadow-[0_10px_35px_rgba(110,60,255,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(110,60,255,0.5)]"
            >
              {/* hover sheen */}
              <span className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              {/* ClickUp icon */}
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="relative">
                <path
                  d="M6.2 9.4L12 5l5.8 4.4"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5.5 13.2c.8 3.2 3.2 5.3 6.5 5.3s5.7-2.1 6.5-5.3"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <span className="relative">Continue with ClickUp</span>

              <ArrowRight size={18} className="relative transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            {/* Secondary CTA */}
            <Link
              href="#how-it-works"
              className="flex h-12 items-center gap-3 rounded-xl border border-white/15 bg-white/2 px-6 text-sm font-medium text-white backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/6"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30">
                <Play size={11} fill="currentColor" strokeWidth={0} />
              </span>
              <span>See How It Works</span>
            </Link>
          </div>

          {/* Login Note */}
          <p className="mt-4 text-xs text-white/40 sm:text-sm">
            Login with your ClickUp account — no separate register needed.
          </p>
        </div>

        {/* ================= RIGHT SIDE ================= */}
        <div className="relative flex items-center justify-center lg:justify-end">

          {/* Hero Image — bled past the grid column so it reads bigger and more immersive */}
          <div className="relative z-10 w-full lg:w-[125%] lg:-mr-16 xl:-mr-28">
            <div className="relative transform-[perspective(1600px)_rotateY(-6deg)_rotateX(2deg)] transition-transform duration-700 ease-out hover:transform-[perspective(1600px)_rotateY(0deg)_rotateX(0deg)]">
              <Image
                src="/hero_img.webp"
                alt="TrackUp dashboard"
                width={1400}
                height={933}
                priority
                className="h-auto w-full rounded-2xl object-contain drop-shadow-[0_35px_90px_rgba(80,50,255,0.35)]"
              />

              {/* Floating stat chip — top left */}
              <div
                className="absolute -left-4 top-8 hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/7 px-4 py-3 shadow-2xl backdrop-blur-md sm:flex"
                style={{ animation: "trackup-float 6s ease-in-out infinite" }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8065ff]/20">
                  <Eye size={16} className="text-[#a68bff]" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">Illustrative preview</p>
                  <p className="text-xs text-white/50">not live telemetry</p>
                </div>
              </div>

              {/* Floating stat chip — bottom right */}
              <div
                className="absolute -right-4 bottom-10 hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/7 px-4 py-3 shadow-2xl backdrop-blur-md sm:flex"
                style={{ animation: "trackup-float-slow 7s ease-in-out infinite" }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">Provider-aware</p>
                  <p className="text-xs text-white/50">capability state visible</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;