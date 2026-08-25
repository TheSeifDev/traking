import { BarChart3, Bell, CheckCircle2, Cloud, Download, PlaySquare, ShieldCheck, UsersRound } from "lucide-react";
import type { ElementType } from "react";
import ClickUpIntegration, { ClickUpIcon } from "./ClickUpIntegration";

type FeatureItem = {
  title: string;
  description: string;
  icon: ElementType | "clickup";
  iconClass: string;
  bullets: string[];
  status: "available" | "limited" | "roadmap";
};

const features: FeatureItem[] = [
  {
    title: "Precise Video Tracking",
    description: "See who watched, when a session started, and the playback evidence available for each supported provider.",
    icon: PlaySquare,
    iconClass: "text-violet-300",
    bullets: ["Play, pause, seek where exposed", "Measured watch time and completion", "Session and event timelines", "No inferred playback metrics"],
    status: "available",
  },
  {
    title: "Native ClickUp Integration",
    description: "Connect TrackUp to the ClickUp workspace used by your team and keep the access relationship explicit.",
    icon: "clickup",
    iconClass: "text-white",
    bullets: ["ClickUp OAuth sign-in", "Workspace discovery", "Authorized task search", "Explicit sync state"],
    status: "available",
  },
  {
    title: "Powerful Analytics",
    description: "Review persisted workspace, video, viewer, and session records without presenting unsupported precision.",
    icon: BarChart3,
    iconClass: "text-violet-300",
    bullets: ["Viewer and session breakdowns", "Provider-aware metrics", "Coverage when evidence is sufficient", "Authorized filters and exports"],
    status: "available",
  },
  {
    title: "Secure & Private",
    description: "Server-side identity, resource scoping, and capability checks protect the current TrackUp viewing flow.",
    icon: ShieldCheck,
    iconClass: "text-blue-300",
    bullets: ["Signed HTTP-only session", "Role and membership checks", "Scoped Watch Link capability", "Sensitive values stay server-side"],
    status: "available",
  },
  {
    title: "Multi-Source Support",
    description: "Bring YouTube, Vimeo, direct media URLs, Google Drive, and Telegram into one scoped library.",
    icon: Cloud,
    iconClass: "text-blue-300",
    bullets: ["YouTube and Vimeo player adapters", "Native direct media playback", "Drive and Telegram session-only", "Capability state stays visible"],
    status: "limited",
  },
  {
    title: "Team & Permissions",
    description: "Manage Organization and Space access while keeping global owner controls distinct from scoped membership.",
    icon: UsersRound,
    iconClass: "text-violet-300",
    bullets: ["Owner, Admin, and Viewer roles", "Organization and Space memberships", "Owner-only global management", "Authorization enforced server-side"],
    status: "available",
  },
  {
    title: "Smart Notifications",
    description: "Notification workflows are not currently part of the production TrackUp surface, so the page does not imply they are active.",
    icon: Bell,
    iconClass: "text-violet-300",
    bullets: ["No fabricated alerts", "Activity remains in analytics", "Captured provider errors stay visible", "Roadmap item"],
    status: "roadmap",
  },
  {
    title: "Export & Reports",
    description: "Export authorized viewer activity where supported; scheduled reports and PDF generation are not implemented.",
    icon: Download,
    iconClass: "text-violet-300",
    bullets: ["CSV viewer activity export", "Active filters are reflected", "Scope authorization enforced", "PDF and scheduled reports unavailable"],
    status: "limited",
  },
];

const statusCopy: Record<FeatureItem["status"], { label: string; className: string }> = {
  available: { label: "Available in TrackUp", className: "text-emerald-200/75" },
  limited: { label: "Provider or scope dependent", className: "text-amber-200/75" },
  roadmap: { label: "Not implemented", className: "text-white/40" },
};

export default function Features({ showIntegration = true, compact = false }: { showIntegration?: boolean; compact?: boolean }) {
  return (
    <section id="features" className={`relative px-5 sm:px-6 lg:px-10 ${compact ? "pb-8 pt-10 sm:pb-12 sm:pt-14 lg:pb-16 lg:pt-16" : "py-10 sm:py-14 lg:py-16"}`}>
      <div className="mx-auto max-w-[90rem]">
        {compact && <div className="mx-auto mb-8 max-w-2xl text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/75">Powerful features</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl">Everything you need to <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">track, understand,</span> and improve.</h2><p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-white/45 sm:text-sm">Provider-aware tracking, ClickUp-connected access, and scoped analytics in one focused workspace.</p></div>}
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-4"}`}>
          {features.map(({ title, description, icon: Icon, iconClass, bullets, status }) => {
            const statusInfo = statusCopy[status];
            return (
              <article key={title} className={`group flex flex-col rounded-xl border border-[#252652] bg-[#0a0c25]/85 text-left shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-400/45 hover:bg-[#0d1030] hover:shadow-[0_24px_80px_rgba(79,55,220,0.16)] ${compact ? "min-h-[15.5rem] p-4" : "min-h-[18rem] p-5 sm:p-5"}`}>
                <div className={`flex items-center justify-center rounded-xl border border-violet-400/25 bg-linear-to-br from-violet-500/20 to-indigo-500/10 shadow-[0_0_28px_rgba(105,65,255,0.14)] ${compact ? "size-10" : "h-12 w-12 rounded-2xl"}`}>
                  {Icon === "clickup" ? <ClickUpIcon size={27} /> : <Icon size={26} strokeWidth={1.8} className={iconClass} />}
                </div>
                <h2 className={`${compact ? "mt-4 text-[13px]" : "mt-5 text-[15px]"} font-semibold leading-5 text-white`}>{title}</h2>
                <p className={`${compact ? "mt-2 text-[10px] leading-4" : "mt-2 text-xs leading-5"} text-white/55`}>{description}</p>
                <ul className={`${compact ? "mt-3 space-y-1.5 pt-3" : "mt-4 space-y-2 pt-4"} border-t border-white/7`}>
                  {bullets.map((bullet) => <li key={bullet} className={`flex items-start gap-2 text-white/55 ${compact ? "text-[10px] leading-3.5" : "text-[11px] leading-4"}`}><CheckCircle2 size={compact ? 11 : 13} className="mt-0.5 shrink-0 text-violet-300" />{bullet}</li>)}
                </ul>
                <p className={`mt-auto text-[10px] font-medium ${compact ? "pt-3" : "pt-4"} ${statusInfo.className}`}>{statusInfo.label}</p>
              </article>
            );
          })}
        </div>
        {showIntegration && <ClickUpIntegration />}
      </div>
    </section>
  );
}
