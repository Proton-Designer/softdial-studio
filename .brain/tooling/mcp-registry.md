---
id: tool.mcp-registry
title: MCP Registry
layer: L2
type: tooling
status: canonical
owner: unassigned
updated: 2026-09-21
answers:
  - "what MCP servers are available"
  - "should I use the database MCP for this"
  - "how do I access X"
covers: "Which MCP servers are available, what each is for, rules for agents using them"
excludes: "External services not exposed via MCP (see tool.integrations), token-optimization tooling (see tool.optimization-registry)"
tokens_est: 533
---

# MCP Registry

**Configured in:** nothing in this repository · **Servers:** 0

This repository ships **no MCP configuration**. There is no `.mcp.json` and no
committed harness settings. Any MCP servers an individual contributor uses are
configured in their own client and are not part of the project.

<!-- Agent-Brain itself does not require MCP. `.brain` is plain files; any agent
     that can read a filesystem can use it. See frameworks/mcp-readiness.md. -->

## Adding one

If an MCP server becomes part of how this project is worked on, commit its
configuration and record it here in this shape:

```markdown
## <server-name>
- **Transport:** <stdio | http>
- **Provides:** <what capability, in plain language>
- **Use it when:** <the situation where this is the right tool>
- **Do NOT use it when:** <cases where something cheaper already answers>
- **Cost / latency:** <roughly what a call costs in time and tokens>
- **Auth:** <what credentials, where they come from>
- **Destructive operations:** <which tools mutate state — or "none, read-only">
```

## Standing prohibitions

| Target | Rule |
|---|---|
| Production Supabase project | No direct database mutation from an agent. Schema changes go through a migration file and `npm run db:push`, reviewed by a human. |
| Telnyx API | `telnyx-purchase-number` **spends money**. No agent should call it against a live account without explicit per-invocation approval. |
