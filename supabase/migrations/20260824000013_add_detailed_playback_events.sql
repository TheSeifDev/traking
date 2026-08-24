-- TrackUp: detailed playback lifecycle event vocabulary.
-- This migration is additive: it preserves all historical events, columns, rows,
-- foreign keys, RLS policies, and existing indexes. Rich provider-specific context
-- remains bounded in watch_events.metadata; relational identity is reconstructed
-- through session -> watch_link -> video and session.viewer_profile_id joins.
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'session_started';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'player_ready';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'metadata_loaded';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'seek_started';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'seek_completed';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'playback_progress';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'session_ended';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'buffering_started';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'buffering_ended';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'playback_rate_changed';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'volume_changed';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'mute_changed';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'fullscreen_entered';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'fullscreen_exited';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'visibility_hidden';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'visibility_visible';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'quality_changed';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'player_error';

CREATE INDEX IF NOT EXISTS idx_watch_events_event_type
  ON public.watch_events(event_type);

COMMENT ON TYPE public.watch_event_type IS
  'Observed TrackUp playback lifecycle and provider telemetry events; unsupported provider events are not fabricated.';
COMMENT ON COLUMN public.watch_events.metadata IS
  'Bounded non-PII event context such as provider_state, player_state, seek_to_seconds, delta_seconds, volume, mute, visibility, error details, device, browser, and OS.';
