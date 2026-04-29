import Telnyx from 'npm:telnyx@4';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const apiKey = Deno.env.get('TELNYX_API_KEY');
    const connectionId = Deno.env.get('TELNYX_CREDENTIAL_CONNECTION_ID');

    if (!apiKey || !connectionId) {
      return new Response(
        JSON.stringify({ error: 'Telnyx not configured (TELNYX_API_KEY, TELNYX_CREDENTIAL_CONNECTION_ID)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const client = new Telnyx({ apiKey });
    const cred = await client.telephonyCredentials.create({ connection_id: connectionId });
    const credId = (cred as { data?: { id?: string } })?.data?.id;
    if (!credId) {
      console.error('telephonyCredentials.create did not return credential id', cred);
      return new Response(
        JSON.stringify({ error: 'Failed to create telephony credential (no id)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Telnyx token API directly so we control response parsing (SDK response shape varies)
    const tokenApiRes = await fetch(`https://api.telnyx.com/v2/telephony_credentials/${encodeURIComponent(credId)}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    const tokenBody = await tokenApiRes.text();
    if (!tokenApiRes.ok) {
      console.error('Telnyx token API error', tokenApiRes.status, tokenBody);
      return new Response(
        JSON.stringify({ error: 'Telnyx token API failed. Check credential connection ID and API key.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    let token = '';
    try {
      const parsed = JSON.parse(tokenBody) as Record<string, unknown>;
      const data = parsed?.data as string | { token?: string } | undefined;
      if (typeof data === 'string') token = data;
      else if (data && typeof data === 'object' && typeof (data as { token?: string }).token === 'string') token = (data as { token: string }).token;
      else if (typeof parsed?.token === 'string') token = parsed.token as string;
    } catch {
      // Response might be plain JWT string
      if (tokenBody.startsWith('eyJ')) token = tokenBody.trim();
    }
    if (!token) {
      console.error('Token response missing token field. Body length:', tokenBody?.length, 'starts with:', tokenBody?.slice(0, 80));
      return new Response(
        JSON.stringify({ error: 'Failed to get WebRTC token from Telnyx. Check credential connection.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('telnyx-webrtc-credentials error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
