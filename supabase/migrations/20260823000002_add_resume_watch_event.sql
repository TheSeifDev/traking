-- TrackUp Migration: Distinguish resumed playback from the initial play event.
-- Existing events remain valid; this only extends the event enum.
ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'resume' AFTER 'play';
