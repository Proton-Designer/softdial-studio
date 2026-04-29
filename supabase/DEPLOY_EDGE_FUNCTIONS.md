# Deploy Supabase Edge Functions

The Supabase CLI is installed as a dev dependency. Use these steps to deploy the **telnyx-webhook** (and optionally all) Edge Functions.

## 1. Log in to Supabase

In a terminal (so the browser can open):

```bash
npx supabase login
```

Complete the login in the browser. This saves your access token locally.

## 2. Link your project

Link this repo to your Supabase project (use your **Project Reference ID** from [Supabase Dashboard](https://supabase.com/dashboard) → Project Settings → General):

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

When prompted, enter your database password if required.

## 3. Deploy the webhook (for Telnyx)

Deploy only the Telnyx webhook (public, no JWT — so Telnyx can call it):

```bash
npm run deploy:webhook
```

Or:

```bash
npx supabase functions deploy telnyx-webhook --no-verify-jwt
```

## 4. (Optional) Deploy all Edge Functions

To deploy every function in `supabase/functions/`:

```bash
npm run deploy:functions
```

**Auth (401) fix:** These functions use **custom auth** inside the code (`getUserFromRequest`). So Supabase must **not** enforce JWT at the gateway, or the gateway’s 401 won’t include CORS and the browser will block. Either:

- Deploy with **no JWT verification** so every request reaches the function:
  ```bash
  npx supabase functions deploy telnyx-list-numbers --no-verify-jwt
  npx supabase functions deploy telnyx-search-numbers --no-verify-jwt
  npx supabase functions deploy telnyx-purchase-number --no-verify-jwt
  npx supabase functions deploy telnyx-webrtc-credentials --no-verify-jwt
  ```
- Or in **Supabase Dashboard** → **Edge Functions** → each function → turn **off** “Enforce JWT verification”.

Then ensure the frontend sends `Authorization: Bearer <session.access_token>` (it does via `getAuthHeaders()`). If the user is not signed in, you’ll get a 401 with a clear message from our code.

## Webhook URL

After deploying `telnyx-webhook`, your webhook URL is:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/telnyx-webhook
```

Use this URL in the Telnyx Call Control Application webhook setting.
