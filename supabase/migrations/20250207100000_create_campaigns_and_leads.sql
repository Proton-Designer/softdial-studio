-- Campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  total_calls_made integer NOT NULL DEFAULT 0,
  connect_rate numeric(5,2) NOT NULL DEFAULT 0,
  last_called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_user_created ON public.campaigns(user_id, created_at DESC);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Campaign leads: links campaign to contact with lead status
CREATE TABLE public.campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'passthrough', 'completed')),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_contact_id ON public.campaign_leads(contact_id);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign_leads for own campaigns"
  ON public.campaign_leads FOR SELECT
  USING (
    campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert campaign_leads for own campaigns"
  ON public.campaign_leads FOR INSERT
  WITH CHECK (
    campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update campaign_leads for own campaigns"
  ON public.campaign_leads FOR UPDATE
  USING (
    campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete campaign_leads for own campaigns"
  ON public.campaign_leads FOR DELETE
  USING (
    campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid())
  );

-- View: campaigns with aggregated lead counts (for list without N+1)
CREATE VIEW public.campaigns_with_stats AS
SELECT
  c.id,
  c.user_id,
  c.name,
  c.status,
  c.total_calls_made,
  c.connect_rate,
  c.last_called_at,
  c.created_at,
  c.updated_at,
  COUNT(cl.id)::integer AS total_contacts,
  COUNT(cl.id) FILTER (WHERE cl.status = 'queued')::integer AS queued,
  COUNT(cl.id) FILTER (WHERE cl.status = 'completed')::integer AS completed,
  COUNT(cl.id) FILTER (WHERE cl.status = 'passthrough')::integer AS passthrough
FROM public.campaigns c
LEFT JOIN public.campaign_leads cl ON cl.campaign_id = c.id
GROUP BY c.id;

-- View runs as invoking user so RLS on campaigns applies
ALTER VIEW public.campaigns_with_stats SET (security_invoker = on);
