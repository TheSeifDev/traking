-- TrackUp: typed playback telemetry and server receipt timestamps.
-- Existing events remain readable; legacy provider fields remain NULL/unknown.

ALTER TABLE public.watch_events
  ADD COLUMN IF NOT EXISTS playback_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS from_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS to_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

UPDATE public.watch_events
SET received_at = created_at
WHERE received_at IS NULL;

ALTER TABLE public.watch_events
  ALTER COLUMN received_at SET DEFAULT timezone('utc', now()),
  ALTER COLUMN received_at SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.watch_events
    ADD CONSTRAINT watch_events_playback_rate_nonnegative
    CHECK (playback_rate IS NULL OR playback_rate > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.watch_events
    ADD CONSTRAINT watch_events_from_rate_nonnegative
    CHECK (from_rate IS NULL OR from_rate > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.watch_events
    ADD CONSTRAINT watch_events_to_rate_nonnegative
    CHECK (to_rate IS NULL OR to_rate > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_watch_events_session_received_at
  ON public.watch_events(session_id, received_at);

COMMENT ON COLUMN public.watch_events.playback_rate IS
  'Provider-reported playback rate at event time; NULL when not recorded.';
COMMENT ON COLUMN public.watch_events.from_rate IS
  'Provider-reported previous playback rate for rate_change events; NULL when not recorded.';
COMMENT ON COLUMN public.watch_events.to_rate IS
  'Provider-reported new playback rate for rate_change events; NULL when not recorded.';
COMMENT ON COLUMN public.watch_events.received_at IS
  'Server/database ingestion time; created_at remains the legacy receipt timestamp.';
