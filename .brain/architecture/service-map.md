---
id: arch.service-map
title: Service Map
layer: L2
type: architecture
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/**
  - supabase/config.toml
related:
  - arch.system-overview
  - arch.dependency-graph
  - domain.auth
answers:
  - "what endpoints exist"
  - "which function handles X"
  - "which functions are authenticated"
  - "where do I add a new endpoint"
  - "which function is the biggest risk to change"
covers: "Every Edge Function: purpose, auth posture, dependencies, and risk"
excludes: "Public URLs and deploy commands (see docs/reference/edge-functions.md), dial-loop internals (see domain.dialer)"
tokens_est: 1555
source_hash: be3d244e90e41dd7fa5cba8da9de4fdb249b8720a44c30206dede5aa8034485f
---

# Service Map

16 Edge Functions, all in `supabase/functions/<name>/index.ts`, all Deno, all
stateless. There are no other services.

## Auth posture — read this first

Two independent layers, routinely confused:

| Layer | Mechanism | Where configured |
|---|---|---|
| **Gateway** | Supabase rejects the request before your code runs | `verify_jwt` in `supabase/config.toml` |
| **In-function** | The function validates the caller's token itself | `supabase/functions/_shared/auth.ts` |

Five functions have `verify_jwt = false`. **Four of them still authenticate
in-function.** Only `telnyx-webhook` is genuinely unauthenticated, and it
substitutes signature verification against `TELNYX_WEBHOOK_SECRET`.

> Turning gateway verification off does **not** mean an endpoint is open. Read
> the function before concluding anything about its auth posture.

## Dialer

| Function | Auth | `_shared` deps | Purpose | Risk |
|---|---|---|---|---|
| `dialer-session-start` | JWT | engine, events, redis, telnyx | Creates a session, fires batch 1. Gated on `PARALLEL_DIALER_ENABLED`. 307 lines. | **High** |
| `dialer-session-stop` | JWT | engine, events, redis, telnyx | Ends a session, returns a summary, clears Redis | **High** |
| `dialer-session-hangup-live` | JWT | engine, redis, telnyx | Hangs up the bridged leg | Medium |
| `dialer-session-pause` | JWT | redis | Pauses batch advance | Low |
| `dialer-session-get` | JWT | redis | Reads current session + batch state | Low |
| `dialer-session-active` | JWT | — | Returns the caller's in-flight session; blocks a second concurrent one | Low |

## Telephony

| Function | Auth | Gateway | Purpose | Risk |
|---|---|---|---|---|
| `telnyx-webhook` | **signature only** | `verify_jwt=false` | Receives all Telnyx call events; drives the dial loop. 393 lines. | **Highest** |
| `telnyx-webrtc-credentials` | JWT (in-function) | `verify_jwt=false` | Mints the agent's WebRTC login token | Medium |
| `telnyx-search-numbers` | JWT (in-function) | `verify_jwt=false` | Searches purchasable numbers | Low |
| `telnyx-purchase-number` | JWT (in-function) | `verify_jwt=false` | **Spends money.** Buys a number, assigns it | Medium |
| `telnyx-list-numbers` | JWT (in-function) | `verify_jwt=false` | Lists the caller's numbers | Low |

## Contacts

| Function | Auth | Purpose | Risk |
|---|---|---|---|
| `contacts-parse-csv` | JWT | Parses CSV, proposes a column mapping. Writes nothing. 248 lines. | Low |
| `contacts-import` | JWT | Validates, de-duplicates, inserts. 174 lines. | Medium — bulk writes |

## Analytics

| Function | Auth | Purpose | Risk |
|---|---|---|---|
| `dashboard-stats` | JWT | Aggregate counters for the dashboard | Low |
| `team-performance` | JWT | Time-series for the analytics charts | Low |
| `ensure-week-summary` | JWT | Idempotently materializes the current week's summary | Low |

## Shared modules

Not deployable. Bundled into each function that imports them.

| Module | Lines | Imported by | Notes |
|---|---|---|---|
| `supabase/functions/_shared/dialer-engine.ts` | 802 | 4 | The dial loop. **The most consequential file in the repo.** |
| `supabase/functions/_shared/telnyx.ts` | — | 4 | Call Control client. Resolves the connection ID, maps Telnyx errors. |
| `supabase/functions/_shared/redis.ts` | — | 6 | Upstash REST client, key scheme, `claimHumanAnswer` |
| `supabase/functions/_shared/dialer-events.ts` | — | 3 | Realtime broadcast publisher, 11 event types |
| `supabase/functions/_shared/amd.ts` | — | via engine | Answering-machine-detection result interpretation |
| `supabase/functions/_shared/auth.ts` | — | 15 | JWT verification. Every function except the webhook. |
| `supabase/functions/_shared/cors.ts` | — | 16 | CORS headers. **Must be returned on error paths too.** |

## Adding a function

1. `supabase/functions/<name>/index.ts`.
2. Import `corsHeaders` from `supabase/functions/_shared/cors.ts` and return them on **every** path,
   including errors — a function that omits them on a 500 turns a readable server
   error into an opaque CORS failure in the browser.
3. Import the auth helper from `supabase/functions/_shared/auth.ts` unless you have a specific,
   written reason not to.
4. Add a typed wrapper in `apps/web/src/lib/api.ts`. There is no generated
   client; this is the only place the contract is written down.
5. Deploy: `npx supabase functions deploy <name>`.

Do **not** set `verify_jwt = false` in `config.toml` unless the caller genuinely
cannot hold a Supabase session. Today exactly one caller qualifies: Telnyx.

## Unverified

- Risk ratings are this author's judgment based on blast radius and side effects,
  not an incident history. There is no incident record in the repo.
- `_shared` line counts other than `dialer-engine.ts` were not individually
  measured and are omitted rather than guessed.
