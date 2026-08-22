-- TrackUp Migration: allow owner/admin link lifecycle management
-- Existing links remain active until explicitly revoked.
ALTER TABLE public.watch_links
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_watch_links_revoked_at
  ON public.watch_links(revoked_at);

COMMENT ON COLUMN public.watch_links.revoked_at IS
  'When set, the public watch link is revoked and cannot create new sessions.';
