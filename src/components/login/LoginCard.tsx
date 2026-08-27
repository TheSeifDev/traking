import { ChevronRight, LockKeyhole, Settings } from "lucide-react";
import ClickUpLogo from "./ClickUpLogo";
import { LOGIN_STEPS } from "./login-content";

type LoginCardProps = {
  /** OAuth route that starts the ClickUp authorization flow. */
  authHref?: string;
};

const LoginCard = ({ authHref = "/api/auth/clickup" }: LoginCardProps) => (
  <div className="relative isolate w-full max-w-md overflow-hidden rounded-3xl border border-white/9 bg-white/[0.03] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] ring-1 ring-violet-300/10 backdrop-blur-2xl sm:px-7 sm:py-8 xl:px-8 xl:py-9">
    {/* Card depth and ambient glow */}
    <div className="pointer-events-none absolute inset-1 rounded-[22px] border border-white/5" />
    <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-violet-600/15 blur-[80px]" />
    <div className="pointer-events-none absolute -bottom-24 left-12 h-40 w-72 rounded-full bg-blue-700/8 blur-[85px]" />

    <div className="relative z-10">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/75">
        <Settings aria-hidden="true" className="size-4" strokeWidth={2.4} />
        <span>Step 1 of 2</span>
      </p>

      <h2 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        Continue with ClickUp
      </h2>

      <p className="mt-2 max-w-md text-xs leading-6 text-white/45 sm:text-sm">
        You&apos;ll be redirected to ClickUp to securely sign in and authorize TrackUp.
      </p>

      {/* A normal anchor is intentional: OAuth should perform a full navigation,
          not be prefetched as an in-app page. */}
      <a
        href={authHref}
        className="group relative mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-violet-500 px-6 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(124,58,237,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-violet-400 hover:shadow-[0_14px_50px_rgba(105,45,255,0.42)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 motion-reduce:transform-none motion-reduce:transition-none"
      >
        <ClickUpLogo gradientId="login-cta-clickup" className="size-6 shrink-0" />
        <span>Continue with ClickUp</span>
        <ChevronRight
          aria-hidden="true"
          className="absolute right-4 size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
          strokeWidth={2.2}
        />
      </a>

      <div className="my-7 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
          What happens next?
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <ol className="space-y-5">
        {LOGIN_STEPS.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/2.5 text-violet-200 shadow-[inset_0_0_18px_rgba(139,92,246,0.05)]">
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </span>

            <span className="pt-1">
              <span className="block text-xs font-semibold text-white">{title}</span>
              <span className="mt-1 block text-xs leading-5 text-white/55">{description}</span>
            </span>
          </li>
        ))}
      </ol>

      <aside className="mt-6 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/3 text-white/80">
          <LockKeyhole aria-hidden="true" className="size-4" strokeWidth={1.9} />
        </span>

        <span>
          <span className="block text-xs font-semibold text-violet-400">
            We never store your ClickUp password.
          </span>
          <span className="mt-1 block text-xs leading-5 text-white/55">
            TrackUp uses OAuth 2.0 for secure authentication.
          </span>
        </span>
      </aside>
    </div>
  </div>
);

export default LoginCard;
