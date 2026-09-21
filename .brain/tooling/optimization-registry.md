---
id: tool.optimization-registry
title: Token Optimization Registry
layer: L2
type: tooling
status: canonical
owner: unassigned
updated: 2026-09-21
answers:
  - "what token optimization tools are enabled"
  - "should I use a containment tool here"
  - "how do I turn optimization tooling on or off"
covers: "Which containment/optimization tools are enabled, per-tool record, integration checklist"
excludes: "MCP servers (see tool.mcp-registry), general tool-output safety rules (see gov.tool-output-policy)"
tokens_est: 1253
---

# Token Optimization Registry

**Status of this repo:** no optimization tooling enabled. Offered during the 2026-09-21 Agent-Brain install and not adopted — the repository is small (159 files, ~37k tokens of docs) and the layered `.brain/` structure addresses the discovery sink directly. Revisit if the repo grows substantially.

Agent-Brain's own optimizations — layering, routing, budgets, indexes — are always
on and require nothing here. This registry covers **optional third-party tooling**
layered on top.

---

## Enabled here

<!-- Only tools actually installed and configured in THIS repo. If none, say so
     and delete the rows — an aspirational list is worse than an empty one. -->

| Tool | Category | Sink addressed | Status | Config | Notes |
|---|---|---|---|---|---|
| — | — | — | `disabled` | — | None enabled; see status above |

Status values: `enabled` · `disabled` · `evaluating` · `rejected`

Recording `rejected` with a reason is as valuable as recording `enabled` — it
stops the same tool being re-evaluated every six months.

---

## Available categories

Agent-Brain recognizes these categories and recommends adoption **in this order**.
Reasoning is in the Agent-Brain project's token-optimization framework doc (not
installed in this repo — the table below is what applies here).

| # | Category | What it does | Sink | Examples |
|---|---|---|---|---|
| 1 | **Knowledge routing** | Navigate instead of search | Discovery | Knowledge graphs · symbol navigation · service maps — **Agent-Brain is this; you already have it** |
| 2a | **Ambient containment** | Filters all shell output automatically; agent unchanged | Tool output | **[Omni](https://github.com/fajarhide/omni)** — start here |
| 2b | **Deliberate workspace** | Separate execution path + indexed search + post-compaction recovery | Tool output · session continuity | **[Context Mode](https://github.com/mksglu/context-mode)** — add if you need those |
| 3 | **Observability** | Measures where tokens actually go | All | [CodeBurn](https://github.com/getagentseal/codeburn) |

**Containment is the only category where you likely need to add something** — it is the
one real sink Agent-Brain does not solve. `.brain/governance/tool-output-policy.md` tells
an agent to scope its commands: that is discipline, and discipline fails. Containment is
enforcement, applied *before* output reaches the context window.

**2a and 2b are not substitutes.** Omni filters the shell path passively and catches
everything; Context Mode is a path the agent must choose, and adds indexed search plus
post-compaction state recovery that nothing else here does. Running **both** is
**unverified** — if they hook the same shell path you get double interception with no way
to tell which layer truncated something. Test before combining, and record the result.

**Deliberately excluded:** output compression (terse-response / caveman-style / semantic
anchors) and generic token audits. Reasoning is in the Agent-Brain project's
token-optimization framework doc (not installed in this repo). If your team evaluates
either, record the outcome as `rejected` with your own reason below — a recorded
rejection stops the same tool being re-evaluated every six months.

---

## Per-tool record

No tool has been evaluated yet. When one is, add a block in this shape:

```markdown
### <Tool name>
- **Category:** <tool compression | context pruning | retrieval | other>
- **Status:** <enabled | disabled | evaluating | rejected>
- **Enable/disable:** <the actual command, env var, or config key>
- **Addresses:** <which token sink, concretely, in this repo>
- **Measured effect:** <numbers + date, or "not measured">
- **Cost:** <setup burden, runtime overhead, failure modes>
- **When NOT to use:** <the cases where it hurts>
- **Decision:** <why the current status>
```

Record rejections too. An undocumented rejection gets re-evaluated every six
months by someone who does not know it was already considered.
