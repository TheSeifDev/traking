import assert from "node:assert/strict";
import { buildPlaybackHeatmap, mergeWatchedRanges, reconstructWatchedRanges } from "../src/lib/analytics/ranges";
import type { WatchEventSummary } from "../src/types/video";
import { groupTimelineItems } from "../src/components/analytics/GroupedSessionTimeline";

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

const grouped = groupTimelineItems([
  event("play", "play", 0, 1),
  event("heartbeat-7", "heartbeat", 7, 2),
  event("heartbeat-12", "heartbeat", 12, 3),
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

console.log(`Analytics Verification: ${checks}/${checks} passed`);
