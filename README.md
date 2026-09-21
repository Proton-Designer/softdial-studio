<div align="center">

# Softdial Studio

**Parallel dialing platform for high-velocity sales teams.**

A React + Vite web client backed by Supabase Edge Functions, Postgres, and
Telnyx Call Control — dialing multiple lines per agent, detecting answering
machines, and bridging the first human that picks up.

[Getting started](#getting-started) · [Architecture](#architecture) · [Documentation](docs/) · [Contributing](CONTRIBUTING.md)

</div>

---

## What it does

Softdial Studio runs **parallel dial sessions**: for a given campaign it fires
_N_ simultaneous outbound legs, runs Telnyx AMD (answering-machine detection) on
each, and the moment a human answers it bridges that leg to the agent's WebRTC
session and hangs up the rest of the batch. Contacts are marked `voicemail`,
`no_answer`, or `connected` automatically, and the next batch fires when the
live call ends.

Around that core it provides contact management with CSV import and column
mapping, campaign building, a dashboard, analytics, and Telnyx phone-number
search and purchase.

## Repository layout

```
softdial-studio/
├── apps/
│   └── web/                 React + Vite client (@softdial/web)
│       ├── src/
│       │   ├── components/  Feature screens + shadcn/ui primitives
│       │   ├── contexts/    Auth and phone-number providers
│       │   ├── hooks/       useDialerSession — live session state machine
│       │   ├── lib/         Supabase client, API layer, Telnyx WebRTC hook
│       │   └── styles/      Tailwind v4 entry + design tokens
│       └── index.html
├── supabase/
│   ├── functions/           17 Deno Edge Functions
│   │   └── _shared/         dialer-engine, telnyx, redis, amd, auth, cors
│   ├── migrations/          Ordered SQL migrations
│   └── sql/                 One-off scripts for the SQL editor
├── docs/                    Guides, reference, validation checklists
├── vendor/
│   └── telnyx-agent-skills/ Telnyx API skill reference (git submodule)
└── .brain/                  Agent-Brain knowledge base (see below)
```

## Getting started

### Prerequisites

- **Node.js ≥ 20** (`node -v`)
- **npm ≥ 10**
- A **Supabase** project ([supabase.com](https://supabase.com))
- A **Telnyx** account with a Voice API (Call Control) Application
- An **Upstash Redis** database (parallel-dialer session state)

### 1. Clone with submodules

```bash
git clone --recurse-submodules https://github.com/Proton-Designer/softdial-studio.git
cd softdial-studio
```

Already cloned without them? `git submodule update --init --recursive`

### 2. Install

```bash
npm install
```

This is an npm workspace — one install at the root covers every package.

### 3. Configure environment

```bash
cp apps/web/.env.example apps/web/.env     # browser-safe config
cp supabase/.env.example supabase/.env     # server-side secrets
```

Fill both in. Every variable is documented in
[`docs/reference/environment-variables.md`](docs/reference/environment-variables.md).

### 4. Provision the backend

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push                            # apply migrations
npx supabase secrets set --env-file supabase/.env
npm run functions:deploy
npm run functions:deploy:webhook           # telnyx-webhook needs --no-verify-jwt
```

Full walkthrough: [`docs/guides/deploy-parallel-dialer.md`](docs/guides/deploy-parallel-dialer.md).

### 5. Run

```bash
npm run dev          # http://localhost:3000
```

## Commands

| Command                            | What it does                                         |
| ---------------------------------- | ---------------------------------------------------- |
| `npm run dev`                      | Start the web client on port 3000                    |
| `npm run build`                    | Typecheck, then production build to `apps/web/dist`  |
| `npm run preview`                  | Serve the production build locally                   |
| `npm run typecheck`                | `tsc --noEmit` across the web app                    |
| `npm run lint` / `lint:fix`        | ESLint over the workspace                            |
| `npm run format` / `format:check`  | Prettier                                             |
| `npm run check`                    | format:check + lint + typecheck — run before pushing |
| `npm run db:push`                  | Apply pending Supabase migrations                    |
| `npm run functions:deploy`         | Deploy all Edge Functions                            |
| `npm run functions:deploy:webhook` | Deploy `telnyx-webhook` without JWT verification     |

## Architecture

```
Browser (React)  ──auth/JWT──►  Supabase Edge Functions (Deno)
      │                               │
      │ @telnyx/webrtc                ├──► Postgres (RLS-scoped per user)
      │                               ├──► Upstash Redis (live session state)
      ▼                               └──► Telnyx Call Control API
  Agent audio  ◄────── bridged leg ──────────────┘
                                      ▲
           Telnyx call events ────────┘  POST /telnyx-webhook
```

The dial loop lives in `supabase/functions/_shared/dialer-engine.ts`. The
webhook (`telnyx-webhook`) is the only unauthenticated function — Telnyx calls
it directly and it verifies a shared signing secret.

Deeper detail lives in [`.brain/architecture/`](.brain/architecture/).

## Documentation

|                                      |                                                            |
| ------------------------------------ | ---------------------------------------------------------- |
| [`docs/`](docs/)                     | Human-facing guides, reference, and checklists             |
| [`.brain/`](.brain/)                 | Agent-Brain knowledge base — layered context for AI agents |
| [`CLAUDE.md`](CLAUDE.md)             | Entry point and routing table for AI coding agents         |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Conventions, workflow, and review expectations             |

## Tech stack

**Client** React 18 · TypeScript 5 · Vite 6 · Tailwind CSS v4 · Radix UI / shadcn-style primitives · Motion · Recharts · `@telnyx/webrtc`

**Backend** Supabase (Postgres + Auth + Edge Functions on Deno) · Upstash Redis · Telnyx Call Control

## License

Proprietary — all rights reserved. Third-party attributions in
[`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).
