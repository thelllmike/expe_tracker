/** One place for cache keys so mutations can invalidate precisely. */
export const qk = {
  profile: ['profile'] as const,
  businesses: ['businesses'] as const,
  categories: ['categories'] as const,
  incomeSources: ['income-sources'] as const,
  accounts: ['accounts'] as const,
  contacts: (kind?: string) => ['contacts', kind ?? 'all'] as const,

  homeSummary: (month: string) => ['home-summary', month] as const,
  plSummary: (businessId: string, anchor: string, period: string) =>
    ['pl-summary', businessId, anchor, period] as const,
  taxSummary: ['tax-summary'] as const,
  netTrend: (businessId: string | null, months: number) =>
    ['net-trend', businessId ?? 'all', months] as const,

  expenses: (filters: unknown) => ['expenses', filters] as const,
  income: (filters: unknown) => ['income', filters] as const,
  expense: (id: string) => ['expense', id] as const,
  incomeEntry: (id: string) => ['income-entry', id] as const,
  vendorHistory: (vendorId: string) => ['vendor-history', vendorId] as const,

  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoice', id] as const,
  quotations: ['quotations'] as const,
  quotation: (id: string) => ['quotation', id] as const,

  receipts: ['receipts'] as const,
  bankTransactions: ['bank-transactions'] as const,
  notifications: ['notifications'] as const,
  exports: ['exports'] as const,
} as const;
