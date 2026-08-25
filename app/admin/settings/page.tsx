import { redirect } from "next/navigation";

/**
 * Compatibility route: Settings has one canonical dashboard surface.
 * The parent /admin layout still enforces authenticated admin/owner access.
 */
export default function AdminSettingsPage() {
  redirect("/settings");
}
