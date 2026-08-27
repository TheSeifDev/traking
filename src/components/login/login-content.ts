import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

export type LoginContentItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const LOGIN_BENEFITS: readonly LoginContentItem[] = [
  {
    icon: LockKeyhole,
    title: "Scoped access",
    description: "TrackUp uses ClickUp OAuth and checks access on protected requests for your authorized workspace context.",
  },
  {
    icon: Zap,
    title: "One-Click Access",
    description: "No extra accounts. No extra passwords. Just continue with your ClickUp account.",
  },
  {
    icon: RefreshCw,
    title: "Connected workspace",
    description: "Load your authorized ClickUp workspace and member context inside TrackUp.",
  },
  {
    icon: BarChart3,
    title: "Evidence-based analytics",
    description: "Review persisted viewer activity and provider-backed metrics when reliable telemetry is available.",
  },
];

export const LOGIN_STEPS: readonly LoginContentItem[] = [
  {
    icon: ShieldCheck,
    title: "You&apos;ll be redirected to ClickUp",
    description: "Sign in to your ClickUp account and authorize TrackUp.",
  },
  {
    icon: Users,
    title: "We&apos;ll fetch your workspace info",
    description: "We&apos;ll securely import your user and workspace data.",
  },
  {
    icon: BarChart3,
    title: "You&apos;re all set!",
    description: "Open TrackUp and review persisted viewing activity with provider-aware measurement.",
  },
];
