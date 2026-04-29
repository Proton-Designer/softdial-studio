import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { setAgentSessionState } from '../_shared/redis.ts';

interface PauseBody {
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
    const body = (await req.json()) as PauseBody;
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

    await supabase
      .from('dialer_sessions')
      .update({ status: 'paused' })
      .eq('id', sessionId);

    await setAgentSessionState(user.id, {
      sessionId,
      campaignId: session.campaign_id,
      conferenceId: session.conference_id,
      conferenceName: session.conference_name,
      linesCount: session.lines_count,
      fromNumber: (session as { from_number?: string }).from_number ?? '',
      status: 'paused',
    });

    return new Response(JSON.stringify({ status: 'paused' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('dialer-session-pause error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
