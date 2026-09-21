---
id: domain.contacts
title: Contacts
layer: L2
type: domain
status: canonical
owner: maintainer
updated: 2026-09-21
sources:
  - supabase/functions/contacts-parse-csv/index.ts
  - supabase/functions/contacts-import/index.ts
  - apps/web/src/components/Contacts.tsx
  - apps/web/src/components/contacts/*.tsx
  - apps/web/src/lib/api.ts
  - supabase/migrations/*.sql
related:
  - domain.campaigns
  - domain.auth
  - arch.system-overview
answers:
  - "what are the canonical contact fields and which one is required"
  - "why are CSV parse and import two separate requests"
  - "what exactly counts as a duplicate on import"
  - "what are the allowed values of category and contact_status"
  - "why does the 'Contacted' filter never match anything"
  - "what happens when part of an import fails"
covers: "The contacts table, two-step CSV import, phone normalisation and de-duplication, the category/contact_status labels, and single-contact create/delete."
excludes: "Per-call state (call_status, call_count, last_called_at) written by the dial loop — see domain.dialer. Campaign membership — see domain.campaigns."
tokens_est: 2237
source_hash: 2a02f613ff8c396def494d99b79a2080ede709ae1f6bc30266d1ea0dcd5b861f
---

# Contacts

## Purpose

Contacts are the call list. Everything the dialer consumes starts as a row in `public.contacts`, arriving via a CSV upload with interactive column mapping or a single
"Add contact" form. A contact without a usable phone number is worthless here, and the import path enforces that.

## Key concepts

| Term | Means |
|---|---|
| Canonical field | One of 13 human-readable labels. The CSV UI speaks labels, the DB speaks snake_case; **three separate maps** translate between them. |
| Column mapping | `{ original_header, mapped_field, status }` per CSV column — a label, `'Skip this column'`, or `null`. |
| `category` vs `contact_status` | Two **separate** labels: a pipeline bucket chosen per import, and a contacted flag. Neither is the dialer's `call_status`. |
| Duplicate | A row whose digits-only phone already exists for this `user_id` — in the table, or earlier in the same CSV. |

## Where the code lives

| What | Path | Notes |
|---|---|---|
| Table + RLS | `supabase/migrations/20250214000001_create_contacts_table.sql` | 4 policies, all `auth.uid() = user_id` |
| Added columns | `supabase/migrations/20250207000001_add_contacts_category_status_address.sql` | sorts **before** the CREATE — see gotchas |
| CSV parse + auto-map | `supabase/functions/contacts-parse-csv/index.ts` | `CANONICAL_FIELDS :5`, `ALIASES :21`, scoring `:80-188` |
| CSV import | `supabase/functions/contacts-import/index.ts` | `CANONICAL_TO_DB :6`, `normalizePhone :22`, dedupe `:76-125` |
| Client contract | `apps/web/src/lib/api.ts` | `CONTACT_CANONICAL_FIELDS :192`, `Contact :208`, `createContact :303` |
| List / filter UI | `apps/web/src/components/Contacts.tsx` | `CATEGORIES :29`, 50/page `:31` |
| Import wizard | `apps/web/src/components/contacts/ImportContactsModal.tsx` | `FIELD_OPTIONS :22` |
| Add / detail modals | `apps/web/src/components/contacts/` | `AddContactModal.tsx` `toDbKey :74`; `ContactDetailModal.tsx` read-only |

## The canonical field set

13 labels: `Business Name`, `Business Link`, `Business Type`, `Rating`, `Review Count`, `Open Hours`, `Phone Number`, `Website`, `Notes`, `First Name`, `Last Name`,
`Owner Contact`, `Address` — declared identically in three places (`contacts-parse-csv/index.ts:5`, `contacts-import/index.ts:6`, `api.ts:192`), shared nowhere.

**Every column is nullable** — no DB-level required field. The *import* path makes `Phone Number` effectively required (a null normalised phone is `skipped`,
`contacts-import/index.ts:114-117`); `createContact` does not, requiring only that *some* field is non-empty (`AddContactModal.tsx:55-58`).

## How it works

1. **Parse** — the browser reads the file as text (`ImportContactsModal.tsx:85-99`) and POSTs `{ csv_text }` to `contacts-parse-csv`, which scores every (column, field)
   pair and returns a *proposed* mapping (`index.ts:157-188`).
2. **Review** — the user corrects the mapping and picks one `category`. Import stays disabled until every column has a value ("Skip" counts).
3. **Import** — the browser POSTs the **original `csv_text` again** with the final mappings to `contacts-import`, which re-parses, normalises phones, de-duplicates, and
   does one bulk `insert().select('id')` (`index.ts:128-142`). If a `campaign_id` was given *and* the caller owns it, the new ids are upserted into `campaign_leads` as
   `queued` (`:144-162`). Returns `{ imported, skipped, duplicates }`.

**Why two round-trips:** parse is a pure proposal the human then edits; the server keeps no state between calls, so the client re-sends the full CSV text. Nothing is
written until step 3. Full detail: `docs/guides/csv-import.md`.

## De-duplication

The key is **digits-only phone, scoped to the importing user**. Because the lookup Set
grows as rows are processed, it also catches duplicates **within the same CSV**. Nothing
else participates, and duplicates are silently dropped, never merged.

Mechanics, `normalizePhone` rules, and line references:
[`docs/guides/csv-import.md`](/docs/guides/csv-import.md).

## Enums

`category` has 5 allowed values and `contact_status` 2. **Neither has a DB CHECK**, and
**nothing ever writes `'Contacted'`** — see gotchas. Full value lists and where each is
enforced: [`docs/guides/csv-import.md`](/docs/guides/csv-import.md).

## Integration points & RLS

Depends on `domain.auth`; depended on by `domain.campaigns` (via the `campaign_leads.contact_id` FK) and `domain.dialer` (which writes `call_status`, `last_called_at`,
`call_count`). The table has SELECT/INSERT/UPDATE/DELETE policies, each `auth.uid() = user_id`. **The two Edge Functions use the service-role key and bypass RLS
entirely** (`contacts-import/index.ts:72-74`) — their only tenancy guarantee is setting and filtering `user_id` from the verified JWT by hand.

## Constraints & gotchas

- **Migration filenames are out of order.** `20250207000001` (ALTER contacts) and `20250207100000` (FK to contacts) both sort *before* `20250214000001`, the `CREATE
  TABLE`, which has no `IF NOT EXISTS`. **A fresh `npm run db:push` against an empty database fails.** Do not "fix" it by editing applied migrations.
- **The `Contacted` filter is dead.** Nothing writes `contact_status = 'Contacted'`; the dialer writes `call_status`, a different column
  (`supabase/functions/_shared/dialer-engine.ts:209`). It always yields zero rows.
- **`Contact` in `api.ts:208-228` is missing `call_status`, `last_called_at`, and `call_count`** (added by the dialer). The type is hand-written; nothing catches it.
- **Import is one bulk insert — all-or-nothing on DB error** (`contacts-import/index.ts:129-139`), but a *partial* success is possible in the campaign step: contacts
  are committed before the `campaign_leads` upsert, and **that upsert's error is never checked** (`:157-160`).
- **There is no update path.** `ContactDetailModal` is read-only and no `updateContact` exists, so `category` and `contact_status` cannot be changed.
- **`Business Link` is special-cased** — it matches only the exact headers `business link` or `link`, never a substring of `Business`
  (`contacts-parse-csv/index.ts:75-77`).
- **Contacts paginate client-side**, 50/page, after `select('*')` of the whole table (`api.ts:276-283`) — large lists load entirely into the browser.

## Adding a new importable field

Thirteen places must change and most failures are silent — full checklist in [`docs/guides/csv-import.md`](/docs/guides/csv-import.md). The one that bites:
`AddContactModal.tsx:90` ends `return map[label] ?? 'notes'`, so a label missing from that map writes its value into `notes` with no error.

## Not covered here

`call_status` / `call_count` / `last_called_at` and the dial loop → `.brain/domains/dialer.md`; `campaign_leads` and lead status → `.brain/domains/campaigns.md`; JWT
and service-role patterns → `.brain/domains/auth.md`.
