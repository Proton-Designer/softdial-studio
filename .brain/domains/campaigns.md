---
id: domain.campaigns
title: Campaigns
layer: L2
type: domain
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - apps/web/src/components/Campaigns.tsx
  - apps/web/src/components/campaigns/**
  - apps/web/src/lib/api.ts
  - supabase/migrations/20250207100000_create_campaigns_and_leads.sql
  - supabase/functions/dialer-session-start/index.ts
related:
  - domain.contacts
  - domain.dialer
  - arch.system-overview
answers:
  - "what are the legal campaign status values and who changes them"
  - "is CampaignWithStats a live query or a cached column"
  - "why do queued / completed / passthrough counts never move"
  - "what does dialer-session-start actually receive from a campaign"
  - "why does Start Parallel Dial fail with 'No dialable contacts in campaign'"
  - "how are campaigns and campaign_leads scoped per user"
covers: "The campaigns and campaign_leads tables, the campaigns_with_stats view, the campaign CRUD surface in the web client, and the handoff from a campaign to a parallel dial session."
excludes: "Contact records and CSV import mechanics (.brain/domains/contacts.md) and everything after the session row is inserted — batching, AMD, call_logs (.brain/domains/dialer.md)."
tokens_est: 2585
source_hash: 6b60bc657d3aec935eac9e4bb25818e47c437a57b9fe5388102d507f41ba04c8
---

# Campaigns

## Purpose

A campaign is a named, user-owned bucket of contacts to call — the unit an agent picks before dialing. Everything else in the
product (the contact list, the dialer, the dashboard) is either feeding a campaign or draining one.

## Key concepts

| Term | Means |
|---|---|
| Campaign | A row in `campaigns`. Owns a name, a status, and three display-only stat columns. |
| Lead | A row in `campaign_leads` — the join between one campaign and one contact, with its own `status`. Not a separate entity; the person's data lives on `contacts`. |
| Dialable | A lead whose contact's `call_status` is *not* `contacted` or `do_not_call`, and which has a phone number. This is a property of the **contact**, not of the lead. |
| `campaigns_with_stats` | A Postgres view, not a table — lead counts are computed per read, never cached. |
| Passthrough | A `campaign_leads.status` value present in the CHECK constraint and the UI, never written by any code. |

## Where the code lives

| What | Path | Notes |
|---|---|---|
| Schema + view + RLS | `supabase/migrations/20250207100000_create_campaigns_and_leads.sql` | Both tables, all 8 policies, `campaigns_with_stats` |
| Client data layer | `apps/web/src/lib/api.ts` | Campaigns section, `:354-496`; `startDialerSession` `:564-668` |
| Campaign list screen | `apps/web/src/components/Campaigns.tsx` | Grid, search, status filter, create-campaign dialog |
| Campaign detail | `apps/web/src/components/campaigns/CampaignManageModal.tsx` | 1,049 lines — see gotchas |
| Session handoff | `supabase/functions/dialer-session-start/index.ts` | Consumes `campaignId`; `:171-207` |
| Lead fetch for dialing | `supabase/functions/_shared/dialer-engine.ts` | `fetchDialableContacts()` `:93-118` |
| Import-time lead creation | `supabase/functions/contacts-import/index.ts` | `:144-162`, CSV rows land as `queued` leads |

## How it works

1. **Create** — `createCampaign(name)` inserts `status: 'active'` with the client's own `auth.uid()`
   (`apps/web/src/lib/api.ts:392-409`), then `Campaigns.tsx:63-67` immediately opens the manage modal for it.
2. **List** — `listCampaigns()` selects `*` from the view (`apps/web/src/lib/api.ts:383-390`). Search and the status filter are
   **client-side** over the full result (`apps/web/src/components/Campaigns.tsx:48-52`).
3. **Attach contacts** — `addLeadsToCampaign()` (upsert with `ignoreDuplicates`, `apps/web/src/lib/api.ts:466-474`) from the
   add-existing picker and the add-new-contact flow, or `contacts-import` during CSV upload.
4. **Read the detail** — the modal runs `getCampaign()` (view) plus `listCampaignLeads()`, which fetches leads, then a second
   `contacts` query by id, and stitches them in JS (`apps/web/src/lib/api.ts:432-464`).
5. **Hand off** — `handleConfirmStartParallelDialing` (`apps/web/src/components/campaigns/CampaignManageModal.tsx:164-223`) POSTs `{
   campaignId, linesCount, fromNumber, agentCallControlId?, agentCallbackNumber? }`. The campaign contributes **only its id**.
6. **Session start** — `dialer-session-start` verifies the from-number is the user's, rejects a second `active` session for the same
   campaign with `409 ACTIVE_SESSION_EXISTS` (`:112-139`), resolves dialable contacts, inserts a `dialer_sessions` row carrying
   `campaign_id`, and fires the first batch.

## Integration points

| Direction | With | Via |
|---|---|---|
| Depends on | `domain.contacts` | `campaign_leads.contact_id` → `contacts.id`; dialability is read off `contacts.call_status` |
| Depends on | `domain.auth` | `auth.uid()` RLS on both tables; `getUserFromRequest()` in the Edge Function |
| Depended on by | `domain.dialer` | `dialer_sessions.campaign_id`; `fetchDialableContacts()` re-reads `campaign_leads` on every batch |
| Depended on by | `domain.telephony` | Caller-ID choice comes from `usePhoneNumbers()` inside the start-dial modal |

## Constraints & gotchas

- **`campaign_leads.status` is write-once dead weight.** Nothing in the repo ever updates it — the only writes are inserts
  defaulting to `queued` (`apps/web/src/lib/api.ts:468`, `supabase/functions/contacts-import/index.ts:152-156`). So in
  `campaigns_with_stats`, `queued` always equals `total_contacts` and `completed` / `passthrough` are always `0`, yet
  `apps/web/src/components/Campaigns.tsx:174-188` renders all three as if they moved. Call progress lives on `contacts.call_status`
  and `call_logs`, not here.
- **`campaigns.total_calls_made`, `connect_rate` and `last_called_at` are never written either** — the dialer's `last_called_at`
  updates target `contacts` (`supabase/functions/_shared/dialer-engine.ts:212,313,458,722`), so the card at
  `apps/web/src/components/Campaigns.tsx:196-209` always shows `0.0%`, `0`, `—`.
- **Status is cosmetic.** `active | paused | completed` (CHECK at migration `:6`), set only from the modal's Select
  (`CampaignManageModal.tsx:434-466` → `updateCampaignStatus`, `apps/web/src/lib/api.ts:421-430`). **Any value may move to any
  other** — no transition rules exist — and `dialer-session-start` never reads `campaigns` at all, so a `paused` campaign dials like
  an active one.
- **`dialer-session-start` never checks campaign ownership.** It takes `campaignId` on trust (`:62,74-77`) and uses the service-role
  key (`:87-90`), bypassing RLS. The accidental guard is `fetchDialableContacts` filtering `contact.user_id`
  (`supabase/functions/_shared/dialer-engine.ts:104`) — another user's campaign yields a `400`, not a `403`.
- **`total_contacts > 0` does not mean dialable.** The view counts every lead (migration `:86`); `fetchDialableContacts` excludes
  contacts already `contacted` or `do_not_call` (`supabase/functions/_shared/dialer-engine.ts:105`). A fully worked campaign still
  shows the Start button (`apps/web/src/components/Campaigns.tsx:211`), then fails `400 "No dialable contacts in campaign."`
- **`CampaignManageModal.tsx` is doing six jobs in one file** and is the first thing to split. The seams are already visible:
  campaign header + status (`:401-476`), lead table with filter/paginate/multi-select (`:478-696`), import and add-contact wrappers
  (`:698-724`), the start-dial configuration modal (`:725-845`), the active-session conflict resolver (`:846-894`), and two confirm
  dialogs (`:895-967`) — plus `AddExistingContactsModal`, a whole second component already living in the same file at `:969`.
- **Pagination and selection are not reset.** `leadsPage` is only changed by the prev/next buttons
  (`CampaignManageModal.tsx:674,682`) — changing a filter (`:523,542`) or opening a different campaign leaves the index where it
  was, so the table can render empty. `selectedLeadIds` survives `onClose` too, so a bulk remove can target ids picked in a
  previously viewed campaign.
- **Lead filters read contact fields, not lead fields**: `categoryFilter` and `contactStatusFilter` match `lead.contact.category` /
  `contact_status` (`CampaignManageModal.tsx:124-130`) — CRM labels, unrelated to `campaign_leads.status`.
- **There is no delete-campaign path.** The RLS DELETE policy exists (migration `:31-33`) but no API function and no UI call it.
  Campaigns accumulate.
- **`UNIQUE(campaign_id, contact_id)`** (migration `:42`) is what makes the add path idempotent; both FKs are `ON DELETE CASCADE`,
  so deleting a contact silently shrinks every campaign it was in.
- **RLS:** `campaigns` is `auth.uid() = user_id` on all four verbs (migration `:19-33`); `campaign_leads` is an `IN (SELECT … FROM
  campaigns …)` subquery (`:50-72`); the view is `security_invoker = on` (`:95`) so it inherits them. Service-role callers — the
  Edge Functions — bypass all of it.

## Not covered here

- Contacts, CSV import, `call_status` semantics → `.brain/domains/contacts.md`
- Batching, AMD, `call_logs`, session stop/advance → `.brain/domains/dialer.md`
- Caller-ID numbers, the WebRTC agent leg → `.brain/domains/telephony.md`; auth and Edge Function token verification →
  `.brain/domains/auth.md`
