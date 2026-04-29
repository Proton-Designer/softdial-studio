# Telnyx Webhook URLs and Edge Function Reference

## Your Supabase Edge Function URLs

Base URL: `https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1`

| Function | Full URL |
|----------|----------|
| telnyx-list-numbers | https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-list-numbers |
| telnyx-search-numbers | https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-search-numbers |
| telnyx-purchase-number | https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-purchase-number |
| telnyx-webrtc-credentials | https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-webrtc-credentials |
| telnyx-webhook | https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-webhook |

These are **correct** and used as follows:
- **Frontend** calls list, search, purchase, webrtc-credentials (with your session token in `Authorization: Bearer ...`).
- **Telnyx** calls only **telnyx-webhook** for call events (no auth).

---

## What to Add in Telnyx

### 1. Voice API Application (Call Control Application)

- In **Telnyx Mission Control** go to **Voice** → **Call Control** → your application (or create one).
- Set **Webhook URL** to:

  **https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-webhook**

- Use this **one** URL for the primary webhook. Optionally add a failover URL if you have a backup endpoint.
- Save. This is where Telnyx sends `call.initiated`, `call.answered`, `call.hangup`, etc.

### 2. SIP Connection (Credential Connection)

- In **Telnyx Mission Control** go to **Voice** → **Connections** (or **SIP Connections**) → your **Credential** connection.
- Find the **Webhook** / **Event URL** (or “Webhook URL”) field.
- Set it to the **same** URL:

  **https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-webhook**

- Save. So both the **Voice API application** and the **SIP connection** point to the same `telnyx-webhook` Edge Function.

---

## Summary

| Where in Telnyx | Field | URL to use |
|-----------------|--------|------------|
| Voice API (Call Control) application | Webhook URL | `https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-webhook` |
| SIP Connection (Credential) | Webhook / Event URL | `https://lahordgefwsiqzvbfpyp.supabase.co/functions/v1/telnyx-webhook` |

Use **only** the **telnyx-webhook** URL for Telnyx. Do **not** put the list/search/purchase/webrtc-credentials URLs in Telnyx; those are for your app and require a logged-in user.
