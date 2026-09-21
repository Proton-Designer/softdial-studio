# Contributing to Softdial Studio

## Setup

```bash
git clone --recurse-submodules https://github.com/Proton-Designer/softdial-studio.git
cd softdial-studio
npm install
cp apps/web/.env.example apps/web/.env
cp supabase/.env.example supabase/.env
npm run dev
```

## Before you push

```bash
npm run check    # prettier --check, eslint, tsc --noEmit
npm run build    # must succeed
```

CI does not exist yet, so `npm run check` is the gate. Don't push red.

## Repository conventions

### Where things go

| Change                               | Location                                          |
| ------------------------------------ | ------------------------------------------------- |
| A screen or feature UI               | `apps/web/src/components/<Feature>.tsx`           |
| A sub-component of a feature         | `apps/web/src/components/<feature>/<Thing>.tsx`   |
| A generic primitive (button, dialog) | `apps/web/src/components/ui/` — mirrors shadcn/ui |
| Client-side API call                 | `apps/web/src/lib/api.ts`                         |
| Cross-screen state                   | `apps/web/src/contexts/`                          |
| Stateful logic reused across screens | `apps/web/src/hooks/`                             |
| A new backend endpoint               | `supabase/functions/<name>/index.ts`              |
| Logic shared between functions       | `supabase/functions/_shared/`                     |
| A schema change                      | A new file in `supabase/migrations/`              |

### Code style

Prettier and ESLint own formatting and correctness — run them rather than
arguing with them. Two things they can't enforce:

- **`apps/web/src/components/ui/` is generated.** These are shadcn/ui
  primitives. They're excluded from Prettier so upstream diffs stay readable.
  Prefer regenerating over hand-editing; if you must edit, say why in the commit.
- **Match the file you're in.** These components are dense and use inline
  Tailwind with hex literals from the design tokens. Follow the local idiom
  instead of introducing a competing one.

### Styling

Tailwind CSS v4, compiled by `@tailwindcss/vite`. The single entry point is
`apps/web/src/styles/globals.css`; design tokens are the CSS custom properties
in `:root`, re-exported to Tailwind through `@theme inline`.

**Add colors as tokens, not literals.** A large amount of existing code uses raw
hex (`bg-[#0A1628]`) — that's legacy, not a pattern to extend.

### Database

Migrations are append-only and named `YYYYMMDDHHMMSS_description.sql`. Never
edit a migration that has been applied to a deployed environment; write a new
one. Every table carries row-level security scoped to `auth.uid()` — a new table
without RLS is a bug.

### Edge Functions

Deno, not Node. They're excluded from the ESLint config because the globals and
module resolution differ.

- Every function except `telnyx-webhook` requires a valid Supabase JWT
  (`_shared/auth.ts`).
- `telnyx-webhook` is deployed with `--no-verify-jwt` because Telnyx calls it
  directly; it authenticates via the shared signing secret instead. Don't remove
  that check.
- Return CORS headers from `_shared/cors.ts` on every response, including errors.

## Commits and pull requests

Conventional-commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
`perf:`, `test:`.

Branch from `main` as `feat/…`, `fix/…`, or `chore/…`. A PR should say what
changed, why, and how you verified it. Changes touching the dial loop, billing,
or auth need a manual verification note — see
[`docs/validation/parallel-dialer-checklist.md`](docs/validation/parallel-dialer-checklist.md).

## Secrets

Never commit `.env` files, API keys, or service-role keys. Server-side secrets go
through `supabase secrets set`. Only `VITE_`-prefixed variables reach the
browser — anything in `apps/web/.env` is public once built.

## Knowledge base

This repo uses [Agent-Brain](https://github.com/Proton-Designer/agent-brain).
When you make a decision worth remembering, record it in `.brain/memory/` rather
than letting it live in a PR thread:

| File                            | For                                       |
| ------------------------------- | ----------------------------------------- |
| `.brain/memory/decisions.md`    | Why an approach was chosen                |
| `.brain/memory/known-issues.md` | Known-broken things and their workarounds |
| `.brain/memory/lessons.md`      | Non-obvious things learned the hard way   |
| `.brain/memory/active-work.md`  | What's in flight right now                |

Full protocol: [`.brain/governance/contribution-protocol.md`](.brain/governance/contribution-protocol.md).
