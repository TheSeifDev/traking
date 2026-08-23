-- TrackUp private viewer identity.
-- Guest identity is scoped to one watch link and never stored in the URL token.

CREATE TABLE IF NOT EXISTS public.viewer_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_link_id    UUID NOT NULL REFERENCES public.watch_links(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  email            TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
  normalized_email TEXT NOT NULL CHECK (char_length(normalized_email) BETWEEN 3 AND 320),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (watch_link_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS idx_viewer_identities_watch_link_id
  ON public.viewer_identities(watch_link_id);
CREATE INDEX IF NOT EXISTS idx_viewer_identities_last_seen_at
  ON public.viewer_identities(last_seen_at DESC);

ALTER TABLE public.viewer_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct viewer identity reads" ON public.viewer_identities;
CREATE POLICY "No direct viewer identity reads"
  ON public.viewer_identities FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "No direct viewer identity inserts" ON public.viewer_identities;
CREATE POLICY "No direct viewer identity inserts"
  ON public.viewer_identities FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct viewer identity updates" ON public.viewer_identities;
CREATE POLICY "No direct viewer identity updates"
  ON public.viewer_identities FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct viewer identity deletes" ON public.viewer_identities;
CREATE POLICY "No direct viewer identity deletes"
  ON public.viewer_identities FOR DELETE TO anon, authenticated USING (false);

ALTER TABLE public.watch_sessions
  ADD COLUMN IF NOT EXISTS viewer_identity_id UUID REFERENCES public.viewer_identities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_watch_sessions_viewer_identity_id
  ON public.watch_sessions(viewer_identity_id);

COMMENT ON TABLE public.viewer_identities IS
  'Validated guest viewer identity scoped to a private watch link; read/write only through server-side service role.';
COMMENT ON COLUMN public.viewer_identities.normalized_email IS
  'Lowercase trimmed email used only for deduplication within one watch link.';
COMMENT ON COLUMN public.watch_sessions.viewer_identity_id IS
  'Guest viewer identity for private-link viewers; mutually exclusive in normal operation with viewer_profile_id.';
