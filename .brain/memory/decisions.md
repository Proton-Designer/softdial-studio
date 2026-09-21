---
id: mem.decisions
title: Decisions
layer: L2
type: memory
status: canonical
owner: maintainer
updated: 2026-09-21
related:
  - arch.system-overview
  - mem.known-issues
answers:
  - "why was X chosen"
  - "why do we do it this way"
  - "was Y considered"
  - "why is there a Redis and a Postgres"
  - "why is the webhook unauthenticated"
  - "why is components/ui not formatted"
covers: "Decisions made, alternatives considered, what superseded what"
excludes: "Work in progress (see mem.active-work), currently-broken behaviour (see mem.known-issues)"
tokens_est: 2102
---

# Decisions

Newest first. Each entry answers: what was decided, why, and what it rules out.

> Entries dated 2026-09-21 were recorded during the repository modernization and
> Agent-Brain install. Earlier decisions are **reconstructed from code**, not from
> a written record — they are labeled as such, and their "decided by" is unknown.

---

## 2026-09-21 — Restore a real Tailwind build; delete the compiled CSS

**Status:** Active · **Decided by:** maintainer (approved during modernization)

**Context:** The web app's src/index.css was a 2,549-line *precompiled* Tailwind v4
artifact shipped by the original Figma Make export. Tailwind was not a
dependency, there was no config, and `apps/web/src/styles/globals.css` — the file holding
every design token — was imported by nothing. The practical effect: **any new
Tailwind utility class silently did nothing.** A developer writing `mt-5` on a new
component would see no margin and no error.

**Decision:** Install `tailwindcss` + `@tailwindcss/vite`, make `globals.css` the
single entry point, delete the compiled `index.css`.

**Why:** A styling system where new classes silently fail is worse than no system,
because the failure mode is invisible and gets attributed to the component.

**Alternatives considered:**
- *Leave it and document the limitation* — rejected: it preserves a trap.
- *Migrate off Tailwind entirely* — rejected: ~700 utility classes in use across
  the components; the cost is enormous and buys nothing.

**Consequences:**
- New utility classes work. Design tokens in `globals.css` are now live.
- CSS grew 55KB → 116KB uncompressed (17KB → 18KB gzipped) because the build now
  emits Tailwind preflight and every class actually used.
- Verified by building and rendering the app; output matches the previous UI.

**Do not undo without understanding:** reintroducing a checked-in compiled
stylesheet restores a build where `globals.css` is decorative and new classes fail
silently.

---

## 2026-09-21 — Add `tw-animate-css`

**Status:** Active · **Decided by:** maintainer

**Context:** shadcn/ui primitives depend on `animate-in`, `animate-out`,
`fade-in-0`, `zoom-in-95`, accordion-up / accordion-down, and `caret-blink`. **None of those
were present in the old compiled CSS either.** Every Radix enter/exit animation in
the app had been silently dead since the Figma export.

**Decision:** Add `tw-animate-css` (the Tailwind v4 successor to
`tailwindcss-animate`) and import it from `globals.css`.

**Why:** These aren't new features — they are the intended behaviour of components
already in the tree. This restores them rather than adding them.

**Consequences:** Dialogs, dropdowns, sheets, and accordions now animate. If a
transition looks wrong somewhere, this is why it changed.

---

## 2026-09-21 — `apps/web/src/components/ui/` is excluded from Prettier

**Status:** Active · **Decided by:** maintainer

**Decision:** Add `apps/web/src/components/ui/` to `.prettierignore`.

**Why:** These 48 files are generated shadcn/ui primitives. Reformatting them
makes every future upstream diff unreadable, which raises the cost of the thing we
most want to stay cheap: regenerating them.

**Consequences:** They keep their upstream double-quote style while the rest of the
repo is single-quoted. That inconsistency is deliberate. ESLint still checks them.

**Do not undo without understanding:** "formatting the whole repo consistently"
sounds obviously right and is the exact instinct this entry exists to stop.

---

## 2026-09-21 — `supabase/` stays at the repository root

**Status:** Active · **Decided by:** maintainer

**Context:** The restructure moved `Frontend/` to `apps/web/` under an npm
workspace. The symmetrical move would have been an apps/api or packages/supabase directory.

**Decision:** Leave `supabase/` at the root.

**Why:** The Supabase CLI resolves `supabase/config.toml`, `migrations/`, and
`functions/` relative to the project root. Moving it means fighting the tool on
every command for cosmetic symmetry.

**Do not undo without understanding:** a future tidy-up that "finishes the
monorepo migration" will break `supabase db push` and every function deploy.

---

## 2026-09-21 — Telnyx skills and Agent-Brain are git submodules, not vendored copies

**Status:** Active · **Decided by:** maintainer

**Context:** `telnyx-ext-agent-skills` existed as a gitlink with **no
`.gitmodules` entry** — a broken half-submodule. Anyone cloning the repo got an
empty directory and no error.

**Decision:** Register both vendor directories — telnyx-agent-skills and
agent-brain — as proper submodules.

**Alternatives considered:**
- *Vendor the 269 files in* — rejected: +3.1MB and immediate upstream drift.
- *Delete it* — rejected: it is actively useful Telnyx reference.

**Consequences:** `git clone --recurse-submodules` is now required for the full
tree. The build does not depend on either, so a plain clone still works.

---

## Reconstructed from code — not from a written record

The following predate this install. The reasoning is **inferred from the
implementation** and was not confirmed with the original author. Recorded because
the constraints are real and easy to break; labeled because the *why* is
reconstructed.

### Redis alongside Postgres, for live call state

`claimHumanAnswer()` (`_shared/redis.ts:110`) is a Redis `SET NX` with a 300s TTL.
It is what guarantees that when several legs in a batch are answered by humans at
once, **exactly one** is bridged. Supabase Edge Functions are stateless and
concurrent, so the webhook handler has no in-process lock to use; Postgres could
express this but not at the per-webhook latency the dial loop needs.

**Do not undo without understanding:** removing Redis to "simplify to one
datastore" reintroduces a race in which two contacts are bridged to one agent, or
legs that should have been hung up keep ringing.

### `telnyx-webhook` is deployed `--no-verify-jwt`

Telnyx has no Supabase session and cannot present a JWT. The endpoint substitutes
signature verification against `TELNYX_WEBHOOK_SECRET`.

**Do not undo without understanding:** the signature check is the *only* thing
protecting the dial engine from the open internet. Removing it while leaving
`--no-verify-jwt` in place exposes the loop entirely.

### Navigation is `useState`, not a router

`MainApp.tsx` switches screens on a `TabType` union. There is no `react-router`.

Consequence, stated because it is regularly rediscovered: **there are no URLs for
app state.** No deep links, no browser back, no refresh-in-place. Adding a router
later is a real migration, not a drop-in.

### The client/server contract is hand-written

`apps/web/src/lib/api.ts` (698 lines) declares every request and response type by
hand. No generated client, no shared types package.

**Consequence:** changing an Edge Function's response shape produces **no
TypeScript error** — only a runtime failure. Treat every function signature change
as a two-sided change.
