// Barrel: export all auth library modules from a single path
// Usage: import { requireAuth, hasPermission, guardAdmin, withPermission, changeUserRole } from "@/src/lib/auth"

export * from "./rbac";
export * from "./session";
export * from "./guards";
export * from "./api-handler";
export * from "./role-management";
// provisioning is intentionally NOT re-exported – only used by the OAuth callback route.
