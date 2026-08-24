"use client";

import Link from "next/link";
import { Activity, Clock3, UserRound, UsersRound } from "lucide-react";
import GroupedSessionTimeline from "@/src/components/analytics/GroupedSessionTimeline";
import type { getUser360 } from "@/src/lib/users/service";

type User360Data = NonNullable<Awaited<ReturnType<typeof getUser360>>>;

function dateLabel(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function secondsLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export default function User360Dashboard({ data, backHref }: { data: User360Data; backHref: string }) {
  return (
    <div className="min-h-full bg-[#08081f] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1200px] space-y-7">
        <header className="border-b border-white/8 pb-7">
          <Link href={backHref} className="text-xs text-violet-300 hover:text-violet-200">← Back</Link>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/70">User 360</p>
              <h1 className="mt-3 break-words text-3xl font-semibold tracking-[-0.035em] text-white">{data.profile.name || data.profile.email}</h1>
              <p className="mt-2 break-all text-sm text-white/45">{data.profile.email} · {data.profile.role}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
              <p>Status: <span className={data.profile.is_active ? "text-emerald-200" : "text-red-200"}>{data.profile.is_active ? "Active" : "Inactive"}</span></p>
              <p className="mt-1">Last active: {dateLabel(data.profile.last_seen_at)}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Watch time" value={secondsLabel(data.summary.total_watch_time_seconds)} icon={Clock3} />
          <Metric label="Videos watched" value={data.summary.videos_watched} icon={Activity} />
          <Metric label="Sessions" value={data.summary.sessions} icon={UsersRound} />
          <Metric label="Avg completion" value={data.summary.average_completion_percentage === null ? "Unavailable" : `${data.summary.average_completion_percentage}%`} icon={UserRound} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Organizations</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Organization memberships</h2>
            <div className="mt-5 space-y-3">
              {data.organizations.length === 0 ? <p className="text-sm text-white/40">No organization membership is visible in this authorized scope.</p> : data.organizations.map((organization) => (
                <div key={organization.organization_id} className="rounded-2xl border border-white/8 bg-black/10 p-3">
                  <p className="text-sm font-medium text-white">{organization.organization_name}</p>
                  <p className="mt-1 text-xs text-white/45">{organization.role} · {organization.status}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Space memberships</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Explicit Space access</h2>
            <div className="mt-5 space-y-3">
              {data.memberships.length === 0 ? <p className="text-sm text-white/40">No Space membership is visible in this authorized scope.</p> : data.memberships.map((membership) => (
                <div key={`${membership.organization_id}-${membership.space_id}`} className="rounded-2xl border border-white/8 bg-black/10 p-3">
                  <p className="text-sm font-medium text-white">{membership.space_name}</p>
                  <p className="mt-1 text-xs text-white/45">{membership.organization_name} · {membership.role} · {membership.status}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section>
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Videos watched</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Viewer-specific video intelligence</h2>
          </div>
          {data.videos.length === 0 ? <div className="rounded-3xl border border-dashed border-white/12 p-10 text-center text-sm text-white/40">No persisted video activity in this authorized scope.</div> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.videos.map((video) => (
                <article key={video.video_id} className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="break-words text-base font-semibold text-white">{video.video_title}</h3><p className="mt-1 break-all text-xs text-white/40">Organization {video.organization_id} · Space {video.space_id}</p></div>
                    <Link href={`/analytics/videos/${video.video_id}/viewers/${data.profile.id}`} className="shrink-0 text-xs text-violet-200 hover:text-violet-100">Open detail →</Link>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Detail label="Watch time" value={secondsLabel(video.total_watch_time_seconds)} />
                    <Detail label="Duration" value={secondsLabel(video.duration)} />
                    <Detail label="Sessions" value={video.sessions} />
                    <Detail label="Completion" value={video.completion_percentage === null ? "Unavailable" : `${Math.round(video.completion_percentage)}%`} />
                    <Detail label="Last position" value={video.last_position === null ? "Unavailable" : secondsLabel(video.last_position)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/7 pt-4 text-xs text-white/45"><span>Pauses {video.pauses}</span><span>Resumes {video.resumes}</span><span>Seeks {video.seeks}</span><span>Speed changes {video.speed_changes}</span><span>Speeds {video.speed_values.length > 0 ? video.speed_values.map((value) => `${value}x`).join(", ") : "Not available from provider"}</span><span>Final speed {video.final_playback_rate === null ? "Not available" : `${video.final_playback_rate}x`}</span><span>Buffering {video.buffering_events}</span><span>Visibility {video.visibility_changes}</span></div>
                  <p className="mt-4 text-xs text-white/35">Watched ranges: {video.heatmap_availability === "measured" ? `${video.watched_ranges.length} reconstructed` : video.heatmap_availability === "not_available_from_provider" ? "Not available from provider" : "Unavailable or insufficient data"} · First watched {dateLabel(video.first_watched_at)} · Last watched {dateLabel(video.last_watched_at)}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Watch history</p><h2 className="mt-2 text-xl font-semibold text-white">User → Video → Session activity</h2></div>
          {data.sessions.length === 0 ? <div className="rounded-3xl border border-dashed border-white/12 p-10 text-center text-sm text-white/40">No persisted sessions in this authorized scope.</div> : (
            <div className="space-y-4">
              {data.sessions.map((session) => (
                <article key={session.session_id} className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><h3 className="break-words text-base font-semibold text-white">{session.video_title}</h3><p className="mt-1 break-all text-xs text-white/40">Session {session.session_id} · {session.source_type}</p><p className="mt-1 text-xs text-white/40">Started {dateLabel(session.started_at)} · Last activity {dateLabel(session.last_activity_at)}</p></div>
                    <span className={`w-fit shrink-0 rounded-full border px-2 py-1 text-[10px] ${session.heatmap.available ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/45"}`}>{session.heatmap.available ? "Measured telemetry" : "Telemetry unavailable/insufficient"}</span>
                  </div>
                  <div className="mt-5 grid gap-3 min-[420px]:grid-cols-4"><Detail label="Watch time" value={secondsLabel(session.watch_time_seconds)} /><Detail label="Completion" value={session.completion_percentage === null ? "Unavailable" : `${Math.round(session.completion_percentage)}%`} /><Detail label="Last position" value={session.last_position === null ? "Unavailable" : `${Math.round(session.last_position)}s`} /><Detail label="Events" value={session.event_count} /></div>
                  <div className="mt-5 rounded-2xl border border-white/7 bg-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Grouped playback timeline</p><div className="mt-3"><GroupedSessionTimeline events={session.playback_events} /></div></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"><Icon size={17} className="text-violet-200" /><p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-white/35">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p></article>;
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p><p className="mt-1 break-words text-sm text-white/75">{value}</p></div>;
}
