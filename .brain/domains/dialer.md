---
id: domain.dialer
title: Parallel Dialer
layer: L2
type: domain
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/_shared/**
  - supabase/functions/dialer-session-*/**
  - supabase/functions/telnyx-webhook/**
  - apps/web/src/hooks/useDialerSession.ts
  - apps/web/src/components/dialer/**
  - supabase/migrations/**
related:
  - domain.telephony
  - domain.campaigns
  - arch.system-overview
answers:
  - "how does the dialer pick which answered call the agent talks to, and what counts as human"
  - "what Redis keys and TTLs does a dial session depend on"
  - "how does the dialer advance from one batch of lines to the next"
  - "why did a dial session stall, or calls_connected stay 0, or a webhook replay break it"
  - "what does PARALLEL_DIALER_ENABLED actually gate"
covers: "The dial-session engine: batching contacts onto N parallel Telnyx lines, AMD triage, human-answer race resolution, conference bridging, batch advance, and the live UI that mirrors it."
excludes: "Telnyx API wrappers, number purchase/search and WebRTC credentials (domain.telephony); campaign and lead list construction (domain.campaigns)."
tokens_est: 2694
source_hash: 1744fad5df8daa881e294a400e9f3d8fa2292fdf9eb517551941572d85e6c2e8
---

# Parallel Dialer

## Purpose

Lets one agent work a campaign list far faster by ringing several contacts at once and connecting the agent only to the first real human who picks up; voicemail,
silence and no-answer are hung up and recorded silently. A "session" is one user × one campaign × one run.

## Key concepts

| Term | Means |
|---|---|
| Batch | The `lines_count` (1–5) contacts dialed at once, identified by `batchIndex`; a session is a row in `dialer_sessions`. |
| Winner | The one leg in a batch that claimed the human lock; all others are hung up. AMD (answering-machine detection) decides, via Telnyx `answering_machine_detection: 'detect'`. |
| Client state | Base64 JSON round-tripped through Telnyx so a webhook knows its session/contact. Two shapes: contact leg (`DecodedClientState`), agent callback leg (`{t:'agent'}`). |
| Conference | Telnyx conference `agent_session_{userId}_{sessionId}` where agent + winner meet; the agent callback is an optional PSTN number dialed *after* a human answers to bridge the agent in. |

## Where the code lives

| What | Path | Notes |
|---|---|---|
| Core engine | `supabase/functions/_shared/dialer-engine.ts` | Every state transition |
| AMD mapping | `supabase/functions/_shared/amd.ts` | 22 lines; read in full |
| Redis state, locks, TTLs | `supabase/functions/_shared/redis.ts` | |
| Realtime fan-out | `supabase/functions/_shared/dialer-events.ts` | Supabase broadcast, not Redis pub/sub |
| Telnyx REST | `supabase/functions/_shared/telnyx.ts` | dial / conference / join / hangup |
| Session start | `supabase/functions/dialer-session-start/index.ts` | Validation, conference, batch 0 |
| Session control | `supabase/functions/dialer-session-{get,active,pause,stop,hangup-live}/index.ts` | |
| Webhook ingress | `supabase/functions/telnyx-webhook/index.ts` | The only driver of batch progress |
| Client | `apps/web/src/hooks/useDialerSession.ts`, `apps/web/src/lib/api.ts` | Hook subscribes to `dialer:user:{userId}` |
| UI | `apps/web/src/components/Dialer.tsx`, `apps/web/src/components/dialer/*.tsx` | `ParallelDialerUI.tsx` is the parallel surface |
| Schema | `supabase/migrations/20260207000100_create_dialer_sessions_and_call_logs.sql` | plus `…20260208000001_add_dialer_sessions_from_number.sql` |

## How it works

1. `dialer-session-start` checks the feature flag, `fromNumber` ownership against `user_phone_numbers`, that no `active` session exists, and Telnyx config; inserts the
   session; creates the conference **only if** an `agentCallControlId` was passed (`index.ts:210`); writes `agent:{userId}:session` to Redis; fires batch 0.
2. `fireBatch` (`dialer-engine.ts:120`) dials each contact **sequentially**, writes `call:{id}` state, upserts `call_logs`, marks the contact `dialing`, then writes
   `session:{id}:batch` and broadcasts `BATCH_FIRING` / `CALL_INITIATED`.
3. Telnyx posts to `telnyx-webhook`, which ACKs immediately and processes in a `queueMicrotask` (`index.ts:376`). Every event re-checks agent session state, runs
   `resolveStaleBatchIfTimedOut`, then hits the per-event switch.
4. On `call.machine.detection.ended`, `handleAmdResult` (`dialer-engine.ts:249`) normalizes the result, applies the 5s grace override, then takes the Redis NX lock via
   `claimHumanAnswer`. Losers hang up; the winner joins (or creates) the conference, and the agent callback is dialed if no agent leg existed.
5. On `call.hangup`, `handleCallHangup` (`:543`) drops the leg and returns `shouldAdvance` when the live human leg ended or the batch emptied;
   `completeBatchAndAdvanceIfNeeded` (`:602`) then advances `current_index` by `lines_count` and fires the next batch, or marks the session `completed`.

## Integration points

| Direction | With | Via |
|---|---|---|
| Depends on | domain.telephony | `supabase/functions/_shared/telnyx.ts`; `TELNYX_CONNECTION_ID` must be a Call Control app (`docs/guides/telnyx-call-control-setup.md`) |
| Depends on | domain.campaigns | `fetchDialableContacts` reads `campaign_leads` ⋈ `contacts` |
| Depends on | Upstash Redis | all live call/batch/lock state (`supabase/functions/_shared/redis.ts`) |
| Depended on by | Web UI | Supabase Realtime broadcast channel `dialer:user:{userId}` |

## Constraints & gotchas

- **The human-answer lock is per session, not per batch.** `claimHumanAnswer` (`redis.ts:110`) is `SET NX EX 300` on `session:{id}:humanClaimed`, deleted only by
  `clearSessionState` on stop (`redis.ts:119`). After batch 0's winner, every later batch's human answer fails the claim and is **hung up** (`dialer-engine.ts:331-340`)
  until the 300s TTL lapses. Start here for any "won't connect" bug.
- **Redis TTLs are the real session limits:** call `300s`, batch `600s`, agent session `3600s`, human lock `300s`. On expiry handlers return silently
  (`dialer-engine.ts:261`, `:267`); past ~1h the agent-state check in `telnyx-webhook/index.ts:199-213` hangs up *every* remaining call.
- **Webhooks are at-least-once with no idempotency guard** — the only dedupe is the `call_logs` upsert on `call_control_id`. A replayed `call.machine.detection.ended`
  re-enters `handleAmdResult`, fails the claim, and hangs up the live winner.
- **Signature verification is effectively off:** `verifySignature` returns `true` when `TELNYX_WEBHOOK_SECRET` is unset *and* when only ed25519 headers are present
  (`telnyx-webhook/index.ts:33-46`). Treat it as unauthenticated.
- **AMD: `not_sure` counts as human** (`amd.ts:20`), `silence`/`fax_detected` as machine (`amd.ts:16`), and a `machine` verdict inside 5000 ms of answer is overridden
  to human (`dialer-engine.ts:284-299`). `PREMIUM_AMD_CONFIG` is exported but unused — the dial sends plain `'detect'` (`telnyx.ts:133`).
- **Nothing runs on a timer.** The 45s stale-batch sweep (`dialer-engine.ts:756`) fires only when another webhook for that session arrives — no cron. All legs quiet ⇒
  wedged.
- **Batch state is unguarded read-modify-write:** `handleCallHangup` reads then writes `session:{id}:batch` (`:554-575`), so concurrent hangups clobber `activeCallIds`.
- **Losing legs never get `no_answer`.** On `call.hangup` with `shouldAdvance=false` the webhook calls `markNoAnswerAndCleanup` (`telnyx-webhook/index.ts:322`), but
  `handleCallHangup` already ran `delCallState` (`dialer-engine.ts:555`) so it returns at `:709` — those contacts stay `call_status='dialing'` forever.
- **Batch advance skips contacts:** `current_index` grows by `lines_count`, but `fetchDialableContacts` excludes `contacted`/`do_not_call` (`:105`), so the window
  shrinks under a fixed offset — every connect silently skips a lead.
- **`calls_connected`/`calls_voicemail`/`calls_no_answer` are never written** — only `calls_made` is (`dialer-engine.ts:234`). UI counters come purely from broadcasts
  and reset to the DB's zeros on reload (`useDialerSession.ts:86`).
- **`dialer-session-active` orders by `created_at`, which `dialer_sessions` lacks** (schema has `started_at`); the error is swallowed, so it always reports no active
  session (`dialer-session-active/index.ts:23-36`).
- **Pause is one-way** — no resume endpoint; `paused` fails the webhook guard and `completeBatchAndAdvanceIfNeeded`'s `status !== 'active'` check (`:617`).
- **`PARALLEL_DIALER_ENABLED=false` only 403s `dialer-session-start`** (`index.ts:50-58`); webhook/pause/stop/hangup-live stay live, so in-flight sessions keep running.
  The UI gate is the separate `VITE_PARALLEL_DIALER_ENABLED` (`apps/web/src/lib/api.ts:9`).
- RLS on `dialer_sessions`/`call_logs` grants **SELECT only**; all writes go through edge functions with the service-role key. Events are Realtime broadcasts, not
  persisted: a client not subscribed when one fires never sees it, and `dialer-session-get` is the only catch-up path.

## Not covered here

- Telnyx numbers, WebRTC credentials, raw API wrappers → `.brain/domains/telephony.md`; campaigns and lead lists → `.brain/domains/campaigns.md`; cross-service flow and
  deployment → `.brain/architecture/system-overview.md`

## Unverified

- `.brain/domains/telephony.md` and `.brain/domains/campaigns.md` did not exist when this was written; confirm their ids before relying on those links.
- `apps/web/src/components/dialer/ContactQueue.tsx` exists but nothing under `apps/web/src` imports it — appears dead.
- Telnyx's webhook retry policy is portal config, not in this repo; at-least-once above is a safe assumption, not a confirmed observation.
