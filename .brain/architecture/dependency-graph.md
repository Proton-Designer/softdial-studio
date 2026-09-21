---
id: arch.dependency-graph
title: Dependency Graph
layer: L2
type: architecture
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - apps/web/src/**
  - supabase/functions/**
  - package.json
  - apps/web/package.json
related:
  - arch.system-overview
  - arch.service-map
answers:
  - "what depends on what"
  - "what breaks if I change this"
  - "can X import from Y"
  - "what is the blast radius of changing dialer-engine"
  - "which external packages matter"
covers: "Directed dependency edges, layering rules and their enforcement, change-impact analysis"
excludes: "Runtime data movement (see arch.data-flows), per-function behaviour (see arch.service-map)"
tokens_est: 1626
source_hash: 25984142165cb4fe7ea8f138a771856965281fe313395418661e06cb9f3a000d
---

# Dependency Graph

## The two independent trees

The client and the Edge Functions **share no code**. There is no shared types
package; the contract between them is duck-typed across HTTP and enforced only by
hand-maintained interfaces in `apps/web/src/lib/api.ts`.

That is a real risk and worth naming: **a change to an Edge Function's response
shape will not produce a TypeScript error in the client.** It produces a runtime
failure. Treat every function signature change as a cross-tree change.

## Client tree

```
main.tsx
  └─ App.tsx
       ├─ contexts/AuthContext.tsx ────────► lib/supabase.ts
       ├─ contexts/PhoneNumbersContext.tsx ─► lib/api.ts
       └─ components/MainApp.tsx
            ├─ Dashboard · Analytics · Settings · Contacts · Campaigns
            └─ Dialer.tsx
                 ├─ hooks/useDialerSession.ts ─► lib/api.ts ─► lib/supabase.ts
                 ├─ lib/useTelnyxCall.ts ──────► @telnyx/webrtc
                 └─ components/dialer/*.tsx
```

**Rules:**

| Rule | Enforced by |
|---|---|
| `components/**` must not import `@supabase/supabase-js` directly — go through `apps/web/src/lib/api.ts` | **Nothing.** Convention only. |
| `components/ui/**` must not import from `components/<feature>/**` | **Nothing.** Convention only. |
| `components/ui/**` is generated; prefer regeneration over editing | `.prettierignore`, `CONTRIBUTING.md` |
| Path alias `@/` resolves to `apps/web/src/` | `vite.config.ts` + `tsconfig.json` |

Three of those four are unenforced. They are conventions the code currently
follows, not invariants you can rely on. If they start mattering, add an ESLint
`no-restricted-imports` rule rather than trusting the note.

## Edge Function tree

Every function is a leaf. Functions **never import each other** — only
`_shared/`. This is a hard property of the Supabase deploy model, not a
convention.

```
_shared/cors.ts        ◄── all 16 functions
_shared/auth.ts        ◄── 15 functions (all except telnyx-webhook)
_shared/redis.ts       ◄── dialer-session-{start,stop,get,pause,hangup-live}, telnyx-webhook
_shared/telnyx.ts      ◄── dialer-session-{start,stop,hangup-live}, telnyx-webhook
_shared/dialer-events.ts ◄── dialer-session-{start,stop}, telnyx-webhook
_shared/dialer-engine.ts ◄── dialer-session-{start,stop,hangup-live}, telnyx-webhook
      └─ imports: redis.ts, telnyx.ts, dialer-events.ts, amd.ts
```

### Blast radius

| Change to | Directly affects | Verify with |
|---|---|---|
| `supabase/functions/_shared/cors.ts` | **All 16 functions** | Any browser call; a CORS regression breaks everything at once |
| `supabase/functions/_shared/auth.ts` | 15 functions | Any authenticated call |
| `supabase/functions/_shared/dialer-engine.ts` | 4 functions — **the entire dial loop** | `docs/validation/parallel-dialer-checklist.md`, end to end |
| `supabase/functions/_shared/redis.ts` | 6 functions | Start a session; confirm batch state advances |
| `supabase/functions/_shared/telnyx.ts` | 4 functions | Place a real call |
| `supabase/functions/_shared/dialer-events.ts` | 3 functions | UI stops updating live but calls still connect |
| A single `<name>/index.ts` | That endpoint only | That endpoint |

`supabase/functions/_shared/dialer-engine.ts` is 802 lines and the most connected module in the
repo. It is where four functions meet. **Changes there are never local** — the
webhook path and the user-initiated path both run through it, and they can run
concurrently for the same session.

## External dependencies that carry architectural weight

| Package | Where | Why it matters |
|---|---|---|
| `@supabase/supabase-js` | both trees | Auth, Postgres, Realtime. Replacing it is a rewrite. |
| `@telnyx/webrtc` | client only | Holds the agent's audio leg. Browser-only; cannot move server-side. |
| `@upstash/redis` | functions only | Reached over REST, not a TCP client — required, because Edge Functions cannot hold a socket pool. |
| `tailwindcss` v4 + `@tailwindcss/vite` | client build | The **only** styling mechanism. See `.brain/memory/decisions.md`. |
| Radix UI (26 packages) | `components/ui/**` | Every primitive. Pinned per-package; they version independently. |

## Known cycles

None detected. The Edge Function tree is acyclic by construction. The client tree
has no cycles as of this writing, though nothing enforces that — `madge` or
the ESLint import/no-cycle rule would, and neither is installed.

## The submodules

The two directories under `vendor/` — telnyx-agent-skills and agent-brain — are git submodules. **No
application code imports from either.** They are reference material and tooling.
A clone without `--recurse-submodules` leaves both directories empty, which
affects documentation and the `brain` CLI but not the build.

## Unverified

- "No cycles in the client tree" is asserted from reading the import structure,
  not from running a cycle detector. It was not mechanically verified.
- The claim that Edge Functions cannot import each other reflects the Supabase
  per-function bundling model and the observed code, not a cited Supabase doc.
