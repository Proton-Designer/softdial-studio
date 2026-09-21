---
id: mem.lessons
title: Lessons
layer: L2
type: memory
status: canonical
owner: maintainer
updated: 2026-09-21
related:
  - mem.known-issues
  - mem.decisions
answers:
  - "what have we learned the hard way"
  - "what mistakes should I avoid here"
  - "what is surprising about this codebase"
  - "what did previous work get wrong"
covers: "Non-obvious things learned from working in this repository"
excludes: "Current defects (see mem.known-issues), the reasoning behind choices (see mem.decisions)"
tokens_est: 1164
---

# Lessons

Things that cost someone time, written down so they cost the next person none.

---

## A UI can look finished and be a mock

`Analytics.tsx` renders polished charts from invented data, including five
fictional agent names. It sits in the main navigation next to `Dashboard.tsx`,
which is genuinely wired to the backend. **Visual completeness is not evidence of
a live data path** in this codebase.

**Apply it:** before trusting or debugging a screen's data, check whether the
component imports from `@/lib/api`. That one grep answers the question in seconds.

---

## Compiled artifacts can masquerade as source

The original export shipped a src/index.css — a 2,549-line file that *looked* like
a stylesheet and was actually Tailwind's compiled output, with no toolchain behind
it. It sat next to the real token file, `apps/web/src/styles/globals.css`, which
nothing imported. New utility classes silently did nothing.

**Apply it:** when a CSS file is thousands of lines and starts with a version
banner (`/*! tailwindcss v4.1.3 ... */`), it is build output. Find out what is
supposed to generate it before editing it.

---

## Check the whole path before believing "already broken"

The missing animation utilities (`animate-in`, `accordion-down`) looked like a
regression introduced by the Tailwind restoration. Comparing against the *old*
compiled CSS showed they had never been there — the animations had been dead since
the export.

**Apply it:** when something appears broken after a change, diff against the
actual prior artifact rather than against your assumption of what it contained.
The answer changes the fix from "revert" to "this was never wired up".

---

## A gitlink without `.gitmodules` fails silently

`telnyx-ext-agent-skills` was recorded in the index as a submodule gitlink with no
corresponding `.gitmodules` entry. `git status` reported a clean tree. Clones got
an empty directory and **no warning**.

**Apply it:** `git ls-files -s | grep ^160000` lists every gitlink. Each one
should have a matching `.gitmodules` entry. Mismatch means broken clones.

---

## `verify_jwt = false` does not mean unauthenticated

Five functions set `verify_jwt = false` in `supabase/config.toml`. Four of them
still verify the caller's token in-process via `supabase/functions/_shared/auth.ts`. Only
`telnyx-webhook` is genuinely open, and it checks a Telnyx signature instead.

**Apply it:** never infer an endpoint's auth posture from `config.toml` alone.
Read the function. Both layers are real and they are configured independently.

---

## Verification beat inference, twice, during this install

Two claims written into these documents were wrong on the first pass and caught
only by going to the code:

1. A backlog item said "grey out already-mapped import fields" was outstanding. It
   is implemented (`ImportContactsModal.tsx:374-386`).
2. A CSS coverage comparison reported 42 "missing" classes after the Tailwind
   restoration. They were variant-prefixed (`lg:grid-cols-4`) and present; the
   comparison script was wrong, not the build.

**Apply it:** in this repository, a plausible-sounding claim about current
behaviour is worth about as much as a coin flip. Spend the thirty seconds.

---

## The dial loop has no owner process

It is easy to read `dialer-session-start` and assume something continues running
after it returns. Nothing does. Every subsequent advance is driven by an inbound
Telnyx webhook.

**Apply it:** when reasoning about "what happens next" in a dial session, the
answer is always "the next webhook arrives, or nothing happens". Timeout handling
is swept on the next event, not on a schedule.
