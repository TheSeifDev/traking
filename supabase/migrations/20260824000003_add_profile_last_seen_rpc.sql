-- Debounced authenticated presence write. The server passes only the profile id
-- obtained from the signed TrackUp session; the client cannot call this directly.
CREATE OR REPLACE FUNCTION public.touch_profile_last_seen(p_profile_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_last_seen TIMESTAMPTZ;
BEGIN
  UPDATE public.profiles
  SET last_seen_at = v_now
  WHERE id = p_profile_id
    AND (last_seen_at IS NULL OR last_seen_at <= v_now - interval '5 minutes')
  RETURNING last_seen_at INTO v_last_seen;

  IF v_last_seen IS NULL THEN
    SELECT last_seen_at INTO v_last_seen
    FROM public.profiles
    WHERE id = p_profile_id;
  END IF;

  RETURN v_last_seen;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_profile_last_seen(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_profile_last_seen(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.touch_profile_last_seen(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.touch_profile_last_seen(UUID) TO service_role;
