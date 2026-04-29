import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { getSessionBatchState } from '../_shared/redis.ts';
import { completeBatchAndAdvanceIfNeeded, handleCallHangup } from '../_shared/dialer-engine.ts';
import { hangupCall } from '../_shared/telnyx.ts';
import { getAgentSessionState } from '../_shared/redis.ts';

interface HangupLiveBody {
  sessionId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as HangupLiveBody;
    const sessionId = body.sessionId?.trim();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: session } = await supabase
      .from('dialer_sessions')
      .select('id, user_id, status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!session || session.status !== 'active') {
      console.warn('[hangup-live] session_not_found_or_inactive', { sessionId });
      return new Response(JSON.stringify({ error: 'Session not found or not active' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const batchState = await getSessionBatchState(sessionId);
    const liveCallId = batchState?.humanAnsweredCallId ?? null;
    if (!liveCallId) {
      console.warn('[hangup-live] no_live_call_to_end', { sessionId });
      // Identify if we have any active calls at all
      const activeCallIds = batchState?.activeCallIds ?? [];
      if (activeCallIds.length > 0) {
        // Fallback: If no "Human" call is registered but there are active calls, maybe we should hang them all up?
        // For now, let's just log this case.
        console.warn('[hangup-live] has_active_calls_but_no_human_winner', { count: activeCallIds.length });
      }
      return new Response(JSON.stringify({ error: 'No live call to end' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[hangup-live] hanging_up_live_call', { sessionId, liveCallId });

    await hangupCall(liveCallId);
    const result = await handleCallHangup(supabase, liveCallId);

    if (result.shouldAdvance && result.sessionId && result.userId) {
      const agentState = await getAgentSessionState(result.userId);
      await completeBatchAndAdvanceIfNeeded(supabase, {
        sessionId: result.sessionId,
        userId: result.userId,
        webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/telnyx-webhook`,
        fromNumber: agentState?.fromNumber ?? '',
      });
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('dialer-session-hangup-live error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
