-- Parallel dialer core tables and contact call-tracking fields

CREATE TABLE IF NOT EXISTS public.dialer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'stopped')),
  lines_count integer NOT NULL DEFAULT 3 CHECK (lines_count BETWEEN 1 AND 5),
  current_index integer NOT NULL DEFAULT 0 CHECK (current_index >= 0),
  total_contacts integer NOT NULL DEFAULT 0 CHECK (total_contacts >= 0),
  conference_id text,
  conference_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  calls_made integer NOT NULL DEFAULT 0 CHECK (calls_made >= 0),
  calls_connected integer NOT NULL DEFAULT 0 CHECK (calls_connected >= 0),
  calls_voicemail integer NOT NULL DEFAULT 0 CHECK (calls_voicemail >= 0),
  calls_no_answer integer NOT NULL DEFAULT 0 CHECK (calls_no_answer >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dialer_sessions_user_started
  ON public.dialer_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dialer_sessions_campaign
  ON public.dialer_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dialer_sessions_status
  ON public.dialer_sessions(status);

ALTER TABLE public.dialer_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dialer_sessions" ON public.dialer_sessions;
CREATE POLICY "Users can view own dialer_sessions"
  ON public.dialer_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.dialer_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  call_control_id text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  status text CHECK (status IN ('initiated', 'answered', 'machine', 'no_answer', 'connected', 'completed')),
  amd_result text CHECK (amd_result IN ('human', 'machine', 'not_sure')),
  duration_seconds integer CHECK (duration_seconds >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_call_control
  ON public.call_logs(call_control_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_session
  ON public.call_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_campaign
  ON public.call_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_user_started
  ON public.call_logs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_status
  ON public.call_logs(status);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own call_logs" ON public.call_logs;
CREATE POLICY "Users can view own call_logs"
  ON public.call_logs FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS call_status text NOT NULL DEFAULT 'not_called'
    CHECK (call_status IN ('not_called', 'dialing', 'contacted', 'voicemail', 'no_answer', 'do_not_call')),
  ADD COLUMN IF NOT EXISTS last_called_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_count integer NOT NULL DEFAULT 0 CHECK (call_count >= 0);

CREATE INDEX IF NOT EXISTS idx_contacts_user_call_status
  ON public.contacts(user_id, call_status);
