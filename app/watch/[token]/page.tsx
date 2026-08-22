/**
 * /watch/[token] - Public watch page
 *
 * Server component: resolves the token server-side, returns 404 for invalid/expired.
 * Passes video metadata to the client WatchPlayer component.
 * Never exposes DB IDs other than the session_id (UUID) needed by the tracking API.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveWatchLink } from "@/src/lib/tracking/service";
import WatchPlayer from "@/src/components/watch/WatchPlayer";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const resolved = await resolveWatchLink(token);
  if (!resolved) return { title: "Video Not Found | TrackUp" };
  return {
    title: `${resolved.title} | TrackUp`,
    description: "Watch this video powered by TrackUp.",
    robots: { index: false, follow: false },
  };
}

export default async function WatchPage({ params }: Props) {
  const { token } = await params;
  const resolved = await resolveWatchLink(token);
  if (!resolved) notFound();

  return (
    <div className="min-h-screen bg-[#070720] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-white text-xl font-semibold mb-4 truncate">{resolved.title}</h1>
        <WatchPlayer
          watchLinkToken={token}
          title={resolved.title}
          sourceType={resolved.source_type}
          sourceUrl={resolved.source_url}
          duration={resolved.duration}
        />
        <p className="mt-4 text-xs text-white/30 text-center">
          Powered by TrackUp — video analytics platform
        </p>
      </div>
    </div>
  );
}