import { parse } from 'npm:csv-parse/sync';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const CANONICAL_FIELDS = [
  'Business Name',
  'Business Link',
  'Business Type',
  'Rating',
  'Review Count',
  'Open Hours',
  'Phone Number',
  'Website',
  'Notes',
  'First Name',
  'Last Name',
  'Owner Contact',
  'Address',
] as const;

const ALIASES: Record<string, string> = {
  company: 'Business Name',
  'company name': 'Business Name',
  url: 'Business Link',
  link: 'Business Link',
  'google link': 'Business Link',
  maps: 'Business Link',
  type: 'Business Type',
  category: 'Business Type',
  industry: 'Business Type',
  stars: 'Rating',
  score: 'Rating',
  reviews: 'Review Count',
  'review #': 'Review Count',
  'num reviews': 'Review Count',
  hours: 'Open Hours',
  schedule: 'Open Hours',
  availability: 'Open Hours',
  phone: 'Phone Number',
  tel: 'Phone Number',
  telephone: 'Phone Number',
  mobile: 'Phone Number',
  cell: 'Phone Number',
  number: 'Phone Number',
  contact: 'Phone Number',
  'contact name': 'Owner Contact',
  site: 'Website',
  web: 'Website',
  webpage: 'Website',
  domain: 'Website',
  note: 'Notes',
  comment: 'Notes',
  description: 'Notes',
  memo: 'Notes',
  first: 'First Name',
  fname: 'First Name',
  'given name': 'First Name',
  last: 'Last Name',
  lname: 'Last Name',
  surname: 'Last Name',
  'family name': 'Last Name',
  owner: 'Owner Contact',
  'decision maker': 'Owner Contact',
  address: 'Address',
  street: 'Address',
  location: 'Address',
  addr: 'Address',
};

function normalizeForMatch(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Business Link: only match exact "Business Link" or "Link" (case insensitive), never "Business". */
function isBusinessLinkMatch(norm: string): boolean {
  return norm === 'business link' || norm === 'link';
}

/** Returns header-only match score 0–100 for a canonical field (no value check). */
function headerMatchScore(originalHeader: string, field: string): number {
  const norm = normalizeForMatch(originalHeader);
  if (!norm) return 0;
  if (normalizeForMatch(field) === norm) return 100;
  if (field === 'Business Link' && isBusinessLinkMatch(norm)) return 100;
  if (field === 'Business Link') return 0;
  const canonNorm = normalizeForMatch(field);
  if (norm.includes(canonNorm) || canonNorm.includes(norm)) return 60;
  const alias = ALIASES[norm] || ALIASES[originalHeader.trim().toLowerCase()];
  if (alias === field) return 80;
  for (const [key, value] of Object.entries(ALIASES)) {
    if (value !== field) continue;
    if (value === 'Business Link' && norm !== 'business link' && norm !== key) continue;
    if (norm.includes(key) || key.includes(norm)) return 50;
  }
  return 0;
}

/** Heuristic: does this value look like a URL/link? */
function looksLikeLink(v: string): boolean {
  const s = (v || '').trim().toLowerCase();
  if (s.startsWith('http://') || s.startsWith('https://')) return true;
  if (s.startsWith('www.') || s.includes('.com') || s.includes('.org') || s.includes('.net'))
    return true;
  if (/maps\.google|google\.com\/maps|goo\.gl|bit\.ly/i.test(s)) return true;
  if (s.includes('/') && (s.includes('.') || s.length > 15)) return true;
  return false;
}

/** Heuristic: does this value look like a phone number? */
function looksLikePhone(v: string): boolean {
  const digits = (v || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/** Heuristic: does this value look like a name (no URL, no @)? */
function looksLikeName(v: string): boolean {
  const s = (v || '').trim();
  if (!s || s.length > 80) return false;
  if (looksLikeLink(s) || s.includes('@')) return false;
  if (looksLikePhone(s)) return false;
  return true;
}

/** Heuristic: numeric rating e.g. 1–5 or 0–5. */
function looksLikeRating(v: string): boolean {
  const n = parseFloat((v || '').trim());
  return !Number.isNaN(n) && n >= 0 && n <= 5 && (v || '').trim().length <= 4;
}

/** Heuristic: integer count (reviews). */
function looksLikeReviewCount(v: string): boolean {
  const s = (v || '').trim();
  const n = parseInt(s, 10);
  return /^\d+$/.test(s) && !Number.isNaN(n) && n >= 0 && n <= 1000000;
}

/** Score 0–100 how well preview values fit this canonical field. */
function valueMatchScore(previewData: string[], field: string): number {
  if (previewData.length === 0) return 0;
  let match = 0;
  for (const v of previewData) {
    const s = (v || '').trim();
    if (!s) continue;
    if (field === 'Business Link' && looksLikeLink(s)) match += 1;
    else if (field === 'Business Name' && looksLikeName(s) && !looksLikeLink(s)) match += 1;
    else if (field === 'Phone Number' && looksLikePhone(s)) match += 1;
    else if (field === 'Website' && looksLikeLink(s)) match += 1;
    else if (field === 'Rating' && looksLikeRating(s)) match += 1;
    else if (field === 'Review Count' && looksLikeReviewCount(s)) match += 1;
    else if (field === 'Business Name' && looksLikeName(s)) match += 0.5;
  }
  const ratio = match / Math.max(previewData.length, 1);
  return Math.round(Math.min(100, ratio * 100));
}

/** Best-fit: score each (column, field) by header + value fit, then assign so each column and each field is used at most once (highest scores first). */
function assignBestFitColumns(
  headers: string[],
  previewRows: Record<string, string>[],
  canonicalFields: readonly string[]
): Map<number, string> {
  const columnCount = headers.length;
  const candidates: { colIdx: number; field: string; score: number }[] = [];
  for (let colIdx = 0; colIdx < columnCount; colIdx++) {
    const original_header = headers[colIdx];
    const preview_data = previewRows
      .map((r) => (r[original_header] != null ? String(r[original_header]).slice(0, 40) : ''))
      .filter(Boolean);
    for (const field of canonicalFields) {
      const h = headerMatchScore(original_header, field);
      const v = valueMatchScore(preview_data, field);
      const combined = h * 0.5 + v * 0.5;
      if (combined >= 25) candidates.push({ colIdx, field, score: combined });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const assignment = new Map<number, string>();
  const usedColumns = new Set<number>();
  const usedFields = new Set<string>();
  for (const { colIdx, field, score } of candidates) {
    if (usedColumns.has(colIdx) || usedFields.has(field)) continue;
    if (score < 30) continue;
    assignment.set(colIdx, field);
    usedColumns.add(colIdx);
    usedFields.add(field);
  }
  return assignment;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as { csv_text?: string };
    const csvText = body?.csv_text;
    if (!csvText || typeof csvText !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing csv_text in body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const totalRows = rows.length;
    const previewForScoring = rows.slice(0, 5);
    const assignment = assignBestFitColumns(headers, previewForScoring, CANONICAL_FIELDS);
    const previewRows = rows.slice(0, 3);

    const columns = headers.map((original_header, colIdx) => {
      const preview_data = previewRows
        .map((r) => (r[original_header] != null ? String(r[original_header]).slice(0, 40) : ''))
        .filter(Boolean);
      const mapped_field = assignment.get(colIdx) ?? null;
      const status = mapped_field ? 'mapped' : 'incomplete';
      return {
        original_header,
        mapped_field,
        status: status as 'mapped' | 'incomplete',
        preview_data,
      };
    });

    return new Response(
      JSON.stringify({
        columns,
        total_rows: totalRows,
        preview_rows: previewRows,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('contacts-parse-csv error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
