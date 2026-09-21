---
id: gov.tool-output-policy
title: Tool Output Policy
layer: L2
type: governance
status: canonical
owner: unassigned
updated: 2026-09-21
answers:
  - "how do I keep tool output from flooding context"
  - "what commands are safe to run"
covers: "Token-expensive commands, safe defaults, destructive-command rules, containment-tool interaction"
excludes: "Which containment tools are actually enabled here (see tool.optimization-registry)"
tokens_est: 1059
---

# Tool Output Policy

Tool output is one of the four token sinks. It is the easiest to fix and the most
often ignored, because nobody sees the cost — the output scrolls past and the
context is spent.

---

## The rule

> **Scope the command before you run it. Filter at the source, not after.**

Filtering after the fact does not help: the output already entered the context
window. The tokens are spent whether or not you read them.

---

## Expensive commands here

| Instead of | Run | Why |
|---|---|---|
| `npm run build` | `npm run build 2>&1 \| tail -20` | Vite prints a per-chunk table; only the tail matters |
| `git log` | `git log --oneline -20` | unbounded history |
| `git diff` | `git diff --stat` first, then scoped | whole-diff floods context |
| `ls -R` | `REPOSITORY_MAP.md` | the map exists precisely for this |
| `grep -r <term> .` | `.brain/indexes/symbol-index.json` | the index answers it without a scan |
| `npx supabase functions list` | `... \| head -30` | Unbounded as function count grows |
| `cat <large file>` | read the specific range | |

<!-- The `ls -R` and `grep -r` rows are the important ones: those are the
     DISCOVERY sink, and the whole point of .brain is that they are no longer
     necessary. If agents still reach for them, routing has a gap — fix the
     routing table rather than the habit. -->

---

## Destructive or expensive — ask first

| Command | Why |
|---|---|
| `npm run db:push` | Mutates the linked project's schema. Migrations are append-only and not trivially reversible. |
| `npm run functions:deploy` | Deploys all 16 functions to the linked project. There is no staging environment configured. |
| `npx supabase secrets set` | Overwrites server-side secrets. `secrets list` first. |

---

## Principles

**Prefer an index to a search.** If you are grepping for a symbol, use
`.brain/indexes/symbol-index.json`. If you are looking for a file, use `REPOSITORY_MAP.md`.
Reaching for `grep` in an Agent-Brain repository usually means the routing table
is missing an entry — that is a bug in the knowledge base, not a bad habit.

**Read ranges, not files.** When a document names `service.ts:120`, read around
line 120.

**One command, one question.** Chained commands produce interleaved output that
costs more to interpret than to re-run separately.

**Report output, do not paste it.** Summarize the result; quote only the lines
that carry the finding. Exception: verification evidence, where the actual output
is the point.

---

## If a containment tool is enabled

Check `.brain/tooling/optimization-registry.md`. If anything there is `enabled`, a
tool is sitting between command output and your context, and two rules become
**correctness** requirements rather than efficiency ones:

- **Parse JSON, not prose.** `node vendor/agent-brain/bin/brain verify . --strict --json`. Structured
  formats are guaranteed to pass through untouched; prose is not. A compressed
  findings list is a findings list with items missing, and nothing marks it as
  reduced.
- **Never `cat` a `.brain/` document.** Use the harness file-read tool. A summary
  that has itself been summarized is indistinguishable from the original.

Agent-Brain does not depend on any such tool. This policy works with none
installed and works better with one — but only if the registry checklist was
completed first.
