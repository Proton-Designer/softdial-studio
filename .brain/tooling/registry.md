---
id: tool.registry
title: Command Registry
layer: L2
type: tooling
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - package.json
  - apps/web/package.json
related:
  - tool.integrations
  - gov.tool-output-policy
answers:
  - "how do I run this"
  - "how do I build this"
  - "what commands exist"
  - "how do I deploy"
  - "how do I apply a migration"
  - "how do I run the checks before pushing"
covers: "Every command needed to develop, verify, and deploy this repository"
excludes: "External service configuration (see tool.integrations), environment variables (see docs/reference/environment-variables.md)"
tokens_est: 1064
source_hash: 0651b7f319afc588197d0db27eb4513c0499f9f6f33120f3553f05c8f6e07487
---

# Command Registry

Run everything from the **repository root**. It is an npm workspace; one install
covers every package.

## Setup

```bash
git clone --recurse-submodules https://github.com/Proton-Designer/softdial-studio.git
npm install
cp apps/web/.env.example apps/web/.env
cp supabase/.env.example supabase/.env
```

Cloned without submodules? `git submodule update --init --recursive`

## Develop

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server on **port 3000**, opens a browser |
| `npm run build` | `tsc --noEmit` then production build into the web app's dist/ directory |
| `npm run preview` | Serve the production build |

## Verify — run before every push

| Command | Does |
|---|---|
| `npm run check` | **The gate.** `format:check` + `lint` + `typecheck` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint 9 flat config |
| `npm run format` / `format:check` | Prettier |

Current baseline as of 2026-09-21: `check` passes with **0 errors, 13
warnings**; `build` succeeds. **There is no CI** — this command is the only gate,
so a red `check` reaches `main` if you let it.

## Database

| Command | Does |
|---|---|
| `npx supabase login` | Authenticate the CLI (opens a browser) |
| `npx supabase link --project-ref <ref>` | Link the repo to a project |
| `npm run db:push` | Apply pending migrations |

Migrations are **append-only**, named `YYYYMMDDHHMMSS_description.sql`. Never edit
one already applied to a deployed environment.

`supabase/sql/` holds one-off scripts for the dashboard SQL editor. They are
**not** part of the migration chain and are not applied by `db:push`.

## Edge Functions

| Command | Does |
|---|---|
| `npm run functions:deploy` | Deploy all 16 |
| `npm run functions:deploy:webhook` | Deploy `telnyx-webhook` with `--no-verify-jwt` |
| `npx supabase functions deploy <name>` | Deploy one |
| `npx supabase secrets set --env-file supabase/.env` | Push server secrets |
| `npx supabase secrets list` | Confirm what is actually set |

> **`telnyx-webhook` must be deployed with `--no-verify-jwt`.** Deploying it with
> the plain `functions:deploy` command leaves gateway JWT verification on, and
> Telnyx — which has no Supabase session — gets rejected. The dial loop then
> starts calls and never advances. Use the dedicated script.

Secrets apply at deploy time. Changing one does not affect a running function
until it is redeployed.

## Knowledge base

| Command | Does |
|---|---|
| `node vendor/agent-brain/bin/brain index .` | Regenerate `.brain/indexes/` |
| `node vendor/agent-brain/bin/brain verify . --strict` | Health-check `.brain/` |
| `node vendor/agent-brain/bin/brain graph .` | Interactive HTML knowledge graph |
| `node vendor/agent-brain/bin/brain scan .` | Re-run discovery into the .brain scan directory |

Requires the agent-brain submodule under `vendor/` to be checked out.

## Manual verification

There are **no automated tests**. The only procedure for the dial loop is
`docs/validation/parallel-dialer-checklist.md`, which needs live Telnyx
credentials and a real phone call.
