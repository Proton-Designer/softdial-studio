---
id: gov.contribution-protocol
title: Contribution Protocol
layer: L2
type: governance
status: canonical
owner: unassigned
updated: 2026-09-21
answers:
  - "what do I update when I change code"
  - "how do I keep the brain current"
covers: "What .brain doc to update for a given change type, agent-specific update rules, the CI gate"
excludes: "How to write a .brain document (see gov.documentation-standards), when a document should be archived (see gov.knowledge-lifecycle)"
tokens_est: 1202
---

# Contribution Protocol

What you must update when you change this repository. Applies to humans and
agents equally.

---

## The rule
<!-- answers: "when do I need to update a .brain document" -->

> **If you changed code that a `.brain` document names in its `sources:`, you
> update that document in the same change.**

Not later. Not in a follow-up ticket. The follow-up does not happen, and the gap
between code and summary is exactly where agents start being confidently wrong.

`brain verify` tells you which document you touched:

```bash
node vendor/agent-brain/bin/brain verify . --strict
```

**After changing anything under `.brain/`, refresh the generated artifacts and commit
them with your change:**

```bash
node vendor/agent-brain/bin/brain index .   # indexes + routing rows + frontmatter hashes
node vendor/agent-brain/bin/brain graph .   # .brain/graph.html — committed here, unlike upstream
```

Unlike Agent-Brain's default, this repo **commits `graph.html`** so the knowledge graph
opens from a fresh clone without anyone needing the CLI. The cost of that choice is that
it goes stale silently if you skip the regenerate step — so don't.

---

## By change type
<!-- answers: "what document do I update for a given change" -->

| You changed | Update |
|---|---|
| Behavior inside a domain | `.brain/domains/<domain>.md` |
| Added/removed/renamed a service | `.brain/architecture/service-map.md`, `REPOSITORY_MAP.md` |
| A dependency between components | `.brain/architecture/dependency-graph.md` |
| How data moves | `.brain/architecture/data-flows.md` |
| Made a non-obvious technical choice | `.brain/memory/decisions.md` |
| Hit a trap others will hit | `.brain/memory/known-issues.md` |
| Tried something that failed | `.brain/memory/lessons.md` |
| Started/finished significant work | `.brain/memory/active-work.md` |
| A command, script, or integration | `.brain/tooling/registry.md` |
| Ownership | `.brain/governance/ownership.md` |

---

## For agents specifically

**At session start:** read root `CLAUDE.md`, then only what the routing table
points you at. Do not crawl the repository.

**During work:** when a summary contradicts the code, **the code is right.** Fix
the summary and note the correction. A silently-wrong summary is worse than a
missing one, because it will be trusted.

**At session end, record:**
- Decisions with reasoning → `.brain/memory/decisions.md`
- Traps hit → `.brain/memory/known-issues.md`
- Dead ends → `.brain/memory/lessons.md` *(the highest-value one — successes get
  written into the code and are visible forever; failures leave no trace at all)*

**Never:** delete a `.brain` document without archiving it · edit
`.brain/indexes/*` by hand (generated — hand edits become a second source of
truth that silently disagrees) · exceed a token budget without recording the
exception.

---

## Review cadence
<!-- answers: "how often should each document be reviewed" -->

| Document | Reviewed |
|---|---|
| `.brain/memory/active-work.md` | Weekly — fastest-rotting file in the system |
| Domain summaries | When `brain verify` flags drift, or quarterly |
| Architecture | Quarterly, or on any structural change |
| `.brain/memory/decisions.md` | Append-only; never rewritten |
| `.brain/memory/known-issues.md` | Monthly — prune what is resolved |

Reviewing a document means **verifying it against reality** and then updating
`updated:`. Bumping the date without re-reading launders staleness as freshness
and is worse than leaving the old date.

---

## CI gate
<!-- answers: "how do I wire brain verify into CI" -->

```yaml
- run: node vendor/agent-brain/bin/brain verify . --strict
```

This must be a required check. Knowledge quality decays by default, and warnings
that do not fail a build accumulate silently until the system is not worth
trusting.
