-- TrackUp Migration: one active internal viewer link per video.
-- Historical revoked links remain queryable for audit/analytics.
CREATE UNIQUE INDEX IF NOT EXISTS uq_watch_links_one_active_video
  ON public.watch_links(video_id)
  WHERE revoked_at IS NULL;

COMMENT ON INDEX public.uq_watch_links_one_active_video IS
  'Allows historical revoked links but enforces at most one active viewer link per video.';
