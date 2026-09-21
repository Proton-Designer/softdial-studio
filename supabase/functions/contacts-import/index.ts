import { parse } from 'npm:csv-parse/sync';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const CANONICAL_TO_DB: Record<string, string> = {
  'Business Name': 'business_name',
  'Business Link': 'business_link',
  'Business Type': 'business_type',
  Rating: 'rating',
  'Review Count': 'review_count',
  'Open Hours': 'open_hours',
  'Phone Number': 'phone_number',
  Website: 'website',
  Notes: 'notes',
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Owner Contact': 'owner_contact',
  Address: 'address',
};

function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10 && !digits.startsWith('1')) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse();

  const { user, error: authError } = await getUserFromRequest(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as {
      csv_text?: string;
      column_mappings?: { original_header: string; mapped_field: string | null }[];
      category?: string;
      campaign_id?: string;
    };
    const csvText = body?.csv_text;
    const columnMappings = body?.column_mappings;
    const category =
      body?.category && ['Cold', 'Warm', 'Follow Up', 'Voicemail', 'Booked'].includes(body.category)
        ? body.category
        : 'Cold';
    const campaignId = body?.campaign_id?.trim() || null;
    if (!csvText || !Array.isArray(columnMappings)) {
      return new Response(JSON.stringify({ error: 'Missing csv_text or column_mappings' }), {
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

    const headerToDb = new Map<string, string>();
    for (const m of columnMappings) {
      const mapped = m.mapped_field?.trim();
      if (mapped && mapped !== 'Skip this column' && CANONICAL_TO_DB[mapped]) {
        headerToDb.set(m.original_header, CANONICAL_TO_DB[mapped]);
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingPhones } = await supabase
      .from('contacts')
      .select('phone_number')
      .eq('user_id', user.id);
    const existingSet = new Set(
      (existingPhones ?? []).map((r: { phone_number: string | null }) =>
        (r.phone_number ?? '').replace(/\D/g, '')
      )
    );

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const toInsert: Record<string, unknown>[] = [];

    for (const row of rows) {
      const contact: Record<string, unknown> = {
        user_id: user.id,
        category,
        contact_status: 'No Contact',
        updated_at: new Date().toISOString(),
      };
      let phoneValue: string | null = null;
      for (const [origHeader, dbCol] of headerToDb) {
        const val = row[origHeader] != null ? String(row[origHeader]).trim() : '';
        if (dbCol === 'phone_number') {
          phoneValue = normalizePhone(val);
          contact[dbCol] = phoneValue;
        } else if (dbCol === 'rating') {
          const num = parseFloat(val);
          contact[dbCol] = isNaN(num) ? null : num;
        } else if (dbCol === 'review_count') {
          const num = parseInt(val, 10);
          contact[dbCol] = isNaN(num) ? null : num;
        } else {
          contact[dbCol] = val || null;
        }
      }
      if (!contact.phone_number || contact.phone_number === null) {
        skipped++;
        continue;
      }
      const phoneDigits = (contact.phone_number as string).replace(/\D/g, '');
      if (existingSet.has(phoneDigits)) {
        duplicates++;
        continue;
      }
      existingSet.add(phoneDigits);
      toInsert.push(contact);
    }

    let insertedContactIds: string[] = [];
    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(toInsert)
        .select('id');
      if (error) {
        console.error('contacts-import insert error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      imported = toInsert.length;
      insertedContactIds = (inserted ?? []).map((r: { id: string }) => r.id);
    }

    if (campaignId && insertedContactIds.length > 0) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (campaign) {
        const leadRows = insertedContactIds.map((contact_id: string) => ({
          campaign_id: campaignId,
          contact_id,
          status: 'queued',
        }));
        await supabase.from('campaign_leads').upsert(leadRows, {
          onConflict: 'campaign_id,contact_id',
          ignoreDuplicates: true,
        });
      }
    }

    return new Response(JSON.stringify({ imported, skipped, duplicates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('contacts-import error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
