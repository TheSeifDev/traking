import LoginBenefits from "./LoginBenefits";
import LoginCard from "./LoginCard";

type LoginHeroProps = {
  returnPath?: string;
  initialError?: string | null;
  authHref?: string; // backwards compatibility if passed
};

const LoginHero = ({ returnPath = "/dashboard", initialError = null }: LoginHeroProps) => (
  <main className="trackup-auth-page relative isolate min-h-[calc(100svh-6rem)] overflow-hidden bg-[#08081f]">
    {/* Page atmosphere */}
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="absolute left-[42%] top-24 h-125 w-125 rounded-full bg-violet-700/10 blur-[150px]" />
      <div className="absolute bottom-0 right-[7%] h-96 w-96 rounded-full bg-blue-800/6 blur-[150px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_47%,rgba(76,29,149,0.08),transparent_34%)]" />
    </div>

    <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-10 px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-20 lg:pt-28 xl:grid-cols-[minmax(0,1.22fr)_minmax(32.5rem,0.92fr)] xl:items-center xl:gap-12">
      <section className="min-w-0" aria-labelledby="trackup-login-title">
        <h1
          id="trackup-login-title"
          className="mt-6 max-w-2xl text-3xl font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-5xl xl:text-[56px]"
        >
          Sign in to{" "}
          <span className="bg-linear-to-r from-fuchsia-400 via-violet-500 to-blue-400 bg-clip-text text-transparent">
            TrackUp
          </span>
          <br />
          Video{" "}
          <span className="bg-linear-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            Intelligence
          </span>
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-6 text-white/50 sm:text-base sm:leading-7">
          TrackUp brings high-precision playback telemetry, viewer engagement curves,
          and drop-off heatmaps into an independent, sovereign analytics platform.
        </p>

        <div className="mt-6">
          <LoginBenefits />
        </div>
      </section>

      <section className="flex min-w-0 justify-center xl:justify-end" aria-label="Sign in to your TrackUp account">
        <LoginCard returnPath={returnPath} initialError={initialError} />
      </section>
    </div>
  </main>
);

export default LoginHero;
