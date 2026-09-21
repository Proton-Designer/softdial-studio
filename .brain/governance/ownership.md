---
id: gov.ownership
title: Ownership
layer: L2
type: governance
status: canonical
owner: maintainer
updated: 2026-09-21
related:
  - gov.contribution-protocol
  - map.repository
answers:
  - "who owns what"
  - "who should review this change"
  - "who do I ask about the dialer"
covers: "Ownership of areas of this repository"
excludes: "How to contribute (see gov.contribution-protocol), what code lives where (see map.repository)"
tokens_est: 761
---

# Ownership

## Current state: single maintainer

Git history shows **one contributor** across the repository's life
(2026-04-29 → 2026-09-21, 2 commits at time of writing). Every `owner:` field in
`.brain/` is therefore set to `maintainer`.

This is recorded rather than left `unassigned` because it is a fact about the
project, not a gap in knowledge. There is no team-to-area mapping to write down
because there is no team.

## What this means in practice

- **No review requirement is enforceable.** There is no second person and no
  CODEOWNERS file. `npm run check` is the only mechanical gate, and it is not
  automated.
- **Knowledge concentration is the main risk.** The reasoning behind the dial
  engine exists in one person's head and, as of this install, in
  `.brain/memory/decisions.md`. That file is the mitigation — keep it current.
- **"Ask the owner" is not a viable routing strategy** for an agent working in
  this repo. Route to the documents instead; that is what they are for.

## When a team forms

Revisit this file first, then:

1. Add a `CODEOWNERS` file so review routing is mechanical rather than social.
2. Replace `owner: maintainer` in each `.brain/` document with the real owning
   team. The `owner:` field is per-document, so this is a mechanical pass.
3. Set an ownership boundary for `supabase/functions/_shared/dialer-engine.ts` specifically. It is
   802 lines, four functions depend on it, and it is where concurrent webhook and
   user-initiated paths meet — it is the one file where "who reviews this" should
   be decided before it is needed rather than after.

## Areas, for when there is someone to assign them to

| Area | Path | Covered by |
|---|---|---|
| Dial engine | `supabase/functions/_shared/dialer-engine.ts` | `domain.dialer` |
| Telephony | `supabase/functions/_shared/telnyx.ts`, `telnyx-*` functions | `domain.telephony` |
| Contacts | `contacts-*` functions, `apps/web/src/components/contacts/` | `domain.contacts` |
| Campaigns | `campaign*` tables, `apps/web/src/components/campaigns/` | `domain.campaigns` |
| Auth & RLS | `supabase/functions/_shared/auth.ts`, all migrations | `domain.auth` |
| Analytics | `dashboard-stats`, `team-performance` | `domain.analytics` |
| Web client | `apps/web/` | `map.repository` |
