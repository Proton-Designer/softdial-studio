export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/** Call this for OPTIONS preflight - returns 200 with CORS headers so browser/gateways accept the preflight. */
export function corsPreflightResponse(): Response {
  return new Response('ok', {
    status: 200,
    headers: corsHeaders,
  });
}
