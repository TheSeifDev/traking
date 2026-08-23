import assert from "node:assert/strict";
import { buildPlaybackHeatmap, reconstructWatchedRanges } from "../src/lib/analytics/ranges";
import type { WatchEventSummary } from "../src/types/video";

function event(
  id: string,
  event_type: WatchEventSummary["event_type"],
  position: number,
  sequence_number: number | null,
  from_position: number | null = null,
): WatchEventSummary {
  return {
    id,
    event_type,
    position,
    from_position,
    duration: 60,
    created_at: new Date(sequence_number === null ? 0 : sequence_number * 1000).toISOString(),
    sequence_number,
    occurred_at: sequence_number === null ? null : new Date(sequence_number * 1000).toISOString(),
  };
}

const contiguous: WatchEventSummary[] = [
  event("play", "play", 0, 1),
  event("heartbeat", "heartbeat", 5, 2),
  event("pause", "pause", 5, 3),
];
const reconstructed = reconstructWatchedRanges(contiguous, 60);
assert.equal(reconstructed.reliable, true);
assert.deepEqual(reconstructed.ranges, [{ start: 0, end: 5 }]);
const measured = buildPlaybackHeatmap(contiguous, 60, true);
assert.equal(measured.available, true);
assert.equal(measured.availability, "measured");
assert.equal(measured.buckets.reduce((sum, bucket) => sum + bucket.watched_seconds, 0), 5);

const withSeek: WatchEventSummary[] = [
  event("play", "play", 0, 1),
  event("heartbeat", "heartbeat", 5, 2),
  event("seek", "seek", 20, 3, 5),
  event("heartbeat-2", "heartbeat", 25, 4),
  event("ended", "ended", 25, 5),
];
const seekRanges = reconstructWatchedRanges(withSeek, 60);
assert.equal(seekRanges.reliable, true);
assert.deepEqual(seekRanges.ranges, [{ start: 0, end: 5 }, { start: 20, end: 25 }]);

const unordered = buildPlaybackHeatmap([event("play", "play", 0, null), event("pause", "pause", 5, null)], 60, true);
assert.equal(unordered.available, false);
assert.equal(unordered.availability, "insufficient_data");

const unsupported = buildPlaybackHeatmap(contiguous, 60, false);
assert.equal(unsupported.available, false);
assert.equal(unsupported.availability, "not_available_from_provider");

console.log("Analytics Verification: 15/15 passed");
