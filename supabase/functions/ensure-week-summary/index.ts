import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

function getLastWeekBounds(): { start: string; end: string; label: string } {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const lastMonday = new Date(now);
  lastMonday.setUTCDate(now.getUTCDate() + diffToMonday - 7);
  lastMonday.setUTCHours(0, 0, 0, 0);
  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
  lastSunday.setUTCHours(23, 59, 59, 999);
  const start = lastMonday.toISOString().slice(0, 10);
  const end = lastSunday.toISOString().slice(0, 10);
  const label = `${start} – ${end}`;
  return { start: lastMonday.toISOString(), end: lastSunday.toISOString(), label };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const now = new Date();
    if (now.getUTCDay() !== 5) {
      return new Response(
        JSON.stringify({ created: false, message: 'Week summary is only created on Fridays' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { start, end, label } = getLastWeekBounds();
    const startStr = start.slice(0, 10);
    const endStr = end.slice(0, 10);

    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'week_summary')
      .like('body', `%${startStr}%`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ created: false, message: 'Week summary already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: rows } = await supabase
      .from('call_events')
      .select('outcome, duration_seconds')
      .eq('user_id', user.id)
      .eq('direction', 'outbound')
      .gte('started_at', start)
      .lte('started_at', end);

    const list = rows ?? [];
    const calls = list.length;
    const answered = list.filter((r: { outcome: string }) => r.outcome === 'answered').length;
    const connectRate = calls > 0 ? Math.round((answered / calls) * 1000) / 10 : 0;
    const talkTimeSeconds = list
      .filter((r: { outcome: string }) => r.outcome === 'answered')
      .reduce((sum: number, r: { duration_seconds?: number }) => sum + (r.duration_seconds ?? 0), 0);
    const hours = Math.floor(talkTimeSeconds / 3600);
    const mins = Math.floor((talkTimeSeconds % 3600) / 60);
    const talkTimeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const body = JSON.stringify({
      week_start: startStr,
      week_end: endStr,
      calls,
      connect_rate: connectRate,
      talk_time_seconds: talkTimeSeconds,
      talk_time_formatted: talkTimeFormatted,
    });

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'week_summary',
      title: `Week summary – ${label}`,
      body,
    });

    return new Response(
      JSON.stringify({ created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('ensure-week-summary error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
