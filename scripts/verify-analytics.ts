import assert from "node:assert/strict";
import { buildPlaybackHeatmap, mergeWatchedRanges, reconstructWatchedRanges } from "../src/lib/analytics/ranges";
import type { WatchEventSummary } from "../src/types/video";
import { groupTimelineItems } from "../src/components/analytics/GroupedSessionTimeline";
import { hasReliablePlaybackTelemetry, isReliablePlaybackEvent } from "../src/lib/videos/service";
import { deriveTrustedSessionMetrics } from "../src/lib/tracking/service";
import { getProviderAdapter, providerSupportsDetailedTelemetry } from "../src/lib/playback/providers";
import { UniversalTrackingEngine } from "../src/lib/playback/tracking-engine";

let checks = 0;

function equal<T>(actual: T, expected: T): void {
  checks += 1;
  assert.equal(actual, expected);
}

function deepEqual<T>(actual: T, expected: T): void {
  checks += 1;
  assert.deepEqual(actual, expected);
}

function event(
  id: string,
  event_type: WatchEventSummary["event_type"],
  position: number,
  sequence_number: number,
  from_position: number | null = null,
): WatchEventSummary {
  const occurredAt = new Date(sequence_number * 1000).toISOString();
  return {
    id,
    event_type,
    position,
    from_position,
    duration: 120,
    created_at: occurredAt,
    sequence_number,
    occurred_at: occurredAt,
  };
}

const realisticPlayback: WatchEventSummary[] = [
  event("play", "play", 0, 1),
  event("heartbeat-20", "heartbeat", 20, 2),
  event("pause-20", "pause", 20, 3),
  event("resume-20", "resume", 20, 4),
  event("heartbeat-45", "heartbeat", 45, 5),
  event("seek-90", "seek", 90, 6, 45),
  event("heartbeat-110", "heartbeat", 110, 7),
  event("pause-110", "pause", 110, 8),
];

const reconstructed = reconstructWatchedRanges(realisticPlayback, 120);
equal(reconstructed.reliable, true);
deepEqual(reconstructed.ranges, [{ start: 0, end: 45 }, { start: 90, end: 110 }]);
equal(reconstructed.ranges.reduce((sum, range) => sum + range.end - range.start, 0), 65);
equal(reconstructed.ranges.some((range) => range.start < 90 && range.end > 45), false);

const measured = buildPlaybackHeatmap(realisticPlayback, 120, true);
equal(measured.available, true);
equal(measured.availability, "measured");
equal(measured.buckets.reduce((sum, bucket) => sum + bucket.watched_seconds, 0), 65);

deepEqual(
  mergeWatchedRanges([{ start: 0, end: 20 }, { start: 10, end: 30 }], 60),
  [{ start: 0, end: 30 }],
);
deepEqual(
  mergeWatchedRanges([{ start: 0, end: 20 }, { start: 20.4, end: 30 }], 60),
  [{ start: 0, end: 30 }],
);

deepEqual(
  reconstructWatchedRanges([event("play", "play", 0, 1), event("pause", "pause", 5, 2)], 60),
  { ranges: [{ start: 0, end: 5 }], reliable: true },
);
const unordered = buildPlaybackHeatmap(
  [event("play", "play", 0, 1), { ...event("pause", "pause", 5, 2), sequence_number: null, occurred_at: null }],
  60,
  true,
);
equal(unordered.available, false);
equal(unordered.availability, "insufficient_data");

const unsupported = buildPlaybackHeatmap(realisticPlayback, 120, false);
equal(unsupported.available, false);
equal(unsupported.availability, "not_available_from_provider");

const detailedPlayback: WatchEventSummary[] = [
  event("session-started", "session_started", 0, 0),
  event("ready", "player_ready", 0, 1),
  event("metadata", "metadata_loaded", 0, 2),
  event("play", "play", 0, 3),
  event("progress-20", "playback_progress", 20, 4),
  event("pause-20", "pause", 20, 5),
  event("resume-20", "resume", 20, 6),
  event("progress-45", "playback_progress", 45, 7),
  event("seek-start", "seek_started", 45, 8),
  event("seek-complete", "seek_completed", 90, 9, 45),
  event("progress-110", "playback_progress", 110, 10),
  event("pause-110", "pause", 110, 11),
  event("session-end", "session_ended", 110, 12),
];
const detailedRanges = reconstructWatchedRanges(detailedPlayback, 120);
equal(detailedRanges.reliable, true);
deepEqual(detailedRanges.ranges, [{ start: 0, end: 45 }, { start: 90, end: 110 }]);
equal(detailedRanges.ranges.some((range) => range.start < 90 && range.end > 45), false);
const lifecycleOnly = buildPlaybackHeatmap([
  event("session-started", "session_started", 0, 0),
  event("ready", "player_ready", 0, 1),
  event("metadata", "metadata_loaded", 0, 2),
], 120, true);
equal(lifecycleOnly.available, false);
equal(lifecycleOnly.availability, "no_telemetry");

const grouped = groupTimelineItems([
  event("play", "play", 0, 1),
  event("heartbeat-7", "heartbeat", 7, 2),
  event("progress-12", "playback_progress", 12, 3),
  event("pause", "pause", 12, 4),
  event("heartbeat-18", "heartbeat", 18, 5),
]);
equal(grouped.length, 4);
equal(grouped[0]?.kind, "event");
equal(grouped[1]?.kind, "progress");
if (grouped[1]?.kind === "progress") equal(grouped[1].events.length, 2);
equal(grouped[2]?.kind, "event");
if (grouped[2]?.kind === "event") equal(grouped[2].event.event_type, "pause");
equal(grouped[3]?.kind, "progress");
if (grouped[3]?.kind === "progress") equal(grouped[3].events.length, 1);

const reliableEvidence = [
  { event_type: "play", position: 0, duration: 90 },
  { event_type: "playback_progress", position: 20, duration: 90 },
];
equal(isReliablePlaybackEvent(reliableEvidence[0]!), true);
equal(hasReliablePlaybackTelemetry("youtube", reliableEvidence), true);
equal(hasReliablePlaybackTelemetry("youtube", [
  { event_type: "session_started", position: 0, duration: 90 },
  { event_type: "player_error", position: 0, duration: 90 },
]), false);
equal(hasReliablePlaybackTelemetry("google_drive", reliableEvidence), false);
const trustedYoutube = deriveTrustedSessionMetrics({ sourceType: "youtube", duration: 120, events: realisticPlayback });
deepEqual(trustedYoutube, { watchTimeSeconds: 65, completionPercentage: 92, measured: true });
const trustedUnsupported = deriveTrustedSessionMetrics({ sourceType: "google_drive", duration: 120, events: realisticPlayback });
deepEqual(trustedUnsupported, { watchTimeSeconds: 0, completionPercentage: 0, measured: false });

equal(providerSupportsDetailedTelemetry("direct_url"), true);
equal(providerSupportsDetailedTelemetry("youtube"), true);
equal(providerSupportsDetailedTelemetry("vimeo"), true);
equal(providerSupportsDetailedTelemetry("google_drive"), false);
equal(providerSupportsDetailedTelemetry("telegram"), false);
equal(getProviderAdapter("vimeo").build_embed_url("https://vimeo.com/123456"), "https://player.vimeo.com/video/123456?api=1&title=0&byline=0&portrait=0");
equal(getProviderAdapter("google_drive").build_embed_url("https://drive.google.com/file/d/drive-id/view"), "https://drive.google.com/file/d/drive-id/preview");
equal(getProviderAdapter("youtube").thumbnail_url("https://youtu.be/abc12345678"), "https://img.youtube.com/vi/abc12345678/hqdefault.jpg");
equal(getProviderAdapter("vimeo").thumbnail_url("https://vimeo.com/123456"), null);
equal(getProviderAdapter("telegram").thumbnail_url("https://t.me/example/1"), null);

async function runEngineChecks(): Promise<void> {
  const engineEvents: string[] = [];
  let ensureSessionCalls = 0;
  const endArguments: { completed: boolean; watchTimeSeconds: number } = { completed: false, watchTimeSeconds: -1 };
  const engine = new UniversalTrackingEngine({
    ensureSession: async () => { ensureSessionCalls += 1; return true; },
    sendEvent: (eventType) => { engineEvents.push(eventType); },
    endSession: async (_snapshot, completed, watchTimeSeconds) => { endArguments.completed = completed; endArguments.watchTimeSeconds = watchTimeSeconds; },
  }, 0);
  await engine.handle({ type: "ready", snapshot: { position: 0, duration: 120 } });
  equal(ensureSessionCalls, 0);
  await engine.handle({ type: "play", snapshot: { position: 0, duration: 120 } });
  await engine.handle({ type: "progress", snapshot: { position: 20, duration: 120 } });
  await engine.handle({ type: "pause", snapshot: { position: 20, duration: 120 } });
  await engine.handle({ type: "seek_started", snapshot: { position: 20, duration: 120 }, fromPosition: 20 });
  await engine.handle({ type: "seek_completed", snapshot: { position: 90, duration: 120 }, fromPosition: 20, resumeAfterSeek: true });
  await engine.handle({ type: "progress", snapshot: { position: 110, duration: 120 } });
  await engine.handle({ type: "ended", snapshot: { position: 120, duration: 120 } });
  equal(ensureSessionCalls, 1);
  deepEqual(engineEvents, ["play", "playback_progress", "pause", "seek_started", "seek_completed", "playback_progress", "complete"]);
  equal(endArguments.completed, true);
  assert.ok(endArguments.watchTimeSeconds >= 0);
  await engine.handle({ type: "play", snapshot: { position: 0, duration: 120 } });
  equal(ensureSessionCalls, 2);
}

runEngineChecks()
  .then(() => console.log(`Analytics Verification: ${checks}/${checks} passed`))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
