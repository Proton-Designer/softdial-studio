# Deploy Parallel Dialer (Functions + DB + Env)

Do these steps **before** running the app so migrations, functions, and secrets are in place.

---

## 1. Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed: `supabase --version`
- Logged in: `supabase login`
- Project linked (from repo root): `supabase link --project-ref YOUR_PROJECT_REF`
  - Get **Project ref** from Supabase Dashboard → Project Settings → General.

---

## 2. Apply database migrations

From the **project root**:

```bash
# Push pending migrations to the linked remote project
supabase db push
```

This applies `20260207000100_create_dialer_sessions_and_call_logs.sql` (and any other pending migrations), creating:

- `dialer_sessions`
- `call_logs`
- New columns on `contacts`: `call_status`, `last_called_at`, `call_count`

**Local only (optional):** To reset local DB and re-run all migrations + seed:

```bash
supabase db reset
```

---

## 3. Set Edge Function secrets

The new dialer and webhook code need these env vars on the **remote** project. Set them in the Dashboard or via CLI.

**Option A – Dashboard (recommended)**  
Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**. Add:

| Secret                     | Description                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TELNYX_API_KEY`           | Telnyx API key (Bearer)                                                                                                                                                                                                   |
| `TELNYX_CONNECTION_ID`     | Call Control connection ID for outbound dialing. **Not** the same as the WebRTC credential connection. See [telnyx-call-control-setup.md](./telnyx-call-control-setup.md) for how to create/find it in the Telnyx portal. |
| `TELNYX_PHONE_NUMBER`      | Outbound caller ID, e.g. `+15551234567`                                                                                                                                                                                   |
| `TELNYX_WEBHOOK_SECRET`    | Used to verify Telnyx webhook signatures                                                                                                                                                                                  |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis REST URL                                                                                                                                                                                                    |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token                                                                                                                                                                                                  |

**Option B – CLI** (from project root):

```bash
supabase secrets set TELNYX_API_KEY=your_key
supabase secrets set TELNYX_CONNECTION_ID=your_connection_id
supabase secrets set TELNYX_PHONE_NUMBER=+15551234567
supabase secrets set TELNYX_WEBHOOK_SECRET=your_webhook_secret
supabase secrets set UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
supabase secrets set UPSTASH_REDIS_REST_TOKEN=your_token
```

Optional:

- `PARALLEL_DIALER_ENABLED` — set to `false` to disable session start (default is enabled if unset in code).

---

## 4. Deploy Edge Functions

From the **project root**:

```bash
# Deploy all functions (including the new dialer and updated webhook)
supabase functions deploy
```

To deploy only the dialer-related and webhook functions:

```bash
supabase functions deploy telnyx-webhook
supabase functions deploy dialer-session-start
supabase functions deploy dialer-session-stop
supabase functions deploy dialer-session-pause
supabase functions deploy dialer-session-get
```

After deploy, your function base URL is:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1`

(e.g. `https://<your-project-ref>.supabase.co/functions/v1`)

---

## 5. Frontend environment

In the web app (`apps/web/.env`), ensure:

- `VITE_SUPABASE_URL` — Supabase project URL (e.g. `https://YOUR_PROJECT_REF.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key

Optional:

- `VITE_PARALLEL_DIALER_ENABLED=false` — set to disable parallel dialer UI/actions (default is enabled).

---

## 6. Telnyx webhook URL

In Telnyx (Voice → Call Control Application and/or SIP Connection), set the webhook URL to:

**https://YOUR_PROJECT_REF.supabase.co/functions/v1/telnyx-webhook**

Same as in [`docs/reference/edge-functions.md`](../reference/edge-functions.md).

---

## 7. Quick checklist

- [ ] `supabase link --project-ref YOUR_REF` (if not already linked)
- [ ] `supabase db push` (migrations applied)
- [ ] All secrets set (Dashboard or `supabase secrets set`)
- [ ] `supabase functions deploy` (all functions deployed)
- [ ] Frontend `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Telnyx webhook URL points to `.../telnyx-webhook`

Then run the app (e.g. `npm run dev` in `Frontend`) and use **Start Parallel Dial** from a campaign that has contacts.
