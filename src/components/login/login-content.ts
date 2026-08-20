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
    title: "Secure Connection",
    description: "Your data is encrypted and never shared. We only access what&apos;s needed.",
  },
  {
    icon: Zap,
    title: "One-Click Access",
    description: "No extra accounts. No extra passwords. Just continue with your ClickUp account.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Sync",
    description: "Keep your teams, tasks, and progress synchronized in real-time.",
  },
  {
    icon: BarChart3,
    title: "Actionable Insights",
    description: "Start tracking videos and gaining insights instantly.",
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
    description: "Start tracking videos and gaining insights instantly.",
  },
];