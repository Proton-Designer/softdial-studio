---
id: domain.telephony
title: Telephony
layer: L2
type: domain
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/_shared/telnyx.ts
  - supabase/functions/telnyx-*/index.ts
  - supabase/migrations/20250208000001_create_user_phone_numbers.sql
  - apps/web/src/lib/useTelnyxCall.ts
  - apps/web/src/contexts/PhoneNumbersContext.tsx
related:
  - domain.dialer
  - domain.auth
  - arch.system-overview
answers:
  - "which Telnyx connection ID goes in which env var"
  - "why does dialing fail with TELNYX_CONNECTION_REJECTED / INVALID_TELNYX_CONNECTION"
  - "how is a WebRTC token minted for the agent's browser"
  - "why is telnyx-webhook deployed with --no-verify-jwt"
  - "how is the Telnyx webhook signature verified, and when does it fail open"
  - "how does a user buy a phone number and where is it stored"
  - "how does the agent's leg join the conference"
  - "what legacy Telnyx env var names are still honoured"
covers: "Telnyx account wiring (API key, the two connection IDs, webhook auth), phone-number search/purchase/listing, and the agent's WebRTC browser leg."
excludes: "The parallel dial loop itself — batching, AMD, call_logs state machine, Redis session state — see .brain/domains/dialer.md."
tokens_est: 3092
source_hash: e519f9be3b10f361895d6b99e8de8f13e7aac7af3dfb986dd53c809b422a9cdb
---

# Telephony

## Purpose

Softdial places and receives real phone calls through Telnyx. This domain covers everything that touches the Telnyx account: authenticating to their API, owning the two different
"connection" objects Telnyx exposes, letting a user buy a caller-ID number, and putting the agent's own voice on the call from the browser.

## Key concepts

| Term | Means |
|---|---|
| Call Control Application | Telnyx "Voice API Application". Has a webhook URL; its **Application ID** is what `POST /calls` and `POST /conferences` want as `connection_id`. Stored as `TELNYX_CONNECTION_ID`. |
| Credential connection | A Telnyx **SIP credential connection**. Used only to mint WebRTC telephony credentials and to attach purchased numbers. Stored as `TELNYX_CREDENTIAL_CONNECTION_ID`. |
| `call_control_id` | Telnyx's per-leg handle. Every action (`join_conference`, `hangup`) is `POST /calls/{call_control_id}/actions/...`. |
| Agent leg | The agent's audio. Two independent mechanisms: a **WebRTC** browser leg (click-to-dial) or a **PSTN callback leg** dialled to `agentCallbackNumber` and joined to the conference. |

## Where the code lives

| What | Path | Notes |
|---|---|---|
| Telnyx REST client | `supabase/functions/_shared/telnyx.ts` | API key + connection-ID resolution, `POST /calls`, conferences, hangup |
| Number search | `supabase/functions/telnyx-search-numbers/index.ts` | `npm:telnyx@4` SDK, `availablePhoneNumbers.list` |
| Number purchase | `supabase/functions/telnyx-purchase-number/index.ts` | `numberOrders.create`, then DB insert |
| Number listing | `supabase/functions/telnyx-list-numbers/index.ts` | Reads Postgres only — never Telnyx |
| WebRTC token mint | `supabase/functions/telnyx-webrtc-credentials/index.ts` | Credential + token, per request |
| Webhook ingress | `supabase/functions/telnyx-webhook/index.ts` | Signature check `:32-73`; agent-leg join `:142-186` |
| Browser WebRTC leg | `apps/web/src/lib/useTelnyxCall.ts` | `@telnyx/webrtc` `TelnyxRTC`; consumed by `apps/web/src/components/Dialer.tsx` |
| Number cache (client) | `apps/web/src/contexts/PhoneNumbersContext.tsx` | Preloads once per sign-in; `usePhoneNumbers()` |
| Schema | `supabase/migrations/20250208000001_create_user_phone_numbers.sql` | `user_phone_numbers`, RLS per `auth.uid()` |
| Docs | `docs/reference/environment-variables.md`, `docs/guides/telnyx-call-control-setup.md` | Env table; portal walkthrough |

## How it works

1. **Buy a number** — `telnyx-search-numbers` lists availability, `telnyx-purchase-number` orders it *against the credential connection*
   (`supabase/functions/telnyx-purchase-number/index.ts:24,40-43`) and inserts a `user_phone_numbers` row with the service-role client (`:66-72`).
2. **Cache it** — `PhoneNumbersContext` calls `listPhoneNumbers()` (`apps/web/src/lib/api.ts:32`) once per sign-in; the dialer and campaign UIs pick a caller ID from it.
3. **Mint a WebRTC token** — `telnyx-webrtc-credentials` creates a telephony credential on the credential connection (`:25`), then `POST /v2/telephony_credentials/{id}/token` (`:36-45`).
4. **Connect the browser** — `connect()` fetches that token and builds `new TelnyxRTC({ login_token })` (`apps/web/src/lib/useTelnyxCall.ts:46-49`); `dial()` calls `client.newCall()`.
5. **Server-side dialing** — `dialOutboundCall()` posts to `/calls` with `connection_id` from `getTelnyxConnectionId()` and `webhook_url` = `<SUPABASE_URL>/functions/v1/telnyx-webhook`
   (`supabase/functions/_shared/telnyx.ts:115-148`, `supabase/functions/dialer-session-start/index.ts:252`).
6. **Webhook returns** — `telnyx-webhook` verifies the signature, ACKs `200` immediately and processes in a `queueMicrotask` (`:376-384`). An answered agent-callback leg is joined to the
   session's `conference_name` (`:142-186`), or hung up if the conference is unknown.

## Integration points

| Direction | With | Via |
|---|---|---|
| Depends on | `domain.auth` | `getUserFromRequest()` in `supabase/functions/_shared/auth.ts` guards all four client-facing `telnyx-*` functions |
| Depends on | Supabase Postgres | `user_phone_numbers`, `dialer_sessions.conference_name` |
| Depended on by | `domain.dialer` | `dialOutboundCall`, `createConference`, `joinCallToConference`, `hangupCall` |
| External | Telnyx | REST `https://api.telnyx.com/v2`, `npm:telnyx@4` SDK, `@telnyx/webrtc`, inbound webhooks |

## Constraints & gotchas

- **The two connection IDs are different Telnyx products and are not interchangeable.** `TELNYX_CONNECTION_ID` = the **Application ID** of a Call Control / Voice API Application *that has a
  webhook URL*, read by `getTelnyxConnectionId()` (`supabase/functions/_shared/telnyx.ts:29-34`) and used for `POST /calls` and `POST /conferences`. `TELNYX_CREDENTIAL_CONNECTION_ID` = a
  **SIP credential connection**, read only in `supabase/functions/telnyx-webrtc-credentials/index.ts:13` and `supabase/functions/telnyx-purchase-number/index.ts:24`. Put the credential
  connection in `TELNYX_CONNECTION_ID` and Telnyx answers `422 "Only Call Control Apps with valid webhook URL are accepted."`; `supabase/functions/_shared/telnyx.ts:66-70` rewrites that to
  `TELNYX_CONNECTION_REJECTED: …`, which `supabase/functions/dialer-session-start/index.ts:292-300` turns into HTTP `503 {code: "INVALID_TELNYX_CONNECTION"}` and
  `apps/web/src/lib/api.ts:642-647` renders. Unset entirely → `503 {code: "MISSING_TELNYX_CONNECTION_ID"}` (`supabase/functions/dialer-session-start/index.ts:157-164`).
- **Legacy fallback:** `TELNYX_CALL_CONTROL_CONNECTION_ID` is still honoured as an alias for `TELNYX_CONNECTION_ID` in both `supabase/functions/_shared/telnyx.ts:31` and
  `supabase/functions/dialer-session-start/index.ts:156`. It is checked *second* — if both are set, `TELNYX_CONNECTION_ID` wins.
- **`telnyx-webhook` is genuinely unauthenticated at both layers.** Telnyx has no Supabase session, so the gateway check is off (`supabase/config.toml:368-369`) and the function never calls
  `getUserFromRequest`. It must be deployed with `--no-verify-jwt` (`package.json:26` → `npm run functions:deploy:webhook`); a plain `functions deploy` re-enables gateway JWT and every
  Telnyx event starts 401-ing. The signature check is the *only* thing guarding the dial loop.
- **The signature check fails open twice.** `verifySignature` (`supabase/functions/telnyx-webhook/index.ts:32-73`) returns `true` when `TELNYX_WEBHOOK_SECRET` is unset (`:34`), and returns
  `true` for ed25519-only requests after a `console.warn` (`:43-46`) — Telnyx Standard Webhooks sign with ed25519, not the shared-secret HMAC this code implements. The HMAC path is SHA-256
  hex over `` `${timestamp}|${rawBody}` `` compared against `telnyx-signature` / `x-telnyx-signature`, with `v1=`-prefix support (`:57-71`). A missing `telnyx-timestamp` is the one hard
  reject (`:38`). There is **no replay window** — an old signed body still validates.
- **The webhook ACKs before it works.** `200 {received:true}` is returned and processing happens in `queueMicrotask` (`:376-384`), so a handler throw is invisible to Telnyx and never
  retried. Conversely Telnyx retries are at-least-once — handlers must be idempotent.
- **WebRTC credentials leak.** `telephonyCredentials.create` runs on *every* call to `telnyx-webrtc-credentials` (`:25`) and nothing ever deletes the credential; each page load that connects
  adds one to the account. The minted token has a Telnyx-side lifetime the code does not track or refresh: `connect()` short-circuits when `clientRef.current` is already set
  (`apps/web/src/lib/useTelnyxCall.ts:41`), so a long-lived tab keeps one token forever. On expiry the symptom is `telnyx.error` on the existing client — `disconnect()` then `connect()` to
  re-mint.
- **Token parsing is deliberately tolerant** (`supabase/functions/telnyx-webrtc-credentials/index.ts:56-71`): Telnyx has returned `data` as a string, `data.token`, top-level `token`, and a
  bare `eyJ…` JWT. Do not collapse it to one shape.
- **`toE164()` strips the `+`** (`apps/web/src/lib/useTelnyxCall.ts:13-18`) — it yields `15551234567`, not `+15551234567`. Server-side dialing does not use this helper; don't assume one
  format.
- **`telnyx-list-numbers` never asks Telnyx** (`supabase/functions/telnyx-list-numbers/index.ts:17-21`) — it reads `user_phone_numbers`, so a number released in the portal still shows in the
  app until the row is deleted.
- **`telnyx_phone_number_id` is globally `UNIQUE`** (migration `:8`): the same Telnyx number cannot attach to two users; a second purchase fails with a constraint error, not a 4xx.
- **Purchase writes with the service-role key**, bypassing the migration's RLS policies. `user_id` comes from the verified token (`supabase/functions/telnyx-purchase-number/index.ts:69`) —
  the only guard against cross-user assignment.
- **Number search quirks** (`supabase/functions/telnyx-search-numbers/index.ts:28-34`): `best_effort: true` is always set; the area code is sent as `national_destination_code` only when
  `country_code === 'US'`. A Telnyx `10031` / "No numbers found" error becomes `200` with an empty list (`:54-66`).
- **Four code strings point at a docs path that no longer exists.** The real file is `docs/guides/telnyx-call-control-setup.md`. Users following the error message hit a dead path.

## Not covered here

- Dial loop, batching, AMD, `call_logs`, Redis session state → `.brain/domains/dialer.md`
- `getUserFromRequest` and session tokens → `supabase/functions/_shared/auth.ts` (and the auth domain doc, if present)
- Deployment mechanics → `docs/guides/deploy-edge-functions.md`

## Unverified

- Telnyx's actual WebRTC token TTL is not asserted anywhere in this repo; the "expiry → `telnyx.error`" symptom above is inferred from the client wiring, not observed in code.
