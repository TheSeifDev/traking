import type { HTMLAttributes, ReactNode } from "react";

function join(className: string | undefined, base: string): string {
  return className ? `${base} ${className}` : base;
}

export const trackupStyles = {
  primaryButton: "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(124,58,237,0.28)] transition hover:bg-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
  secondaryButton: "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
  field: "rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-300/50 focus:ring-2 focus:ring-violet-300/10",
  select: "min-h-10 rounded-xl border border-white/10 bg-[#0b0b28] px-3 py-2 text-xs text-white/70 outline-none focus:border-violet-300/50 focus:ring-2 focus:ring-violet-300/10",
  tab: "rounded-xl px-3 py-2 text-sm transition hover:bg-white/5 hover:text-white",
  tabActive: "bg-white/10 text-white",
  tabInactive: "text-white/45",
} as const;

export function TrackUpPageShell({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={join(className, "min-h-full bg-[#08081f] px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-7")} {...props}>{children}</div>;
}

export function TrackUpContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={join(className, "mx-auto w-full max-w-[1440px] space-y-8")} {...props}>{children}</div>;
}

export function TrackUpSurface({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={join(className, "rounded-3xl border border-white/9 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-6")} {...props}>{children}</section>;
}

export function TrackUpPanel({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={join(className, "rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:p-5")} {...props}>{children}</article>;
}

export function TrackUpPageHeader({ eyebrow, title, description, action, className }: { eyebrow: string; title: string; description?: string; action?: ReactNode; className?: string }) {
  return <header className={join(className, "flex flex-col gap-5 border-b border-white/8 pb-7 lg:flex-row lg:items-end lg:justify-between")}><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/70">{eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">{description}</p>}</div>{action && <div className="flex flex-wrap gap-2">{action}</div>}</header>;
}

export function TrackUpSectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">{eyebrow}</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2></div>{action}</div>;
}

export function TrackUpKpi({ icon, label, value, note, tone = "violet", className }: { icon?: ReactNode; label: string; value: ReactNode; note?: string; tone?: "violet" | "blue" | "cyan" | "emerald" | "amber"; className?: string }) {
  const toneClasses = { violet: "bg-violet-400/12 text-violet-200", blue: "bg-blue-400/12 text-blue-200", cyan: "bg-cyan-400/12 text-cyan-200", emerald: "bg-emerald-400/12 text-emerald-200", amber: "bg-amber-400/12 text-amber-200" } as const;
  return <article className={join(className, "min-w-0")}><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{icon}</div><p className="mt-4 truncate text-2xl font-semibold tracking-[-0.035em] text-white">{value}</p><p className="mt-1 text-xs font-medium text-white/65">{label}</p>{note && <p className="mt-1 truncate text-[10px] text-white/30">{note}</p>}</article>;
}

export function TrackUpState({ icon, title, body, action, tone = "empty", className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; tone?: "empty" | "error" | "unavailable"; className?: string }) {
  const toneClass = tone === "error" ? "border-red-300/20 bg-red-400/[0.06]" : tone === "unavailable" ? "border-amber-300/20 bg-amber-400/[0.05]" : "border-dashed border-white/10 bg-white/[0.018]";
  return <div className={join(className, `flex min-h-44 flex-col items-center justify-center rounded-2xl border px-6 py-8 text-center ${toneClass}`)}>{icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/30">{icon}</div>}<h3 className="mt-4 text-sm font-semibold text-white/80">{title}</h3>{body && <p className="mt-2 max-w-sm text-xs leading-5 text-white/38">{body}</p>}{action}</div>;
}
