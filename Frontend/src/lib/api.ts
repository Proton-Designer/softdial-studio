import { supabase } from './supabase';

const getFunctionsUrl = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return '';
  return `${url}/functions/v1`;
};

export function isParallelDialerEnabled(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  return env?.VITE_PARALLEL_DIALER_ENABLED !== 'false';
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  // If no session, the Edge Function will return 401 with a clear message
  return headers;
}

/** Headers for calling Supabase Edge Functions from the browser (includes apikey so gateway accepts the request). */
async function getEdgeFunctionHeaders(): Promise<HeadersInit> {
  const anonKey = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(anonKey ? { apikey: anonKey } : {}),
  };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function listPhoneNumbers() {
  const res = await fetch(`${getFunctionsUrl()}/telnyx-list-numbers`, {
    method: 'GET',
    headers: await getEdgeFunctionHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list numbers');
  return data.numbers as { id: string; telnyx_phone_number_id: string; phone_number: string; created_at: string }[];
}

export async function searchPhoneNumbers(areaCode: string, countryCode = 'US') {
  const params = new URLSearchParams({ area_code: areaCode, country_code: countryCode });
  const res = await fetch(`${getFunctionsUrl()}/telnyx-search-numbers?${params}`, {
    method: 'GET',
    headers: await getEdgeFunctionHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to search numbers');
  return data.numbers as { phone_number: string; monthly_cost?: string }[];
}

export async function purchasePhoneNumber(phoneNumber: string) {
  const res = await fetch(`${getFunctionsUrl()}/telnyx-purchase-number`, {
    method: 'POST',
    headers: await getEdgeFunctionHeaders(),
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to purchase number');
  return data as { success: boolean; phone_number: string };
}

export interface DashboardStats {
  callsToday: number;
  connectRate: number;
  talkTimeFormatted: string;
  talkTimeSeconds: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${getFunctionsUrl()}/dashboard-stats`, {
    method: 'GET',
    headers: await getEdgeFunctionHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load dashboard stats');
  return data as DashboardStats;
}

export interface TeamPerformancePoint {
  day: string;
  date: string;
  calls: number;
  connections: number;
}

export async function getTeamPerformanceChart(
  range: '7d' | '30d' | 'custom',
  customStart?: string,
  customEnd?: string
): Promise<TeamPerformancePoint[]> {
  const params = new URLSearchParams({ range });
  if (range === 'custom' && customStart) params.set('custom_start', customStart);
  if (range === 'custom' && customEnd) params.set('custom_end', customEnd);
  const res = await fetch(`${getFunctionsUrl()}/team-performance?${params}`, {
    method: 'GET',
    headers: await getEdgeFunctionHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load team performance');
  return (data.data ?? []) as TeamPerformancePoint[];
}

export interface UserPreferences {
  team_performance_range?: '7d' | '30d' | 'custom';
  custom_start?: string;
  custom_end?: string;
}

export async function getUserPreferences(): Promise<UserPreferences | null> {
  const { data, error } = await supabase.from('user_preferences').select('team_performance_range, custom_start, custom_end').maybeSingle();
  if (error) throw new Error(error.message);
  return data as UserPreferences | null;
}

export async function saveUserPreferences(
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      team_performance_range: prefs.team_performance_range ?? null,
      custom_start: prefs.custom_start ?? null,
      custom_end: prefs.custom_end ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

export async function ensureWeekSummary(): Promise<void> {
  const url = `${getFunctionsUrl()}/ensure-week-summary`;
  const res = await fetch(url, { method: 'POST', headers: await getEdgeFunctionHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to ensure week summary');
  }
}

// --- Contacts (CSV import + single add) ---
export const CONTACT_CANONICAL_FIELDS = [
  'Business Name',
  'Business Link',
  'Business Type',
  'Rating',
  'Review Count',
  'Open Hours',
  'Phone Number',
  'Website',
  'Notes',
  'First Name',
  'Last Name',
  'Owner Contact',
  'Address',
] as const;

export interface Contact {
  id: string;
  user_id: string;
  business_name: string | null;
  business_link: string | null;
  business_type: string | null;
  rating: number | null;
  review_count: number | null;
  open_hours: string | null;
  phone_number: string | null;
  website: string | null;
  notes: string | null;
  first_name: string | null;
  last_name: string | null;
  owner_contact: string | null;
  address: string | null;
  category: string | null;
  contact_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParseCsvColumn {
  original_header: string;
  mapped_field: string | null;
  status: 'mapped' | 'incomplete';
  preview_data: string[];
}

export interface ParseCsvResponse {
  columns: ParseCsvColumn[];
  total_rows: number;
  preview_rows: Record<string, string>[];
}

export async function parseContactsCsv(csvText: string): Promise<ParseCsvResponse> {
  const res = await fetch(`${getFunctionsUrl()}/contacts-parse-csv`, {
    method: 'POST',
    headers: await getEdgeFunctionHeaders(),
    body: JSON.stringify({ csv_text: csvText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to parse CSV');
  return data as ParseCsvResponse;
}

export async function importContacts(
  csvText: string,
  columnMappings: { original_header: string; mapped_field: string | null }[],
  category: string = 'Cold',
  campaignId?: string
): Promise<{ imported: number; skipped: number; duplicates: number }> {
  const body: Record<string, unknown> = { csv_text: csvText, column_mappings: columnMappings, category };
  if (campaignId) body.campaign_id = campaignId;
  const res = await fetch(`${getFunctionsUrl()}/contacts-import`, {
    method: 'POST',
    headers: await getEdgeFunctionHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import contacts');
  return data as { imported: number; skipped: number; duplicates: number };
}

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

export interface CreateContactInput {
  business_name?: string;
  business_link?: string;
  business_type?: string;
  rating?: number;
  review_count?: number;
  open_hours?: string;
  phone_number?: string;
  website?: string;
  notes?: string;
  first_name?: string;
  last_name?: string;
  owner_contact?: string;
  address?: string;
  category?: string;
  contact_status?: string;
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: user.id,
      business_name: input.business_name ?? null,
      business_link: input.business_link ?? null,
      business_type: input.business_type ?? null,
      rating: input.rating ?? null,
      review_count: input.review_count ?? null,
      open_hours: input.open_hours ?? null,
      phone_number: input.phone_number ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      owner_contact: input.owner_contact ?? null,
      address: input.address ?? null,
      category: input.category ?? 'Cold',
      contact_status: input.contact_status ?? 'No Contact',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);
}

export async function deleteContacts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('user_id', user.id)
    .in('id', ids);
  if (error) throw new Error(error.message);
}

// --- Campaigns ---
export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  total_calls_made: number;
  connect_rate: number;
  last_called_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithStats extends Campaign {
  total_contacts: number;
  queued: number;
  completed: number;
  passthrough: number;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: 'queued' | 'passthrough' | 'completed';
  added_at: string;
  contact: Contact;
}

export async function listCampaigns(): Promise<CampaignWithStats[]> {
  const { data, error } = await supabase
    .from('campaigns_with_stats')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignWithStats[];
}

export async function createCampaign(name: string): Promise<Campaign> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: name.trim(),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Campaign;
}

export async function getCampaign(id: string): Promise<CampaignWithStats | null> {
  const { data, error } = await supabase
    .from('campaigns_with_stats')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CampaignWithStats | null;
}

export async function updateCampaignStatus(id: string, status: 'active' | 'paused' | 'completed'): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listCampaignLeads(campaignId: string): Promise<CampaignLead[]> {
  const { data: leadsData, error: leadsError } = await supabase
    .from('campaign_leads')
    .select('id, campaign_id, contact_id, status, added_at')
    .eq('campaign_id', campaignId)
    .order('added_at', { ascending: false });
  if (leadsError) throw new Error(leadsError.message);
  const leads = (leadsData ?? []) as { id: string; campaign_id: string; contact_id: string; status: string; added_at: string }[];
  if (leads.length === 0) return [];
  const contactIds = [...new Set(leads.map((l) => l.contact_id))];
  const { data: contactsData, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .in('id', contactIds);
  if (contactsError) throw new Error(contactsError.message);
  const contactsMap = new Map(((contactsData ?? []) as Contact[]).map((c) => [c.id, c]));
  return leads.map((l) => ({
    id: l.id,
    campaign_id: l.campaign_id,
    contact_id: l.contact_id,
    status: l.status as 'queued' | 'passthrough' | 'completed',
    added_at: l.added_at,
    contact: contactsMap.get(l.contact_id)!,
  })).filter((cl) => cl.contact);
}

export async function addLeadsToCampaign(campaignId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  const rows = contactIds.map((contact_id) => ({ campaign_id: campaignId, contact_id }));
  const { error } = await supabase.from('campaign_leads').upsert(rows, {
    onConflict: 'campaign_id,contact_id',
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
}

export async function removeLeadFromCampaign(campaignId: string, contactId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_leads')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactId);
  if (error) throw new Error(error.message);
}

export async function removeLeadsFromCampaign(campaignId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  const { error } = await supabase
    .from('campaign_leads')
    .delete()
    .eq('campaign_id', campaignId)
    .in('contact_id', contactIds);
  if (error) throw new Error(error.message);
}

export async function getWebrtcCredentials(): Promise<{ token: string }> {
  const res = await fetch(`${getFunctionsUrl()}/telnyx-webrtc-credentials`, {
    method: 'GET',
    headers: await getEdgeFunctionHeaders(),
  });
  const data = (await res.json()) as { token?: string; error?: string };
  if (!res.ok) throw new Error(data.error || 'Failed to get credentials');
  const token = data.token && typeof data.token === 'string' ? data.token.trim() : '';
  if (!token) throw new Error(data.error || 'No WebRTC token received. Check Telnyx credential connection.');
  return { token };
}

// --- Parallel dialer session ---
export interface DialerSessionSummary {
  calls_made?: number;
  calls_connected?: number;
  calls_voicemail?: number;
  calls_no_answer?: number;
  total_contacts?: number;
}

export interface DialerSessionStartResponse {
  sessionId: string;
  conferenceDetails: {
    conferenceId: string | null;
    conferenceName: string;
  };
  totalContacts: number;
}

export interface DialerSessionRecord {
  id: string;
  campaign_id: string;
  status: 'active' | 'paused' | 'completed' | 'stopped';
  lines_count: number;
  current_index: number;
  total_contacts: number;
  conference_id: string | null;
  conference_name: string;
  calls_made: number;
  calls_connected: number;
  calls_voicemail: number;
  calls_no_answer: number;
}

export interface DialerBatchState {
  activeCallIds: string[];
  humanAnsweredCallId: string | null;
  batchIndex: number;
  firedAt: number;
  /** Current batch contact previews; set when batch is fired so UI can show after load */
  contacts?: { id: string; name: string; phone: string }[];
}

/** Thrown when startDialerSession returns 409 because an active session already exists for the campaign. */
export class ActiveSessionExistsError extends Error {
  constructor(
    message: string,
    public readonly existingSessionId: string
  ) {
    super(message);
    this.name = 'ActiveSessionExistsError';
  }
}

export async function startDialerSession(args: {
  campaignId: string;
  linesCount: 1 | 2 | 3 | 4 | 5;
  fromNumber: string;
  agentCallControlId?: string;
  /** When set, the backend will call this number when a contact answers so the agent can join the conference for two-way audio. */
  agentCallbackNumber?: string;
}): Promise<DialerSessionStartResponse> {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const url = `${getFunctionsUrl()}/dialer-session-start`;
  console.info('[startDialerSession] checkpoint:request_prepared', {
    requestId,
    campaignId: args.campaignId,
    linesCount: args.linesCount,
    hasFromNumber: Boolean(args.fromNumber),
    hasAgentCallControlId: Boolean(args.agentCallControlId),
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: await getEdgeFunctionHeaders(),
    body: JSON.stringify({ ...args, debugRequestId: requestId }),
  });
  let data: {
    error?: string;
    code?: string;
    existingSessionId?: string;
    requestId?: string;
    checkpoint?: string;
    sessionId?: string;
  };
  try {
    data = (await res.json()) as {
      error?: string;
      code?: string;
      existingSessionId?: string;
      requestId?: string;
      checkpoint?: string;
      sessionId?: string;
    };
  } catch {
    console.error('[startDialerSession] checkpoint:response_non_json', {
      requestId,
      status: res.status,
      statusText: res.statusText,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    throw new Error(`Failed to start dialer session (${res.status}) [requestId=${requestId}]`);
  }
  const serverRequestId = data.requestId ?? requestId;
  console.info('[startDialerSession] checkpoint:response_received', {
    requestId: serverRequestId,
    status: res.status,
    code: data.code,
    checkpoint: data.checkpoint,
    elapsedMs: Math.round(performance.now() - startedAt),
  });
  if (!res.ok) {
    console.warn('[startDialerSession] error response', {
      status: res.status,
      error: data.error,
      code: data.code,
      existingSessionId: data.existingSessionId,
      requestId: serverRequestId,
      checkpoint: data.checkpoint,
    });
    if (res.status === 409 && data.code === 'ACTIVE_SESSION_EXISTS' && data.existingSessionId) {
      throw new ActiveSessionExistsError(
        `An active dialer session already exists for this campaign. [requestId=${serverRequestId}]`,
        data.existingSessionId
      );
    }
    if (res.status === 503 && data.code === 'MISSING_TELNYX_CONNECTION_ID') {
      throw new Error(data.error || 'Set TELNYX_CONNECTION_ID in Supabase secrets. See docs/TELNYX_CALL_CONTROL_SETUP.md.');
    }
    if (res.status === 503 && data.code === 'INVALID_TELNYX_CONNECTION') {
      throw new Error(data.error || 'Use a Call Control Application connection in Telnyx, not the WebRTC credential connection. See docs/TELNYX_CALL_CONTROL_SETUP.md.');
    }
    if (res.status === 503 && data.code === 'MISSING_TELNYX_API_KEY') {
      throw new Error((data.error || 'Outbound dialing is not configured. Set TELNYX_API_KEY in Supabase Edge Function secrets.') + ` [requestId=${serverRequestId}, checkpoint=${data.checkpoint ?? 'unknown'}]`);
    }
    throw new Error((data.error || `Failed to start dialer session (${res.status})`) + ` [requestId=${serverRequestId}, checkpoint=${data.checkpoint ?? 'unknown'}]`);
  }
  console.info('[startDialerSession] checkpoint:success', {
    requestId: serverRequestId,
    sessionId: data.sessionId,
    elapsedMs: Math.round(performance.now() - startedAt),
  });
  return data as DialerSessionStartResponse;
}

export async function stopDialerSession(sessionId: string): Promise<{ summary: DialerSessionSummary }> {
  const res = await fetch(`${getFunctionsUrl()}/dialer-session-stop`, {
    method: 'POST',
    headers: await getEdgeFunctionHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to stop dialer session');
  return data as { summary: DialerSessionSummary };
}

export async function pauseDialerSession(sessionId: string): Promise<{ status: 'paused' }> {
  const res = await fetch(`${getFunctionsUrl()}/dialer-session-pause`, {
    method: 'POST',
    headers: await getEdgeFunctionHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to pause dialer session');
  return data as { status: 'paused' };
}

/** End the current live contact call in a parallel session and advance to the next batch. */
export async function hangupLiveCall(sessionId: string): Promise<void> {
  const res = await fetch(`${getFunctionsUrl()}/dialer-session-hangup-live`, {
    method: 'POST',
    headers: await getEdgeFunctionHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error || 'Failed to end live call');
}

export async function getDialerSession(sessionId: string): Promise<{
  session: DialerSessionRecord;
  batch: DialerBatchState | null;
}> {
  const res = await fetch(`${getFunctionsUrl()}/dialer-session-get?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: await getEdgeFunctionHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load dialer session');
  return data as { session: DialerSessionRecord; batch: DialerBatchState | null };
}

/** Returns the current user's active parallel dialer session (if any). Use this to restore the parallel dialer UI when opening the Dialer tab. */
export async function getActiveDialerSession(): Promise<{
  sessionId: string;
  campaignId: string;
} | null> {
  const res = await fetch(`${getFunctionsUrl()}/dialer-session-active`, {
    method: 'GET',
    headers: await getEdgeFunctionHeaders(),
  });
  const data = (await res.json()) as { session?: { sessionId: string; campaignId: string } | null; error?: string };
  if (!res.ok) throw new Error(data.error || 'Failed to get active dialer session');
  return data.session ?? null;
}
