/**
 * /watch/[token] - Internal TrackUp viewer
 *
 * The token is resolved server-side. Invalid, expired, or revoked links are
 * not rendered, and the page stays non-indexable. Viewing requires an active
 * TrackUp session; the original viewer path is preserved through ClickUp OAuth.
 */
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveWatchLink } from "@/src/lib/tracking/service";
import { authorizeSpaceMember } from "@/src/lib/spaces/access";
import { getCurrentUser } from "@/src/lib/auth/session";
import WatchPlayer from "@/src/components/watch/WatchPlayer";
import { getProviderAdapter } from "@/src/lib/playback/providers";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const resolved = await resolveWatchLink(token);
  if (!resolved) return { title: "Video Not Found" };
  return {
    title: resolved.title,
    description: "Watch this video inside TrackUp.",
    robots: { index: false, follow: false },
  };
}

function LoginRequired({ token }: { token: string }) {
  const returnPath = `/watch/${encodeURIComponent(token)}`;
  const loginUrl = `/login?redirect=${encodeURIComponent(returnPath)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08081f] px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/9 bg-white/[0.03] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-9">
        <Image src="/logo.webp" alt="TrackUp" width={44} height={44} priority className="mx-auto h-11 w-11 object-contain" />
        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-violet-300/70">Private viewer</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in to watch this video</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">
          This TrackUp viewer requires an active ClickUp-connected account. After sign-in, you will return to this exact video.
        </p>
        <a
          href={loginUrl}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
        >
          Continue with ClickUp
        </a>
        <p className="mt-4 text-xs text-white/30">TrackUp keeps the video inside this viewer and does not redirect to the provider.</p>
      </section>
    </main>
  );
}

export default async function WatchPage({ params }: Props) {
  const { token } = await params;
  const resolved = await resolveWatchLink(token);
  if (!resolved) notFound();

  const user = await getCurrentUser();
  if (!user) return <LoginRequired token={token} />;
  if (!resolved.space_id) notFound();
  try {
    await authorizeSpaceMember(resolved.space_id, user);
  } catch {
    notFound();
  }

  const provider = getProviderAdapter(resolved.source_type);
  const sourceLabel = provider.label;
  const hasPlaybackTelemetry = provider.capabilities.detailed_tracking;

  return (
    <main className="min-h-screen bg-[#08081f] px-4 py-8 text-white sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.webp" alt="TrackUp" width={40} height={40} priority className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold tracking-wide text-white/85">TrackUp</span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Private viewer</span>
        </header>

        <section className="rounded-3xl border border-white/9 bg-white/[0.03] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs uppercase tracking-[0.18em] text-violet-300/70">Shared video</p><h1 className="mt-2 truncate text-xl font-semibold text-white sm:text-2xl">{resolved.title}</h1></div>
            <span className="w-fit rounded-full border border-violet-400/15 bg-violet-500/10 px-2.5 py-1 text-xs capitalize text-violet-200">{sourceLabel}</span>
          </div>
          <WatchPlayer watchLinkToken={token} title={resolved.title} sourceType={resolved.source_type} sourceUrl={resolved.source_url} duration={resolved.duration} />
          <div className="mt-6 flex flex-col gap-2 border-t border-white/8 pt-4 text-xs leading-5 text-white/35 sm:flex-row sm:items-center sm:justify-between"><span>{hasPlaybackTelemetry ? "Your playback session is registered securely by TrackUp after actual playback begins." : "This provider does not expose reliable playback callbacks, so TrackUp does not record fabricated sessions or playback metrics."}</span><span>{hasPlaybackTelemetry ? `${provider.label} ${provider.playback_metrics_scope.replaceAll("_", " ")} telemetry is supported when valid player events are stored.` : "Playback position, duration, watched ranges, and completion are unavailable for this provider."}</span></div>
        </section>

        <p className="mt-5 text-center text-xs text-white/25">Shared through TrackUp · This page does not send viewers to the source provider.</p>
      </div>
    </main>
  );
}
