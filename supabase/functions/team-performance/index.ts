import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDateRange(
  range: string,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date();
  if (range === '7d') {
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
  } else if (range === '30d') {
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
  } else if (range === 'custom' && customStart && customEnd) {
    start.setTime(new Date(customStart).getTime());
    start.setUTCHours(0, 0, 0, 0);
    end.setTime(new Date(customEnd).getTime());
    end.setUTCHours(23, 59, 59, 999);
  } else {
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
  }
  return { start, end };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '7d';
    const customStart = url.searchParams.get('custom_start') || undefined;
    const customEnd = url.searchParams.get('custom_end') || undefined;

    const { start, end } = getDateRange(range, customStart, customEnd);
    const startStr = start.toISOString();
    const endStr = end.toISOString();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: rows } = await supabase
      .from('call_events')
      .select('started_at, outcome')
      .eq('user_id', user.id)
      .eq('direction', 'outbound')
      .gte('started_at', startStr)
      .lte('started_at', endStr);

    const byDay: Record<string, { calls: number; connections: number }> = {};
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      byDay[key] = { calls: 0, connections: 0 };
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const r of rows ?? []) {
      const d = (r.started_at as string).slice(0, 10);
      if (!byDay[d]) byDay[d] = { calls: 0, connections: 0 };
      byDay[d].calls += 1;
      if (r.outcome === 'answered') byDay[d].connections += 1;
    }

    const sortedDates = Object.keys(byDay).sort();
    const data = sortedDates.map((dateStr) => {
      const d = new Date(dateStr + 'T12:00:00Z');
      return {
        day: DAY_NAMES[d.getUTCDay()],
        date: dateStr,
        calls: byDay[dateStr].calls,
        connections: byDay[dateStr].connections,
      };
    });

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('team-performance error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
