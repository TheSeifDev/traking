import { Cloud, Plus, Play } from "lucide-react";

const UpcomingIntegrations = () => {
  return (
    <section className="px-6 pb-20 md:px-10">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#7040ff]/25 bg-[#090d24] px-6 py-8 md:px-8">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[#5125d6]/10 blur-[80px]" />

        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-base font-semibold">
              More integrations coming soon ✧
            </h2>

            <p className="mt-3 max-w-md text-xs leading-6 text-white/50">
              We&apos;re constantly working to bring more powerful integrations to
              help you track, analyze, and grow.
            </p>

            <h3 className="mt-5 text-xs font-semibold">
              Upcoming integrations:
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {["Dropbox", "OneDrive", "AWS S3", "+ More"].map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-white/9 bg-white/2 px-3 py-1.5 text-[10px] text-white/60"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Orbital visual */}
          <div className="relative mx-auto flex h-48 w-80 items-center justify-center">
            <div className="absolute h-40 w-40 rounded-full border border-[#713cff]/20" />
            <div className="absolute h-28 w-28 rounded-full border border-[#713cff]/25" />
            <div className="absolute h-20 w-20 rounded-full border border-[#713cff]/30" />

            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[#874dff]/50 bg-[#5523b8]/20 shadow-[0_0_35px_rgba(110,50,255,0.4)]">
              <Play size={23} className="text-[#a466ff]" />
            </div>

            <div className="absolute right-8 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
              <Cloud size={18} className="text-blue-400" />
            </div>

            <div className="absolute left-8 top-14 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-xs">
              aws
            </div>

            <div className="absolute bottom-5 right-16 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Plus size={18} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UpcomingIntegrations;