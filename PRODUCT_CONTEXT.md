---
id: ctx.product
title: Product Context
layer: L2
type: map
status: draft
owner: maintainer
updated: 2026-09-21
related:
  - arch.system-overview
  - domain.dialer
answers:
  - "what does this product do"
  - "who is this for"
  - "what problem does it solve"
  - "what does success look like for a user"
covers: "Product intent, the user, and the metric the system exists to move"
excludes: "Implementation (see arch.system-overview), per-capability behaviour (see .brain/domains/)"
tokens_est: 1203
---

# Product Context

> **Status: draft — partially inferred.** The operator confirmed the summary
> below as accurate but did not supply an independent product brief. Treat the
> *problem* and *mechanism* as verified against code; treat *market*, *pricing*,
> and *competitive positioning* as absent rather than assumed. See Open questions.

## What it is

Softdial Studio is a **parallel dialing platform for outbound sales teams**. An
agent dials many numbers simultaneously, answering-machine detection discards the
ones a human never picks up, and the first real human answer is bridged to the
agent's headset.

## The problem

Manual outbound dialing is dominated by waiting. Most calls reach voicemail, a
dead line, or nobody. An agent dialing one number at a time spends the majority
of the hour listening to ring tone and voicemail greetings rather than talking to
people.

## The mechanism

Dial *N* lines at once instead of one. Let AMD absorb the dead ends
automatically. Bridge the agent only when there is a human on the line, and drop
the rest of the batch the instant that happens — so the agent's time is spent
almost entirely in conversation.

The metric the whole system exists to move is **live conversations per agent
hour**. Nearly every design decision in the dial engine trades against it: batch
size, AMD sensitivity, and how aggressively losing legs are hung up.

## Who it is for

Outbound sales teams — SDRs and similar high-volume callers. The UI is written
for a single agent working a campaign: the landing screen surfaces call counts and
connect rate, and the dialer is the only full-screen working surface.

Signup collects first name, last name, company name, and company email, which
indicates B2B team use rather than individual consumer use.

## What a user does

1. Import contacts from CSV, mapping their columns to the canonical fields.
2. Group contacts into a campaign.
3. Buy or assign a Telnyx phone number to call from.
4. Start a parallel dial session, choosing how many lines to run.
5. Talk to whoever picks up. Voicemails and no-answers are dispositioned
   automatically.
6. Review connect rate and volume on the dashboard.

## Product surfaces and their maturity

Stated plainly, because the UI does not distinguish them and an agent assuming
otherwise will waste time:

| Surface | State |
|---|---|
| Parallel dialer | The real product. Most engineering effort lives here. |
| Contacts + CSV import | Working, with known rough edges — see `.brain/memory/active-work.md` |
| Campaigns | Working; several contact-adding paths still missing |
| Dashboard | Backed by real aggregates |
| Analytics | **Partly static placeholder data** — see `domain.analytics` |
| Settings → billing / team | UI present; no evidence of a billing backend in this repo |

## Open questions

1. **Is this a commercial product today, or pre-release?** The operator selected
   the inferred description rather than either the "commercial SaaS" or
   "pre-development" framing, so this is genuinely undetermined. The landing copy
   claims "2,000+ active teams", but that copy is static marketing text in
   `AuthScreen.tsx`, not a live figure — it is not evidence of real customers.
2. **Is there a billing system?** Settings has a billing tab. No Stripe or other
   payment dependency exists in this repository. Either it is elsewhere or it is
   unbuilt.
3. **Compliance posture is undocumented.** Outbound dialing in the US touches
   TCPA, state calling-window rules, and DNC list obligations. **No
   consent tracking, call-time-window enforcement, or DNC suppression exists
   anywhere in this codebase.** Whether that is handled operationally, handled
   elsewhere, or simply not yet addressed is unknown — and it is the single most
   consequential unanswered question about this product.
