---
id: meta.domains-readme
title: Domains
layer: L2
type: meta
status: canonical
owner: unassigned
updated: 2026-09-21
answers:
  - "what business domains exist"
  - "which domain owns X"
covers: "What qualifies as a domain, how to write one, shared vs. local domain content"
excludes: "The domains themselves (see each domain's own .brain/domains/*.md)"
tokens_est: 859
---

# `.brain/domains/`

One summary per **business capability**. This is the layer most repositories lack, and its absence is why agents read code to answer
questions code was never the right source for.

---

## The domains

| Domain | Covers | Code | Owner |
|---|---|---|---|
| [Parallel Dialer](/.brain/domains/dialer.md) | Dial sessions, batching, AMD triage, human-answer race, batch advance | `supabase/functions/_shared/dialer-engine.ts` | maintainer |
| [Telephony](/.brain/domains/telephony.md) | Telnyx Call Control, number search/purchase, WebRTC agent leg | `supabase/functions/_shared/telnyx.ts` | maintainer |
| [Contacts](/.brain/domains/contacts.md) | Contact records, CSV parse/import, column mapping, de-duplication | `supabase/functions/contacts-*` | maintainer |
| [Campaigns](/.brain/domains/campaigns.md) | Campaigns, leads, and the handoff into a dial session | `apps/web/src/components/campaigns/` | maintainer |
| [Auth & Access Control](/.brain/domains/auth.md) | Supabase auth, the two authorization layers, RLS policies | `supabase/functions/_shared/auth.ts` | maintainer |
| [Analytics & Notifications](/.brain/domains/analytics.md) | Dashboard aggregates, call events, week summaries, notifications | `supabase/functions/dashboard-stats/` | maintainer |

---

## What counts as a domain

A **business capability**, not a directory and not a technical layer.

| Domain | Not a domain |
|---|---|
| Authentication, Billing, Orders, Notifications | `utils`, `components`, `api`, `middleware` |

Typical repositories have **3–15**. Forty means directories were indexed rather than capabilities identified; one means nobody
looked.

---

## Writing one

Use `_TEMPLATE.md`. Budget: **150 lines**.

The test a domain summary must pass:

> Could an agent implement a small feature in this domain, correctly, having read
> only this document and the files it names?

If not, it describes the domain rather than enabling work in it.

Two fields carry disproportionate weight:

- **`sources:`** — the globs that make drift mechanically detectable. Without it, "is this still true?" stays a judgment call
  forever.
- **`excludes:`** — the boundary. An agent that knows where a document stops will ask; one that doesn't will answer confidently out
  of a gap, and nobody catches it.

---

## Shared vs. local

In a monorepo, ask: **would a second package need this?**

Yes → root `.brain/domains/`. No → the package's own `.brain/domains/`. Unsure → root, with a `related:` edge from the package.

When in doubt, root. A domain copied into two packages drifts apart within a quarter and then gives two answers with no tiebreaker;
a slightly over-general root document is a much cheaper mistake.
