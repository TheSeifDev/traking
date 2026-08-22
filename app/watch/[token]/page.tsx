/**
 * /watch/[token] - Public internal TrackUp viewer
 *
 * The token is resolved server-side. Invalid, expired, or revoked links are
 * not rendered, and the page stays non-indexable.
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
    description: "Watch this video inside TrackUp.",
    robots: { index: false, follow: false },
  };
}

export default async function WatchPage({ params }: Props) {
  const { token } = await params;
  const resolved = await resolveWatchLink(token);
  if (!resolved) notFound();

  const sourceLabel = resolved.source_type.replace("_", " ");
  const isDirectUrl = resolved.source_type === "direct_url";

  return (
    <main className="min-h-screen bg-[#070720] px-4 py-8 text-white sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500"><span className="text-xs font-bold">T</span></div>
            <span className="text-sm font-semibold tracking-wide text-white/85">TrackUp</span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Private viewer</span>
        </header>

        <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 shadow-2xl shadow-black/20 sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs uppercase tracking-[0.18em] text-violet-300/70">Shared video</p><h1 className="mt-2 truncate text-xl font-semibold text-white sm:text-2xl">{resolved.title}</h1></div>
            <span className="w-fit rounded-full border border-violet-400/15 bg-violet-500/10 px-2.5 py-1 text-xs capitalize text-violet-200">{sourceLabel}</span>
          </div>
          <WatchPlayer watchLinkToken={token} title={resolved.title} sourceType={resolved.source_type} sourceUrl={resolved.source_url} duration={resolved.duration} />
          <div className="mt-6 flex flex-col gap-2 border-t border-white/8 pt-4 text-xs leading-5 text-white/35 sm:flex-row sm:items-center sm:justify-between"><span>Your viewing session is registered securely by TrackUp.</span><span>{isDirectUrl ? "Playback metrics are available for this source." : "Playback metrics are limited for this source."}</span></div>
        </section>

        <p className="mt-5 text-center text-xs text-white/25">Shared through TrackUp · This page does not send viewers to the source provider.</p>
      </div>
    </main>
  );
}
