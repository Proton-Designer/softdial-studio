import { Redis } from 'npm:@upstash/redis@1.35.3';

export type CallState =
  | 'initiated'
  | 'answered_pending_amd'
  | 'human_connected'
  | 'machine'
  | 'no_answer'
  | 'hangup';

export interface ActiveCallState {
  userId: string;
  sessionId: string;
  campaignId: string;
  contactId: string;
  status: CallState;
  callControlId: string;
  batchIndex: number;
  startedAt: number;
  /** Set when call.answered is processed; used for AMD grace period (treat early "machine" as human). */
  answeredAt?: number;
}

export interface SessionBatchContact {
  id: string;
  name: string;
  phone: string;
}

export interface SessionBatchState {
  activeCallIds: string[];
  humanAnsweredCallId: string | null;
  batchIndex: number;
  firedAt: number;
  /** Current batch contact previews for UI; set when batch is fired */
  contacts?: SessionBatchContact[];
}

export interface AgentSessionState {
  sessionId: string;
  campaignId: string;
  conferenceId: string | null;
  conferenceName: string;
  linesCount: number;
  fromNumber: string;
  status: 'active' | 'paused' | 'completed' | 'stopped';
  /** When set, the backend will call this number when a contact answers and join the agent to the conference for two-way audio. */
  agentCallbackNumber?: string;
}

let redisSingleton: Redis | null = null;

export function getRedis(): Redis {
  if (redisSingleton) return redisSingleton;
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL') ?? Deno.env.get('REDIS_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? Deno.env.get('REDIS_TOKEN');
  if (!url || !token) {
    throw new Error('Missing Upstash Redis env. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

export const redisKeys = {
  call: (callControlId: string) => `call:${callControlId}`,
  sessionBatch: (sessionId: string) => `session:${sessionId}:batch`,
  sessionHumanClaimed: (sessionId: string) => `session:${sessionId}:humanClaimed`,
  agentSession: (userId: string) => `agent:${userId}:session`,
  userDialerChannel: (userId: string) => `dialer:user:${userId}`,
};

export async function setCallState(state: ActiveCallState): Promise<void> {
  const redis = getRedis();
  await redis.set(redisKeys.call(state.callControlId), state, { ex: 300 });
}

export async function getCallState(callControlId: string): Promise<ActiveCallState | null> {
  const redis = getRedis();
  return (await redis.get<ActiveCallState>(redisKeys.call(callControlId))) ?? null;
}

export async function delCallState(callControlId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(redisKeys.call(callControlId));
}

export async function setSessionBatchState(sessionId: string, state: SessionBatchState): Promise<void> {
  const redis = getRedis();
  await redis.set(redisKeys.sessionBatch(sessionId), state, { ex: 600 });
}

export async function getSessionBatchState(sessionId: string): Promise<SessionBatchState | null> {
  const redis = getRedis();
  return (await redis.get<SessionBatchState>(redisKeys.sessionBatch(sessionId))) ?? null;
}

export async function setAgentSessionState(userId: string, state: AgentSessionState): Promise<void> {
  const redis = getRedis();
  await redis.set(redisKeys.agentSession(userId), state, { ex: 3600 });
}

export async function getAgentSessionState(userId: string): Promise<AgentSessionState | null> {
  const redis = getRedis();
  return (await redis.get<AgentSessionState>(redisKeys.agentSession(userId))) ?? null;
}

export async function claimHumanAnswer(sessionId: string, callControlId: string): Promise<boolean> {
  const redis = getRedis();
  const claimed = await redis.set(redisKeys.sessionHumanClaimed(sessionId), callControlId, {
    nx: true,
    ex: 300,
  });
  return claimed === 'OK';
}

export async function clearSessionState(sessionId: string, userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(redisKeys.sessionBatch(sessionId));
  await redis.del(redisKeys.sessionHumanClaimed(sessionId));
  await redis.del(redisKeys.agentSession(userId));
}
