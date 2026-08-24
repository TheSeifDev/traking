import { notFound } from "next/navigation";
import { guardOwner } from "@/src/lib/auth/guards";
import { getUser360 } from "@/src/lib/users/service";
import User360Dashboard from "@/src/components/users/User360Dashboard";

type PageProps = { params: Promise<{ userId: string }> };

export default async function OwnerUserPage({ params }: PageProps) {
  const user = await guardOwner();
  const { userId } = await params;
  let data;
  try {
    data = await getUser360(userId, { kind: "owner" }, user);
  } catch {
    notFound();
  }
  if (!data) notFound();
  return <User360Dashboard data={data} backHref="/owner" />;
}
