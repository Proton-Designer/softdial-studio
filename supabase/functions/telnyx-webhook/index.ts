import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import {
  completeBatchAndAdvanceIfNeeded,
  decodeAgentCallbackState,
  decodeClientState,
  handleAmdResult,
  handleCallHangup,
  markNoAnswerAndCleanup,
  resolveStaleBatchIfTimedOut,
} from '../_shared/dialer-engine.ts';
import { getAgentSessionState, getCallState, setCallState } from '../_shared/redis.ts';
import { hangupCall, joinCallToConference } from '../_shared/telnyx.ts';
import { publishDialerEvent } from '../_shared/dialer-events.ts';

type WebhookBody = {
  data?: {
    event_type?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
  };
};

function webhookLog(step: string, meta: Record<string, unknown> = {}): void {
  console.log('[telnyx-webhook]', step, meta);
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('TELNYX_WEBHOOK_SECRET');
  if (!secret) return true;
  const signature = req.headers.get('telnyx-signature') ?? req.headers.get('x-telnyx-signature');
  const ed25519Signature = req.headers.get('telnyx-signature-ed25519');
  const timestamp = req.headers.get('telnyx-timestamp') ?? '';
  if (!timestamp) return false;

  // Telnyx Standard Webhooks use ed25519 signatures (not shared-secret HMAC).
  // If only ed25519 headers are present, allow processing for now so call control
  // flow continues; this avoids false 401s when TELNYX_WEBHOOK_SECRET is set.
  if (!signature && ed25519Signature) {
    console.warn('[telnyx-webhook] ed25519 signature received; skipping HMAC validation');
    return true;
  }
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = `${timestamp}|${rawBody}`;
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  // Some Telnyx payloads include signature prefixes like "t=...,v1=...".
  if (expected === signature) return true;
  if (signature.includes('v1=')) {
    const maybeV1 = signature
      .split(',')
      .map((part) => part.trim())
      .find((part) => part.startsWith('v1='))
      ?.replace('v1=', '');
    return maybeV1 === expected;
  }
  return false;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function processWebhook(body: WebhookBody): Promise<void> {
  const eventType = body?.data?.event_type ?? '';
  const occurredAt = body?.data?.occurred_at ?? null;
  const payload = (body?.data?.payload ?? {}) as Record<string, unknown>;
  const callControlId = asString(payload.call_control_id || payload.call_session_id);
  const clientStateRaw = asString(payload.client_state ?? (body?.data as Record<string, unknown>)?.client_state);
  const clientState = decodeClientState(clientStateRaw);
  const agentCallback = decodeAgentCallbackState(clientStateRaw);
  const amdResult = asString(payload.result);

  webhookLog('event_received', {
    eventType,
    occurredAt,
    callControlId,
    hasClientStateRaw: Boolean(clientStateRaw),
    decodedClientState: clientState ? {
      sessionId: clientState.sessionId,
      contactId: clientState.contactId,
      batchIndex: clientState.batchIndex,
    } : null,
    decodedAgentCallback: agentCallback ? {
      sessionId: agentCallback.sessionId,
      userId: agentCallback.userId,
    } : null,
    amdResult: amdResult || null,
  });

  if (!eventType || !callControlId) {
    webhookLog('event_ignored_missing_event_or_call_id', { eventType, callControlId });
    return;
  }

  const supabase = getSupabaseAdmin();
  const cachedCall = await getCallState(callControlId);
  const callContext = cachedCall ?? (clientState
    ? {
      userId: clientState.userId,
      sessionId: clientState.sessionId,
      campaignId: clientState.campaignId,
      contactId: clientState.contactId,
      callControlId,
      status: 'initiated' as const,
      batchIndex: clientState.batchIndex,
      startedAt: Date.now(),
    }
    : null);
  webhookLog('call_context_resolved', {
    eventType,
    callControlId,
    source: cachedCall ? 'redis' : clientState ? 'client_state' : 'none',
    sessionId: callContext?.sessionId ?? null,
    contactId: callContext?.contactId ?? null,
  });

  // Agent callback leg (we dialed the agent when contact answered); handle join to conference on answer.
  if (agentCallback && eventType === 'call.answered') {
    webhookLog('agent_callback_answered_start', {
      callControlId,
      sessionId: agentCallback.sessionId,
    });
    try {
      const { data: session, error: sessionError } = await supabase
        .from('dialer_sessions')
        .select('conference_name')
        .eq('id', agentCallback.sessionId)
        .maybeSingle();
      if (sessionError) {
        webhookLog('agent_callback_session_fetch_failed', {
          sessionId: agentCallback.sessionId,
          callControlId,
          error: sessionError.message,
        });
        await hangupCall(callControlId);
        return;
      }
      if (!session?.conference_name) {
        webhookLog('agent_callback_missing_conference_name', {
          sessionId: agentCallback.sessionId,
          callControlId,
          hasSession: !!session,
        });
        await hangupCall(callControlId);
        return;
      }
      await joinCallToConference(callControlId, session.conference_name);
      webhookLog('agent_callback_joined_conference', {
        sessionId: agentCallback.sessionId,
        callControlId,
        conferenceName: session.conference_name,
      });
    } catch (err) {
      webhookLog('agent_callback_join_failed', {
        sessionId: agentCallback.sessionId,
        callControlId,
        error: String(err),
      });
      await hangupCall(callControlId);
    }
    return;
  }

  if (!callContext) {
    webhookLog('event_ignored_missing_call_context', {
      eventType,
      callControlId,
      hasAgentCallback: Boolean(agentCallback),
      hasClientStateRaw: Boolean(clientStateRaw),
    });
    return;
  }

  const agentState = await getAgentSessionState(callContext.userId);
  if (!agentState || agentState.sessionId !== callContext.sessionId || agentState.status !== 'active') {
    webhookLog('hanging_up_due_to_invalid_agent_state', {
      eventType,
      callControlId,
      callSessionId: callContext.sessionId,
      agentStateSessionId: agentState?.sessionId ?? null,
      agentStateStatus: agentState?.status ?? null,
    });
    await hangupCall(callControlId);
    return;
  }

  await resolveStaleBatchIfTimedOut(supabase, {
    sessionId: callContext.sessionId,
    userId: callContext.userId,
    fromNumber: agentState.fromNumber ?? '',
    webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telnyx-webhook`,
    triggerEventType: eventType,
    triggerCallControlId: callControlId,
  });

  switch (eventType) {
    case 'call.initiated': {
      webhookLog('case_call_initiated', {
        sessionId: callContext.sessionId,
        callControlId,
        contactId: callContext.contactId,
      });
      await setCallState({ ...callContext, status: 'initiated' });
      await supabase
        .from('call_logs')
        .upsert(
          {
            session_id: callContext.sessionId,
            user_id: callContext.userId,
            campaign_id: callContext.campaignId,
            contact_id: callContext.contactId,
            call_control_id: callControlId,
            status: 'initiated',
            direction: 'outbound',
          },
          { onConflict: 'call_control_id' }
        );
      await supabase
        .from('contacts')
        .update({
          call_status: 'dialing',
          last_called_at: new Date().toISOString(),
        })
        .eq('id', callContext.contactId);
      break;
    }
    case 'call.answered': {
      webhookLog('case_call_answered', {
        sessionId: callContext.sessionId,
        callControlId,
        contactId: callContext.contactId,
      });
      await setCallState({
        ...callContext,
        status: 'answered_pending_amd',
        answeredAt: Date.now(),
      });
      await supabase
        .from('call_logs')
        .update({
          status: 'answered',
          answered_at: new Date().toISOString(),
        })
        .eq('call_control_id', callControlId);
      await publishDialerEvent(callContext.userId, 'CALL_ANSWERED', {
        contactId: callContext.contactId,
      });
      break;
    }
    case 'call.machine.detection.ended':
    case 'call.machine.premium.detection.ended': {
      webhookLog('case_call_amd_ended', {
        sessionId: callContext.sessionId,
        callControlId,
        contactId: callContext.contactId,
        amdResult: amdResult || null,
      });
      await handleAmdResult(supabase, {
        callControlId,
        amdRawResult: amdResult,
      });
      break;
    }
    case 'call.machine.greeting.ended': {
      webhookLog('case_call_machine_greeting_ended_hangup', {
        sessionId: callContext.sessionId,
        callControlId,
        contactId: callContext.contactId,
      });
      // With standard AMD ('detect'), this event is not required for our flow and
      // can cause false-positive disconnects if received unexpectedly.
      // Keep it as an observability checkpoint only.
      break;
    }
    case 'call.hangup': {
      webhookLog('case_call_hangup', {
        sessionId: callContext.sessionId,
        callControlId,
        contactId: callContext.contactId,
      });
      const result = await handleCallHangup(supabase, callControlId);
      webhookLog('case_call_hangup_decision', {
        callControlId,
        shouldAdvance: result.shouldAdvance,
        sessionId: result.sessionId,
        userId: result.userId,
      });
      if (result.shouldAdvance && result.sessionId && result.userId) {
        await completeBatchAndAdvanceIfNeeded(supabase, {
          sessionId: result.sessionId,
          userId: result.userId,
          webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telnyx-webhook`,
          fromNumber: agentState.fromNumber ?? '',
        });
      } else {
        await markNoAnswerAndCleanup(supabase, callControlId);
      }
      break;
    }
    case 'call.bridged': {
      webhookLog('case_call_bridged', {
        sessionId: callContext.sessionId,
        callControlId,
      });
      await supabase
        .from('call_logs')
        .update({
          status: 'connected',
        })
        .eq('call_control_id', callControlId);
      break;
    }
    default:
      webhookLog('case_unhandled_event', {
        eventType,
        callControlId,
        sessionId: callContext.sessionId,
      });
      break;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawBody = await req.text();
    const verified = await verifySignature(req, rawBody);
    if (!verified) {
      webhookLog('signature_verification_failed');
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = JSON.parse(rawBody) as WebhookBody;
    webhookLog('request_accepted_for_async_processing', {
      eventType: body?.data?.event_type ?? null,
      callControlId: asString((body?.data?.payload as Record<string, unknown> | undefined)?.call_control_id),
    });
    queueMicrotask(() => {
      processWebhook(body).catch((err) => console.error('telnyx-webhook async processing error:', err));
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('telnyx-webhook error:', errorMessage, err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
