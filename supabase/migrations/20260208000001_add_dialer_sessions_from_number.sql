-- Store the user's chosen caller ID for the session (their purchased number)
ALTER TABLE public.dialer_sessions
  ADD COLUMN IF NOT EXISTS from_number text;

COMMENT ON COLUMN public.dialer_sessions.from_number IS 'E.164 number the user chose to call from for this session (their purchased number).';
