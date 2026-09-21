---
id: domain.analytics
title: Analytics & Notifications
layer: L2
type: domain
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/dashboard-stats/index.ts
  - supabase/functions/team-performance/index.ts
  - supabase/functions/ensure-week-summary/index.ts
  - supabase/migrations/20250213000001_create_call_events_and_notifications.sql
  - apps/web/src/components/Dashboard.tsx
  - apps/web/src/components/Analytics.tsx
  - apps/web/src/components/TopNavigation.tsx
related:
  - domain.dialer
  - domain.auth
  - arch.system-overview
answers:
  - "is the Analytics screen real data or a mock"
  - "where do the Dashboard's Calls Today / Connect Rate / Talk Time numbers come from"
  - "what writes rows into call_events, and why are my dashboard metrics always zero"
  - "how is the weekly summary notification created and when"
  - "how are in-app notifications listed, counted and marked read"
  - "where is the dashboard chart date range stored"
  - "what is the difference between call_logs and call_events"
covers: "The Dashboard metrics and team-performance chart, the call_events aggregation functions behind them, the Analytics screen's status, the weekly-summary job, and the in-app notification bell."
excludes: "The dial loop, AMD, and the call_logs state machine that actually records calls — see .brain/domains/dialer.md. Telnyx wiring — see .brain/domains/telephony.md."
tokens_est: 2746
source_hash: 35e4e91694a8ec04948d80af7c5c352af8ec5a3c0768a46f30e1ae653d4fd7ea
---

# Analytics & Notifications

## Purpose

Softdial exists to raise live conversations per agent hour, so the agent needs to see that number. This domain is the reporting surface: the Dashboard's headline metrics and trend chart, and
the notification bell that delivers a weekly recap. Most of that surface is not yet connected to real call data — read "Constraints & gotchas" before trusting anything here.

## Key concepts

| Term | Means |
|---|---|
| `call_events` | The analytics table. One row per call session, with `outcome` and `duration_seconds`. **Every analytics query reads it; nothing in this repo writes it.** |
| `call_logs` | The *operational* table the dial loop actually writes (`supabase/functions/_shared/dialer-engine.ts:195`). Different table, not read by any analytics function. |
| Connect rate | `answered / total outbound`, as a percentage to one decimal (`supabase/functions/dashboard-stats/index.ts:36`). |
| Talk time | Sum of `duration_seconds` over `outcome = 'answered'` rows only (`supabase/functions/dashboard-stats/index.ts:37-42`). |
| Week summary | A `notifications` row of `type = 'week_summary'` whose `body` is a JSON string, not prose (`supabase/functions/ensure-week-summary/index.ts:82-96`). |

## Where the code lives

| What | Path | Notes |
|---|---|---|
| **Real** dashboard UI | `apps/web/src/components/Dashboard.tsx` | Fetches at `:64` and `:74` |
| **Mock** analytics UI | `apps/web/src/components/Analytics.tsx` | Hardcoded constants at `:17-38` |
| Today's metrics | `supabase/functions/dashboard-stats/index.ts` | Single-user, UTC day |
| Trend chart | `supabase/functions/team-performance/index.ts` | Day buckets, 7d/30d/custom |
| Weekly recap job | `supabase/functions/ensure-week-summary/index.ts` | Fridays only |
| Client contract | `apps/web/src/lib/api.ts:68-189` | Stats, chart, prefs, notifications |
| Notification bell | `apps/web/src/components/TopNavigation.tsx:70-109` | Fetch, count, mark read |
| Schema + RLS | `supabase/migrations/20250213000001_create_call_events_and_notifications.sql` | Three tables |
| Screen routing | `apps/web/src/components/MainApp.tsx:71` | Renders the mock Analytics tab |

## How it works

1. **Dashboard mounts** — `getDashboardStats()` (`apps/web/src/components/Dashboard.tsx:74`) hits `dashboard-stats`, which selects today's outbound `call_events` for `user.id` and derives
   calls, connect rate and talk time (`supabase/functions/dashboard-stats/index.ts:25-46`).
2. **Range is restored** — `getUserPreferences()` reads `user_preferences` directly over PostgREST (`apps/web/src/lib/api.ts:115-122`); changing the range upserts it back (`:124-136`).
3. **Chart loads** — `getTeamPerformanceChart()` (`apps/web/src/components/Dashboard.tsx:64`) calls `team-performance`, which pre-seeds one bucket per day in the range then counts rows into
   it (`supabase/functions/team-performance/index.ts:61-85`), so gaps render as zeros rather than disappearing.
4. **Bell mounts** — `TopNavigation` fires `ensureWeekSummary()` once (`apps/web/src/components/TopNavigation.tsx:70`) and `getUnreadNotificationCount()` (`:74`); opening the panel calls
   `listNotifications()` (`:81`).
5. **Week summary** — `ensure-week-summary` returns early unless today is Friday (`supabase/functions/ensure-week-summary/index.ts:29`), dedupes, aggregates last Mon–Sun, and inserts a
   `notifications` row with a JSON `body` (`:82-96`).
6. **Read state** — clicking an item stamps `read_at` (`apps/web/src/lib/api.ts:166-172`); "Mark all read" stamps every null (`:174-180`). The badge is a client-side decrement
   (`apps/web/src/components/TopNavigation.tsx:96`).

## Integration points

| Direction | With | Via |
|---|---|---|
| Depends on | `domain.auth` | `getUserFromRequest()` in all three Edge Functions; RLS `auth.uid()` for direct table reads |
| Depends on | `domain.dialer` | *Intended* producer of `call_events` — see gotchas; currently no link exists |
| Depends on | Supabase Postgres | `call_events`, `notifications`, `user_preferences` |
| Depended on by | `apps/web/src/components/Dashboard.tsx`, `apps/web/src/components/TopNavigation.tsx` | `apps/web/src/lib/api.ts` |

## Constraints & gotchas

- **The Analytics screen is a design mock. It is not wired to anything.** `apps/web/src/components/Analytics.tsx` imports nothing from `apps/web/src/lib/api.ts` — only Recharts, Lucide and
  Motion. Every chart renders module-level constants at `apps/web/src/components/Analytics.tsx:17-38` — `callVolumeData`, `performanceData`, and `agentData`, which lists five invented people
  (Sarah Chen, James Wilson, Alex Kumar, Maria Garcia, Tom Anderson) — and the metric tiles are hardcoded strings. It is still routed into the nav at
  `apps/web/src/components/MainApp.tsx:71`, so it looks live. **`apps/web/src/components/Dashboard.tsx` is the real one**, the only screen calling the analytics API. Do not "fix a bug" seen
  on Analytics; there is no data path to fix.
- **Nothing writes `call_events`.** It is referenced in exactly four places: the migration, and a `SELECT` in each of the three Edge Functions. The dial loop writes `call_logs` instead
  (`supabase/functions/_shared/dialer-engine.ts:195`, `supabase/functions/telnyx-webhook/index.ts:232`). So the Dashboard's real wiring aggregates an empty table — zero calls, 0%, "0m" is
  expected behaviour, not a bug.
- **`team-performance` is real code over that same empty table** — genuine, correct aggregation that returns real data the moment `call_events` is populated. Despite the name it is **not**
  team-wide: it filters `user_id = user.id` (`supabase/functions/team-performance/index.ts:56`). No multi-agent rollup exists.
- **"Revenue Pipeline" is a literal placeholder** — the fourth Dashboard tile is the string `'Coming soon'` (`apps/web/src/components/Dashboard.tsx:163`).
- **`ensure-week-summary` only works on a Friday** (`:29`), and only if the user opens the app that day — it fires from a component mount (`apps/web/src/components/TopNavigation.tsx:70`),
  not cron. Miss that Friday and the summary is never written; nothing backfills.
- **Its dedupe is a `LIKE` over the body text** (`supabase/functions/ensure-week-summary/index.ts:44-51`) — `%<week_start>%` against the JSON blob, not a unique constraint. Two concurrent
  tab loads on a Friday can both miss and insert twice.
- **A week-summary `body` is JSON, not display text** — `TopNavigation` parses it, falling back to raw text on a throw (`apps/web/src/components/TopNavigation.tsx:215-232`). Change the
  producer's shape and the bell silently renders a JSON blob.
- **All three functions set `verify_jwt = false`** (`supabase/config.toml:371-378`), relying solely on their own `getUserFromRequest()` for identity, then use the service-role key, which
  bypasses RLS — the token's `user_id` is the only tenant boundary.
- **`notifications` has no INSERT policy at all** (migration `:61-62`) — only SELECT and UPDATE. Clients cannot create notifications; only a service-role function can. The UPDATE policy also
  has no `WITH CHECK` (migration `:57-59`), and `markAllNotificationsRead()` issues an unfiltered `UPDATE ... IS NULL` (`apps/web/src/lib/api.ts:174-180`) — scoping rests entirely on the
  USING clause.
- **Everything is UTC-bucketed** (`supabase/functions/dashboard-stats/index.ts:18-21`, `supabase/functions/team-performance/index.ts:64,70`) — a UTC-8 agent's evening calls land on
  tomorrow's bucket.
- **`call_events.user_id` is `ON DELETE SET NULL`** (migration `:4`) — deleting a user orphans their rows rather than removing them, and they vanish from every query.

## Not covered here

- Dial loop, AMD, batching, and the `call_logs` table → `.brain/domains/dialer.md`
- Telnyx webhook ingress and signature handling → `.brain/domains/telephony.md`
- Auth, `getUserFromRequest()`, and RLS conventions → `.brain/domains/auth.md`

## Unverified

- That `call_events` was *intended* to be written by the Telnyx webhook is inferred from the migration's comments (`:1`, `:24`, `:29`) and the unique index on `telnyx_call_session_id`
  (`:18`). No such writer exists in this repo, and no record in `.brain/memory/` was consulted to confirm the intent.
- Whether a deployed environment holds `call_events` rows from an out-of-repo source (manual SQL, a prior branch) was not checked — only this repository was.
