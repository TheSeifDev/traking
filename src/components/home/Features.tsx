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

export default function Features({ showIntegration = true }: { showIntegration?: boolean }) {
  return (
    <section id="features" className="relative px-6 py-10 sm:py-14 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-[90rem]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ title, description, icon: Icon, iconClass, bullets, status }) => {
            const statusInfo = statusCopy[status];
            return (
              <article key={title} className="group flex min-h-[18rem] flex-col rounded-2xl border border-[#252652] bg-[#0a0c25]/85 p-5 text-left shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:border-violet-400/45 hover:bg-[#0d1030] hover:shadow-[0_24px_80px_rgba(79,55,220,0.16)] sm:p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/25 bg-linear-to-br from-violet-500/20 to-indigo-500/10 shadow-[0_0_28px_rgba(105,65,255,0.14)]">
                  {Icon === "clickup" ? <ClickUpIcon size={27} /> : <Icon size={26} strokeWidth={1.8} className={iconClass} />}
                </div>
                <h2 className="mt-5 text-[15px] font-semibold leading-5 text-white">{title}</h2>
                <p className="mt-2 text-xs leading-5 text-white/55">{description}</p>
                <ul className="mt-4 space-y-2 border-t border-white/7 pt-4">
                  {bullets.map((bullet) => <li key={bullet} className="flex items-start gap-2 text-[11px] leading-4 text-white/55"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-violet-300" />{bullet}</li>)}
                </ul>
                <p className={`mt-auto pt-4 text-[10px] font-medium ${statusInfo.className}`}>{statusInfo.label}</p>
              </article>
            );
          })}
        </div>
        {showIntegration && <ClickUpIntegration />}
      </div>
    </section>
  );
}
