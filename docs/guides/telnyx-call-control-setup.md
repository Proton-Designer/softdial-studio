# Telnyx Setup for Parallel Dialing (One Thing, Not Two)

You need **one** thing for parallel dialing: a **Voice API Application** (Telnyx also calls it a **Call Control Application**). You do **not** need to create a separate SIP connection or “connect” SIP trunking to it.

---

## Portal vs API: Application ID is what you use

In the Telnyx portal:

- **Voice API Application** (Call Control) shows only an **Application ID** — there is no separate "connection ID" for it.
- **SIP trunking** shows a **Connection ID** — you may already use that as **TELNYX_CREDENTIAL_CONNECTION_ID** (for WebRTC / telephony credentials).

For parallel dialing, **use the Application ID**, not the SIP connection ID. Telnyx's `POST /calls` API expects a value in the `connection_id` field; their docs state it is _"The ID of the Call Control App (formerly ID of the connection)"_. So:

- **TELNYX_CONNECTION_ID** = **Application ID** from your Voice API / Call Control Application (the one with the webhook URL).
- **TELNYX_CREDENTIAL_CONNECTION_ID** = keep as your **SIP/credential connection ID** (for WebRTC click-to-dial). Do **not** use this value for parallel dialing — Telnyx will reject it with a webhook/Call Control error.

You do **not** link SIP trunking to the Voice Application. They are separate: one ID for credentials (SIP), one ID for Call Control dialing (Application).

---

## What you actually need

| What                                                 | Purpose                                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Voice API Application** (Call Control Application) | Has a **webhook URL** and an **Application ID** (the only ID the portal shows). That **Application ID** is what you set as **TELNYX_CONNECTION_ID**. |
| **Outbound Voice Profile**                           | Required by Telnyx for outbound dialing (billing/destinations). You create it once and attach it to the application.                                 |

Telnyx’s docs say you “dial from a given **connection**”; for the Voice API, that “connection” **is** the Call Control Application. So:

- **TELNYX_CONNECTION_ID** = the **Application ID** of your Call Control Application (the one with the webhook). The portal only shows "Application ID" — use that.
- You are **not** looking for a separate “SIP connection” to link. (**TELNYX_CREDENTIAL_CONNECTION_ID** stays your SIP/credential connection for WebRTC; do not use it for parallel dialing.)

If you create two things that look the same (e.g. two applications with the same webhook), you only need **one** of them. Use that one application’s **ID** as **TELNYX_CONNECTION_ID**.

---

## Step-by-step (Portal)

### 1. Create an Outbound Voice Profile (if you don’t have one)

- In [Telnyx Portal](https://portal.telnyx.com), go to **Voice** → **Outbound** (or **Outbound Voice Profiles**).
- Create a profile (name, service plan, etc.). Note its **Profile ID** — you’ll attach it to the application in the next step.

### 2. Create one Voice API / Call Control Application

- Go to **Call Control** → **Applications** (or **Voice** → **Applications**).
- Click **Create** (or **Add Application**).
- Set:
  - **Name:** e.g. `Softdial Parallel Dialer`
  - **Webhook URL:**  
    `https://YOUR_PROJECT_REF.supabase.co/functions/v1/telnyx-webhook`  
    (e.g. `https://<your-project-ref>.supabase.co/functions/v1/telnyx-webhook`)
  - **Outbound** (or similar): attach the **Outbound Voice Profile** you created (or an existing one).
- Save.

### 3. Get the Application’s ID

- Open the application you just created.
- Copy its **ID** (numeric string, e.g. `1293384261075731499`).  
  This is **TELNYX_CONNECTION_ID** — the same ID is used as `connection_id` in `POST /calls` in Telnyx’s API.

### 4. Set the secret in Supabase

- Supabase Dashboard → your project → **Project Settings** → **Edge Functions** → **Secrets**.
- Add or edit:
  - **Name:** `TELNYX_CONNECTION_ID`
  - **Value:** the **Application ID** from step 3 (not a different “connection” ID).
- Redeploy:
  ```bash
  npx supabase functions deploy dialer-session-start
  npx supabase functions deploy telnyx-webhook
  ```

---

## Summary

- **SIP connection** = not required for parallel dialing. (Use SIP only if you’re doing SIP trunking to your own PBX/app.)
- **Voice API Application** (Call Control Application) = the one thing you create. It has a webhook URL and an ID. That **ID** is **TELNYX_CONNECTION_ID**.
- You are not “connecting a SIP trunk to a Voice Application.” You create one application, set its webhook and outbound profile, and use its ID.

Reference: [Telnyx – Getting started with Programmable Voice](https://developers.telnyx.com/docs/voice/programmable-voice/get-started) (“dial a number from a given **connection (Voice API application)**”) and [Create a call control application](https://developers.telnyx.com/api-reference/call-control-applications/create-a-call-control-application).
