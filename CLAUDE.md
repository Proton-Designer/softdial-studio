# Softdial Studio

A **parallel dialing platform for outbound sales teams**. One agent dials many
lines at once; answering-machine detection discards the dead ends; the first
human answer is bridged to the agent and the rest of the batch is hung up. The
metric the system exists to move is live conversations per agent hour.

**Stack:** TypeScript · React 18 + Vite 6 + Tailwind v4 · Deno (Supabase Edge
Functions) · Postgres · Upstash Redis · Telnyx Call Control + WebRTC
**Layout:** npm workspace — `apps/web` (client) + `supabase/` (backend, at root)

---

## Where to find things

| If you need… | Read |
|---|---|
| **Anything not listed below** | **`.brain/README.md`** — indexes the whole knowledge base |
| What this system is, end to end | `.brain/architecture/system-overview.md` — **canonical**; root `ARCHITECTURE.md` is only a pointer to it |
| What each of the 16 Edge Functions does | `.brain/architecture/service-map.md` |
| To *see* the knowledge base as an interactive diagram | `.brain/README.md` → "Interactive knowledge graph" |
| Where any code lives | `REPOSITORY_MAP.md` |
| How the parallel dialer works | `.brain/domains/dialer.md` |
| How Telnyx / phone numbers / WebRTC work | `.brain/domains/telephony.md` |
| How contacts and CSV import work | `.brain/domains/contacts.md` |
| How campaigns and leads work | `.brain/domains/campaigns.md` |
| How auth and RLS work | `.brain/domains/auth.md` |
| How the dashboard and analytics work | `.brain/domains/analytics.md` |
| Why a decision was made | `.brain/memory/decisions.md` |
| What is known-broken | `.brain/memory/known-issues.md` |
| What is in flight right now | `.brain/memory/active-work.md` |
| What we learned the hard way | `.brain/memory/lessons.md` |
| Build / deploy commands | `.brain/tooling/registry.md` |
| External services and their config | `.brain/tooling/integrations.md` |
| Step-by-step guides (deploy, Telnyx setup, CSV import, manual E2E) | `docs/README.md` — the L3 index; `.brain/` summarizes, `docs/` walks you through |
| What to update when you change code | `.brain/governance/contribution-protocol.md` |
| What the product does and for whom | `PRODUCT_CONTEXT.md` |
<!-- GENERATED:ROUTING-ROWS v1 candidates="arch.dependency-graph,arch.data-flows,gov.ownership,tool.integrations,tool.optimization-registry" -->
| how does data move through the system | `.brain/architecture/data-flows.md` |
| what depends on what | `.brain/architecture/dependency-graph.md` |
| who owns what | `.brain/governance/ownership.md` |
| what external services does this use | `.brain/tooling/integrations.md` |
| what token optimization tools are enabled | `.brain/tooling/optimization-registry.md` |
<!-- /GENERATED:ROUTING-ROWS -->

---

## Hard constraints

- **`telnyx-webhook` must be deployed with `--no-verify-jwt`** — use
  `npm run functions:deploy:webhook`. A plain deploy re-enables gateway JWT, Telnyx
  gets 401s, and the dial loop starts calls that never advance.
- **Its signature check currently fails open.** Treat that endpoint as
  unauthenticated until fixed. See `.brain/memory/known-issues.md` #0 before
  touching it — and do not "clean up" the fail-open branches without implementing
  ed25519 verification, or all real Telnyx traffic is rejected.
- **Migrations are append-only.** Never edit a migration already applied to a
  deployed environment. Write a new one.
- **Every new table needs RLS scoped to `auth.uid()`.** A table without it is a
  data leak, not a TODO.
- **Changing an Edge Function's response shape produces no TypeScript error.** The
  contract is hand-written in `apps/web/src/lib/api.ts`. Update both sides in the
  same commit.
- **`supabase/functions/_shared/dialer-engine.ts` changes are never local.** Four functions depend on
  it, and the webhook and user-initiated paths run through it concurrently.
- **`supabase/` stays at the repo root** — the Supabase CLI requires it there.
- **No screen shows a true number today.** `Analytics.tsx` is hardcoded mock data
  (invented agent names included). `Dashboard.tsx` is wired for real but aggregates
  `call_events`, which **nothing in this repo ever writes** — the dial loop writes
  `call_logs`. Its zeros are correct behaviour over an empty table, not a bug to
  debug. See `.brain/domains/analytics.md`.

---

## How to work here

**Load context in layers.** Summary → detail → source. Read the domain doc before
the code. Do not grep the repository to answer a question the routing table
already routes.

**Verify before you assert.** `.brain` summaries can drift. When a summary and the
code disagree, the code is right — fix the summary and note it in
`.brain/memory/known-issues.md`. In this repository specifically, plausible claims
about current behaviour have been wrong often enough to be worth the 30 seconds;
see `.brain/memory/lessons.md`.

**Record what you learn.** Non-obvious decision → `.brain/memory/decisions.md`.
Trap you hit → `.brain/memory/known-issues.md`. Approach that failed →
`.brain/memory/lessons.md`.

**Say what you did not do.** Partial work reported as complete is worse than
partial work reported honestly.

---

## Commands

```bash
npm install                      # workspace root; covers every package
npm run dev                      # web client on :3000
npm run check                    # format + lint + typecheck — the only gate; no CI exists
npm run build                    # typecheck + production build
npm run db:push                  # apply Supabase migrations
npm run functions:deploy:webhook # telnyx-webhook, with --no-verify-jwt
```

There are **no automated tests**. The dial loop is verified by hand via
`docs/validation/parallel-dialer-checklist.md`.

Full reference: `.brain/tooling/registry.md`
