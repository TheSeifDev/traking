/**
 * /videos - Video management page
 */
import { guardAuth } from "@/src/lib/auth/guards";
import VideoList from "@/src/components/dashboard/VideoList";

export default async function VideosPage() {
  const user = await guardAuth();
  return <VideoList role={user.role} />;
}
