# Agent Guide — Softdial Studio

A parallel dialing platform for outbound sales teams: many simultaneous call
legs, answering-machine detection, first human answer bridged to the agent.

This repository uses **Agent-Brain**: knowledge is layered, and you navigate to it
rather than searching for it.

## Start here

1. Read this file.
2. Use the routing table below to load only what your task needs.
3. Read the domain summary before the code it describes.

**Do not grep the repository to answer a question the routing table answers.**
That is the search cost this structure exists to remove.

## Routing

| If you need… | Read |
|---|---|
| System architecture | `.brain/architecture/system-overview.md` |
| Where code lives | `REPOSITORY_MAP.md` |
| A business domain | `.brain/domains/<domain>.md` — dialer, telephony, contacts, campaigns, auth, analytics |
| Past decisions | `.brain/memory/decisions.md` |
| Known problems | `.brain/memory/known-issues.md` |
| Work in flight | `.brain/memory/active-work.md` |
| Commands & tooling | `.brain/tooling/registry.md` |
| Ownership | `.brain/governance/ownership.md` |
| Full index of knowledge | `.brain/indexes/doc-index.json` |
| An interactive visual diagram of the knowledge base | `.brain/README.md` |

Machine-readable routing: `.brain/indexes/knowledge-map.json` maps questions to
documents and documents to source paths.

## Rules

- **Layers, in order.** Summary → documentation → source. Never source first.
- **Code wins.** If a summary contradicts the code, the code is correct. Fix the
  summary and record it in `.brain/memory/known-issues.md`.
- **Write down what you learn.** Decisions, traps, and dead ends go in
  `.brain/memory/`. Undocumented knowledge is re-derived at full cost next session.
- **Update what you invalidate.** Changing code covered by a `sources:` glob means
  updating that summary — see `.brain/governance/contribution-protocol.md`.
- **Report honestly.** Say what you did not do, and what you were unsure of.

## Constraints

- **`telnyx-webhook` deploys with `--no-verify-jwt`** (`npm run functions:deploy:webhook`).
  Its signature check currently **fails open** — treat the endpoint as
  unauthenticated, and read `.brain/memory/known-issues.md` #0 before changing it.
- **Migrations are append-only**, and every new table needs RLS scoped to
  `auth.uid()`.
- **The client/server contract is hand-written** in `apps/web/src/lib/api.ts`.
  Changing an Edge Function's response shape raises no type error — only a runtime
  failure. Update both sides together.
- **`supabase/functions/_shared/dialer-engine.ts` changes are never local** — four functions depend on
  it and run through it concurrently.
- **The Analytics screen is hardcoded mock data.** `Dashboard.tsx` is real.
- **Verify before asserting.** `npm run check` and `npm run build` are the only
  gates; there is no CI and there are no tests.
