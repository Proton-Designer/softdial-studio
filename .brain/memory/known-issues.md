---
id: mem.known-issues
title: Known Issues
layer: L2
type: memory
status: canonical
owner: maintainer
updated: 2026-09-21
related:
  - mem.active-work
  - mem.decisions
  - domain.analytics
answers:
  - "what is broken"
  - "what are the known issues"
  - "why is this behaving strangely"
  - "is the analytics screen real"
  - "what should I not trust"
covers: "Known defects, traps, and behaviour that looks intentional but is not"
excludes: "Planned work (see mem.active-work), deliberate design choices (see mem.decisions)"
tokens_est: 2494
---

# Known Issues

Ordered by how likely each is to waste someone's time, except #0 — ordered by consequence.

---

## 0. The Telnyx webhook signature check fails open — the dial loop is effectively unauthenticated

**Severity: critical — security. Verified in code 2026-09-21.**

`telnyx-webhook` is the only endpoint reachable without a Supabase session (deployed `--no-verify-jwt`, because Telnyx has none), so
`verifySignature()` is the *only* thing protecting the dial engine from the open internet. It returns `true` without verifying
anything on **two** paths (`supabase/functions/telnyx-webhook/index.ts:32-46`):

```ts
const secret = Deno.env.get('TELNYX_WEBHOOK_SECRET');
if (!secret) return true;                        // (1) no secret → accept everything
...
if (!signature && ed25519Signature) {
  console.warn('[telnyx-webhook] ed25519 signature received; skipping HMAC validation');
  return true;                                   // (2) accept ANY ed25519 header, unchecked
}
```

**Path (2) is the dangerous one.** Telnyx Standard Webhooks sign with **ed25519**, not the shared-secret HMAC implemented here — so
path (2) is plausibly the path production traffic takes. Any caller sending a `telnyx-timestamp` header and a
`telnyx-signature-ed25519` header **of any value** is accepted; the value is never checked. A forged request can drive the dial
engine directly: inject call events, disposition contacts, stall batches, hang up live calls. There is also **no replay window** —
the timestamp must be present (`:38`) but is never compared to now.

**The fix** is to verify the ed25519 signature against Telnyx's public key (in the portal) and reject rather than warn, making
`TELNYX_WEBHOOK_SECRET` a hard requirement that fails closed.

**Do not** just delete the fail-open branches — without ed25519 verification in place that rejects all real Telnyx traffic and takes
the dialer down.

Reported during the Agent-Brain install; **not fixed** — the fix needs the account's public key and live-traffic verification the
install could not do.

---

## 1. The Analytics screen is entirely fake data

**Severity: high — actively misleading.**

`apps/web/src/components/Analytics.tsx` imports **nothing** from `@/lib/api`. Every chart on it renders module-level constants
hardcoded at `Analytics.tsx:17-38`:

`callVolumeData` (invented weekday call counts), `performanceData` (an invented disposition split), and `agentData` — **five
invented people** ("Sarah Chen", "James Wilson", "Alex Kumar", "Maria Garcia", "Tom Anderson").

The numbers never change, never load, and bear no relation to the account viewing them. It is a design mock wired into the
navigation. **Do not** debug why analytics "aren't updating", and do not cite any figure from it. Verified 2026-09-21.

**`Dashboard.tsx` is real** — it calls `getDashboardStats()` and `getTeamPerformanceChart()` (`:64,74`). The two screens look
equally finished and are not.

---

## 1b. Dial-session bookkeeping bugs (verified in code)

**Severity: high.** Found during domain extraction, confirmed against the schema and the functions. Not fixed.

- **`dialer-session-active` can never find an active session.** `supabase/functions/dialer-session-active/index.ts:28` orders by
  `created_at`, but `dialer_sessions` has **no such column** — the schema defines `started_at`
  (`supabase/migrations/20260207000100_create_dialer_sessions_and_call_logs.sql`). The Postgres error is swallowed, so the endpoint
  reports "no active session" unconditionally. This is the guard meant to stop a second concurrent session.

- **Three of the four session counters are never written.** `dialer_sessions` declares `calls_made`, `calls_connected`,
  `calls_voicemail`, and `calls_no_answer`. Only `calls_made` is ever incremented (`_shared/dialer-engine.ts:234`). The other three
  are *read* by `dialer-session-stop` (`index.ts:70`) to build the end-of-session summary, so **every session summary reports zero
  connects, zero voicemails, zero no-answers.** The live UI numbers come from Realtime broadcasts and reset to the stored zeros on
  reload.

Recorded rather than fixed: fixing them changes dial-loop behaviour and needs the manual validation checklist, which requires live
Telnyx credentials.

**The human-answer lock outlives its batch — verified in source.** `claimHumanAnswer` sets
`session:{id}:humanClaimed` with `SET NX EX 300` (`supabase/functions/_shared/redis.ts:110`), but the key is **per
session, not per batch**, and is only deleted by `clearSessionState` on stop (`:119-124`). After batch 0's winner is
bridged, **every later batch's human answer fails the claim and is hung up** (`dialer-engine.ts:331-340`) until the
300s TTL lapses. Independently confirmed against source during the cold-agent verification pass.

Further findings from the same extraction — unguarded read-modify-write on batch state, losing legs never reaching
`no_answer`, batch advance skipping contacts — are in `.brain/domains/dialer.md` under *Constraints & gotchas*.
**Specific and plausible, but not independently confirmed.** Treat as leads, not facts.

---

## 2. Client/server contract is unenforced

**Severity: high — silent runtime failure.** `apps/web/src/lib/api.ts` hand-declares every Edge Function request and response type.
There is no generated client and no shared types package, so **changing a function's response shape produces no TypeScript error** —
only a runtime failure, usually surfacing as `undefined` deep in a component. Update both sides in the same commit.

---

## 3. No automated tests, and no CI

**Severity: high.** Zero tests. `npm run check` and `npm run build` pass, but nothing runs them automatically. The only verification
procedure is `docs/validation/parallel-dialer-checklist.md`, which needs live Telnyx credentials and a real phone call. Every
dial-loop change is validated by hand or not at all.

---

## 4. Two independent feature flags gate the dialer

**Severity: medium — confusing to diagnose.**

`VITE_PARALLEL_DIALER_ENABLED` (client) hides the UI; `PARALLEL_DIALER_ENABLED` (server) makes `dialer-session-start` reject
requests. Unrelated variables in different environments — **both must be on.** Setting only one gives a visible Start button that
fails on click.

Defaults are asymmetric: the client flag is opt-*out* (anything but the string `"false"` enables it, `api.ts:9-12`); the server flag
must be explicitly `true`. The server flag also gates **only** `dialer-session-start` — webhook, pause, stop, and hangup stay live,
so in-flight sessions keep running after it is turned off.

---

## 5. The dial loop only advances when a webhook arrives

**Severity: medium — by design, but surprising.**

No cron, no worker, no timer. If Telnyx never sends a terminal event for a leg, that batch does not advance.
`resolveStaleBatchIfTimedOut()` (`_shared/dialer-engine.ts:744`) mitigates this but is swept on the **next inbound event**, not on a
schedule. A session whose events stop entirely stays wedged.

Related: webhooks are at-least-once. Every handler must tolerate the same event arriving twice, late, or out of order — and the only
dedupe today is the `call_logs` upsert on `call_control_id`.

---

## 6. Smaller items

- **`CampaignManageModal.tsx` is 1,050 lines** — ~3× the next largest component. Campaign editing, lead listing, lead add/remove,
  and session launch in one file. Not broken; just expensive to change safely.
- **`.cursor/skills/` duplicates the Telnyx submodule.** 12 skill docs (~26k tokens) that appear to be a JavaScript subset of the
  telnyx-agent-skills submodule. Whether the copies were edited after copying was **not determined**.
- **Lint warnings are not errors.** `npm run lint` passes with 0 errors and 13 warnings: 11 react-refresh/only-export-components
  (mostly in the generated UI primitives) and 2 react-hooks/exhaustive-deps in `useDialerSession.ts` flagging an unnecessary
  `state.session` dependency. The hooks ones are in the live dial-session state machine and are worth a look.
- **`ContactQueue.tsx` appears dead** — nothing imports it. Not confirmed.

---

## Not issues — deliberate, documented elsewhere

- Redis alongside Postgres → `mem.decisions`
- `telnyx-webhook` unauthenticated at the gateway → `mem.decisions`, `domain.auth`
- the generated UI primitives left unformatted → `mem.decisions`
- No router / no URLs for app state → `mem.decisions`
