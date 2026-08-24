import type { WatchEventSummary, WatchEventType } from "@/src/types/video";

export interface WatchedRange {
  start: number;
  end: number;
}

export interface HeatmapBucket extends WatchedRange {
  watched_seconds: number;
  coverage_percentage: number;
}

export type HeatmapAvailability = "measured" | "no_telemetry" | "insufficient_data" | "not_available_from_provider";

export interface PlaybackHeatmap {
  available: boolean;
  availability: HeatmapAvailability;
  duration_seconds: number | null;
  bucket_size_seconds: number | null;
  ranges: WatchedRange[];
  buckets: HeatmapBucket[];
}

interface OrderedEvent extends WatchEventSummary {
  sequence_number?: number | null;
  occurred_at?: string | null;
}

function clampPosition(position: number, duration: number | null): number {
  const safe = Number.isFinite(position) ? Math.max(0, position) : 0;
  return duration && duration > 0 ? Math.min(duration, safe) : safe;
}

function compareEvents(a: OrderedEvent, b: OrderedEvent): number {
  const aSequence = a.sequence_number ?? null;
  const bSequence = b.sequence_number ?? null;
  if (aSequence !== null && bSequence !== null && aSequence !== bSequence) return aSequence - bSequence;
  if (aSequence !== null && bSequence === null) return -1;
  if (aSequence === null && bSequence !== null) return 1;
  const aOccurred = a.occurred_at ? new Date(a.occurred_at).getTime() : Number.NaN;
  const bOccurred = b.occurred_at ? new Date(b.occurred_at).getTime() : Number.NaN;
  if (Number.isFinite(aOccurred) && Number.isFinite(bOccurred) && aOccurred !== bOccurred) return aOccurred - bOccurred;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function addRange(ranges: WatchedRange[], start: number, end: number, duration: number | null): void {
  const safeStart = clampPosition(start, duration);
  const safeEnd = clampPosition(end, duration);
  if (safeEnd - safeStart >= 0.25) ranges.push({ start: safeStart, end: safeEnd });
}

export function mergeWatchedRanges(input: WatchedRange[], duration: number | null): WatchedRange[] {
  const sorted = input
    .map((range) => ({ start: clampPosition(range.start, duration), end: clampPosition(range.end, duration) }))
    .filter((range) => range.end - range.start >= 0.25)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: WatchedRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.5) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function reconstructWatchedRanges(events: WatchEventSummary[], duration: number | null): {
  ranges: WatchedRange[];
  reliable: boolean;
} {
  const ordered = (events as OrderedEvent[]).slice().sort(compareEvents);
  if (ordered.length === 0) return { ranges: [], reliable: false };
  const hasCompleteOrdering = ordered.every((event) => event.sequence_number !== null && event.sequence_number !== undefined);
  const validDuration = duration !== null && Number.isFinite(duration) && duration > 0;
  const hasStart = ordered.some((event) => event.event_type === "play" || event.event_type === "resume");
  const hasProgress = ordered.some((event) => ["heartbeat", "playback_progress", "pause", "seek", "seek_started", "seek_completed", "complete", "ended"].includes(event.event_type) && Number.isFinite(event.position));
  if (!validDuration || !hasStart || !hasProgress) return { ranges: [], reliable: false };

  const ranges: WatchedRange[] = [];
  let playing = false;
  let segmentStart: number | null = null;
  let lastPosition = 0;
  let resumeAfterSeek = false;
  let resumeAfterBuffer = false;

  for (const event of ordered) {
    const position = clampPosition(event.position, duration);
    switch (event.event_type as WatchEventType) {
      case "play":
      case "resume":
        if (playing && segmentStart !== null) addRange(ranges, segmentStart, lastPosition, duration);
        playing = true;
        segmentStart = position;
        lastPosition = position;
        break;
      case "heartbeat":
      case "playback_progress":
        if (!playing || segmentStart === null) break;
        if (position + 0.5 < lastPosition) {
          addRange(ranges, segmentStart, lastPosition, duration);
          segmentStart = position;
        } else {
          addRange(ranges, lastPosition, position, duration);
        }
        lastPosition = position;
        break;
      case "seek_started":
        resumeAfterSeek = playing;
        if (playing && segmentStart !== null) addRange(ranges, segmentStart, position, duration);
        playing = false;
        segmentStart = null;
        lastPosition = position;
        break;
      case "seek_completed":
      case "seek": {
        const seekOrigin = event.from_position === null || event.from_position === undefined
          ? lastPosition
          : clampPosition(event.from_position, duration);
        if (playing && segmentStart !== null) addRange(ranges, segmentStart, seekOrigin, duration);
        const continuePlayback: boolean = event.event_type === "seek_completed"
          ? resumeAfterSeek || event.metadata?.inferred === true
          : playing;
        playing = continuePlayback;
        segmentStart = continuePlayback ? position : null;
        lastPosition = position;
        resumeAfterSeek = false;
        break;
      }
      case "buffering_started":
        resumeAfterBuffer = playing;
        if (playing && segmentStart !== null) addRange(ranges, segmentStart, lastPosition, duration);
        playing = false;
        segmentStart = null;
        break;
      case "buffering_ended":
        playing = resumeAfterBuffer;
        segmentStart = playing ? position : null;
        lastPosition = position;
        resumeAfterBuffer = false;
        break;
      case "pause":
      case "complete":
      case "ended":
      case "session_ended":
        if (playing && segmentStart !== null) addRange(ranges, segmentStart, Math.max(lastPosition, position), duration);
        playing = false;
        segmentStart = null;
        lastPosition = position;
        break;
      default:
        break;
    }
  }

  if (playing && segmentStart !== null) addRange(ranges, segmentStart, lastPosition, duration);
  return { ranges: mergeWatchedRanges(ranges, duration), reliable: hasCompleteOrdering && ranges.length > 0 };
}

export function adaptiveBucketSize(duration: number): number {
  if (duration <= 120) return 1;
  if (duration <= 600) return 5;
  return Math.max(5, Math.ceil(duration / 120));
}

export function buildPlaybackHeatmap(
  events: WatchEventSummary[],
  duration: number | null,
  supported: boolean,
): PlaybackHeatmap {
  if (!supported) return { available: false, availability: "not_available_from_provider", duration_seconds: duration, bucket_size_seconds: null, ranges: [], buckets: [] };
  if (!duration || duration <= 0) return { available: false, availability: "no_telemetry", duration_seconds: null, bucket_size_seconds: null, ranges: [], buckets: [] };
  if (events.length === 0) return { available: false, availability: "no_telemetry", duration_seconds: duration, bucket_size_seconds: null, ranges: [], buckets: [] };
  const hasPlaybackEvent = events.some((event) => ["play", "resume", "pause", "seek", "seek_started", "seek_completed", "heartbeat", "playback_progress", "complete", "ended"].includes(event.event_type));
  if (!hasPlaybackEvent) return { available: false, availability: "no_telemetry", duration_seconds: duration, bucket_size_seconds: null, ranges: [], buckets: [] };
  const reconstructed = reconstructWatchedRanges(events, duration);
  if (!reconstructed.reliable) return { available: false, availability: "insufficient_data", duration_seconds: duration, bucket_size_seconds: null, ranges: reconstructed.ranges, buckets: [] };

  const bucketSize = adaptiveBucketSize(duration);
  const buckets: HeatmapBucket[] = [];
  for (let start = 0; start < duration; start += bucketSize) {
    const end = Math.min(duration, start + bucketSize);
    const watchedSeconds = reconstructed.ranges.reduce((sum, range) => sum + Math.max(0, Math.min(end, range.end) - Math.max(start, range.start)), 0);
    buckets.push({ start, end, watched_seconds: Math.round(watchedSeconds * 100) / 100, coverage_percentage: Math.round((watchedSeconds / (end - start)) * 100) });
  }
  return { available: true, availability: "measured", duration_seconds: duration, bucket_size_seconds: bucketSize, ranges: reconstructed.ranges, buckets };
}

export function aggregateHeatmaps(
  heatmaps: PlaybackHeatmap[],
  duration: number | null,
  supported: boolean,
): PlaybackHeatmap {
  if (!supported) return buildPlaybackHeatmap([], duration, false);
  const ranges = heatmaps.flatMap((heatmap) => heatmap.available ? heatmap.ranges : []);
  if (!duration || ranges.length === 0) {
    return { available: false, availability: heatmaps.some((heatmap) => heatmap.availability === "insufficient_data") ? "insufficient_data" : "no_telemetry", duration_seconds: duration, bucket_size_seconds: null, ranges: [], buckets: [] };
  }
  const merged = mergeWatchedRanges(ranges, duration);
  const syntheticEvents: WatchEventSummary[] = merged.flatMap((range, index) => [
    { id: `range-${index}-start`, event_type: "play", position: range.start, from_position: null, duration, created_at: new Date(index).toISOString(), sequence_number: index * 2 } as OrderedEvent,
    { id: `range-${index}-end`, event_type: "pause", position: range.end, from_position: null, duration, created_at: new Date(index).toISOString(), sequence_number: index * 2 + 1 } as OrderedEvent,
  ]);
  return buildPlaybackHeatmap(syntheticEvents, duration, true);
}
