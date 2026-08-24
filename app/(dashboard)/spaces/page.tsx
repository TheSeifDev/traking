import { guardAuth } from "@/src/lib/auth/guards";
import { resolveActiveSpaceForUser } from "@/src/lib/spaces/active-space";
import SpacesDirectory from "@/src/components/spaces/SpacesDirectory";

export default async function SpacesPage() {
  const user = await guardAuth();
  const resolution = await resolveActiveSpaceForUser(user);
  return <SpacesDirectory spaces={resolution.spaces} organizations={resolution.organizations} role={user.role} activeSpaceId={resolution.space?.id ?? null} />;
}
