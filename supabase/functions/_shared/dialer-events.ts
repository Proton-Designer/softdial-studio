import { createClient } from 'npm:@supabase/supabase-js@2';
import { redisKeys } from './redis.ts';

export type DialerEventType =
  | 'DIALER_SESSION_STARTED'
  | 'BATCH_FIRING'
  | 'CALL_INITIATED'
  | 'CALL_ANSWERED'
  | 'HUMAN_CONNECTED'
  | 'CALL_ENDED'
  | 'CONTACT_VOICEMAIL'
  | 'CONTACT_NO_ANSWER'
  | 'BATCH_COMPLETE'
  | 'CAMPAIGN_COMPLETE'
  | 'DIALER_ERROR';

let supabaseSingleton: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (supabaseSingleton) return supabaseSingleton;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  supabaseSingleton = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return supabaseSingleton;
}

export async function publishDialerEvent<T extends Record<string, unknown>>(
  userId: string,
  type: DialerEventType,
  payload: T
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const channel = supabase.channel(redisKeys.userDialerChannel(userId), {
    config: { broadcast: { self: false } },
  });
  await channel.subscribe();
  await channel.send({
    type: 'broadcast',
    event: type,
    payload,
  });
  await supabase.removeChannel(channel);
}
