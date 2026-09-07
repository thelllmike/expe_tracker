import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toISODate, startOfMonth } from '@/lib/format';
import { qk } from './keys';
import type {
  Account,
  AppNotification,
  BankTransaction,
  Business,
  Category,
  Contact,
  ContactKind,
  Expense,
  ExportRecord,
  HomeSummary,
  InvoiceItem,
  InvoiceView,
  NetTrendRow,
  PLSummary,
  Profile,
  Quotation,
  QuotationItem,
  Receipt,
  TaxSummary,
} from '@/types/db';

/** Throws on a Supabase error so React Query surfaces it, otherwise returns data. */
function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export const thisMonth = () => toISODate(startOfMonth(new Date()));

// ------------------------------------------------------------------ reference

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useBusinesses() {
  return useQuery({
    queryKey: qk.businesses,
    queryFn: async (): Promise<Business[]> =>
      unwrap(
        await supabase
          .from('businesses')
          .select('*')
          .order('is_default', { ascending: false })
          .order('created_at'),
      ),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async (): Promise<Category[]> =>
      unwrap(await supabase.from('categories').select('*').order('position')),
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: async (): Promise<Account[]> =>
      unwrap(await supabase.from('accounts').select('*').order('created_at')),
  });
}

export function useContacts(kind?: ContactKind) {
  return useQuery({
    queryKey: qk.contacts(kind),
    queryFn: async (): Promise<Contact[]> => {
      let q = supabase.from('contacts').select('*').order('name');
      if (kind) q = q.eq('kind', kind);
      return unwrap(await q);
    },
  });
}

// ------------------------------------------------------------------ dashboards

export function useHomeSummary(month = thisMonth()) {
  return useQuery({
    queryKey: qk.homeSummary(month),
    queryFn: async (): Promise<HomeSummary> =>
      unwrap(await supabase.rpc('home_summary', { p_month: month })) as HomeSummary,
  });
}

export function usePLSummary(businessId: string | undefined, month = thisMonth()) {
  return useQuery({
    queryKey: qk.plSummary(businessId ?? '', month),
    enabled: Boolean(businessId),
    queryFn: async (): Promise<PLSummary> =>
      unwrap(
        await supabase.rpc('pl_summary', { p_business_id: businessId!, p_month: month }),
      ) as PLSummary,
  });
}

export function useTaxSummary() {
  return useQuery({
    queryKey: qk.taxSummary,
    queryFn: async (): Promise<TaxSummary> =>
      unwrap(await supabase.rpc('tax_summary', {})) as TaxSummary,
  });
}

export function useNetTrend(businessId: string | null = null, months = 6) {
  return useQuery({
    queryKey: qk.netTrend(businessId, months),
    queryFn: async (): Promise<NetTrendRow[]> =>
      unwrap(
        await supabase.rpc('net_trend', { p_business_id: businessId, p_months: months }),
      ) as NetTrendRow[],
  });
}

// ------------------------------------------------------------------ expenses

export type ExpenseFilters = {
  businessId?: string | null;
  categoryId?: string | null;
  month?: string;
  /** Only expenses whose tax is recoverable. */
  taxOnly?: boolean;
};

export type ExpenseRow = Expense & {
  business: Pick<Business, 'id' | 'name' | 'short_name' | 'accent_index'> | null;
  category: Pick<Category, 'id' | 'name'> | null;
  vendor: Pick<Contact, 'id' | 'name'> | null;
};

export function useExpenses(filters: ExpenseFilters = {}) {
  const month = filters.month ?? thisMonth();
  return useQuery({
    queryKey: qk.expenses({ ...filters, month }),
    queryFn: async (): Promise<ExpenseRow[]> => {
      const from = new Date(month);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);

      let q = supabase
        .from('expenses')
        .select(
          '*, business:businesses(id,name,short_name,accent_index),' +
            ' category:categories(id,name), vendor:contacts(id,name)',
        )
        .gte('spent_on', month)
        .lt('spent_on', toISODate(to))
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.businessId) q = q.eq('business_id', filters.businessId);
      if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
      if (filters.taxOnly) q = q.eq('tax_recoverable', true);

      return unwrap(await q) as unknown as ExpenseRow[];
    },
  });
}

/** "Last 3 at Riverbend: $1,240 · $1,180 · $1,240" */
export function useVendorHistory(vendorId: string | null | undefined) {
  return useQuery({
    queryKey: qk.vendorHistory(vendorId ?? ''),
    enabled: Boolean(vendorId),
    queryFn: async () =>
      unwrap(
        await supabase.rpc('recent_vendor_amounts', { p_vendor_id: vendorId!, p_limit: 3 }),
      ) as { amount_minor: number; currency: string; spent_on: string }[],
  });
}

// ------------------------------------------------------------------ invoices

export type InvoiceRow = InvoiceView & {
  business: Pick<Business, 'id' | 'name' | 'accent_index'> | null;
  client: Pick<Contact, 'id' | 'name' | 'email' | 'address'> | null;
};

export function useInvoices() {
  return useQuery({
    queryKey: qk.invoices,
    queryFn: async (): Promise<InvoiceRow[]> =>
      unwrap(
        await supabase
          .from('invoices_view')
          .select('*, business:businesses(id,name,accent_index), client:contacts(id,name,email,address)')
          .order('due_date', { ascending: true }),
      ) as unknown as InvoiceRow[],
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: qk.invoice(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<{ invoice: InvoiceRow; items: InvoiceItem[] }> => {
      const invoice = unwrap(
        await supabase
          .from('invoices_view')
          .select(
            '*, business:businesses(*), client:contacts(id,name,email,address)',
          )
          .eq('id', id!)
          .single(),
      ) as unknown as InvoiceRow;

      const items = unwrap(
        await supabase.from('invoice_items').select('*').eq('invoice_id', id!).order('position'),
      ) as InvoiceItem[];

      return { invoice, items };
    },
  });
}

// ------------------------------------------------------------------ quotations

export type QuotationRow = Quotation & {
  business: Pick<Business, 'id' | 'name' | 'accent_index'> | null;
  client: Pick<Contact, 'id' | 'name'> | null;
};

export function useQuotations() {
  return useQuery({
    queryKey: qk.quotations,
    queryFn: async (): Promise<QuotationRow[]> =>
      unwrap(
        await supabase
          .from('quotations')
          .select('*, business:businesses(id,name,accent_index), client:contacts(id,name)')
          .order('created_at', { ascending: false }),
      ) as unknown as QuotationRow[],
  });
}

export function useQuotation(id: string | undefined) {
  return useQuery({
    queryKey: qk.quotation(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<{ quotation: QuotationRow; items: QuotationItem[] }> => {
      const quotation = unwrap(
        await supabase
          .from('quotations')
          .select('*, business:businesses(*), client:contacts(id,name,email,address)')
          .eq('id', id!)
          .single(),
      ) as unknown as QuotationRow;

      const items = unwrap(
        await supabase.from('quotation_items').select('*').eq('quotation_id', id!).order('position'),
      ) as QuotationItem[];

      return { quotation, items };
    },
  });
}

// ------------------------------------------------------------------ ops screens

export function useReceipts() {
  return useQuery({
    queryKey: qk.receipts,
    queryFn: async (): Promise<Receipt[]> =>
      unwrap(
        await supabase
          .from('receipts')
          .select('*')
          .neq('status', 'filed')
          .order('captured_at', { ascending: false }),
      ),
  });
}

export type BankTransactionRow = BankTransaction & {
  account: Pick<Account, 'id' | 'name' | 'badge' | 'currency'> | null;
  business: Pick<Business, 'id' | 'name' | 'accent_index'> | null;
  category: Pick<Category, 'id' | 'name'> | null;
  matched_invoice: { id: string; number: string } | null;
};

export function useBankTransactions() {
  return useQuery({
    queryKey: qk.bankTransactions,
    queryFn: async (): Promise<BankTransactionRow[]> =>
      unwrap(
        await supabase
          .from('bank_transactions')
          .select(
            '*, account:accounts(id,name,badge,currency), business:businesses(id,name,accent_index),' +
              ' category:categories(id,name), matched_invoice:invoices(id,number)',
          )
          .eq('status', 'pending')
          .order('posted_on', { ascending: false }),
      ) as unknown as BankTransactionRow[],
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: async (): Promise<AppNotification[]> =>
      unwrap(
        await supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      ),
  });
}

export function useExports() {
  return useQuery({
    queryKey: qk.exports,
    queryFn: async (): Promise<ExportRecord[]> =>
      unwrap(
        await supabase
          .from('exports')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
      ),
  });
}

// ------------------------------------------------------------------ documents

/** Latest rate from one currency into another; 1 when they match. */
export function useFxRate(from: string, to: string) {
  return useQuery({
    queryKey: ['fx-rate', from, to],
    enabled: Boolean(from && to),
    queryFn: async (): Promise<number> => {
      if (from === to) return 1;
      const { data, error } = await supabase
        .from('fx_rates')
        .select('rate')
        .eq('base', from)
        .eq('quote', to)
        .order('as_of', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      // No rate on file is not an error — fall back to parity and let the user
      // see the unconverted figure rather than blocking the invoice.
      return data?.rate ?? 1;
    },
  });
}

/** Next INV-/QT- number for a business. */
export function useNextDocumentNumber(
  businessId: string | null | undefined,
  kind: 'invoice' | 'quotation',
) {
  return useQuery({
    queryKey: ['next-number', businessId ?? '', kind],
    enabled: Boolean(businessId),
    // The number is only reserved on save, so don't hold a stale one in cache.
    staleTime: 0,
    queryFn: async (): Promise<string> =>
      unwrap(
        await supabase.rpc('next_document_number', {
          p_business_id: businessId!,
          p_kind: kind,
        }),
      ) as string,
  });
}
