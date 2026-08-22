-- ===============================================================================
-- TrackUp Migration: Preserve the origin position for seek events
-- ===============================================================================

ALTER TABLE public.watch_events
  ADD COLUMN IF NOT EXISTS from_position NUMERIC(10,2);

COMMENT ON COLUMN public.watch_events.from_position IS
  'Playback position immediately before a seek; populated for seek events to support future watched-range reconstruction.';
