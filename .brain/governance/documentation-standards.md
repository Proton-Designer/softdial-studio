---
id: gov.documentation-standards
title: Documentation Standards
layer: L2
type: governance
status: canonical
owner: unassigned
updated: 2026-09-21
answers:
  - "how do I write a .brain document"
  - "where does this piece of knowledge belong"
  - "what frontmatter is required"
covers: "Where knowledge belongs by layer, frontmatter schema, writing and review rules"
excludes: "When to update a doc after a code change (see gov.contribution-protocol), when a doc retires (see gov.knowledge-lifecycle)"
tokens_est: 1290
---

# Documentation Standards

## Where knowledge belongs
<!-- answers: "where does this piece of knowledge belong" -->

Decide by asking **what question does this answer?**

| Knowledge | Goes in |
|---|---|
| What this repo is; where to find things | `/CLAUDE.md` (L1) |
| How the system is structured | `.brain/architecture/` |
| How a business capability works | `.brain/domains/` |
| Why something was decided | `.brain/memory/decisions.md` |
| What is broken or trap-laden | `.brain/memory/known-issues.md` |
| What failed and was abandoned | `.brain/memory/lessons.md` |
| What is in flight | `.brain/memory/active-work.md` |
| Commands, services, integrations | `.brain/tooling/` |
| Detailed reference, ADRs, runbooks | `docs/` (L3) — not `.brain` |
| Superseded knowledge | `.brain/archive/` (L5) |

**If it fits two places, it goes in one and the other references it.** A fact
duplicated is a fact that will disagree with itself within a quarter, with no
tiebreaker.

## The layer rules
<!-- answers: "what are the L1 through L5 layer rules" -->

Full model: the Agent-Brain project's layering specification (not installed in this repo — this section is the summary that applies here).

- **L1 routes, never explains.** The moment `/CLAUDE.md` describes how something
  works, that content belongs one hop down.
- **L2 summarizes and points.** A summary with no outbound pointers is a dead end
  that forces the search it existed to prevent.
- **Never write L4 detail into L2.** Name the file; let the reader go to source.
- **Any fact reachable from L1 in ≤3 hops.** Enforced by `brain verify`.

## Frontmatter
<!-- answers: "what frontmatter fields are required" -->

Mandatory on every `.brain` document. Schema summarized below (full source: the
Agent-Brain project's frontmatter specification, not installed in this repo).

Required: `id` `title` `layer` `type` `status` `owner` `updated`
Expected on L2: `sources` `related` `answers`
Required on domains: `covers` `excludes`
Machine-owned — never hand-edit: `source_hash` `tokens_est`

`sources:` is the highest-value optional field: it is what turns "is this still
true?" from a judgment call into a computation.

## Writing rules
<!-- answers: "what are the writing rules for a .brain document" -->

- **Budgets are hard.** Enforced by `brain verify` against Agent-Brain's built-in
  budget table. Over budget → route, split, demote, or archive. Compress last, not first.
- **State the boundary.** Every domain doc says what it does *not* cover.
- **Label inference.** Anything derived from structure rather than confirmed in
  code says so inline. A document that hides its confidence level gets trusted
  exactly as much as one that earned it.
- **Numbers carry method.** Token figures are estimates (±15%). Performance claims
  carry the measurement and its date, or say "not measured".
- **Real paths only.** Every path referenced must exist. `brain verify` checks.
- **Write for an agent with no prior context.** No unexplained internal shorthand.
- **Annotate a section that answers one specific question.** A heading followed
  immediately by `<!-- answers: "question" -->` becomes its own `brain query`
  result — just that section, not the whole file. Use it on a heading with a
  narrow, specific answer (a gotcha, a single decision, a retry limit); skip it
  on a broad survey heading where the whole section is the point. Add one the
  moment you write a heading whose content someone will want without reading
  everything around it — a new entry in `.brain/memory/known-issues.md` or
  `.brain/memory/decisions.md` included, once it has a real
  (non-`{{templated}}`) heading of its own.

## Reviewing

Reviewing means **verifying against reality**, then updating `updated:`. Bumping
the date without re-reading launders staleness as freshness and is worse than
leaving the old date — it converts an honest "this is old" into a false "this is
current".

## Checks

```bash
node vendor/agent-brain/bin/brain verify . --strict
```

Validates frontmatter, budgets, links, `related:` ids, `sources:` globs, orphans,
duplicate ids, and drift.
