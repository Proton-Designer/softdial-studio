-- Add address, category, and contact_status to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Cold',
  ADD COLUMN IF NOT EXISTS contact_status text DEFAULT 'No Contact';
