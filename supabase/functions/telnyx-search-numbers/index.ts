import Telnyx from 'npm:telnyx@4';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const areaCode = (url.searchParams.get('area_code') || '').trim();
    const countryCode = url.searchParams.get('country_code') || 'US';

    const apiKey = Deno.env.get('TELNYX_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'TELNYX_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = new Telnyx({ apiKey });

    // Telnyx filter: country_code required; optional national_destination_code (area code for US).
    // best_effort: true returns numbers when strict filter has no results (per Telnyx error 10031).
    const filter: Record<string, unknown> = {
      country_code: countryCode,
      best_effort: true,
    };
    if (areaCode && countryCode === 'US') {
      filter.national_destination_code = areaCode;
    }

    const response = await client.availablePhoneNumbers.list({ filter });
    const raw = response as { data?: unknown[] };
    const list = Array.isArray(raw?.data) ? raw.data : [];

    const numbers = list.map((n: Record<string, unknown>) => {
      const cost = n.cost_information as Record<string, unknown> | undefined;
      return {
        phone_number: (n.phone_number as string) || '',
        monthly_cost: cost?.monthly_cost != null ? String(cost.monthly_cost) : undefined,
      };
    });

    return new Response(JSON.stringify({ numbers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('telnyx-search-numbers error:', err);
    const message = err instanceof Error ? err.message : String(err);
    const isTelnyxFilter =
      message.includes('10031') ||
      message.includes('best_effort') ||
      message.includes('No numbers found');
    if (isTelnyxFilter) {
      return new Response(
        JSON.stringify({
          numbers: [],
          message:
            'No numbers found for this area. Try a different area code or leave it blank for general search.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
