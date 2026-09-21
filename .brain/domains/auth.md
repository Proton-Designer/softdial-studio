---
id: domain.auth
title: Auth & Access Control
layer: L2
type: domain
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/_shared/auth.ts
  - supabase/functions/_shared/cors.ts
  - supabase/config.toml
  - supabase/migrations/*.sql
  - apps/web/src/contexts/AuthContext.tsx
  - apps/web/src/components/AuthScreen.tsx
related:
  - domain.dialer
  - domain.contacts
  - arch.system-overview
answers:
  - "how is a user authenticated when calling an Edge Function"
  - "why is verify_jwt false on almost every function"
  - "which Edge Functions are actually unauthenticated"
  - "which tables have RLS and what do the policies allow"
  - "where does SUPABASE_SERVICE_ROLE_KEY bypass RLS"
  - "what user metadata is collected at signup"
covers: "Supabase auth, session handling, the two-layer Edge Function authorization model, service-role usage, and the per-table RLS inventory."
excludes: "Telnyx webhook signature mechanics (domain.telephony); dial-loop ownership checks (domain.dialer)."
tokens_est: 2458
source_hash: 72ae36b48b1a82ec57268147c64b611d02180c60311c1a76ec376035c0c6554d
---

# Auth & Access Control

## Purpose

Softdial is single-tenant-per-user: every contact, campaign, number, and call belongs to exactly one `auth.users` row. This domain establishes *who* is calling (Supabase email/password auth) and the
two independent places deciding *what they may touch*: in-function token checks in Deno, and Postgres row-level security.

## Key concepts

| Term | Means |
|---|---|
| Gateway `verify_jwt` | Platform-level JWT check, set per function in `supabase/config.toml`. Rejects before your code runs **with no CORS headers** — which is why it is almost always off here. |
| In-function check | `getUserFromRequest(req)` in `supabase/functions/_shared/auth.ts`. Validates the bearer token itself and returns a CORS-bearing 401 on failure. |
| Anon key | `VITE_SUPABASE_ANON_KEY`, sent as the `apikey` header so the gateway accepts the request. It is **not** identity — RLS still applies. |
| Service-role key | `SUPABASE_SERVICE_ROLE_KEY`. A client built with it **bypasses all RLS**; ownership guards there are hand-written. |

## Where the code lives

| What | Path |
|---|---|
| Token validation | `supabase/functions/_shared/auth.ts` — the only auth primitive, 41 lines |
| CORS headers | `supabase/functions/_shared/cors.ts` — `Allow-Origin: '*'` (`:2`) |
| Gateway config | `supabase/config.toml` — `verify_jwt` `:360-396`, `[auth]` from `:150` |
| Browser session | `apps/web/src/contexts/AuthContext.tsx` — `getSession` + `onAuthStateChange` (`:34-50`) |
| Sign-up UI | `apps/web/src/components/AuthScreen.tsx` — collects `first_name`, `last_name`, `company_name` into `auth.users.raw_user_meta_data` (no profiles table) (`:45-58`) |
| Header attachment | `apps/web/src/lib/api.ts:14-28` — `getEdgeFunctionHeaders()` |

## How it works

1. **Signup / session** — `supabase.auth.signUp` carries the metadata (`apps/web/src/contexts/AuthContext.tsx:54-64`); `AuthProvider` hydrates from `getSession()` and subscribes to `onAuthStateChange`
   (`:34-50`).
2. **Calling a function** — `getEdgeFunctionHeaders()` sets `apikey` and `Authorization: Bearer <access_token>` **only if a session exists** (`apps/web/src/lib/api.ts:20-27`); no session → no header →
   401.
3. **Layer 1 (gateway)** — `verify_jwt` is `false` for 15 of 16; only `dialer-session-hangup-live` keeps the `true` default.
4. **Layer 2 (in-function)** — `getUserFromRequest` requires a `Bearer ` prefix (`supabase/functions/_shared/auth.ts:8`) then validates via `supabase.auth.getUser(token)` on a service-role client
   (`:19-26`). Functions then scope every service-role query by hand; the browser's direct reads use the anon-key client, where RLS enforces.

## Authorization matrix (all 16 functions)

| Function | Gateway | In-function | Net |
|---|---|---|---|
| `dialer-session-hangup-live` | **true** (default) | `:22` | double-guarded |
| `dialer-session-start`/`-stop`/`-pause`/`-get`/`-active` | false | `:42`/`:22`/`:19`/`:15`/`:14` | guarded |
| `contacts-import`, `contacts-parse-csv` | false | `:33`, `:193` | guarded |
| `dashboard-stats`, `team-performance`, `ensure-week-summary` | false | `:8`, `:36`, `:24` | guarded |
| `telnyx-list-numbers`/`-search-numbers`/`-purchase-number`/`-webrtc-credentials` | false | `:9`/`:8`/`:9`/`:8` | guarded |
| **`telnyx-webhook`** | false | **none** | **unauthenticated** |

`telnyx-webhook` has neither layer, and its `verifySignature()` **fails open on two paths** (`supabase/functions/telnyx-webhook/index.ts:33-46`) — see `.brain/memory/known-issues.md`
#0. **Treat it as fully unauthenticated**: it holds a service-role client and drives the
dial loop.

## Per-table RLS inventory

**Every table has `ENABLE ROW LEVEL SECURITY`. None is unprotected.** All policies are `auth.uid()`-scoped or ownership-derived.

| Table | Policies (migration) |
|---|---|
| `campaigns` | SELECT/INSERT/UPDATE/DELETE, all `auth.uid() = user_id` (`20250207100000:17-33`) |
| `campaign_leads` | SELECT/INSERT/UPDATE/DELETE via `campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())` (`:48-72`) |
| `contacts` | SELECT/INSERT/UPDATE/DELETE, all `auth.uid() = user_id` (`20250214000001:24-40`) |
| `user_phone_numbers` | SELECT/INSERT/UPDATE/DELETE, all `auth.uid() = user_id` (`20250208000001:15-36`) |
| `call_events` | **SELECT only** (`20250213000001:22-27`); writes are service-role by design |
| `notifications` | **SELECT + UPDATE only** (`20250213000001:51-59`); inserts are service-role |
| `user_preferences` | SELECT/INSERT/UPDATE (`20250213000001:73-85`). No DELETE policy |
| `dialer_sessions` | **SELECT only** (`20260207000100:28-33`); all writes via Edge Functions |
| `call_logs` | **SELECT only** (`20260207000100:62-67`) |
| `campaigns_with_stats` (view) | `security_invoker = on` (`20250207100000:95`) — caller's RLS applies. Correct. |

## Constraints & gotchas

- **`verify_jwt = false` is deliberate** (`supabase/config.toml:358-359`): the gateway's 401 carries no CORS headers, so the browser sees an opaque network error.
- **A new function needs BOTH.** No `[functions.<name>]` block → silently inherits `verify_jwt = true`; a `false` block with no `getUserFromRequest` call → wide open.
- **`getUserFromRequest` round-trips to GoTrue every request** (`supabase/functions/_shared/auth.ts:20-21`) rather than verifying the JWT locally, putting auth latency on the dial loop's critical
  path.
- **Service-role clients bypass RLS entirely** — 13 functions plus `supabase/functions/_shared/dialer-events.ts:22`. The only guard there is a hand-written `.eq('user_id', user.id)`; every current
  call site scopes correctly, and omitting one is a silent cross-tenant read.
- **`campaign_leads` policies check the campaign, never the contact.** INSERT only requires owning the `campaign_id` (`20250207100000:56-60`); `contact_id` ownership is unvalidated, so a crafted
  insert can link another user's contact into your campaign. Mitigated on the dial path (`supabase/functions/_shared/dialer-engine.ts:98-105`) and RLS still blocks reading the row, but **a stricter
  policy belongs here.**
- **`notifications` UPDATE has `USING` but no `WITH CHECK` — checked, and it is fine.** Postgres falls back to the `USING` expression for the check when `WITH CHECK` is omitted, so a user still cannot
  update a row into someone else's `user_id`. Recorded here so it is not re-raised as a finding. `notifications` also has no INSERT policy by design — inserts come from `ensure-week-summary` on the
  service-role client.
- **`call_events.user_id` is nullable** (`20250213000001:4`); once null the row is invisible to everyone — not a leak, but orphaned rows exist and are unreachable.
- **`Access-Control-Allow-Origin: '*'`** (`supabase/functions/_shared/cors.ts:2`) — safe only because identity is a bearer token, not a cookie.
- **Email confirmation is off; password floor is 6 characters** (`supabase/config.toml:210`, `:175`) and the strength meter never blocks a weak one — anyone can create an account and immediately dial.
- **`raw_user_meta_data` is user-writable via the client SDK** — display-only, never an input to an authorization decision.

## Not covered here

Webhook signature mechanics → `.brain/domains/telephony.md`; dial-loop ownership checks → `.brain/domains/dialer.md`; CSV import validation → `.brain/domains/contacts.md`.

## Unverified

- **Whether production matches `supabase/config.toml`** — `verify_jwt` and `[auth]` are also settable in the hosted dashboard and can diverge; and **whether every migration has been applied** — the
  inventory is read from SQL, not a live database.
- No password-reset flow was found; "Forgot password?" (`AuthScreen.tsx:333`) appears non-functional. Inferred from the absence of a handler.
