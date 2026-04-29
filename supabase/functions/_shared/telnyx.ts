
interface TelnyxCallResponse {
  data?: {
    call_control_id?: string;
    call_leg_id?: string;
    call_session_id?: string;
    id?: string;
  };
}

interface TelnyxConferenceResponse {
  data?: {
    id?: string;
    name?: string;
  };
}

function getTelnyxApiKey(): string {
  const apiKey = Deno.env.get('TELNYX_API_KEY');
  if (!apiKey) throw new Error('Missing TELNYX_API_KEY');
  return apiKey;
}

/**
 * Resolve the Telnyx connection_id for outbound calls (POST /calls) and conferences.
 * Must be a Call Control connection (application with webhook URL). The WebRTC
 * credential connection (TELNYX_CREDENTIAL_CONNECTION_ID) cannot be used here — Telnyx
 * returns 422 "Only Call Control Apps with valid webhook URL are accepted."
 */
function getTelnyxConnectionId(): string {
  const connectionId =
    Deno.env.get('TELNYX_CONNECTION_ID') ?? Deno.env.get('TELNYX_CALL_CONTROL_CONNECTION_ID');
  if (!connectionId) throw new Error('Missing TELNYX_CONNECTION_ID');
  return connectionId;
}

async function telnyxRequest<T = unknown>(path: string, init: RequestInit): Promise<T> {
  const apiKey = getTelnyxApiKey();
  const method = init.method ?? 'GET';
  console.log('[telnyx-api] request_start', { method, path });
  const res = await fetch(`https://api.telnyx.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const errBody = typeof parsed === 'object' && parsed !== null ? JSON.stringify(parsed) : String(parsed);
    console.error('[telnyx-api] request_failed', { method, path, status: res.status, body: errBody });
    if (res.status === 422 && (errBody.includes('webhook') || errBody.includes('Call Control'))) {
      throw new Error(
        'TELNYX_CONNECTION_REJECTED: The connection ID is not a Call Control Application with a webhook URL. In Telnyx Portal create a Call Control Application, set its webhook to your Supabase telnyx-webhook URL, then use that application\'s connection ID as TELNYX_CONNECTION_ID. Do not use the WebRTC credential connection ID here.'
      );
    }
    throw new Error(`Telnyx API ${path} failed (${res.status}): ${errBody}`);
  }

  console.log('[telnyx-api] request_success', { method, path, status: res.status });
  return parsed as T;
}

export function buildConferenceName(userId: string, sessionId: string): string {
  return `agent_session_${userId}_${sessionId}`;
}

export async function createConference(args: {
  userId: string;
  sessionId: string;
  agentCallControlId?: string;
}): Promise<{ id: string | null; name: string }> {
  console.log('[telnyx-api] create_conference_start', {
    userId: args.userId,
    sessionId: args.sessionId,
    hasAgentCallControlId: Boolean(args.agentCallControlId),
  });
  const name = buildConferenceName(args.userId, args.sessionId);
  const connectionId = getTelnyxConnectionId();
  const payload: Record<string, string> = {
    name,
    connection_id: connectionId,
  };
  if (args.agentCallControlId) payload.call_control_id = args.agentCallControlId;
  const response = await telnyxRequest<TelnyxConferenceResponse>('/conferences', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  console.log('[telnyx-api] create_conference_success', {
    userId: args.userId,
    sessionId: args.sessionId,
    conferenceId: response.data?.id ?? null,
    conferenceName: response.data?.name ?? name,
  });
  return {
    id: response.data?.id ?? null,
    name: response.data?.name ?? name,
  };
}

export async function dialOutboundCall(args: {
  to: string;
  from: string;
  webhookUrl: string;
  clientState: string;
}): Promise<{ callControlId: string }> {
  console.log('[telnyx-api] dial_outbound_start', {
    to: args.to,
    from: args.from,
    hasClientState: Boolean(args.clientState),
    webhookUrl: args.webhookUrl,
  });
  const connectionId = getTelnyxConnectionId();
  const payload = {
    connection_id: connectionId,
    to: args.to,
    from: args.from,
    webhook_url: args.webhookUrl,
    answering_machine_detection: 'detect',
    client_state: args.clientState,
  };
  const response = await telnyxRequest<TelnyxCallResponse>('/calls', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const callControlId = response.data?.call_control_id;
  if (!callControlId) throw new Error('Telnyx did not return call_control_id for dial');
  console.log('[telnyx-api] dial_outbound_success', {
    to: args.to,
    from: args.from,
    callControlId,
  });
  return { callControlId };
}

export async function joinCallToConference(callControlId: string, conferenceName: string): Promise<void> {
  console.log('[telnyx-api] join_conference_start', { callControlId, conferenceName });
  await telnyxRequest(`/calls/${encodeURIComponent(callControlId)}/actions/join_conference`, {
    method: 'POST',
    body: JSON.stringify({
      conference_name: conferenceName,
      muted: false,
      soft_mute: false,
    }),
  });
  console.log('[telnyx-api] join_conference_success', { callControlId, conferenceName });
}

export async function hangupCall(callControlId: string): Promise<void> {
  console.log('[telnyx-api] hangup_start', { callControlId });
  await telnyxRequest(`/calls/${encodeURIComponent(callControlId)}/actions/hangup`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  console.log('[telnyx-api] hangup_success', { callControlId });
}
