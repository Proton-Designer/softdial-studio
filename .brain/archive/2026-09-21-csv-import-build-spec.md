---
id: archive.csv-import-build-spec
title: CSV Import — Original Build Spec (Archived)
layer: L5
type: archive
status: archived
owner: maintainer
updated: 2026-09-21
superseded_by: domain.contacts
related:
  - domain.contacts
covers: "The original implementation prompt for the CSV import feature, preserved verbatim."
excludes: "How CSV import actually works today — see .brain/domains/contacts.md and docs/guides/csv-import.md."
tokens_est: 2551
---

# CSV Import — Original Build Spec (Archived)

**Provenance.** This was `docs/guides/csv-import.md` — and before the repository
restructure, Frontend/csvImplementation.md — until 2026-09-21. It is not documentation — it is
the **original build prompt** that briefed the feature.

**Why it was archived.** It describes an architecture that was never built. The
spec calls for Next.js API routes, Python/pandas parsing (`pd.read_csv`), the
`phonenumbers` Python library, and `POST /api/contacts/parse-csv`. The actual
implementation is Deno + the csv-parse module running on Supabase Edge Functions,
and it also omits the `Address` field that shipped. An agent or engineer reading it
as current documentation would be misled on every technical detail.

It is kept because it records the **original intent and the canonical field list**,
which is genuine history worth having.

**For current behaviour** read `.brain/domains/contacts.md` (summary) and
`docs/guides/csv-import.md` (the rewritten guide).

---

Build a complete CSV contact import system and single contact creation feature
for our cold-calling web app. Here is the full spec:

---

## PART 1: CSV UPLOAD & COLUMN MAPPING FLOW

### Step 1: CSV Upload Entry Point

- Add an "Import Contacts" button to the existing contacts screen
- On click, open a modal or navigate to a new /contacts/import page
- The upload area should accept .csv files only, with drag-and-drop support
  and a fallback file picker button
- On file selection, immediately parse the CSV using Python/Pandas on the
  backend before showing any UI

### Step 2: Backend CSV Parsing Endpoint

Create a POST /api/contacts/parse-csv endpoint that:

- Accepts a multipart/form-data CSV file upload
- Uses pandas to read the CSV: pd.read_csv(file)
- Extracts all column headers from the file
- Grabs a preview of the first 3 rows of data for each column
- Runs automatic column mapping using fuzzy string matching logic against
  this exact list of canonical field names:
  - Business Name
  - Business Link
  - Business Type
  - Rating
  - Review Count
  - Open Hours
  - Phone Number
  - Website
  - Notes
  - First Name
  - Last Name
  - Owner Contact
- Fuzzy matching rules (implement in this priority order):
  1. Exact match (case-insensitive)
  2. Contains match (e.g. "biz name" → Business Name, "phone" → Phone Number)
  3. Common alias mapping:
     "company" or "company name" → Business Name
     "url" or "link" or "google link" or "maps" → Business Link
     "type" or "category" or "industry" → Business Type
     "stars" or "score" → Rating
     "reviews" or "review #" or "num reviews" → Review Count
     "hours" or "schedule" or "availability" → Open Hours
     "phone" or "tel" or "telephone" or "mobile" or "cell" → Phone Number
     "site" or "web" or "webpage" or "domain" → Website
     "note" or "comment" or "description" or "memo" → Notes
     "first" or "fname" or "given name" → First Name
     "last" or "lname" or "surname" or "family name" → Last Name
     "owner" or "contact" or "contact name" or "decision maker" → Owner Contact
  4. If no match found → status: "incomplete"
- Return JSON response with shape:
  {
  columns: [
  {
  original_header: string, // raw name from CSV
  mapped_field: string | null, // matched canonical field or null
  status: "mapped" | "incomplete",
  preview_data: string[] // first 3 non-null values from this column
  }
  ],
  total_rows: number,
  preview_rows: object[] // first 3 full rows as objects
  }

### Step 3: Column Mapping Review Screen

Build a full mapping review UI (match the screenshot provided) with:

LAYOUT:

- Full page or large modal layout
- Title: "Map Your Columns"
- Subtitle: "X columns mapped automatically · Y need your attention"
- A table/list with these columns:
  [Column header in file] [Preview information] [Status] [Object] [Fields]
- "Column header in file": show the raw CSV column name
- "Preview information": show the first 3 values from that column,
  separated by line breaks, truncated to 40 chars each
- "Status":
  - Green pill with checkmark + "Mapped" if auto-matched
  - Grey pill "Pending" if incomplete
- "Object": always show "Contact" (static label for now)
- "Fields": a dropdown (shadcn Select component) showing all 12 canonical
  field options plus a "Skip this column" option. Pre-select the matched
  field if status is "mapped". Show "Please Select" placeholder if pending.

BEHAVIOR:

- When user changes a dropdown, update that column's mapped_field in state
- Prevent duplicate field assignments: if a field is already selected in
  another row, grey it out in other dropdowns but still allow it
- Show a running count at the top: "X of Y columns assigned"
- "Finish Import" button at the bottom, disabled until all columns are
  either assigned OR explicitly set to "Skip this column"
- "Cancel" button that returns to contacts screen without saving

### Step 4: Import Execution

On "Finish Import" click:

- Send POST /api/contacts/import with:
  {
  column_mappings: [{ original_header, mapped_field }],
  file_id: string // reference to the temp-stored parsed CSV on server
  }
- Backend Python/Pandas script should:
  1. Re-read the CSV using the confirmed mappings
  2. For each row, construct a contact object with only the mapped fields
  3. Normalize phone numbers: strip all non-numeric characters, format as
     E.164 (+1XXXXXXXXXX for US numbers)
  4. Skip rows where Phone Number is empty/null (phone is required)
  5. Deduplicate against existing contacts by phone number
  6. Bulk insert all valid contacts into the Supabase contacts table
  7. Return { imported: number, skipped: number, duplicates: number }
- Show a success screen: "X contacts imported successfully" with a
  "View Contacts" button that navigates back to the contacts list

---

## PART 2: SINGLE CONTACT ADD FORM

Add an "Add Contact" button next to the "Import Contacts" button on the
contacts screen. On click, open a modal (not a new page) with:

DEFAULT FIELDS (always shown, all optional):

- Business Name (text input)
- Business Type (text input)
- Phone Number (text input, validated as phone number on submit)
- Website (text input, validated as URL on submit)

ADDITIONAL FIELDS (collapsed by default):

- An "+ Add Field" button that opens a dropdown listing any canonical
  fields not already shown:
  Business Link, Rating, Review Count, Open Hours, Notes,
  First Name, Last Name, Owner Contact
- Each selected additional field adds a new labeled input row
- Added fields can be removed with an X button

BEHAVIOR:

- At least one field must have a value to enable the Save button
- Phone number, if provided, must be a valid format
- On save: POST /api/contacts/single with the contact data
- Insert into Supabase contacts table with the same schema as CSV imports
- On success: close modal, refresh contacts list, show a brief toast
  "Contact added successfully"
- On error: show inline error message, do not close modal

---

## SUPABASE CONTACTS TABLE SCHEMA

Ensure the contacts table has these columns (create migration if needed):
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users not null
business_name text
business_link text
business_type text
rating numeric(3,1)
review_count integer
open_hours text
phone_number text
website text
notes text
first_name text
last_name text
owner_contact text
created_at timestamptz default now()
updated_at timestamptz default now()

Add index on (user_id, phone_number) for deduplication queries.
Row-level security: users can only read/write their own contacts.

---

## TECH STACK CONTEXT

- Frontend: React/Next.js with TypeScript, Tailwind CSS, shadcn/ui components
- Backend: Next.js API routes + Python scripts invoked via child_process or
  a FastAPI microservice
- Database: Supabase (PostgreSQL)
- CSV parsing: Python with pandas library
- Phone normalization: phonenumbers Python library
- File handling: store temp CSV in /tmp during the mapping session, clean
  up after import completes

---

## FILE STRUCTURE TO CREATE/MODIFY

- app/contacts/page.tsx — add Import and Add Contact buttons
- app/contacts/import/page.tsx — mapping review screen
- app/api/contacts/parse-csv/route.ts — calls Python parser script
- app/api/contacts/import/route.ts — calls Python import script
- app/api/contacts/single/route.ts — single contact creation
- scripts/parse_csv.py — pandas parsing + fuzzy matching logic
- scripts/import_contacts.py — pandas import + normalization + bulk insert
- components/contacts/AddContactModal.tsx — single add modal
- components/contacts/ColumnMappingTable.tsx — mapping review table component
- supabase/migrations/xxx_contacts_table.sql — schema migration
