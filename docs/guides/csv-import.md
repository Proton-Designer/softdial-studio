# CSV contact import

How the import wizard actually works, and what to change when you add a field.

> The previous contents of this file were the original **build prompt**, not
> documentation — it specified Next.js API routes and Python/pandas, neither of
> which was built. It is preserved verbatim at
> [`.brain/archive/2026-09-21-csv-import-build-spec.md`](../../.brain/archive/2026-09-21-csv-import-build-spec.md).
> For a summary of this domain, see [`.brain/domains/contacts.md`](../../.brain/domains/contacts.md).

## The flow

Import is **two round-trips** to two different Edge Functions, with a human
decision in between.

```
file ──► browser reads text (ImportContactsModal.tsx:85-99)
      ──► POST contacts-parse-csv  { csv_text }
          └─► returns columns[] with a PROPOSED mapping, total_rows, 3 preview rows
      ──► user corrects the mapping in the wizard
      ──► POST contacts-import     { csv_text (again), mappings, category, campaign_id? }
          └─► parses, normalises phones, de-duplicates, one bulk insert
          └─► optionally links the new ids into campaign_leads
      ◄── { imported, skipped, duplicates }
```

**Why two calls.** Parsing is a pure, side-effect-free proposal; the human then
edits it. The server keeps **no state between the calls**, so the client re-sends
the full CSV text on the second one. Nothing is written until the second call —
abandoning the wizard imports nothing.

### Auto-mapping

`contacts-parse-csv` scores every (column, canonical field) pair as
`0.5·headerMatchScore + 0.5·valueMatchScore`, sorts descending, and greedily
assigns so each column and each field is used at most once, dropping anything
below 30 (`supabase/functions/contacts-parse-csv/index.ts:157-188`).

In the wizard, Import stays disabled until _every_ column has a value — choosing
"Skip this column" counts. Selecting a field already mapped elsewhere blanks the
other column instead of duplicating it.

### De-duplication

The key is **digits-only phone number, scoped to the importing user**.

`contacts-import` loads every existing `phone_number` for the user into a Set of
`phone.replace(/\D/g, '')` (`index.ts:76-84`). Per row: normalise the phone; if it
is `null`, count `skipped`; if its digits are already in the Set, count
`duplicates`; otherwise add and queue it (`:114-124`).

Because the Set is updated as it goes, this also catches duplicates **within the
same CSV**. Nothing else participates — not name, business, or address. Duplicates
are silently dropped, never merged or updated.

`normalizePhone` (`:22-28`): 10 digits not starting with `1` → `+1XXXXXXXXXX`;
11 digits starting with `1` → `+1XXXXXXXXXX`; ≥10 digits otherwise → `+` + digits;
fewer than 10 digits → `null`.

### Failure behaviour

The insert is **one bulk statement**, so a constraint violation returns 500 and
**no rows land** (`contacts-import/index.ts:129-139`).

A partial success is still possible in the campaign step: contacts are already
committed when the `campaign_leads` upsert runs, and **that upsert's error is never
checked** (`:157-160`). A `campaign_id` that is missing or belongs to someone else
skips linking silently (`:151`).

## Adding a new importable field, end to end

Every step is required unless marked optional. Missing one usually fails
silently rather than loudly.

1. **A new migration file**, timestamped after `20260208000001`:
   `ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS <col> …`.
   Never edit an applied migration.
2. `supabase/functions/contacts-parse-csv/index.ts:5` — add the label to
   `CANONICAL_FIELDS`.
3. _(optional)_ same file `:21` `ALIASES` — header synonyms. Without them only an
   exact or substring header match auto-maps.
4. _(optional)_ same file `:138` `valueMatchScore` — a value heuristic. Without one
   the field scores on header alone; a perfect header match still clears the 30
   threshold.
5. `supabase/functions/contacts-import/index.ts:6` — add `'<Label>': '<col>'` to
   `CANONICAL_TO_DB`.
6. same file `:99-113` — add a coercion branch if the column is not text; otherwise
   it is written as `val || null`.
7. `apps/web/src/lib/api.ts:192` — add the label to `CONTACT_CANONICAL_FIELDS`.
   This alone feeds the wizard's dropdown, so `ImportContactsModal.tsx` needs no edit.
8. `apps/web/src/lib/api.ts:208` — add the column to the `Contact` interface.
9. `apps/web/src/lib/api.ts:285` — add it to `CreateContactInput`.
10. `apps/web/src/lib/api.ts:310-328` — add it to the `createContact` insert body.
    Fields absent here are never written by the single-add path.
11. `apps/web/src/components/contacts/AddContactModal.tsx:75` — add the label to
    `toDbKey`'s map, **or the value silently lands in `notes`** (`:90` ends
    `return map[label] ?? 'notes'`). Add to `DEFAULT_FIELDS` (`:12`) only if it
    should show without expanding "additional fields", and add a numeric branch at
    `:102-104` if it is not a string.
12. `apps/web/src/components/contacts/ContactDetailModal.tsx` — render it, or it is
    invisible after import.
13. _(optional)_ `apps/web/src/components/Contacts.tsx:275-330` for card display,
    and `:67-78` to make it searchable.

## Enums

| Field            | Allowed values                                     | Enforced where                                                                                                                                                                  |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `category`       | `Cold`, `Warm`, `Follow Up`, `Voicemail`, `Booked` | Whitelist at `contacts-import/index.ts:46` — anything else silently becomes `Cold`. **No DB CHECK.**                                                                            |
| `contact_status` | `No Contact`, `Contacted`                          | UI filter only. Import hardcodes `'No Contact'` (`contacts-import/index.ts:95`). **No DB CHECK, and nothing ever writes `'Contacted'`** — that filter always returns zero rows. |

## Gotchas

- **`Business Link` is deliberately special-cased** — it matches only the exact
  headers `business link` or `link`, never a substring of `Business`
  (`contacts-parse-csv/index.ts:75-77`, `:92`).
- **There is no update path.** `ContactDetailModal` is read-only and no
  `updateContact` exists, so `category` and `contact_status` cannot be changed from
  the UI after creation.
- **Contacts paginate client-side**, 50 per page, after `select('*')` of the whole
  table (`api.ts:276-283`). Large lists load entirely into the browser.
