# Environment variables

Two separate environments. Getting them confused is the most common setup
failure in this repo.

|              | Client (`apps/web/.env`)                 | Server (Supabase secrets)                       |
| ------------ | ---------------------------------------- | ----------------------------------------------- |
| Who reads it | The browser bundle                       | Deno Edge Functions                             |
| Prefix       | `VITE_` (required)                       | none                                            |
| Visibility   | **Public** — shipped in the JS bundle    | Private                                         |
| How to set   | `cp apps/web/.env.example apps/web/.env` | `supabase secrets set --env-file supabase/.env` |

> **Anything in `apps/web/.env` is public.** Vite inlines `VITE_`-prefixed
> values at build time. Never put a service-role key or a Telnyx API key there.

---

## Client variables

| Variable                       | Required | Purpose                                                                                                              |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`            | yes      | Supabase project URL (`https://<ref>.supabase.co`). Dashboard → Project Settings → API.                              |
| `VITE_SUPABASE_ANON_KEY`       | yes      | Anon/public key. Safe in the browser — RLS enforces access.                                                          |
| `VITE_PARALLEL_DIALER_ENABLED` | no       | Set to `"false"` to hide parallel-dial UI. Any other value, or unset, enables it. Read in `apps/web/src/lib/api.ts`. |

Missing either Supabase value: the app renders but every request fails at the
Supabase client, usually surfacing as a stuck loading state on the auth screen.

---

## Server variables

### Supabase

| Variable                    | Required | Purpose                                                                                               |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | yes      | Injected automatically in deployed functions. Set it explicitly for local `supabase functions serve`. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | Bypasses RLS for server-side writes (call logs, session state). **Never expose to the browser.**      |

### Telnyx

| Variable                          | Required | Purpose                                                                                                                                 |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TELNYX_API_KEY`                  | yes      | Telnyx Portal → API Keys. Authenticates every Call Control request.                                                                     |
| `TELNYX_CONNECTION_ID`            | yes      | **The Application ID of your Voice API / Call Control Application** — not the SIP connection ID.                                        |
| `TELNYX_CREDENTIAL_CONNECTION_ID` | yes      | SIP credential connection, used to mint WebRTC credentials for the agent's browser leg.                                                 |
| `TELNYX_WEBHOOK_SECRET`           | yes      | Verifies inbound webhook signatures. Without it `telnyx-webhook` cannot authenticate Telnyx, and it is deployed with `--no-verify-jwt`. |

> **The single most common misconfiguration.** `TELNYX_CONNECTION_ID` and
> `TELNYX_CREDENTIAL_CONNECTION_ID` are different IDs from different Telnyx
> products. Using the SIP credential connection ID for outbound dialing makes
> Telnyx reject the call with `TELNYX_CONNECTION_REJECTED`. See
> [`../guides/telnyx-call-control-setup.md`](../guides/telnyx-call-control-setup.md).

`TELNYX_CALL_CONTROL_CONNECTION_ID` is read as a legacy fallback for
`TELNYX_CONNECTION_ID` (`supabase/functions/_shared/telnyx.ts`). Prefer the
current name.

### Upstash Redis

| Variable                   | Required | Purpose                                        |
| -------------------------- | -------- | ---------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | yes      | REST endpoint holding live dial-session state. |
| `UPSTASH_REDIS_REST_TOKEN` | yes      | REST token for the above.                      |

`REDIS_URL` and `REDIS_TOKEN` are read as legacy fallbacks
(`supabase/functions/_shared/redis.ts`). Prefer the `UPSTASH_` names.

### Feature flags

| Variable                  | Required | Purpose                                                                                                                                                  |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PARALLEL_DIALER_ENABLED` | yes      | Must be `true` or `dialer-session-start` rejects every request. Independent of the client flag — **both must be on** for the feature to work end to end. |

---

## Verifying

```bash
npx supabase secrets list                  # confirm what's actually set
npm run functions:deploy                   # secrets apply on next deploy
```

Changing a secret does not affect already-running functions until they are
redeployed.
