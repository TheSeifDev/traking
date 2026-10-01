import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  LockKeyhole,
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
    icon: ShieldCheck,
    title: "Sovereign Authentication",
    description: "Enterprise-grade server-side sessions with cryptographic token hashing and zero third-party dependencies.",
  },
  {
    icon: LockKeyhole,
    title: "Role-Based Access Control",
    description: "Strict Owner, Admin, and Viewer access hierarchies protecting all video telemetry and analytics.",
  },
  {
    icon: Zap,
    title: "Granular Playback Intelligence",
    description: "Sub-second heatmaps, drop-off curves, and verified viewer engagement across all video sources.",
  },
  {
    icon: BarChart3,
    title: "Evidence-Based Analytics",
    description: "Review persisted viewer activity and telemetry with zero guesswork and robust data isolation.",
  },
];

export const LOGIN_STEPS: readonly LoginContentItem[] = [
  {
    icon: Users,
    title: "Owner-Provisioned Access",
    description: "Your account is created and authorized directly by your organization's TrackUp Owner.",
  },
  {
    icon: ShieldCheck,
    title: "Encrypted Credential Verification",
    description: "Passwords are verified using memory-hard Argon2id hashing with constant-time protections.",
  },
  {
    icon: BarChart3,
    title: "Connected Video Intelligence",
    description: "Seamlessly access your workspaces, manage tracking links, and inspect viewer telemetry.",
  },
];
