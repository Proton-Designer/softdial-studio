-- call_events: store Telnyx call lifecycle for dashboard stats
CREATE TABLE public.call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  telnyx_call_session_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  outcome text CHECK (outcome IN ('answered', 'no_answer', 'busy', 'failed', 'unknown')),
  started_at timestamptz NOT NULL,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_call_events_telnyx_session ON public.call_events(telnyx_call_session_id);
CREATE INDEX idx_call_events_user_started ON public.call_events(user_id, started_at);
CREATE INDEX idx_call_events_started_at ON public.call_events(started_at);

ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Service role / webhook can insert and update; users can only read own rows
CREATE POLICY "Users can view own call_events"
  ON public.call_events FOR SELECT
  USING (auth.uid() = user_id);

-- Webhook uses service role key, so no RLS policy for insert/update from Edge Function
-- Allow service role to do anything; for anon we restrict. So we need a policy that
-- allows insert/update when ... we can't easily do "service role" in RLS. So either:
-- 1. Edge Function uses service_role key -> bypasses RLS
-- 2. Or we create a policy that allows insert/update only from a dedicated role
-- Supabase Edge Functions that use createClient with service_role bypass RLS. So we're good.
-- Only SELECT is restricted to own user_id.

-- notifications: in-app notifications (e.g. week summary)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read_at);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert must be done by backend (Edge Function with service role) or we allow system
-- So we don't add INSERT policy for users; Edge Function will use service role to insert.

-- user_preferences: dashboard custom date range etc.
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_performance_range text CHECK (team_performance_range IN ('7d', '30d', 'custom')),
  custom_start date,
  custom_end date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);
