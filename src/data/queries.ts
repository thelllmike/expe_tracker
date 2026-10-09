import { useQueries, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toISODate, startOfMonth } from '@/lib/format';
import { qk } from './keys';
import type {
  Account,
  AdminUser,
  AppNotification,
  BankTransaction,
  Business,
  Category,
  Contact,
  ContactKind,
  Expense,
  ExportRecord,
  HomeSummary,
  Income,
  IncomeSource,
  InvoiceItem,
  InvoiceView,
  NetTrendRow,
  PLPeriod,
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

export function useIncomeSources() {
  return useQuery({
    queryKey: qk.incomeSources,
    queryFn: async (): Promise<IncomeSource[]> =>
      unwrap(await supabase.from('income_sources').select('*').order('position')),
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

export function useHomeSummary(month = thisMonth(), period: PLPeriod = 'month') {
  return useQuery({
    queryKey: qk.homeSummary(`${month}:${period}`),
    queryFn: async (): Promise<HomeSummary> =>
      unwrap(
        await supabase.rpc('home_summary', { p_month: month, p_period: period }),
      ) as HomeSummary,
  });
}

/**
 * `anchor` is any date inside the period; the function truncates it. Passing
 * today with 'week' therefore returns the week that contains today.
 */
export function usePLSummary(
  businessId: string | undefined,
  anchor = thisMonth(),
  period: PLPeriod = 'month',
) {
  return useQuery({
    queryKey: qk.plSummary(businessId ?? '', anchor, period),
    enabled: Boolean(businessId),
    queryFn: async (): Promise<PLSummary> =>
      unwrap(
        await supabase.rpc('pl_summary', {
          p_business_id: businessId!,
          p_month: anchor,
          p_period: period,
        }),
      ) as PLSummary,
  });
}

/**
 * The same figures for several businesses at once, for the consolidated view.
 * There is no server-side rollup: with a handful of businesses, one RPC each is
 * cheaper than another migration, and each result stays individually cached.
 */
export function usePLSummaries(
  businessIds: string[],
  anchor = thisMonth(),
  period: PLPeriod = 'month',
) {
  return useQueries({
    queries: businessIds.map((id) => ({
      queryKey: qk.plSummary(id, anchor, period),
      queryFn: async (): Promise<PLSummary> =>
        unwrap(
          await supabase.rpc('pl_summary', {
            p_business_id: id,
            p_month: anchor,
            p_period: period,
          }),
        ) as PLSummary,
    })),
  });
}

/** Adds up per-business summaries into one, merging the two breakdowns by name. */
export function combinePLSummaries(parts: PLSummary[]): PLSummary | null {
  if (!parts.length) return null;

  const merge = (lists: { name: string; total_minor: number }[][]) => {
    const totals = new Map<string, number>();
    for (const list of lists) {
      for (const row of list ?? []) {
        totals.set(row.name, (totals.get(row.name) ?? 0) + row.total_minor);
      }
    }
    return [...totals.entries()]
      .map(([name, total_minor]) => ({ name, total_minor }))
      .sort((a, b) => b.total_minor - a.total_minor);
  };

  const sum = (pick: (p: PLSummary) => number) => parts.reduce((t, p) => t + (pick(p) || 0), 0);

  return {
    ...parts[0],
    business_id: 'all',
    revenue_minor: sum((p) => p.revenue_minor),
    expense_minor: sum((p) => p.expense_minor),
    net_minor: sum((p) => p.net_minor),
    tax_collected_minor: sum((p) => p.tax_collected_minor),
    tax_recoverable_minor: sum((p) => p.tax_recoverable_minor),
    tax_payable_minor: sum((p) => p.tax_payable_minor),
    cash_hand_minor: sum((p) => p.cash_hand_minor),
    cash_bank_minor: sum((p) => p.cash_bank_minor),
    categories: merge(parts.map((p) => p.categories)),
    sources: merge(parts.map((p) => p.sources)),
  };
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

// -------------------------------------------------------------------- income

export type IncomeFilters = {
  businessId?: string | null;
  sourceId?: string | null;
  month?: string;
};

export type IncomeRow = Income & {
  business: Pick<Business, 'id' | 'name' | 'short_name' | 'accent_index'> | null;
  source: Pick<IncomeSource, 'id' | 'name'> | null;
  client: Pick<Contact, 'id' | 'name'> | null;
};

/** The revenue-side twin of useExpenses, over the same month window. */
export function useIncome(filters: IncomeFilters = {}) {
  const month = filters.month ?? thisMonth();
  return useQuery({
    queryKey: qk.income({ ...filters, month }),
    queryFn: async (): Promise<IncomeRow[]> => {
      const from = new Date(month);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);

      let q = supabase
        .from('income')
        .select(
          '*, business:businesses(id,name,short_name,accent_index),' +
            ' source:income_sources(id,name), client:contacts(id,name)',
        )
        .gte('received_on', month)
        .lt('received_on', toISODate(to))
        .order('received_on', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.businessId) q = q.eq('business_id', filters.businessId);
      if (filters.sourceId) q = q.eq('source_id', filters.sourceId);

      return unwrap(await q) as unknown as IncomeRow[];
    },
  });
}

/** One expense, for the edit screen. */
export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: qk.expense(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<Expense> =>
      unwrap(await supabase.from('expenses').select('*').eq('id', id!).single()) as Expense,
  });
}

/** One income entry, for the edit screen. */
export function useIncomeEntry(id: string | undefined) {
  return useQuery({
    queryKey: qk.incomeEntry(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<Income> =>
      unwrap(await supabase.from('income').select('*').eq('id', id!).single()) as Income,
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

// ---------------------------------------------------------------------- admin

/**
 * Whether the signed-in account is on the admin list. Keyed by user so one
 * account's answer is never shown to the next person to sign in on the device.
 */
export function useIsAdmin(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.isAdmin(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<boolean> => unwrap(await supabase.rpc('is_admin', {})) as boolean,
  });
}

/** Every account, newest first. The database refuses anyone who is not an admin. */
export function useAdminUsers() {
  return useQuery({
    queryKey: qk.adminUsers,
    queryFn: async (): Promise<AdminUser[]> =>
      unwrap(await supabase.rpc('admin_list_users', {})) as AdminUser[],
  });
}
