---
id: tool.integrations
title: Integrations
layer: L2
type: tooling
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/_shared/**
  - apps/web/src/lib/**
related:
  - tool.registry
  - domain.telephony
  - arch.system-overview
answers:
  - "what external services does this use"
  - "where do I configure Telnyx"
  - "what happens if Redis goes down"
  - "what third-party accounts do I need"
  - "where is the Telnyx API reference"
covers: "Every external service this system depends on, how it is configured, and how it fails"
excludes: "Commands (see tool.registry), Telnyx call semantics (see domain.telephony), variable-by-variable detail (see docs/reference/environment-variables.md)"
tokens_est: 1204
source_hash: 56d4b590be2d7ab3780abd32ac6132915ac472ffc3b36558ef958d85be85c1bc
---

# Integrations

Four external services. Three are required for the app to function at all.

## Supabase — required

Auth, Postgres, Realtime, and the Edge Function runtime. There is no server of
our own; Supabase *is* the backend.

| Piece | Used for |
|---|---|
| Auth | Email/password sessions; `auth.uid()` scopes every RLS policy |
| Postgres | 9 tables, all RLS-scoped |
| Edge Functions | All 16 endpoints, Deno |
| Realtime | Broadcast channel `dialer:user:<userId>` for live dial events |

**Config:** `supabase/config.toml`, plus `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` in the client and `SUPABASE_SERVICE_ROLE_KEY` server-side.

**Fails:** total outage. Nothing works.

## Telnyx — required

Outbound dialing, answering-machine detection, call bridging, and the agent's
WebRTC audio leg.

| Product | Env var | Used by |
|---|---|---|
| Voice API / Call Control Application | `TELNYX_CONNECTION_ID` | Outbound dialing |
| SIP credential connection | `TELNYX_CREDENTIAL_CONNECTION_ID` | WebRTC agent leg |
| API key | `TELNYX_API_KEY` | All REST calls |
| Webhook signing secret | `TELNYX_WEBHOOK_SECRET` | Verifying inbound events |

> **The two connection IDs are different things from different Telnyx products
> and swapping them is the single most common misconfiguration in this project.**
> `TELNYX_CONNECTION_ID` must be the **Application ID** of a Voice API / Call
> Control Application that has a webhook URL set. Using the SIP credential
> connection ID makes Telnyx reject calls with `TELNYX_CONNECTION_REJECTED`
> (`_shared/telnyx.ts:68` raises this with an explanatory message).

**Webhook target:**
`https://<project-ref>.supabase.co/functions/v1/telnyx-webhook` — set as both the
primary and failover URL on the Call Control Application.

**Fails:** no outbound calls. If only WebRTC fails, calls connect but the agent
hears nothing.

**Setup guide:** `docs/guides/telnyx-call-control-setup.md`.

## Upstash Redis — required for the dialer

Live call and session state over the REST API (not a TCP client — Edge Functions
cannot hold a socket pool).

**Config:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Legacy
`REDIS_URL` / `REDIS_TOKEN` are still read as fallbacks (`_shared/redis.ts:50`).

**Fails:** new dial sessions cannot start; in-flight sessions lose the
single-winner claim that keeps two humans from being bridged to one agent.
**Durable history is unaffected** — Redis holds no system of record.

## Figma — historical, not live

The web client began as a Figma Make export ("Parallel Dialer SaaS Web App").
`apps/web/src/components/figma/ImageWithFallback.tsx` is a leftover. There is no
live Figma integration and no design-token sync; `globals.css` is now the source
of truth for design tokens.

## Reference material in the repo

| Path | What |
|---|---|
| `vendor/` → telnyx-agent-skills | Telnyx's own API skill docs, 269 files, git submodule. Reference only — no code imports it. |
| `.cursor/skills/` | 12 Telnyx JavaScript skill docs for Cursor. Appears to be a subset of the above; see the *Smaller items* section of `.brain/memory/known-issues.md`. |
| `.cursor/rules/telnyx-integration.mdc` | Cursor rule file for Telnyx work |
| `vendor/` → agent-brain | This knowledge base's tooling |

## Not integrated

No payment processor (Settings has a billing tab with no backend behind it in
this repo), no error-tracking service, no analytics/telemetry SDK, no email
provider beyond Supabase Auth's built-in delivery, and no CI provider.
