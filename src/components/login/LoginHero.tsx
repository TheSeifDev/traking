import IntegrationVisual from "./IntegrationVisual";
import LoginBenefits from "./LoginBenefits";
import LoginCard from "./LoginCard";

type LoginHeroProps = {
  authHref?: string;
};

const LoginHero = ({ authHref = "/api/auth/clickup" }: LoginHeroProps) => (
  <main className="trackup-auth-page relative isolate min-h-[calc(100svh-6rem)] overflow-hidden bg-[#08081f]">
    {/* Page atmosphere */}
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="absolute left-[42%] top-24 h-125 w-125 rounded-full bg-violet-700/10 blur-[150px]" />
      <div className="absolute bottom-0 right-[7%] h-96 w-96 rounded-full bg-blue-800/6 blur-[150px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_47%,rgba(76,29,149,0.08),transparent_34%)]" />
    </div>

    {/* تم إضافة xl:items-center لجعل المحتوى في المنتصف عمودياً */}
    <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-10 px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-20 lg:pt-28 xl:grid-cols-[minmax(0,1.22fr)_minmax(32.5rem,0.92fr)] xl:items-center xl:gap-12">
      <section className="min-w-0" aria-labelledby="clickup-login-title">

        <h1
          id="clickup-login-title"
          className="mt-6 max-w-2xl text-3xl font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-5xl xl:text-[56px]"
        >
          Connect with{" "}
          <span className="bg-linear-to-r from-fuchsia-400 via-violet-500 to-blue-400 bg-clip-text text-transparent">
            ClickUp
          </span>
          <br />
          to{" "}
          <span className="bg-linear-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            Get Started
          </span>
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-6 text-white/50 sm:text-base sm:leading-7">
          TrackUp works hand-in-hand with ClickUp to bring all your video tracking
          and team insights into one connected workspace.
        </p>

        <div className="mt-6 grid items-start gap-5 md:grid-cols-[18rem_minmax(0,1fr)]">
          <LoginBenefits />

          <div className="hidden min-w-0 md:block">
            <IntegrationVisual />
          </div>
        </div>
      </section>

      {/* تم تعديل هذا السطر لجعل الكرت يلتصق باليمين ويمركز */}
      <section className="flex min-w-0 justify-center xl:justify-end" aria-label="Connect your ClickUp account">
        <LoginCard authHref={authHref} />
      </section>
    </div>
  </main>
);

export default LoginHero;
