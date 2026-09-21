---
id: map.repository
title: Repository Map
layer: L2
type: map
status: canonical
owner: maintainer
updated: 2026-09-21
related:
  - arch.system-overview
  - arch.service-map
answers:
  - "where does feature X live"
  - "where is the code for the dialer"
  - "what is in this directory"
  - "where do I put a new component"
  - "where are the migrations"
covers: "Directory-by-directory map of the repository and which L2 document covers each area"
excludes: "How subsystems work (see .brain/domains/), architecture (see arch.system-overview)"
tokens_est: 1489
---

# Repository Map

npm workspace. One package (`apps/web`), plus a Supabase project at the root and
two git submodules under `vendor/`.

```
softdial-studio/
├── apps/web/            Web client         →  domain.* (all UI)
├── supabase/            Backend + schema   →  arch.service-map
├── docs/                L3 documentation
├── .brain/              L2 knowledge base
├── vendor/              Submodules (no application code)
└── .cursor/             Cursor-specific rules and skills
```

## `apps/web/` — the client

Package `@softdial/web`. React 18 · TypeScript · Vite 6 · Tailwind v4.

| Path | Contains | Covered by |
|---|---|---|
| `apps/web/src/App.tsx` | Auth gate: `AuthScreen` or `MainApp` | `domain.auth` |
| `apps/web/src/main.tsx` | React root. Imports the only stylesheet. | — |
| `apps/web/src/components/MainApp.tsx` | Shell + tab router. **There is no react-router** — navigation is `useState` over a `TabType` union. | — |
| `apps/web/src/components/Dashboard.tsx` | Landing metrics | `domain.analytics` |
| `apps/web/src/components/Dialer.tsx` + `dialer/` | Live dial UI (7 files) | `domain.dialer` |
| `apps/web/src/components/Contacts.tsx` + `contacts/` | Contact list, import, detail (4 files) | `domain.contacts` |
| `apps/web/src/components/Campaigns.tsx` + `campaigns/` | Campaign list + manage modal (2 files) | `domain.campaigns` |
| `apps/web/src/components/Analytics.tsx` | Charts. **Partly mock data** — see `domain.analytics` | `domain.analytics` |
| `apps/web/src/components/Settings.tsx` | Profile, numbers, billing, team tabs | `domain.telephony` |
| `apps/web/src/components/TopNavigation.tsx` · `Sidebar.tsx` | Chrome + notifications | `domain.analytics` |
| `apps/web/src/components/ui/` | **48 generated shadcn/ui primitives.** Excluded from Prettier. Prefer regenerating over editing. | — |
| `apps/web/src/components/figma/` | `ImageWithFallback` — leftover from the Figma export | — |
| `apps/web/src/contexts/` | `AuthContext`, `PhoneNumbersContext` | `domain.auth`, `domain.telephony` |
| `apps/web/src/hooks/useDialerSession.ts` | Live dial-session state machine + Realtime subscription | `domain.dialer` |
| `apps/web/src/lib/api.ts` | **The entire backend contract.** ~40 typed wrappers. 698 lines. | `arch.service-map` |
| `apps/web/src/lib/supabase.ts` | Supabase client singleton | `domain.auth` |
| `apps/web/src/lib/useTelnyxCall.ts` | WebRTC hook — the agent's audio leg | `domain.telephony` |
| `apps/web/src/styles/globals.css` | **The only stylesheet.** Tailwind entry + design tokens. | — |

## `supabase/` — the backend

| Path | Contains | Covered by |
|---|---|---|
| `supabase/functions/` | 16 Edge Functions, one dir each | `arch.service-map` |
| `supabase/functions/_shared/dialer-engine.ts` | **The dial loop. 802 lines. Most consequential file in the repo.** | `domain.dialer` |
| `supabase/functions/_shared/telnyx.ts` | Call Control client | `domain.telephony` |
| `supabase/functions/_shared/redis.ts` | Upstash client, key scheme, `claimHumanAnswer` | `arch.data-flows` |
| `supabase/functions/_shared/dialer-events.ts` | Realtime publisher, 11 event types | `arch.data-flows` |
| `supabase/functions/_shared/amd.ts` | Answering-machine-detection interpretation | `domain.dialer` |
| `supabase/functions/_shared/auth.ts` · `cors.ts` | Used by every function | `domain.auth` |
| `supabase/migrations/` | 7 migrations, append-only, 9 tables | `domain.auth` (RLS) |
| `supabase/sql/` | One-off scripts for the Supabase SQL editor — **not** part of the migration chain | — |
| `supabase/config.toml` | Project config, including per-function `verify_jwt` | `domain.auth` |

## `docs/` — L3 documentation

| Path | Contains |
|---|---|
| `docs/guides/` | Deployment, Telnyx setup, CSV import |
| `docs/reference/` | Environment variables, Edge Function inventory |
| `docs/validation/` | Manual E2E checklist for the dial loop |

## `.brain/` — L2 knowledge

`architecture/` · `domains/` · `memory/` · `governance/` · `tooling/` ·
`indexes/` (generated) · `archive/` · `agents/` (reserved).
Start at [`.brain/README.md`](.brain/README.md).

## `vendor/` — submodules

| Path | What | Note |
|---|---|---|
| telnyx-agent-skills | Telnyx's API skill docs (269 files) | Reference only. No code imports it. |
| agent-brain | The knowledge-base tooling | Provides `node vendor/agent-brain/bin/brain` |

A clone without `--recurse-submodules` leaves both empty. The build is unaffected;
documentation tooling is not.

## Deliberately not in this map

Dependency, build, scan, and temp directories — generated
or vendored, and listing them would recreate the token problem this map exists to
solve.

## Unverified

- File counts (48 `ui/` primitives, 7 dialer files) were counted at
  2026-09-21 and will drift. Treat as approximate.
