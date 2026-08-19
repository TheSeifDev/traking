const IntegrationsHero = () => {
  return (
    <section className="relative px-6 pb-16 pt-24 md:px-10 md:pb-20 md:pt-28">
      <div className="pointer-events-none absolute left-1/2 top-0 h-112.5 w-200 -translate-x-1/2 rounded-full bg-[#5424ff]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="inline-flex rounded-full border border-[#713cff]/30 bg-[#5424ff]/10 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#a77aff]">
          Integrations
        </span>

        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Connect. Sync. Track.
          <br />
          <span className="bg-linear-to-r from-[#c24cff] via-[#8b5cff] to-[#4ca6ff] bg-clip-text text-transparent">
            All in one place.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/60 md:text-base">
          TrackUp integrates seamlessly with the tools your team already uses.
          Centralize your videos, tasks, and insights without switching
          platforms.
        </p>
      </div>
    </section>
  );
};

export default IntegrationsHero;