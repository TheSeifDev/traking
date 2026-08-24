import { guardAuth } from "@/src/lib/auth/guards";
import { listSpacesForUser } from "@/src/lib/spaces/service";
import { getAccessibleOrganizations } from "@/src/lib/spaces/access";
import SpacesDirectory from "@/src/components/spaces/SpacesDirectory";

export default async function SpacesPage() {
  const user = await guardAuth();
  const [spaces, organizations] = await Promise.all([listSpacesForUser(user), getAccessibleOrganizations(user)]);
  return <SpacesDirectory spaces={spaces} organizations={organizations} role={user.role} />;
}
