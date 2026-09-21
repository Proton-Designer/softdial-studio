# Edge Functions reference

All functions are Deno, deployed to Supabase, and live in
`supabase/functions/<name>/index.ts`.

**Base URL:** `https://<your-project-ref>.supabase.co/functions/v1`

Find your project ref in Supabase Dashboard → Project Settings → General. The
client builds these URLs from `VITE_SUPABASE_URL`, so nothing here is hardcoded
in application code.

---

## Inventory

### Dialer sessions

| Function                     | Purpose                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `dialer-session-start`       | Creates a parallel dial session and fires the first batch. Rejects unless `PARALLEL_DIALER_ENABLED=true`. The largest function in the repo. |
| `dialer-session-get`         | Fetches a session's current state and batch status.                                                                                         |
| `dialer-session-active`      | Returns the caller's in-flight session, if any. Used to block a second concurrent session.                                                  |
| `dialer-session-pause`       | Pauses batch progression.                                                                                                                   |
| `dialer-session-stop`        | Ends a session and returns a summary.                                                                                                       |
| `dialer-session-hangup-live` | Hangs up the currently bridged live call.                                                                                                   |

### Contacts

| Function             | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `contacts-parse-csv` | Parses an uploaded CSV and proposes header → field mappings.           |
| `contacts-import`    | Commits a mapped CSV import, de-duplicating against existing contacts. |

### Telephony

| Function                    | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `telnyx-search-numbers`     | Searches purchasable Telnyx numbers by area code.                          |
| `telnyx-purchase-number`    | Purchases a number and assigns it to the caller.                           |
| `telnyx-list-numbers`       | Lists numbers assigned to the caller.                                      |
| `telnyx-webrtc-credentials` | Mints a short-lived Telnyx WebRTC login token for the agent's browser leg. |
| `telnyx-webhook`            | **Unauthenticated.** Receives Telnyx call events and drives the dial loop. |

### Analytics

| Function              | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `dashboard-stats`     | Aggregate counters for the dashboard.                     |
| `team-performance`    | Time-series data for the analytics charts.                |
| `ensure-week-summary` | Idempotently materializes the current week's summary row. |

Shared logic lives in `supabase/functions/_shared/`: `dialer-engine.ts` (the dial
loop), `telnyx.ts` (Call Control client), `redis.ts` (session state), `amd.ts`
(answering-machine detection), `dialer-events.ts`, `auth.ts`, `cors.ts`.

---

## Authentication model

Two distinct layers — don't confuse them.

**Gateway JWT verification** (`verify_jwt` in `supabase/config.toml`) is
Supabase's edge rejecting requests before your code runs. It is disabled for
five functions: the four `telnyx-*` client-facing ones and `telnyx-webhook`.

**In-function verification** (`_shared/auth.ts`) is the function checking the
caller's token itself. **Every function except `telnyx-webhook` does this**,
including the four with gateway verification turned off.

So the four `telnyx-*` client functions are still authenticated — the check just
happens inside the function rather than at the gateway. The client sends both the
`apikey` header and `Authorization: Bearer <session token>` (see
`getEdgeFunctionHeaders` in `apps/web/src/lib/api.ts`).

### `telnyx-webhook` is the exception

It is genuinely unauthenticated at both layers, because Telnyx calls it directly
and has no Supabase session. It must be deployed with `--no-verify-jwt`:

```bash
npm run functions:deploy:webhook
```

It authenticates by verifying the Telnyx signature against
`TELNYX_WEBHOOK_SECRET`. **That check is the only thing standing between the
public internet and the dial loop — do not remove or weaken it.**

---

## Telnyx configuration

Point your Telnyx **Voice API (Call Control) Application** webhook at:

```
https://<your-project-ref>.supabase.co/functions/v1/telnyx-webhook
```

Set the failover URL to the same value. Full walkthrough, including which
connection ID goes where, is in
[`../guides/telnyx-call-control-setup.md`](../guides/telnyx-call-control-setup.md).

---

## Deploying

```bash
npm run functions:deploy              # all functions
npm run functions:deploy:webhook      # telnyx-webhook only, with --no-verify-jwt
npx supabase functions deploy <name>  # a single other function
```

Secrets are applied at deploy time — changing one does not affect a
already-running function until it is redeployed.
