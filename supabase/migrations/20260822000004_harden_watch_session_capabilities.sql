-- ==============================================================================

-- TrackUp Migration: Bind anonymous watch sessions to a private capability

-- ==============================================================================



CREATE EXTENSION IF NOT EXISTS pgcrypto;



ALTER TABLE public.watch_sessions

  ADD COLUMN IF NOT EXISTS session_token TEXT;



UPDATE public.watch_sessions

SET session_token = encode(extensions.gen_random_bytes(32), 'hex')

WHERE session_token IS NULL;



ALTER TABLE public.watch_sessions

  ALTER COLUMN session_token SET NOT NULL;



CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_sessions_session_token

  ON public.watch_sessions(session_token);



COMMENT ON COLUMN public.watch_sessions.session_token IS

  'Private per-session capability required for anonymous tracking writes; never exposed in analytics responses.';

