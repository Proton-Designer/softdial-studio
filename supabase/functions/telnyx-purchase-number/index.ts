import Telnyx from 'npm:telnyx@4';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const { phone_number } = body as { phone_number?: string };

    if (!phone_number) {
      return new Response(JSON.stringify({ error: 'phone_number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('TELNYX_API_KEY');
    const connectionId = Deno.env.get('TELNYX_CREDENTIAL_CONNECTION_ID');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'TELNYX_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: 'TELNYX_CREDENTIAL_CONNECTION_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const client = new Telnyx({ apiKey });

    const numberOrder = await client.numberOrders.create({
      phone_numbers: [{ phone_number }],
      connection_id: connectionId,
    });

    const orderId = numberOrder.data?.id;
    const orderPhoneNumbers = numberOrder.data?.phone_numbers;
    if (!orderId || !orderPhoneNumbers?.length) {
      return new Response(JSON.stringify({ error: 'Failed to create number order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderedNumber = orderPhoneNumbers[0];
    const telnyxId =
      typeof orderedNumber === 'object' && orderedNumber !== null && 'id' in orderedNumber
        ? (orderedNumber as { id: string }).id
        : null;
    const num =
      typeof orderedNumber === 'object' && orderedNumber !== null && 'phone_number' in orderedNumber
        ? (orderedNumber as { phone_number: string }).phone_number
        : phone_number;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase.from('user_phone_numbers').insert({
      user_id: user.id,
      telnyx_phone_number_id: telnyxId || orderId,
      phone_number: num,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, phone_number: num }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('telnyx-purchase-number error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
