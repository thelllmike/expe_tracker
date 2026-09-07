import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from './keys';
import { toISODate } from '@/lib/format';
import type {
  AccountKind,
  BusinessKind,
  ContactKind,
  InvoiceStatus,
  QuoteStatus,
} from '@/types/db';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Not signed in.');
  return data.user.id;
}

function check({ error }: { error: { message: string } | null }) {
  if (error) throw new Error(error.message);
}

/** Anything that changes money invalidates the dashboards as well as the list. */
function useLedgerInvalidation() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['home-summary'] });
    void qc.invalidateQueries({ queryKey: ['pl-summary'] });
    void qc.invalidateQueries({ queryKey: ['net-trend'] });
    void qc.invalidateQueries({ queryKey: qk.taxSummary });
  };
}

// ------------------------------------------------------------------ expenses

export type NewExpense = {
  businessId: string;
  amountMinor: number;
  currency: string;
  categoryId?: string | null;
  vendorId?: string | null;
  accountId?: string | null;
  receiptId?: string | null;
  spentOn: Date;
  taxMinor?: number;
  taxRecoverable?: boolean;
  memo?: string | null;
  isRecurring?: boolean;
  recurrence?: string | null;
  /** Rate from the expense currency into the profile's base currency. */
  fxRate?: number;
};

export function useCreateExpense() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async (input: NewExpense) => {
      const owner_id = await requireUserId();
      const fx = input.fxRate ?? 1;

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          owner_id,
          business_id: input.businessId,
          category_id: input.categoryId ?? null,
          vendor_id: input.vendorId ?? null,
          account_id: input.accountId ?? null,
          receipt_id: input.receiptId ?? null,
          amount_minor: input.amountMinor,
          currency: input.currency,
          fx_rate: fx,
          base_minor: Math.round(input.amountMinor * fx),
          tax_minor: input.taxMinor ?? 0,
          tax_recoverable: input.taxRecoverable ?? false,
          spent_on: toISODate(input.spentOn),
          memo: input.memo ?? null,
          is_recurring: input.isRecurring ?? false,
          recurrence: input.recurrence ?? null,
        })
        .select()
        .single();
      check({ error });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: qk.receipts });
      invalidateLedger();
    },
  });
}

// ------------------------------------------------------------------ invoices

export type InvoiceDraft = {
  id?: string;
  businessId: string;
  clientId: string | null;
  number: string;
  currency: string;
  fxRate: number;
  issueDate: Date;
  dueDate: Date;
  termsDays: number;
  taxRate: number;
  attachPaymentLink: boolean;
  isRecurring: boolean;
  items: { description: string; detail?: string | null; qty: number; unitMinor: number }[];
};

/** Subtotal / tax / total, derived once so the form and the row always agree. */
export function invoiceTotals(
  items: { qty: number; unitMinor: number }[],
  taxRate: number,
  fxRate: number,
) {
  const subtotal = items.reduce((sum, i) => sum + Math.round(i.qty * i.unitMinor), 0);
  const tax = Math.round((subtotal * taxRate) / 100);
  const total = subtotal + tax;
  return { subtotal, tax, total, baseTotal: Math.round(total * fxRate) };
}

export function useSaveInvoice() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async ({ draft, status }: { draft: InvoiceDraft; status: InvoiceStatus }) => {
      const owner_id = await requireUserId();
      const totals = invoiceTotals(draft.items, draft.taxRate, draft.fxRate);

      const payload = {
        owner_id,
        business_id: draft.businessId,
        client_id: draft.clientId,
        number: draft.number,
        currency: draft.currency,
        fx_rate: draft.fxRate,
        status,
        issue_date: toISODate(draft.issueDate),
        due_date: toISODate(draft.dueDate),
        terms_days: draft.termsDays,
        subtotal_minor: totals.subtotal,
        tax_rate: draft.taxRate,
        tax_minor: totals.tax,
        total_minor: totals.total,
        base_total_minor: totals.baseTotal,
        attach_payment_link: draft.attachPaymentLink,
        is_recurring: draft.isRecurring,
        recurrence: draft.isRecurring ? 'monthly' : null,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      };

      const { data, error } = draft.id
        ? await supabase.from('invoices').update(payload).eq('id', draft.id).select().single()
        : await supabase.from('invoices').insert(payload).select().single();
      check({ error });

      const invoiceId = (data as { id: string }).id;

      // Line items are replaced wholesale — simpler than diffing, and the lists
      // are short enough that the extra write costs nothing.
      check(await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId));
      if (draft.items.length) {
        check(
          await supabase.from('invoice_items').insert(
            draft.items.map((item, position) => ({
              invoice_id: invoiceId,
              owner_id,
              description: item.description,
              detail: item.detail ?? null,
              qty: item.qty,
              unit_minor: item.unitMinor,
              amount_minor: Math.round(item.qty * item.unitMinor),
              position,
            })),
          ),
        );
      }

      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: qk.invoices });
      if (data && 'id' in data) void qc.invalidateQueries({ queryKey: qk.invoice(data.id as string) });
      invalidateLedger();
    },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const owner_id = await requireUserId();

      const { data: invoice, error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .select()
        .single();
      check({ error });
      if (!invoice) return null;

      // A paid invoice is revenue — record it so P&L and the home hero move.
      check(
        await supabase.from('income').insert({
          owner_id,
          business_id: invoice.business_id,
          client_id: invoice.client_id,
          invoice_id: invoice.id,
          amount_minor: invoice.total_minor,
          currency: invoice.currency,
          fx_rate: invoice.fx_rate,
          base_minor: invoice.base_total_minor,
          tax_minor: invoice.tax_minor,
          received_on: toISODate(new Date()),
          memo: invoice.number,
        }),
      );
      return invoice;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.invoices });
      invalidateLedger();
    },
  });
}

// ------------------------------------------------------------------ quotations

export type QuotationDraft = {
  id?: string;
  businessId: string;
  clientId: string | null;
  number: string;
  currency: string;
  validUntil: Date;
  validDays: number;
  taxRate: number;
  summary?: string | null;
  allowOnlineAccept: boolean;
  autoBill: boolean;
  items: { description: string; detail?: string | null; qty: number; unitMinor: number }[];
};

export function useSaveQuotation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ draft, status }: { draft: QuotationDraft; status: QuoteStatus }) => {
      const owner_id = await requireUserId();
      const totals = invoiceTotals(draft.items, draft.taxRate, 1);

      const payload = {
        owner_id,
        business_id: draft.businessId,
        client_id: draft.clientId,
        number: draft.number,
        currency: draft.currency,
        status,
        issue_date: toISODate(new Date()),
        valid_until: toISODate(draft.validUntil),
        valid_days: draft.validDays,
        subtotal_minor: totals.subtotal,
        tax_rate: draft.taxRate,
        tax_minor: totals.tax,
        total_minor: totals.total,
        summary: draft.summary ?? null,
        allow_online_accept: draft.allowOnlineAccept,
        auto_bill: draft.autoBill,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      };

      const { data, error } = draft.id
        ? await supabase.from('quotations').update(payload).eq('id', draft.id).select().single()
        : await supabase.from('quotations').insert(payload).select().single();
      check({ error });

      const quotationId = (data as { id: string }).id;
      check(await supabase.from('quotation_items').delete().eq('quotation_id', quotationId));
      if (draft.items.length) {
        check(
          await supabase.from('quotation_items').insert(
            draft.items.map((item, position) => ({
              quotation_id: quotationId,
              owner_id,
              description: item.description,
              detail: item.detail ?? null,
              qty: item.qty,
              unit_minor: item.unitMinor,
              amount_minor: Math.round(item.qty * item.unitMinor),
              position,
            })),
          ),
        );
      }
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.quotations }),
  });
}

/** "Convert to invoice" on an accepted quote: copies the header and every line. */
export function useConvertQuotation() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async (quotationId: string) => {
      const owner_id = await requireUserId();

      const quotation = (
        await supabase.from('quotations').select('*').eq('id', quotationId).single()
      ).data;
      if (!quotation) throw new Error('Quotation not found.');

      const items =
        (await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId).order('position'))
          .data ?? [];

      const number = (
        await supabase.rpc('next_document_number', {
          p_business_id: quotation.business_id,
          p_kind: 'invoice',
        })
      ).data as string;

      const due = new Date();
      due.setDate(due.getDate() + 14);

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          owner_id,
          business_id: quotation.business_id,
          client_id: quotation.client_id,
          number,
          currency: quotation.currency,
          fx_rate: 1,
          status: 'draft',
          issue_date: toISODate(new Date()),
          due_date: toISODate(due),
          terms_days: 14,
          subtotal_minor: quotation.subtotal_minor,
          tax_rate: quotation.tax_rate,
          tax_minor: quotation.tax_minor,
          total_minor: quotation.total_minor,
          base_total_minor: quotation.total_minor,
        })
        .select()
        .single();
      check({ error });

      if (items.length) {
        check(
          await supabase.from('invoice_items').insert(
            items.map((item) => ({
              invoice_id: invoice!.id,
              owner_id,
              description: item.description,
              detail: item.detail,
              qty: item.qty,
              unit_minor: item.unit_minor,
              amount_minor: item.amount_minor,
              position: item.position,
            })),
          ),
        );
      }

      check(
        await supabase
          .from('quotations')
          .update({ converted_invoice_id: invoice!.id })
          .eq('id', quotationId),
      );

      return invoice!;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.quotations });
      void qc.invalidateQueries({ queryKey: qk.invoices });
      invalidateLedger();
    },
  });
}

// ------------------------------------------------------------------ bank feed

/** "Confirm" on a pending line: turns it into a real expense and marks it done. */
export function useConfirmTransaction() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async (txnId: string) => {
      const owner_id = await requireUserId();
      const txn = (await supabase.from('bank_transactions').select('*').eq('id', txnId).single()).data;
      if (!txn) throw new Error('Transaction not found.');
      if (!txn.business_id) throw new Error('Pick a business for this transaction first.');

      // Money in is matched against an invoice, not booked as an expense.
      if (txn.amount_minor > 0) {
        if (txn.matched_invoice_id) {
          check(
            await supabase
              .from('invoices')
              .update({ status: 'paid', paid_at: new Date().toISOString() })
              .eq('id', txn.matched_invoice_id),
          );
        }
        check(
          await supabase.from('income').insert({
            owner_id,
            business_id: txn.business_id,
            invoice_id: txn.matched_invoice_id,
            amount_minor: txn.amount_minor,
            currency: txn.currency,
            fx_rate: 1,
            base_minor: txn.amount_minor,
            received_on: txn.posted_on,
            memo: txn.description,
          }),
        );
        check(
          await supabase.from('bank_transactions').update({ status: 'confirmed' }).eq('id', txnId),
        );
        return;
      }

      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
          owner_id,
          business_id: txn.business_id,
          category_id: txn.category_id,
          account_id: txn.account_id,
          amount_minor: Math.abs(txn.amount_minor),
          currency: txn.currency,
          fx_rate: 1,
          base_minor: Math.abs(txn.amount_minor),
          spent_on: txn.posted_on,
          memo: txn.description,
        })
        .select()
        .single();
      check({ error });

      check(
        await supabase
          .from('bank_transactions')
          .update({ status: 'confirmed', expense_id: expense!.id })
          .eq('id', txnId),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.bankTransactions });
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: qk.invoices });
      invalidateLedger();
    },
  });
}

export function useDismissTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txnId: string) => {
      check(await supabase.from('bank_transactions').update({ status: 'dismissed' }).eq('id', txnId));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.bankTransactions }),
  });
}

// ------------------------------------------------------------------ receipts

/** "File to Maple & Co": books the receipt as an expense and marks it filed. */
export function useFileReceipt() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async ({ receiptId, businessId }: { receiptId: string; businessId: string }) => {
      const owner_id = await requireUserId();
      const receipt = (await supabase.from('receipts').select('*').eq('id', receiptId).single()).data;
      if (!receipt) throw new Error('Receipt not found.');

      check(
        await supabase.from('expenses').insert({
          owner_id,
          business_id: businessId,
          receipt_id: receiptId,
          amount_minor: receipt.amount_minor ?? 0,
          currency: receipt.currency ?? 'USD',
          fx_rate: 1,
          base_minor: receipt.amount_minor ?? 0,
          tax_minor: receipt.tax_minor ?? 0,
          tax_recoverable: (receipt.tax_minor ?? 0) > 0,
          spent_on: receipt.captured_at.slice(0, 10),
          memo: receipt.merchant,
        }),
      );

      check(
        await supabase
          .from('receipts')
          .update({ status: 'filed', business_id: businessId })
          .eq('id', receiptId),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.receipts });
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      invalidateLedger();
    },
  });
}

// ------------------------------------------------------------------ misc

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      check(
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .is('read_at', null),
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}


// ------------------------------------------------------------------ businesses

export type BusinessDraft = {
  id?: string;
  name: string;
  shortName: string | null;
  kind: BusinessKind;
  currency: string;
  accentIndex: number;
  taxLabel: string | null;
  taxRate: number;
  vatNumber: string | null;
  isDefault: boolean;
  /** Create the starter category list alongside the first business. */
  seedCategories?: boolean;
};

/** The categories a new account starts with, so expense entry is usable at once. */
const STARTER_CATEGORIES = [
  'Cost of goods',
  'Payroll',
  'Rent',
  'Utilities',
  'Marketing',
  'Software',
  'Repairs',
  'Travel',
  'Professional fees',
  'Bank charges',
  'Other',
];

export function useSaveBusiness() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async (draft: BusinessDraft) => {
      const owner_id = await requireUserId();

      const payload = {
        owner_id,
        name: draft.name,
        short_name: draft.shortName,
        kind: draft.kind,
        currency: draft.currency,
        accent_index: draft.accentIndex,
        tax_label: draft.taxLabel,
        tax_rate: draft.taxRate,
        vat_number: draft.vatNumber,
        is_default: draft.isDefault,
      };

      const { data, error } = draft.id
        ? await supabase.from('businesses').update(payload).eq('id', draft.id).select().single()
        : await supabase.from('businesses').insert(payload).select().single();
      check({ error });

      // Only one business can be the default.
      if (draft.isDefault && data) {
        check(
          await supabase
            .from('businesses')
            .update({ is_default: false })
            .eq('owner_id', owner_id)
            .neq('id', data.id),
        );
      }

      if (draft.seedCategories) {
        const { data: existing } = await supabase.from('categories').select('id').limit(1);
        if (!existing?.length) {
          check(
            await supabase.from('categories').insert(
              STARTER_CATEGORIES.map((name, position) => ({ owner_id, name, position })),
            ),
          );
        }
      }

      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.businesses });
      void qc.invalidateQueries({ queryKey: qk.categories });
      invalidateLedger();
    },
  });
}

export function useDeleteBusiness() {
  const qc = useQueryClient();
  const invalidateLedger = useLedgerInvalidation();
  return useMutation({
    mutationFn: async (id: string) => {
      check(await supabase.from('businesses').delete().eq('id', id));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.businesses });
      invalidateLedger();
    },
  });
}

// ------------------------------------------------------------------ contacts

/** Inline "add new" from the vendor / client pickers. */
export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      kind: ContactKind;
      businessId?: string | null;
      email?: string | null;
      currency?: string | null;
    }) => {
      const owner_id = await requireUserId();
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          owner_id,
          name: input.name,
          kind: input.kind,
          business_id: input.businessId ?? null,
          email: input.email ?? null,
          currency: input.currency ?? null,
        })
        .select()
        .single();
      check({ error });
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

/** Inline "add new" from the paid-from picker and the accounts screen. */
export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      kind: AccountKind;
      currency: string;
      businessId?: string | null;
      mask?: string | null;
    }) => {
      const owner_id = await requireUserId();
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          owner_id,
          name: input.name,
          kind: input.kind,
          currency: input.currency,
          business_id: input.businessId ?? null,
          mask: input.mask ?? null,
          badge: input.name.slice(0, 2).toUpperCase(),
        })
        .select()
        .single();
      check({ error });
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.accounts }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const owner_id = await requireUserId();
      const { data, error } = await supabase
        .from('categories')
        .insert({ owner_id, name, position: 99 })
        .select()
        .single();
      check({ error });
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.categories }),
  });
}
