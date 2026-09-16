// Ledger — the document renderer.
//
// Rebuilt to match the business's Canva invoice: the corner artwork is the
// artwork lifted from that file, the layout follows its measurements, and the
// type is set in a geometric sans with the same wide tracking.
//
// Split out from index.ts so the layout can be rendered and eyeballed locally
// without deploying — see "Checking the PDF layout" in the README.

import { PDFDocument, rgb, setCharacterSpacing, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1';
import { ART_BOTTOM_RIGHT, ART_TOP_LEFT, bytes, FONT_BOLD, FONT_REGULAR } from './assets.ts';

const A4 = { width: 595.28, height: 841.89 };

const BLACK = rgb(0, 0, 0);
const INK = rgb(0x22 / 255, 0x22 / 255, 0x22 / 255);
const NAVY = rgb(0x2E / 255, 0x3F / 255, 0x57 / 255);
const WHITE = rgb(1, 1, 1);

/** Column geometry, measured off the reference document. */
const TEXT_LEFT = 82;      // BILLED TO / PAY TO / footer
const VALUE_LEFT = 196;    // the value column beside those labels
const RULE_LEFT = 58;      // item rules and the header bar
const RULE_RIGHT = 534;
const AMOUNT_RIGHT = 528;  // right edge of every figure
const QTY_LEFT = 243;
const ITEM_LEFT = 75;
const TOTALS_RULE_LEFT = 292;
const TOTALS_LABEL_RIGHT = 445;

/**
 * Canva exported at 630x876pt: A4 with ~17pt of bleed on every edge. The corner
 * crops are measured in that space, so they are placed against it and allowed to
 * run off the trimmed page exactly as the original does.
 */
const BLEED = 17;
/** Crop widths converted from source pixels at 630pt / 2600px. */
const ART_TL_W = 150;
const ART_BR_W = 232;

/** Items stop here so they never run into the bottom-right artwork. */
const CONTENT_BOTTOM = 600;
const PAGE_FLOOR = A4.height - 26;
const FOOTER_REST = 746;

export type Item = { description: string; detail: string | null; qty: number; amount_minor: number };
type Kind = 'invoice' | 'quotation';

// deno-lint-ignore no-explicit-any
export async function render(kind: Kind, d: any, items: Item[], logoBytes: Uint8Array | null) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // The bundled faces stand in for Garet. If either fails to parse the document
  // still renders, just in the base-14 fallback.
  let regular, bold;
  try {
    regular = await pdf.embedFont(bytes(FONT_REGULAR), { subset: true });
    bold = await pdf.embedFont(bytes(FONT_BOLD), { subset: true });
  } catch {
    regular = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  const artTopLeft = await pdf.embedPng(bytes(ART_TOP_LEFT));
  const artBottomRight = await pdf.embedPng(bytes(ART_BOTTOM_RIGHT));

  const business = d.business ?? {};
  const client = d.client ?? {};

  let page = pdf.addPage([A4.width, A4.height]);

  /** Page coordinates written top-down, the way the layout reads. */
  const Y = (t: number) => A4.height - t;

  /**
   * Draw with letter spacing. Tc is text state and survives BT/ET, so it is
   * reset after every run rather than left set for whatever draws next.
   */
  const draw = (
    v: string,
    x: number,
    t: number,
    size: number,
    font = regular,
    colour = INK,
    tracking = 0.6,
  ) => {
    if (tracking) page.pushOperators(setCharacterSpacing(tracking));
    page.drawText(v, { x, y: Y(t), size, font, color: colour });
    if (tracking) page.pushOperators(setCharacterSpacing(0));
  };

  /** Width including tracking — the trailing gap after the last glyph is dropped. */
  const widthOf = (v: string, size: number, font: typeof regular, tracking: number) =>
    font.widthOfTextAtSize(v, size) + Math.max(v.length - 1, 0) * tracking;

  const drawRight = (
    v: string,
    edge: number,
    t: number,
    size: number,
    font = regular,
    colour = INK,
    tracking = 0.6,
  ) => draw(v, edge - widthOf(v, size, font, tracking), t, size, font, colour, tracking);

  const rule = (x1: number, x2: number, t: number, thickness = 1) =>
    page.drawLine({ start: { x: x1, y: Y(t) }, end: { x: x2, y: Y(t) }, thickness, color: BLACK });

  /**
   * Artwork sits on every page, so a spill-over page is not a bare sheet.
   *
   * The source file is 630x876pt — A4 plus Canva's bleed — and the crops carry
   * that bleed with them. Offsetting by BLEED puts the art where the trimmed
   * page would cut it, which is how the original prints.
   */
  const drawArtwork = () => {
    const tlH = (ART_TL_W * artTopLeft.height) / artTopLeft.width;
    page.drawImage(artTopLeft, {
      x: -BLEED,
      y: A4.height + BLEED - tlH,
      width: ART_TL_W,
      height: tlH,
    });
    const brH = (ART_BR_W * artBottomRight.height) / artBottomRight.width;
    page.drawImage(artBottomRight, {
      x: A4.width + BLEED - ART_BR_W,
      y: -BLEED,
      width: ART_BR_W,
      height: brH,
    });
  };

  const drawTableHead = (t: number) => {
    const h = 35;
    page.drawRectangle({ x: RULE_LEFT, y: Y(t + h), width: RULE_RIGHT - RULE_LEFT, height: h, color: BLACK });
    // The navy block that overhangs the right end of the bar in the original.
    page.drawRectangle({ x: RULE_RIGHT, y: Y(t + h), width: 16, height: h, color: NAVY });
    draw('DESCRIPTION', TEXT_LEFT, t + 23, 12, bold, WHITE, 1.8);
    drawRight('AMOUNT', AMOUNT_RIGHT, t + 23, 12, bold, WHITE, 1.8);
    return t + h + 19;
  };

  drawArtwork();

  // ---------------------------------------------------------------- logo
  if (logoBytes) {
    try {
      const img = isPng(logoBytes) ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes);
      const box = 68;
      const scale = Math.min(box / img.width, box / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: RULE_RIGHT + 16 - w, y: Y(36 + h), width: w, height: h });
    } catch (e) {
      // A logo that will not decode should never cost the user their document —
      // but it must say so, or it silently prints without one.
      console.error('[ledger] logo embed failed:', e instanceof Error ? e.message : e);
    }
  }

  // ---------------------------------------------------------------- header
  drawRight(business.name ?? 'Business', 530, 140, 25, bold, INK, 1.2);
  drawRight(kind === 'invoice' ? 'INVOICE' : 'Quotation', 530, 177, 20, bold, INK, 2.2);
  drawRight(`#${d.number}`, 530, 199, 17, regular, INK, 1.4);
  if (business.vat_number) drawRight(`VAT ${business.vat_number}`, 530, 217, 10, regular, INK, 0.8);

  // ---------------------------------------------------------------- parties
  draw('BILLED TO:', TEXT_LEFT, 269, 13.5, bold, INK, 1.6);
  draw(String(client.name ?? 'No client'), VALUE_LEFT, 269, 12.5, regular, INK, 0.7);
  draw('DATE:', TEXT_LEFT, 292, 13.5, bold, INK, 1.6);
  draw(formatDate(d.issue_date), VALUE_LEFT, 292, 12.5, regular, INK, 0.7);

  // The reference document carries BILLED TO and DATE only; the due date and the
  // quote expiry live in the app rather than on the printed sheet.
  let top = 323;

  // ---------------------------------------------------------------- line items
  top = drawTableHead(top);

  const breakPage = (resumeTable: boolean) => {
    page = pdf.addPage([A4.width, A4.height]);
    drawArtwork();
    top = resumeTable ? drawTableHead(90) : 110;
  };

  for (const item of items) {
    const rowHeight = item.detail ? 47 : 34;
    if (top + rowHeight > CONTENT_BOTTOM) breakPage(true);

    draw(item.description, ITEM_LEFT, top, 12.5, regular, INK, 0.7);
    const qty = Number(item.qty);
    draw(
      `Qty.  ${Number.isInteger(qty) ? String(qty).padStart(2, '0') : qty}`,
      QTY_LEFT,
      top,
      12.5,
      regular,
      INK,
      0.7,
    );
    drawRight(money(item.amount_minor), AMOUNT_RIGHT, top, 12.5, regular, INK, 0.7);
    if (item.detail) {
      top += 14;
      draw(item.detail, ITEM_LEFT, top, 9.5, regular, INK, 0.5);
    }
    top += 10;
    rule(RULE_LEFT, RULE_RIGHT, top);
    top += 24;
  }

  rule(RULE_LEFT, RULE_RIGHT, top);

  // ---------------------------------------------------------------- totals
  // Pay-to and footer are measured up front: the three blocks travel together,
  // so the decision to break a page is made once, with the whole tail in hand.
  const payRows: [string, string][] = [];
  if (business.bank_name) payRows.push(['Bank', business.bank_name]);
  if (business.bank_account_name) payRows.push(['Account Name', business.bank_account_name]);
  if (business.bank_account_number) payRows.push(['Account Number', business.bank_account_number]);
  if (business.bank_branch) payRows.push(['Branch', business.bank_branch]);
  if (!payRows.length && business.iban) payRows.push(['IBAN', business.iban]);
  if (business.pay_link && d.attach_payment_link !== false) payRows.push(['Pay online', business.pay_link]);
  const pay = payRows.slice(0, 5);

  const footerLines = [
    ...(business.footer_contact
      ? String(business.footer_contact).split('\n')
      : business.address
        ? String(business.address).split('\n')
        : []),
    ...(d.notes ? [String(d.notes)] : []),
  ].slice(0, 3);

  const taxRow = Number(d.tax_minor) > 0;

  /** Leading above each block: the reference spacing, and a tighter fallback. */
  const SPACIOUS = { totals: 46, pay: 31, footer: 34 };
  const TIGHT = { totals: 26, pay: 20, footer: 20 };

  const tailHeight = (g: typeof SPACIOUS) =>
    g.totals + 17 + (taxRow ? 22 : 0) + 9 + 23 + 22 + 9 + 24 +
    (pay.length ? g.pay + 22 + (pay.length - 1) * 22 : 0) +
    (footerLines.length ? g.footer + (footerLines.length - 1) * 16 : 0);

  let gap = SPACIOUS;
  if (top + tailHeight(gap) > PAGE_FLOOR) {
    gap = TIGHT;
    // Still short even tightened: the tail belongs on a page of its own.
    if (top + tailHeight(gap) > PAGE_FLOOR) breakPage(false);
    else if (top + tailHeight(SPACIOUS) <= PAGE_FLOOR) gap = SPACIOUS;
  }

  top += gap.totals;
  rule(TOTALS_RULE_LEFT, RULE_RIGHT, top, 2);

  top += 17;
  drawRight('Sub Total', TOTALS_LABEL_RIGHT, top, 12.5, regular, INK, 0.9);
  drawRight(money(d.subtotal_minor), AMOUNT_RIGHT, top, 12.5, regular, INK, 0.9);

  if (taxRow) {
    top += 22;
    drawRight(`Tax ${Number(d.tax_rate)}%`, TOTALS_LABEL_RIGHT, top, 12.5, regular, INK, 0.9);
    drawRight(money(d.tax_minor), AMOUNT_RIGHT, top, 12.5, regular, INK, 0.9);
  }

  top += 9;
  rule(TOTALS_RULE_LEFT, RULE_RIGHT, top, 2);

  top += 23;
  drawRight('advance', TOTALS_LABEL_RIGHT, top, 12.5, regular, INK, 0.9);
  drawRight(money(d.advance_minor ?? 0), AMOUNT_RIGHT, top, 12.5, regular, INK, 0.9);

  top += 22;
  drawRight('Discount', TOTALS_LABEL_RIGHT, top, 12.5, regular, INK, 0.9);
  drawRight(money(d.discount_minor ?? 0), AMOUNT_RIGHT, top, 12.5, regular, INK, 0.9);

  top += 9;
  rule(TOTALS_RULE_LEFT + 18, RULE_RIGHT, top, 1);

  // The figure actually owed, once the advance and discount come off.
  const due = Number(d.total_minor) - Number(d.advance_minor ?? 0) - Number(d.discount_minor ?? 0);
  top += 24;
  draw(kind === 'invoice' ? 'TOTAL DUE TODAY' : 'QUOTED TOTAL', 297, top, 14.5, bold, INK, 1.2);
  drawRight(money(Math.max(due, 0)), AMOUNT_RIGHT, top, 14.5, bold, INK, 1.2);

  // ---------------------------------------------------------------- pay to
  if (pay.length) {
    top += gap.pay;
    draw('PAY TO:', 85, top, 13.5, bold, INK, 1.6);
    pay.forEach(([label, value], i) => {
      draw(label, 85, top + 22 + i * 22, 11.5, regular, INK, 0.7);
      draw(String(value), 202, top + 22 + i * 22, 11.5, regular, INK, 0.7);
    });
    top += 22 + (pay.length - 1) * 22;
  }

  if (footerLines.length) {
    // Settle at the foot of the page when there is slack, else straight below.
    const lastLine = FOOTER_REST + (footerLines.length - 1) * 16;
    const footerTop = lastLine <= PAGE_FLOOR ? Math.max(top + gap.footer, FOOTER_REST) : top + gap.footer;
    footerLines.forEach((line, i) => draw(line, TEXT_LEFT, footerTop + i * 16, 11.5, regular, INK, 0.7));
  }

  return await pdf.save();
}

function isPng(b: Uint8Array): boolean {
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

/**
 * The reference document prints bare figures — no symbol, no trailing zeros —
 * so a round amount reads "1,500" and only a real fraction shows decimals.
 */
function money(minor: number): string {
  const n = Number(minor) / 100;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}
