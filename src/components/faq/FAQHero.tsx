const FAQHero = () => {
  return (
    <section className="relative px-6 pt-16 pb-10 lg:pt-20">
      <div className="mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mx-auto inline-flex items-center rounded-full border border-[#5a46b9] bg-[#16133d]/70 px-4 py-1.5 text-xs font-medium text-white/80 shadow-[0_0_20px_rgba(91,64,255,0.12)]">
          FAQ
        </div>

        {/* Heading */}
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-[48px]">
          Frequently{" "}
          <span className="bg-linear-to-r from-[#bd4cff] via-[#8b5cf6] to-[#5f8dff] bg-clip-text text-transparent">
            Asked Questions
          </span>
        </h1>

        {/* Description */}
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
          Everything you need to know about TrackUp.
          <br />
          Can&apos;t find the answer you&apos;re looking for? We&apos;re here to help.
        </p>
      </div>
    </section>
  );
};

export default FAQHero;