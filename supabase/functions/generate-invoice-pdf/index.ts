// Ledger — invoice PDF generation
//
// Renders the invoice preview screen as a real PDF, stores it in the private
// `documents` bucket and hands back a signed URL.
//
// Deploy:  supabase functions deploy generate-invoice-pdf
// Invoke:  supabase.functions.invoke('generate-invoice-pdf', { body: { invoice_id } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Design tokens, converted from hex to pdf-lib's 0–1 RGB.
const INK = rgb(0x0f / 255, 0x1c / 255, 0x2e / 255);
const MUTED = rgb(0x5b / 255, 0x6b / 255, 0x7c / 255);
const RULE = rgb(0.87, 0.87, 0.85);

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 56;

type Item = {
  description: string;
  detail: string | null;
  qty: number;
  amount_minor: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const { invoice_id } = await req.json();
    if (!invoice_id) return json({ error: 'invoice_id is required' }, 400);

    // Run every read as the calling user so RLS decides what they may export.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not signed in' }, 401);

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, business:businesses(*), client:contacts(id,name,email,address)')
      .eq('id', invoice_id)
      .single();
    if (invoiceError || !invoice) return json({ error: 'Invoice not found' }, 404);

    const { data: items } = await supabase
      .from('invoice_items')
      .select('description, detail, qty, amount_minor')
      .eq('invoice_id', invoice_id)
      .order('position');

    const bytes = await renderInvoice(invoice, (items ?? []) as Item[]);

    // Service role writes to `documents`; the bucket's policies only grant reads.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const path = `${userData.user.id}/invoices/${invoice.number}.pdf`;
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) return json({ error: uploadError.message }, 500);

    await admin.from('invoices').update({ pdf_path: path }).eq('id', invoice_id);
    await admin.from('exports').insert({
      owner_id: userData.user.id,
      filename: `${invoice.number}.pdf`,
      kind: 'pdf',
      storage_path: path,
    });

    const { data: signed, error: signError } = await admin.storage
      .from('documents')
      .createSignedUrl(path, 60 * 60);
    if (signError) return json({ error: signError.message }, 500);

    return json({ url: signed.signedUrl, path });
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

// deno-lint-ignore no-explicit-any
async function renderInvoice(invoice: any, items: Item[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.width, A4.height]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const business = invoice.business ?? {};
  const client = invoice.client ?? {};
  const symbol = currencySymbol(invoice.currency);
  const right = A4.width - MARGIN;

  let y = A4.height - MARGIN;

  const draw = (
    value: string,
    x: number,
    yy: number,
    size: number,
    font = regular,
    colour = INK,
  ) => page.drawText(value, { x, y: yy, size, font, color: colour });

  const drawRight = (
    value: string,
    edge: number,
    yy: number,
    size: number,
    font = regular,
    colour = INK,
  ) => draw(value, edge - font.widthOfTextAtSize(value, size), yy, size, font, colour);

  // ---- header
  draw(business.name ?? 'Business', MARGIN, y, 14, bold);
  if (business.vat_number) draw(`VAT ${business.vat_number}`, MARGIN, y - 14, 9, regular, MUTED);
  drawRight('INVOICE', right, y, 20, bold);
  drawRight(invoice.number, right, y - 16, 9, regular, MUTED);

  y -= 56;

  // ---- parties
  draw('BILLED TO', MARGIN, y, 8, bold, MUTED);
  draw('DATES', right - 150, y, 8, bold, MUTED);
  y -= 14;

  const billedLines = String(client.address ?? client.name ?? 'No client').split('\n');
  billedLines.forEach((line, i) => draw(line, MARGIN, y - i * 13, 10));
  draw(`Issued ${formatDate(invoice.issue_date)}`, right - 150, y, 10);
  draw(`Due ${formatDate(invoice.due_date)}`, right - 150, y - 13, 10);

  y -= Math.max(billedLines.length * 13, 26) + 26;

  // ---- table head
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 14;
  draw('DESCRIPTION', MARGIN, y, 8, bold, MUTED);
  drawRight('QTY', right - 110, y, 8, bold, MUTED);
  drawRight('AMOUNT', right, y, 8, bold, MUTED);
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 22;

  // ---- lines
  for (const item of items) {
    draw(item.description, MARGIN, y, 10);
    if (item.detail) {
      draw(item.detail, MARGIN, y - 12, 8.5, regular, MUTED);
    }
    drawRight(String(Number(item.qty)), right - 110, y, 10, regular, MUTED);
    drawRight(money(item.amount_minor, symbol), right, y, 10);

    y -= item.detail ? 32 : 22;
    page.drawLine({
      start: { x: MARGIN, y: y + 8 },
      end: { x: right, y: y + 8 },
      thickness: 0.5,
      color: RULE,
    });
  }

  // ---- totals
  y -= 16;
  const labelX = right - 190;
  drawRight('Subtotal', labelX + 70, y, 10, regular, MUTED);
  drawRight(money(invoice.subtotal_minor, symbol), right, y, 10, regular, MUTED);

  if (invoice.tax_minor > 0) {
    y -= 15;
    drawRight(`Tax ${Number(invoice.tax_rate)}%`, labelX + 70, y, 10, regular, MUTED);
    drawRight(money(invoice.tax_minor, symbol), right, y, 10, regular, MUTED);
  }

  y -= 10;
  page.drawLine({ start: { x: labelX, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 20;
  drawRight('Total due', labelX + 70, y, 11, bold);
  drawRight(money(invoice.total_minor, symbol), right, y, 16, bold);

  // ---- payment footer
  if (invoice.attach_payment_link && (business.pay_link || business.iban)) {
    y -= 46;
    page.drawLine({ start: { x: MARGIN, y: y + 18 }, end: { x: right, y: y + 18 }, thickness: 1, color: RULE });
    draw('Pay by card, transfer or QR', MARGIN, y, 10, bold);
    if (business.pay_link) draw(business.pay_link, MARGIN, y - 14, 9, regular, MUTED);
    if (business.iban) draw(`IBAN ${business.iban}`, MARGIN, y - 26, 9, regular, MUTED);
  }

  return await doc.save();
}

function money(minor: number, symbol: string): string {
  return `${symbol}${(minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currencySymbol(code: string): string {
  // Helvetica has no glyph for ₹ and similar; fall back to the ISO code.
  return ({ USD: '$', EUR: 'EUR ', GBP: 'GBP ' } as Record<string, string>)[code] ?? `${code} `;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
