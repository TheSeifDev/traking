import Link from "next/link";

const IntegrationsCTA = () => {
  return (
    <section className="px-6 pb-16 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 rounded-xl border border-[#7040ff]/30 bg-linear-to-r from-[#0b1030] via-[#17104a] to-[#0b1030] px-7 py-6 md:flex-row">
        <div>
          <h2 className="text-base font-semibold">Ready to connect your tools?</h2>
          <p className="mt-2 text-xs text-white/50">
            Join hundreds of teams that use TrackUp to track video engagement
            inside their favorite tools.
          </p>
        </div>

        <Link
          href="/login"
          className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-linear-to-r from-[#8b3dff] to-[#5d4cff] px-6 text-xs font-semibold shadow-[0_8px_25px_rgba(105,65,255,0.3)] transition hover:-translate-y-px"
        >
          Continue with ClickUp
        </Link>
      </div>
    </section>
  );
};

export default IntegrationsCTA;