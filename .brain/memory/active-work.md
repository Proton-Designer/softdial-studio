---
id: mem.active-work
title: Active Work
layer: L2
type: memory
status: canonical
owner: maintainer
updated: 2026-09-21
related:
  - mem.known-issues
  - domain.contacts
  - domain.campaigns
answers:
  - "what is in flight"
  - "what is being worked on"
  - "what is the current backlog"
  - "what should I pick up next"
covers: "Work in progress and the near-term backlog"
excludes: "Shipped decisions (see mem.decisions), defects in shipped behaviour (see mem.known-issues)"
tokens_est: 933
---

# Active Work

## In flight

Nothing. The repository modernization and Agent-Brain install
(2026-09-21) are complete and committed.

## Backlog

Migrated verbatim in intent from the former docs/backlog.md, removed under the
Phase 02 classification plan — a TODO list is memory, and two copies diverge.

> **Provenance and confidence.** These were written by the maintainer in
> the original changesToBeMade.txt at an unrecorded date before 2026-04-29. Only the
> one marked *verified* below has been rechecked against current code. The rest
> are `unverified` — **confirm the item still reproduces before starting it.**

### Contacts

| # | Item | Status |
|---|---|---|
| 1 | On loading the next page of contacts, scroll to the top of the list instead of leaving the user at the bottom. | unverified |
| 2 | The CSV import column-mapping step is overlapped by the menu and does not fit on screen. Reduce the container's vertical extent. | unverified |
| 3 | Import field dropdown: cap at ~5 visible options and make it scrollable. | unverified |

**Item 3 was partially resolved already.** The original note also asked to grey
out already-mapped fields. That half **is implemented** —
`isFieldMappedElsewhere` in `apps/web/src/components/contacts/ImportContactsModal.tsx`
drives both the `disabled` prop and a muted style on each affected option
(verified 2026-09-21, `ImportContactsModal.tsx:374-386`). Only the height cap and
scrolling remain.

### Campaigns

| # | Item | Status |
|---|---|---|
| 4 | Widen the "create new campaign" naming dialog. | unverified |
| 5 | Fix the status dropdown and give it a solid background — it renders transparent. | unverified |
| 6 | Bring the campaigns screen to parity with contacts: CSV import, single-contact creation, and adding existing contacts. | unverified |

Item 6 is the only substantial one — it is a feature, not a fix, and it is
plausibly the largest open item in the product.

## Recommended next steps

Not assigned; offered as a reading of the current state:

1. **Verify the six backlog items.** A one-hour pass converts a stale list into a
   real one. Five of six have never been rechecked.
2. **Decide what `Analytics.tsx` is.** It currently renders static placeholder
   data (see `.brain/memory/known-issues.md`). Either wire it to
   `team-performance` or label it in the UI. Shipping charts that look live and
   are not is the kind of thing that erodes trust in every other number on screen.
3. **Add CI.** `npm run check` and `npm run build` both pass today. Nothing
   enforces that they keep passing.
4. **Decide the compliance posture.** No consent tracking, calling-window
   enforcement, or DNC suppression exists in this codebase. See the open question
   in `PRODUCT_CONTEXT.md`. This is a product decision, not an engineering task,
   and it is the highest-consequence open item.
