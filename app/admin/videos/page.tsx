import { redirect } from "next/navigation";

/**
 * Compatibility route: Videos has one canonical dashboard library.
 * The parent /admin layout still enforces authenticated admin/owner access.
 */
export default function AdminVideosPage() {
  redirect("/videos");
}
