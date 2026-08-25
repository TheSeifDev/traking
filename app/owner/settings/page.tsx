import { redirect } from "next/navigation";

/**
 * Compatibility route: TrackUp keeps one canonical settings surface.
 * The parent /owner layout enforces the owner-only boundary before redirecting.
 */
export default function OwnerSettingsPage() {
  redirect("/settings");
}
