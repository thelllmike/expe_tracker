// Ledger — invoice & quotation PDF generation
//
// Renders a branded A4 document, stores it in the private `documents` bucket and
// hands back a signed URL. Handles both document kinds; the deployed function
// name is kept so existing clients keep working.
//
// Deploy:  supabase functions deploy generate-invoice-pdf
// Invoke:  supabase.functions.invoke('generate-invoice-pdf', { body: { invoice_id } })
//          supabase.functions.invoke('generate-invoice-pdf', { body: { quotation_id } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { render, type Item } from './render.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Kind = 'invoice' | 'quotation';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const body = await req.json();
    const invoiceId: string | undefined = body.invoice_id;
    const quotationId: string | undefined = body.quotation_id;
    if (!invoiceId && !quotationId) {
      return json({ error: 'invoice_id or quotation_id is required' }, 400);
    }

    const kind: Kind = invoiceId ? 'invoice' : 'quotation';
    const id = (invoiceId ?? quotationId)!;
    const table = kind === 'invoice' ? 'invoices' : 'quotations';
    const itemTable = kind === 'invoice' ? 'invoice_items' : 'quotation_items';
    const fk = kind === 'invoice' ? 'invoice_id' : 'quotation_id';

    // Run every read as the calling user so RLS decides what they may export.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not signed in' }, 401);

    const { data: doc, error: docError } = await supabase
      .from(table)
      .select('*, business:businesses(*), client:contacts(id,name,email,address)')
      .eq('id', id)
      .single();
    if (docError || !doc) return json({ error: `${kind} not found` }, 404);

    const { data: items } = await supabase
      .from(itemTable)
      .select('description, detail, qty, amount_minor')
      .eq(fk, id)
      .order('position');

    const logo = await fetchLogo(doc.business?.logo_path ?? null);
    const bytes = await render(kind, doc, (items ?? []) as Item[], logo);

    // Service role writes to `documents`; the bucket's policies only grant reads.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const folder = kind === 'invoice' ? 'invoices' : 'quotations';
    const safeNumber = String(doc.number).replace(/[^\w.-]+/g, '-');
    const path = `${userData.user.id}/${folder}/${safeNumber}.pdf`;
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) return json({ error: uploadError.message }, 500);

    await admin.from(table).update({ pdf_path: path }).eq('id', id);
    await admin.from('exports').insert({
      owner_id: userData.user.id,
      filename: `${safeNumber}.pdf`,
      kind: 'pdf',
      storage_path: path,
    });

    const { data: signed, error: signError } = await admin.storage
      .from('documents')
      .createSignedUrl(path, 60 * 60);
    if (signError) return json({ error: signError.message }, 500);

    return json({ url: signed.signedUrl, path, filename: `${safeNumber}.pdf` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** The logos bucket is public, so the object can be fetched without signing. */
async function fetchLogo(logoPath: string | null): Promise<Uint8Array | null> {
  if (!logoPath) return null;
  try {
    const base = Deno.env.get('SUPABASE_URL')!;
    const res = await fetch(`${base}/storage/v1/object/public/logos/${logoPath}`);
    if (!res.ok) {
      console.error(`[ledger] logo fetch failed: ${res.status} for ${logoPath}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());

    // Storage will serve whatever was uploaded, including an error page saved as
    // a .jpg. Check the magic bytes so a bad object is reported rather than
    // handed to pdf-lib as an image.
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!png && !jpg) {
      console.error(
        `[ledger] logo at ${logoPath} is not a PNG or JPEG (${bytes.length} bytes); skipping.`,
      );
      return null;
    }
    return bytes;
  } catch (e) {
    console.error('[ledger] logo fetch threw:', e instanceof Error ? e.message : e);
    return null;
  }
}

