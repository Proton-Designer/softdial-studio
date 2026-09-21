---
id: arch.data-flows
title: Data Flows
layer: L2
type: architecture
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/_shared/dialer-engine.ts
  - supabase/functions/_shared/dialer-events.ts
  - supabase/functions/_shared/redis.ts
  - supabase/functions/telnyx-webhook/index.ts
  - apps/web/src/hooks/useDialerSession.ts
related:
  - arch.system-overview
  - arch.dependency-graph
  - domain.dialer
answers:
  - "how does data move through the system"
  - "what happens when a call is answered"
  - "how does the UI know a call connected"
  - "what is stored in Redis versus Postgres"
  - "what events does the dialer emit"
  - "how is a CSV import processed"
covers: "Runtime data movement: the dial loop, the realtime event stream, the store split, and the CSV import path"
excludes: "Which module imports which (see arch.dependency-graph), per-domain rules (see .brain/domains/)"
tokens_est: 1919
source_hash: 35270b375aee6e7b32f9cb54b38fb07d8d62b20379c4f34d14b9450a4f2df655
---

# Data Flows

## Where state lives, and why it is split

| Store | Holds | Lifetime | Losing it means |
|---|---|---|---|
| **Postgres** | Contacts, campaigns, leads, dial sessions, call logs, call events, notifications, preferences, phone numbers | Durable | Total data loss |
| **Redis** | Per-call state, per-batch state, the agent's active-session slot, the human-answer claim | Ephemeral (claim TTL: 300s) | In-flight calls lose coordination; **history is intact** |
| **Browser** | UI state, Supabase session, `ACTIVE_AGENT_CALL_CONTROL_ID` in `localStorage` | Tab/session | Reload recovers via `dialer-session-active` |

Redis keys (`_shared/redis.ts:61`):

```
call:<callControlId>              → ActiveCallState
session:<sessionId>:batch         → SessionBatchState
session:<sessionId>:humanClaimed  → the winning callControlId   (SET NX, EX 300)
agent:<userId>:session            → AgentSessionState
dialer:user:<userId>              → Realtime broadcast channel name (not a key)
```

**The split is not arbitrary.** Redis exists for one thing Postgres cannot do
cheaply enough here: an atomic single-winner claim across concurrent stateless
webhook invocations. Everything else in Redis is there because it is already the
hot path.

## The dial loop

```
 CLIENT                EDGE FUNCTION            REDIS / PG              TELNYX
   │
   ├─ startDialerSession ──►
   │                    dialer-session-start
   │                      ├─ gate: PARALLEL_DIALER_ENABLED
   │                      ├─ claim ────────────► agent:<uid>:session
   │                      ├─ insert ──────────► dialer_sessions (PG)
   │                      └─ fireBatch() ──────────────────────────────► POST /calls  ×N
   │                            └─ write ─────► call:<id> ×N              (client_state
   │                            └─ write ─────► session:<sid>:batch        encodes sid
   │  ◄── DIALER_SESSION_STARTED, BATCH_FIRING, CALL_INITIATED ×N          + contact)
   │        (Supabase Realtime broadcast on dialer:user:<uid>)
   │                                                                  ┌── calls ring
   │                                                                  └── AMD runs
   │                          telnyx-webhook  ◄──── call.answered / AMD result ───┘
   │                            └─ handleAmdResult()
   │                                 ├─ machine → mark contact voicemail, hang up leg
   │                                 └─ human   → claimHumanAnswer()  [SET NX]
   │                                        ├─ WON  → bridge to agent
   │                                        │         hang up EVERY other leg in batch
   │                                        └─ LOST → hang up this leg
   │  ◄── CALL_ANSWERED / HUMAN_CONNECTED / CONTACT_VOICEMAIL
   │
   │                          telnyx-webhook  ◄──── call.hangup ───────────────────┘
   │                            └─ handleCallHangup()
   │                                 └─ completeBatchAndAdvanceIfNeeded()
   │                                       └─ fireBatch()  → next batch, or
   │  ◄── CALL_ENDED, BATCH_COMPLETE, CAMPAIGN_COMPLETE
```

**Read that diagram once more for the shape, not the detail:** the client starts
the loop and then only *observes*. Every subsequent advance is driven by an
inbound webhook. There is no polling and no server-side timer.

### `client_state` is the correlation key

Telnyx does not know about sessions. The engine encodes
`{sessionId, contactId, userId}` into the Telnyx `client_state` field
(`encodeClientState`, `_shared/dialer-engine.ts:37`) and decodes it on every
inbound event. **If `client_state` is dropped or mangled, the event cannot be
attributed to a session and the loop stalls silently.**

## The realtime event stream

One channel per user: `dialer:user:<userId>`, published with the service-role
client and `broadcast: { self: false }` (`_shared/dialer-events.ts:38`).

Eleven event types:

| Event | Emitted when |
|---|---|
| `DIALER_SESSION_STARTED` | Session created |
| `BATCH_FIRING` | A batch is about to originate |
| `CALL_INITIATED` | One leg placed |
| `CALL_ANSWERED` | A leg answered (before AMD verdict) |
| `HUMAN_CONNECTED` | AMD said human and this leg won the claim |
| `CONTACT_VOICEMAIL` | AMD said machine |
| `CONTACT_NO_ANSWER` | Leg ended without a human |
| `CALL_ENDED` | The live call finished |
| `BATCH_COMPLETE` | All legs in a batch resolved |
| `CAMPAIGN_COMPLETE` | No dialable contacts remain |
| `DIALER_ERROR` | Engine error |

The client subscribes in `useDialerSession.ts` and reduces these into UI state.
**This stream is advisory, not authoritative** — it is best-effort delivery over
Realtime. Postgres and Redis hold the truth. A dropped broadcast leaves the UI
stale while the call proceeds normally; `dialer-session-get` re-syncs.

## CSV import

Deliberately two round-trips:

```
file → [browser reads text]
     → contacts-parse-csv  → returns detected columns + proposed field mapping
     → [user corrects the mapping in ImportContactsModal]
     → contacts-import     → validates, de-duplicates, inserts
                           → optionally attaches to a campaign (campaign_leads)
```

The split exists so the user can correct the mapping before anything is written.
The full CSV text is re-sent on the second call; **nothing is stored between the
two steps**, so the parse step is free of cleanup obligations.

## Unverified

- Event-ordering guarantees on the Realtime broadcast were not tested. The client
  reducer is written to tolerate out-of-order arrival, which suggests ordering is
  not assumed, but this was inferred from the code's defensiveness rather than
  confirmed.
- The 300s TTL on `session:<id>:humanClaimed` is read from `redis.ts:112`. Whether
  that value was chosen to match a specific Telnyx call-duration limit is not
  recorded anywhere.
