-- Atomic same-email invitation acceptance after ClickUp identity verification.
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_invitation_id UUID,
  p_token_hash TEXT,
  p_email TEXT,
  p_clickup_user_id TEXT,
  p_name TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations;
  v_profile public.profiles;
  v_email TEXT := lower(trim(p_email));
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  IF p_invitation_id IS NULL OR p_token_hash IS NULL OR p_clickup_user_id IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_invitation';
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
    AND token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invitation';
  END IF;
  IF v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_accepted';
  END IF;
  IF v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_revoked';
  END IF;
  IF v_invitation.expires_at <= v_now THEN
    RAISE EXCEPTION 'invitation_expired';
  END IF;
  IF v_invitation.email <> v_email THEN
    RAISE EXCEPTION 'invitation_email_mismatch';
  END IF;
  IF v_invitation.role NOT IN ('admin'::public.user_role, 'viewer'::public.user_role) THEN
    RAISE EXCEPTION 'invalid_invitation';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_invitation.profile_id
  FOR UPDATE;

  IF NOT FOUND OR v_profile.email <> v_email THEN
    RAISE EXCEPTION 'invitation_email_mismatch';
  END IF;
  IF v_profile.clickup_user_id IS NOT NULL AND v_profile.clickup_user_id <> p_clickup_user_id THEN
    RAISE EXCEPTION 'profile_identity_mismatch';
  END IF;

  UPDATE public.profiles
  SET clickup_user_id = p_clickup_user_id,
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      role = v_invitation.role,
      is_active = true
  WHERE id = v_profile.id
  RETURNING * INTO v_profile;

  UPDATE public.invitations
  SET accepted_at = v_now
  WHERE id = v_invitation.id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.accept_invitation(UUID, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
