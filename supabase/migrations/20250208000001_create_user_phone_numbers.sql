-- Create user_phone_numbers table for storing Telnyx numbers assigned to users
CREATE TABLE public.user_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telnyx_phone_number_id text NOT NULL,
  phone_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(telnyx_phone_number_id)
);

-- Create index for faster lookups by user
CREATE INDEX idx_user_phone_numbers_user_id ON public.user_phone_numbers(user_id);

-- Enable RLS
ALTER TABLE public.user_phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only CRUD their own rows
CREATE POLICY "Users can view own phone numbers"
  ON public.user_phone_numbers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phone numbers"
  ON public.user_phone_numbers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own phone numbers"
  ON public.user_phone_numbers
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own phone numbers"
  ON public.user_phone_numbers
  FOR DELETE
  USING (auth.uid() = user_id);
