import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = user.id;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
    const todayStartStr = todayStart.toISOString();
    const todayEndStr = todayEnd.toISOString();

    const { data: outboundToday } = await supabase
      .from('call_events')
      .select('id, outcome, duration_seconds')
      .eq('user_id', userId)
      .eq('direction', 'outbound')
      .gte('started_at', todayStartStr)
      .lt('started_at', todayEndStr);

    const list = outboundToday ?? [];
    const callsToday = list.length;
    const answeredCount = list.filter((r: { outcome: string }) => r.outcome === 'answered').length;
    const connectRate = callsToday > 0 ? Math.round((answeredCount / callsToday) * 1000) / 10 : 0;
    const talkTimeSeconds = list
      .filter((r: { outcome: string }) => r.outcome === 'answered')
      .reduce(
        (sum: number, r: { duration_seconds?: number }) => sum + (r.duration_seconds ?? 0),
        0
      );

    const hours = Math.floor(talkTimeSeconds / 3600);
    const mins = Math.floor((talkTimeSeconds % 3600) / 60);
    const talkTimeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return new Response(
      JSON.stringify({
        callsToday,
        connectRate,
        talkTimeFormatted,
        talkTimeSeconds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('dashboard-stats error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
