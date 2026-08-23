-- TrackUp Analytics: bind new watch sessions to profiles and preserve ordered telemetry.
-- Existing rows remain valid; legacy sessions/events without these fields stay explicitly anonymous.

ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'buffer';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'rate_change';
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'visibility_change';

ALTER TABLE public.watch_sessions
  ADD COLUMN IF NOT EXISTS viewer_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT;

CREATE INDEX IF NOT EXISTS idx_watch_sessions_viewer_profile_id
  ON public.watch_sessions(viewer_profile_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_viewer_profile_started_at
  ON public.watch_sessions(viewer_profile_id, started_at DESC);

ALTER TABLE public.watch_events
  ADD COLUMN IF NOT EXISTS client_event_id TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_watch_events_session_client_event
  ON public.watch_events(session_id, client_event_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_session_sequence
  ON public.watch_events(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_watch_events_session_occurred_at
  ON public.watch_events(session_id, occurred_at);

COMMENT ON COLUMN public.watch_sessions.viewer_profile_id IS
  'Authenticated TrackUp profile associated with this watch session; legacy hashed-only sessions remain NULL.';
COMMENT ON COLUMN public.watch_sessions.device_type IS
  'Coarse device class derived server-side from the request user-agent; NULL when unknown.';
COMMENT ON COLUMN public.watch_sessions.browser IS
  'Browser family derived server-side from the request user-agent; NULL when unknown.';
COMMENT ON COLUMN public.watch_sessions.os IS
  'Operating-system family derived server-side from the request user-agent; NULL when unknown.';
COMMENT ON COLUMN public.watch_events.client_event_id IS
  'Client-generated idempotency key for one playback event; never contains PII.';
COMMENT ON COLUMN public.watch_events.sequence_number IS
  'Monotonic per-session client sequence used to reconstruct playback order.';
COMMENT ON COLUMN public.watch_events.occurred_at IS
  'Client playback timestamp; created_at remains the server receipt timestamp.';
COMMENT ON COLUMN public.watch_events.metadata IS
  'Non-PII provider event metadata such as visibility or playback rate.';
