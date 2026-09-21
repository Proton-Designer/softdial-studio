---
id: arch.system-overview
title: System Overview
layer: L2
type: architecture
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - apps/web/src/**
  - supabase/functions/**
  - supabase/migrations/**
related:
  - arch.dependency-graph
  - arch.data-flows
  - arch.service-map
  - map.repository
answers:
  - "what is the architecture"
  - "how does this system work"
  - "what are the components"
  - "where does a new feature belong"
  - "what external services does this depend on"
  - "why is there a Redis if there is already a Postgres"
covers: "Components, trust boundaries, the dial lifecycle end to end, external dependencies, and where new code belongs"
excludes: "Per-function detail (see arch.service-map), import rules (see arch.dependency-graph), payload-level flows (see arch.data-flows), per-capability logic (see .brain/domains/)"
tokens_est: 2080
source_hash: 96056caa8c656e85e4e0c0c87feaf4c80faa4432241ccd348e515b256a3455e2
---

# System Overview

Softdial Studio is a **parallel dialer**: one agent, many simultaneous outbound
call legs, with answering-machine detection filtering the ones a human never
picks up. It is a three-tier system with an unusual fourth participant — the
telephony provider calls *into* the backend, and that inbound webhook is what
actually drives the dial loop forward.

## Components

| Component | Runtime | Location | Role |
|---|---|---|---|
| **Web client** | Browser (React 18 / Vite 6) | `apps/web/` | All UI. Holds the agent's WebRTC audio leg. |
| **Edge Functions** | Deno (Supabase) | `supabase/functions/` | 16 HTTP endpoints. All business logic. |
| **Shared modules** | Deno | `supabase/functions/_shared/` | The dial engine and provider clients. Not deployed alone. |
| **Postgres** | Supabase | `supabase/migrations/` | Durable record. 9 tables, RLS-scoped per user. |
| **Redis** | Upstash (REST) | — | Ephemeral live-call state. Not durable, deliberately. |
| **Telnyx** | External | — | Call Control (dialing, AMD, bridging) + WebRTC (agent audio). |

There is **no server of our own**. Everything server-side is a Supabase Edge
Function; there is no long-running process, which is the single most important
constraint in this architecture — see *Consequences* below.

## Trust boundaries

```
  ┌─ Browser ────────────────┐
  │  React app               │   Public. Holds the anon key and a user JWT.
  │  @telnyx/webrtc          │   Anything in apps/web/.env ships to users.
  └──────────┬───────────────┘
             │ HTTPS + Authorization: Bearer <supabase session JWT>
  ┌──────────▼───────────────┐
  │  Edge Functions (Deno)   │   Trusted. Holds service-role key, Telnyx API
  │                          │   key, webhook secret, Redis token.
  └──┬────────┬───────────┬──┘
     │        │           │
 Postgres  Upstash    Telnyx API
  (RLS)     Redis
     ▲
     │  ◄── POST /telnyx-webhook ── Telnyx (UNAUTHENTICATED at the gateway)
```

**The webhook is the sharp edge.** `telnyx-webhook` is deployed with
`--no-verify-jwt` because Telnyx has no Supabase session. It is the only
endpoint reachable without a user token, and the only thing standing between the
public internet and the dial engine is the signature check against
`TELNYX_WEBHOOK_SECRET`. Every other function verifies the caller's JWT in-process
via `supabase/functions/_shared/auth.ts`.

## The dial lifecycle

This is the flow worth understanding before changing anything:

1. **Start.** Client calls `dialer-session-start` with a campaign and a line
   count. The function refuses unless `PARALLEL_DIALER_ENABLED=true`, claims the
   agent's session slot in Redis (`agent:<userId>:session`), and calls
   `fireBatch()`.
2. **Fire.** `fireBatch()` (`_shared/dialer-engine.ts:120`) originates N calls
   through the Telnyx Call Control API, one per contact, each carrying an encoded
   `client_state` that identifies the session and contact.
3. **Telnyx works.** Calls ring. Telnyx runs AMD on each answered leg.
4. **Webhook drives everything.** Telnyx POSTs each event to `telnyx-webhook`,
   which dispatches into the engine: `handleAmdResult()`, `handleCallHangup()`,
   `completeBatchAndAdvanceIfNeeded()`.
5. **First human wins.** On a `human` AMD result the engine calls
   `claimHumanAnswer()` — a Redis `SET NX` on `session:<id>:humanClaimed`. Exactly
   one leg wins that race. The winner is bridged to the agent; **every other leg
   in the batch is hung up immediately.**
6. **Advance.** When the live call ends, the batch completes and the next one
   fires. Repeat until the campaign is exhausted.
7. **Observe.** State changes are pushed to the browser over a Supabase Realtime
   broadcast channel, `dialer:user:<userId>` (`supabase/functions/_shared/dialer-events.ts`).

## Consequences of having no server

Three properties fall out of "everything is a stateless function", and most
surprising behaviour in this codebase traces back to one of them:

- **The dial loop has no owner process.** Nothing sits and watches a session. The
  loop advances only when a webhook arrives. A batch where Telnyx never sends a
  final event would hang forever, which is why
  `resolveStaleBatchIfTimedOut()` (`_shared/dialer-engine.ts:744`) exists — it is
  a timeout swept on the *next* inbound event, not a background job.
- **Concurrency control lives in Redis, not Postgres.** `claimHumanAnswer()` needs
  an atomic single-winner primitive across concurrent webhook invocations. Redis
  `SET NX` provides it; a Postgres round-trip per webhook would not be cheap
  enough. This is why both stores exist. Redis is **live state only** — losing it
  drops in-flight calls, not history.
- **Webhooks are at-least-once.** Telnyx may redeliver. Every handler must be
  idempotent. Assume any event can arrive twice, late, or out of order.

## External dependencies

| Service | Used for | Fails how |
|---|---|---|
| Supabase Auth | Sessions, user identity | No login; app stuck on auth screen |
| Supabase Postgres | All durable data, RLS | Total outage |
| Supabase Realtime | Pushing dial events to the UI | UI goes stale; calls still connect |
| Supabase Edge Runtime | All backend logic | Total outage |
| Upstash Redis | Live call/session state | New sessions fail; in-flight sessions lose coordination |
| Telnyx Call Control | Dialing, AMD, bridging | No outbound calls |
| Telnyx WebRTC | Agent's audio leg | Calls connect but the agent cannot hear them |

## Where new code belongs

| If you are adding… | Put it in |
|---|---|
| A screen or UI surface | `apps/web/src/components/` |
| A call to the backend | `apps/web/src/lib/api.ts` |
| A new HTTP endpoint | `supabase/functions/<name>/index.ts` |
| Logic two functions both need | `supabase/functions/_shared/` |
| Anything touching the dial loop | `supabase/functions/_shared/dialer-engine.ts` — and read `.brain/domains/dialer.md` first |
| A schema change | A new file in `supabase/migrations/` (append-only) |

**Do not add a background worker, cron, or queue consumer** without deciding
deliberately where it runs. There is no place for one today, and inventing one
silently changes the architecture.

## Unverified

- The per-service failure modes in *External dependencies* are reasoned from the
  code's dependency structure, not from observed outages. No chaos or failure
  testing exists in this repo.
- Telnyx's exact redelivery policy is assumed to be at-least-once from general
  webhook practice; it was not confirmed against Telnyx documentation.
