import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { buildConferenceName, createConference } from '../_shared/telnyx.ts';
import { fetchDialableContacts, fireBatch } from '../_shared/dialer-engine.ts';
import { setAgentSessionState } from '../_shared/redis.ts';
import { publishDialerEvent } from '../_shared/dialer-events.ts';

interface StartRequestBody {
  campaignId?: string;
  linesCount?: number;
  agentCallControlId?: string;
  fromNumber?: string;
  /** When set, the backend will call this number when a contact answers and join the agent to the conference for two-way audio. */
  agentCallbackNumber?: string;
  debugRequestId?: string;
}

const log = (step: string, detail?: Record<string, unknown>) => {
  console.log(`[dialer-session-start] ${step}`, detail ?? '');
};

Deno.serve(async (req) => {
  let requestId = crypto.randomUUID();
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
  const respond = (status: number, payload: Record<string, unknown>, checkpoint: string) =>
    new Response(
      JSON.stringify({
        ...payload,
        requestId,
        checkpoint,
      }),
      { status, headers: jsonHeaders }
    );

  if (req.method === 'OPTIONS') return corsPreflightResponse();
  if (req.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' }, 'method_check');
  }

  log('request_received', { requestId });
  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) {
    log('auth_failed', { requestId, error: authError.status });
    return authError;
  }
  log('auth_ok', { requestId, userId: user.id });

  try {
    const featureEnabled = (Deno.env.get('PARALLEL_DIALER_ENABLED') ?? 'true').toLowerCase() === 'true';
    if (!featureEnabled) {
      log('feature_disabled');
      return new Response(JSON.stringify({ error: 'Parallel dialer is disabled' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as StartRequestBody;
    requestId = body.debugRequestId?.trim() || requestId;
    const campaignId = body.campaignId?.trim();
    const linesCount = Math.max(1, Math.min(5, Number(body.linesCount ?? 3)));
    const agentCallControlId = body.agentCallControlId?.trim();
    const fromNumber = body.fromNumber?.trim();
    const agentCallbackNumber = body.agentCallbackNumber?.trim() || undefined;
    log('body_parsed', { requestId, campaignId, linesCount, fromNumber: fromNumber ? '***' : null });

    if (!campaignId) {
      log('validation_failed', { requestId, reason: 'missing_campaignId' });
      return respond(400, { error: 'campaignId is required' }, 'validate_campaign_id');
    }
    if (!fromNumber) {
      log('validation_failed', { requestId, reason: 'missing_fromNumber' });
      return respond(
        400,
        { error: 'Choose a phone number to call from. Purchase one in Settings if needed.' },
        'validate_from_number'
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    log('checking_user_phone_number', { requestId });
    const { data: userNumber, error: userNumberError } = await supabase
      .from('user_phone_numbers')
      .select('phone_number')
      .eq('user_id', user.id)
      .eq('phone_number', fromNumber)
      .maybeSingle();
    if (userNumberError) {
      log('user_phone_number_error', { requestId, error: userNumberError.message });
      return respond(500, { error: 'Could not verify phone number.' }, 'check_user_phone_number');
    }
    if (!userNumber) {
      log('validation_failed', { requestId, reason: 'fromNumber_not_owned' });
      return respond(
        400,
        { error: 'That phone number is not yours. Choose a number you purchased in Settings.' },
        'validate_owned_number'
      );
    }

    log('checking_existing_session', { requestId, campaignId });
    const { data: existingSession, error: existingError } = await supabase
      .from('dialer_sessions')
      .select('id,status')
      .eq('user_id', user.id)
      .eq('campaign_id', campaignId)
      .eq('status', 'active')
      .maybeSingle();
    if (existingError) {
      log('existing_session_query_error', { requestId, error: existingError.message });
      return respond(500, { error: 'Could not check existing sessions.' }, 'check_existing_session');
    }
    if (existingSession) {
      log('conflict_active_session_exists', { requestId, existingSessionId: existingSession.id });
      return respond(
        409,
        {
          error: 'An active dialer session already exists for this campaign.',
          code: 'ACTIVE_SESSION_EXISTS',
          existingSessionId: existingSession.id,
        },
        'existing_session_conflict'
      );
    }

    const telnyxApiKey = Deno.env.get('TELNYX_API_KEY');
    if (!telnyxApiKey) {
      log('config_error', { requestId, reason: 'missing_telnyx_api_key' });
      return respond(
        503,
        {
          error: 'Server is not configured for outbound dialing. Set TELNYX_API_KEY in Supabase Edge Function secrets.',
          code: 'MISSING_TELNYX_API_KEY',
        },
        'config_validation'
      );
    }

    const connectionId =
      Deno.env.get('TELNYX_CONNECTION_ID') ?? Deno.env.get('TELNYX_CALL_CONTROL_CONNECTION_ID');
    if (!connectionId) {
      log('config_error', { requestId, reason: 'missing_telnyx_connection_id' });
      return respond(
        503,
        {
          error: 'Parallel dialing requires a Call Control connection. Set TELNYX_CONNECTION_ID in Supabase secrets. In Telnyx Portal: create a Call Control Application with webhook URL pointing to your Supabase telnyx-webhook, then use that connection’s ID. See docs/TELNYX_CALL_CONTROL_SETUP.md.',
          code: 'MISSING_TELNYX_CONNECTION_ID',
        },
        'config_validation'
      );
    }
    log('config_ok', { requestId });

    log('fetching_dialable_contacts', { requestId, campaignId });
    const allDialable = await fetchDialableContacts(supabase, {
      campaignId,
      userId: user.id,
      offset: 0,
      limit: 5000,
    });
    log('dialable_contacts_fetched', { requestId, count: allDialable.length });

    if (allDialable.length === 0) {
      log('validation_failed', { requestId, reason: 'no_dialable_contacts' });
      return respond(400, { error: 'No dialable contacts in campaign.' }, 'validate_dialable_contacts');
    }

    log('inserting_dialer_session', { requestId });
    const { data: sessionRow, error: sessionError } = await supabase
      .from('dialer_sessions')
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        status: 'active',
        lines_count: linesCount,
        current_index: 0,
        total_contacts: allDialable.length,
        from_number: fromNumber,
      })
      .select('*')
      .single();
    if (sessionError || !sessionRow) {
      log('session_insert_error', { requestId, error: sessionError?.message });
      throw new Error(sessionError?.message ?? 'Failed to create dialer session');
    }
    log('session_created', { requestId, sessionId: sessionRow.id });

    // Telnyx POST /conferences requires call_control_id; only create when we have an agent leg.
    const conference = agentCallControlId
      ? await createConference({
          userId: user.id,
          sessionId: sessionRow.id,
          agentCallControlId,
        })
      : {
          id: null as string | null,
          name: buildConferenceName(user.id, sessionRow.id),
        };

    log('conference_ready', { requestId, agentCallControlId: !!agentCallControlId, conferenceName: conference.name });
    await supabase
      .from('dialer_sessions')
      .update({
        conference_id: conference.id,
        conference_name: conference.name,
      })
      .eq('id', sessionRow.id);
    log('conference_updated', { requestId, conferenceId: conference.id, conferenceName: conference.name });

    log('setting_redis_agent_state', { requestId });
    await setAgentSessionState(user.id, {
      sessionId: sessionRow.id,
      campaignId,
      conferenceId: conference.id,
      conferenceName: conference.name,
      linesCount,
      fromNumber,
      status: 'active',
      agentCallbackNumber,
    });

    const firstBatch = allDialable.slice(0, linesCount);
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telnyx-webhook`;
    log('firing_first_batch', { requestId, batchSize: firstBatch.length });
    await fireBatch(supabase, {
      userId: user.id,
      sessionId: sessionRow.id,
      campaignId,
      conferenceName: conference.name,
      linesCount,
      fromNumber,
      webhookUrl,
      batchIndex: 0,
      contacts: firstBatch,
    });
    log('first_batch_fired', { requestId });

    await publishDialerEvent(user.id, 'DIALER_SESSION_STARTED', {
      sessionId: sessionRow.id,
      totalContacts: allDialable.length,
      linesCount,
      conferenceName: conference.name,
      conferenceId: conference.id,
    });

    log('success', { requestId, sessionId: sessionRow.id, totalContacts: allDialable.length });
    return new Response(
      JSON.stringify({
        sessionId: sessionRow.id,
        conferenceDetails: {
          conferenceId: conference.id,
          conferenceName: conference.name,
        },
        totalContacts: allDialable.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = String(err);
    console.error('[dialer-session-start] error', err);
    log('catch_error', { requestId, message: msg });
    if (msg.includes('TELNYX_CONNECTION_REJECTED') || (msg.includes('422') && msg.includes('webhook'))) {
      return respond(
        503,
        {
          error: 'The connection ID is not valid for server-side dialing. Create a Call Control Application in the Telnyx portal with your webhook URL and set its connection ID as TELNYX_CONNECTION_ID. Do not use the WebRTC credential connection. See docs/TELNYX_CALL_CONTROL_SETUP.md.',
          code: 'INVALID_TELNYX_CONNECTION',
        },
        'telnyx_422'
      );
    }
    return respond(500, { error: msg }, 'catch_error');
  }
});
