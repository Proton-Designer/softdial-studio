---
id: gov.knowledge-lifecycle
title: Knowledge Lifecycle
layer: L2
type: governance
status: canonical
owner: unassigned
updated: 2026-09-21
answers:
  - "when should a document be archived"
  - "how often is knowledge reviewed"
  - "what do I do about a drifted document"
covers: "Review cadence, drift handling, archiving and deletion rules"
excludes: "What to update on a code change (see gov.contribution-protocol), authoring/frontmatter rules (see gov.documentation-standards)"
tokens_est: 1133
---

# Knowledge Lifecycle

```
created → canonical → (drift detected) → verified or updated
                    → superseded → archived (L5)
```

Nothing is deleted. Superseded knowledge is archived with provenance, because an
archive is what makes consolidation reversible — and consolidation that cannot be
reversed does not get done, so the corpus rots instead.

---

## Creating
<!-- answers: "what does a new document need before it is written" -->

New knowledge needs a home before it is written (`documentation-standards.md`),
valid frontmatter, and a routing entry. **A document nothing routes to is
maintenance cost with no return** — `brain verify` flags it as an orphan.

## Reviewing
<!-- answers: "how often is knowledge reviewed" -->

| Document | Cadence |
|---|---|
| `.brain/memory/active-work.md` | Weekly — fastest-rotting file in the system |
| Domain summaries | On drift, or quarterly |
| Architecture | Quarterly, or on structural change |
| `.brain/memory/known-issues.md` | Monthly — prune what is resolved |
| `.brain/memory/decisions.md` | Never rewritten; append-only |

Review = **verify against reality**, then update `updated:`. A date bumped
without re-reading is worse than a stale date, because it converts an honest
signal into a false one.

## Drift
<!-- answers: "what do I do about a drifted document" -->

`brain verify` compares each document's `source_hash` against a recomputed hash of
its `sources:` globs.

**Drift-suspect ≠ stale.** A formatting-only commit changes the hash without
invalidating a word. The detection is mechanical; the verdict stays human.

On a drift flag:
1. Read the document and the changed code.
2. Still accurate → bump `updated:`, regenerate the hash. Done.
3. Partially wrong → fix the wrong parts.
4. Fundamentally wrong → rewrite, and archive the old version if it described a
   design worth remembering.

**Never suppress a drift flag without doing 1.** The check is only worth having if
its output is acted on; a routinely-ignored warning trains everyone to ignore all
of them.

## Archiving
<!-- answers: "when should a document be archived" -->

Archive when a document is superseded, or describes something that no longer
exists but is worth remembering.

Requires a full provenance header (`origin_path`, `archived_reason`,
`superseded_by`, `retained_because`) — see `.brain/archive/README.md`.

**`retained_because` is the test.** If no credible sentence can be written for it,
the document is a `Delete` candidate and belongs in front of a human, not quietly
parked in the archive. That field is what separates an archive from a junk drawer.

## Deleting
<!-- answers: "when is it OK to delete a document instead of archiving it" -->

Rare, and it requires: no unique content · a retained copy or recoverable history ·
a recorded reason, following the Agent-Brain project's deletion protocol (not
installed in this repo — the rule above is what applies here).

**When torn between delete and archive, archive.** The costs are wildly
asymmetric — archiving wastes kilobytes; deleting destroys a fact, and you will
not be present when someone needs it.

## Ownership of the lifecycle

| Role | Responsibility |
|---|---|
| Maintainer (sole owner today) | Reviews on cadence; responds to drift flags |
| Anyone changing code | Updates the affected `.brain/` summary in the same commit |
| CI | **Not set up.** When added, it must run `brain verify . --strict` and block on failure. Today this is manual. |
| AI agents | Record decisions, traps, and dead ends in `.brain/memory/` as they work |
