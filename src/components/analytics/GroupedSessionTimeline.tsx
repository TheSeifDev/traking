"use client";

import { useMemo, useState } from "react";
import type { WatchEventSummary } from "@/src/types/video";

const HEARTBEAT = "heartbeat";

export type TimelineItem =
  | { kind: "event"; event: WatchEventSummary }
  | { kind: "progress"; events: WatchEventSummary[] };

function position(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const safe = Math.max(0, Math.round(value));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function absolute(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function description(event: WatchEventSummary): string {
  switch (event.event_type) {
    case "play": return "Started playback";
    case "resume": return `Resumed from ${position(event.position)}`;
    case "pause": return `Paused at ${position(event.position)}`;
    case "seek": return `Moved from ${position(event.from_position)} to ${position(event.position)}`;
    case "complete": return "Reached the recorded end of the video";
    case "ended": return "Playback ended or the viewer left";
    case "buffer": return event.metadata?.state === "end" ? "Buffering ended" : "Buffering started";
    case "rate_change": return `${event.from_rate ?? "?"}x → ${event.to_rate ?? event.playback_rate ?? "?"}x`;
    case "visibility_change": return event.metadata?.state === "hidden" ? "Viewer left the tab" : "Viewer returned to the tab";
    case "heartbeat": return `Playback progress at ${position(event.position)}`;
  }
}

function label(event: WatchEventSummary): string {
  return event.event_type === "rate_change" ? "Speed" : event.event_type.replace("_", " ");
}

export function groupTimelineItems(events: WatchEventSummary[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let heartbeatGroup: WatchEventSummary[] = [];
  const flush = () => {
    if (heartbeatGroup.length > 0) items.push({ kind: "progress", events: heartbeatGroup });
    heartbeatGroup = [];
  };
  for (const event of events) {
    if (event.event_type === HEARTBEAT) heartbeatGroup.push(event);
    else {
      flush();
      items.push({ kind: "event", event });
    }
  }
  flush();
  return items;
}

function RawEventList({ events }: { events: WatchEventSummary[] }) {
  return <div className="mt-3 space-y-1.5 border-t border-white/7 pt-3">{events.map((event) => <div key={event.id} className="rounded-lg border border-white/7 bg-black/10 px-3 py-2 text-[10px] text-white/50"><div className="flex flex-wrap gap-x-3 gap-y-1"><span className="font-medium capitalize text-white/80">{label(event)}</span><span>position {position(event.position)}</span>{event.from_position !== null && <span>from {position(event.from_position)}</span>}{event.duration !== null && <span>duration {position(event.duration)}</span>}{event.playback_rate !== null && event.playback_rate !== undefined && <span>rate {event.playback_rate}x</span>}</div><div className="mt-1 text-[10px] text-white/30">Occurred: {absolute(event.occurred_at)} · Received: {absolute(event.received_at)}</div></div>)}</div>;
}

function TimelineEvent({ event }: { event: WatchEventSummary }) {
  const occurred = event.occurred_at ?? event.created_at;
  return <div className="rounded-xl border border-white/7 bg-black/10 px-3 py-3"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-violet-400/10 px-2 py-1 text-[10px] font-semibold capitalize text-violet-200">{label(event)}</span><span className="text-[10px] text-white/35">{position(event.position)}</span></div><p className="mt-2 text-xs font-medium capitalize text-white/85">{description(event)}</p></div><div className="shrink-0 text-[10px] text-white/35 sm:text-right"><p>{absolute(occurred)}</p><p className="mt-1">Received {absolute(event.received_at)}</p></div></div></div>;
}

export default function GroupedSessionTimeline({ events }: { events: WatchEventSummary[] }) {
  const [showRaw, setShowRaw] = useState(false);
  const items = useMemo(() => groupTimelineItems(events), [events]);
  const primaryCount = items.filter((item) => item.kind === "event").length;
  return <div className="space-y-2">{events.length === 0 ? <p className="text-xs text-white/35">No events were stored for this session.</p> : <><div className="flex items-center justify-between gap-3"><p className="text-[10px] text-white/35">{primaryCount} meaningful event{primaryCount === 1 ? "" : "s"} · {events.length} persisted samples</p><button type="button" onClick={() => setShowRaw((value) => !value)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-violet-200/80 transition hover:border-violet-300/30 hover:text-violet-100">{showRaw ? "Hide raw events" : "View raw event data"}</button></div><div className="space-y-2">{items.map((item) => item.kind === "event" ? <TimelineEvent key={item.event.id} event={item.event} /> : <ProgressGroup key={item.events[0]?.id} events={item.events} showRaw={showRaw} />)}</div></>}</div>;
}

function ProgressGroup({ events, showRaw }: { events: WatchEventSummary[]; showRaw: boolean }) {
  const first = events[0];
  const last = events[events.length - 1];
  if (!first || !last) return null;
  return <div className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.04] px-3 py-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold text-cyan-200">Playback Progress</span><span className="text-[10px] text-white/35">{position(first.position)} → {position(last.position)}</span></div><p className="mt-2 text-xs text-white/65">{events.length} progress sample{events.length === 1 ? "" : "s"}</p></div><div className="text-[10px] text-white/35 sm:text-right"><p>{absolute(first.occurred_at ?? first.created_at)}</p><p className="mt-1">Last received {absolute(last.received_at)}</p></div></div>{showRaw && <RawEventList events={events} />}</div>;
}
