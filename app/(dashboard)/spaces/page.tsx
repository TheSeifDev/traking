import { guardAuth } from "@/src/lib/auth/guards";
import { listSpacesForUser } from "@/src/lib/spaces/service";
import SpacesDirectory from "@/src/components/spaces/SpacesDirectory";

export default async function SpacesPage() {
  const user = await guardAuth();
  const spaces = await listSpacesForUser(user);
  return <SpacesDirectory spaces={spaces} role={user.role} />;
}
