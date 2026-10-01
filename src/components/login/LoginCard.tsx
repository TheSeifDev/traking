import { LockKeyhole, ShieldCheck } from "lucide-react";
import LoginForm from "./LoginForm";
import { LOGIN_STEPS } from "./login-content";

type LoginCardProps = {
  returnPath?: string;
  initialError?: string | null;
};

const LoginCard = ({ returnPath = "/dashboard", initialError = null }: LoginCardProps) => (
  <div className="relative isolate w-full max-w-md overflow-hidden rounded-3xl border border-white/9 bg-white/[0.03] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] ring-1 ring-violet-300/10 backdrop-blur-2xl sm:px-7 sm:py-8 xl:px-8 xl:py-9">
    {/* Card depth and ambient glow */}
    <div className="pointer-events-none absolute inset-1 rounded-[22px] border border-white/5" />
    <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-violet-600/15 blur-[80px]" />
    <div className="pointer-events-none absolute -bottom-24 left-12 h-40 w-72 rounded-full bg-blue-700/8 blur-[85px]" />

    <div className="relative z-10">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/75">
        <ShieldCheck aria-hidden="true" className="size-4 text-violet-400" strokeWidth={2.4} />
        <span>Secure Sign In</span>
      </p>

      <h2 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        Sign in to TrackUp
      </h2>

      <p className="mt-2 max-w-md text-xs leading-6 text-white/45 sm:text-sm">
        Enter your credentials to securely access your video workspaces and analytics.
      </p>

      {/* Interactive Credentials Form */}
      <LoginForm returnPath={returnPath} initialError={initialError} />

      <div className="my-6 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
          Platform Security
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <ol className="space-y-4">
        {LOGIN_STEPS.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/2.5 text-violet-200 shadow-[inset_0_0_18px_rgba(139,92,246,0.05)]">
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </span>

            <span className="pt-0.5">
              <span className="block text-xs font-semibold text-white">{title}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-white/50">{description}</span>
            </span>
          </li>
        ))}
      </ol>

      <aside className="mt-6 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/3 text-white/80">
          <LockKeyhole aria-hidden="true" className="size-3.5 text-violet-400" strokeWidth={1.9} />
        </span>

        <span>
          <span className="block text-xs font-semibold text-violet-300">
            Memory-Hard Session Protection
          </span>
          <span className="mt-0.5 block text-[11px] leading-4 text-white/45">
            Passwords are verified via Argon2id. Sessions are token-hashed and never stored in localStorage.
          </span>
        </span>
      </aside>
    </div>
  </div>
);

export default LoginCard;
