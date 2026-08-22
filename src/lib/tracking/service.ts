/*
 * Uses admin client (anon cannot read session to verify, so we skip verify for MVP).
 * Rate limiting / spam prevention is a post-MVP concern.
 */
export async function recordTrackingEvent(
  payload: TrackingEventPayload
): Promise<boolean> {
  if (!payload.session_id || !payload.session_token || !payload.event_type) return false;
  if (!(await isAuthorizedWatchSession(payload.session_id, payload.session_token))) return false;




  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("watch_events").insert({
      session_id: payload.session_id,
      event_type: payload.event_type,
      position: payload.position ?? 0,
      duration: payload.from_position ?? null,
    });




    if (error) {
      // Update last_seen_at on session (fire-and-forget)
      void supabase
        .from("watch_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", payload.session_id);
    }




    // Always update last_seen_at on heartbeat/play
    if (!error && (payload.event_type === "heartbeat" || payload.event_type === "play")) {
      void supabase
        .from("watch_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", payload.session_id);
    }




    return !error;
  } catch {
    return false;
  }
}




/**
 * Ends a watch session, recording final watch time and completion %.
 */
export async function endWatchSession(
  sessionId: string,
  sessionToken: string,
  watchTimeSeconds: number,
  completionPercentage: number
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("watch_sessions")
      .update({
        ended_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        watch_time_seconds: Math.round(watchTimeSeconds),
        completion_percentage: Math.min(100, Math.max(0, completionPercentage)),
      })
      .eq("id", sessionId)
      .eq("session_token", sessionToken)
      .select("id")
      .maybeSingle();



