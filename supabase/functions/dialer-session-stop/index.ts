import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { clearSessionState, getAgentSessionState } from '../_shared/redis.ts';
import { getActiveCallIdsForSession } from '../_shared/dialer-engine.ts';
import { hangupCall } from '../_shared/telnyx.ts';
import { publishDialerEvent } from '../_shared/dialer-events.ts';

interface StopBody {
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
    const body = (await req.json()) as StopBody;
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
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const activeCallIds = await getActiveCallIdsForSession(sessionId);
    for (const callId of activeCallIds) {
      await hangupCall(callId);
    }

    await supabase
      .from('dialer_sessions')
      .update({
        status: 'stopped',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    await clearSessionState(sessionId, user.id);

    const { data: summary } = await supabase
      .from('dialer_sessions')
      .select('calls_made,calls_connected,calls_voicemail,calls_no_answer,total_contacts')
      .eq('id', sessionId)
      .maybeSingle();

    await publishDialerEvent(user.id, 'CAMPAIGN_COMPLETE', {
      sessionId,
      summary: summary ?? {},
      stopped: true,
    });

    const agentSession = await getAgentSessionState(user.id);

    return new Response(
      JSON.stringify({
        summary: summary ?? {},
        previousAgentSession: agentSession,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('dialer-session-stop error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
