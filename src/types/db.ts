/**
 * Hand-written mirror of supabase/migrations. Once you have a project linked you
 * can regenerate this with:
 *   npx supabase gen types typescript --linked > src/types/db.ts
 * Keep the domain aliases at the bottom either way — the screens import those.
 */

export type BusinessKind = 'retail' | 'design' | 'property' | 'services' | 'other';
export type ContactKind = 'client' | 'vendor';
export type AccountKind = 'bank' | 'card' | 'cash';
export type AccountStatus = 'live' | 'expired' | 'disconnected';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';
/** `overdue` is derived from due_date, never stored. */
export type InvoiceDisplayStatus = InvoiceStatus | 'overdue';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type ReceiptSource = 'scan' | 'email' | 'whatsapp' | 'photo' | 'upload';
export type ReceiptStatus = 'pending' | 'matched' | 'filed';
export type TxnStatus = 'pending' | 'confirmed' | 'dismissed';
export type AlertSeverity = 'critical' | 'positive' | 'warning' | 'info';
export type MemberRole = 'owner' | 'accountant';

type Timestamps = { created_at: string };

export interface Tables {
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    initials: string | null;
    base_currency: string;
    fy_start_month: number;
    invoice_numbering: 'per_business' | 'global';
    fx_mode: 'daily_auto' | 'manual';
    onboarded_at: string | null;
  } & Timestamps;

  businesses: {
    id: string;
    owner_id: string;
    name: string;
    short_name: string | null;
    kind: BusinessKind;
    currency: string;
    accent_index: number;
    tax_label: string | null;
    tax_rate: number;
    vat_number: string | null;
    address: string | null;
    pay_link: string | null;
    iban: string | null;
    is_default: boolean;
    logo_path: string | null;
    brand_color: string | null;
    bank_name: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_branch: string | null;
    footer_contact: string | null;
  } & Timestamps;

  business_members: {
    business_id: string;
    user_id: string;
    role: MemberRole;
    invited_at: string;
  };

  categories: {
    id: string;
    owner_id: string;
    business_id: string | null;
    name: string;
    position: number;
  };

  contacts: {
    id: string;
    owner_id: string;
    business_id: string | null;
    kind: ContactKind;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    currency: string | null;
  } & Timestamps;

  accounts: {
    id: string;
    owner_id: string;
    business_id: string | null;
    name: string;
    institution: string | null;
    mask: string | null;
    badge: string | null;
    kind: AccountKind;
    currency: string;
    balance_minor: number;
    status: AccountStatus;
    auto_categorise: boolean;
    last_synced_at: string | null;
  } & Timestamps;

  fx_rates: { base: string; quote: string; rate: number; as_of: string };

  receipts: {
    id: string;
    owner_id: string;
    business_id: string | null;
    storage_path: string | null;
    source: ReceiptSource;
    merchant: string | null;
    amount_minor: number | null;
    currency: string | null;
    tax_minor: number | null;
    doc_number: string | null;
    status: ReceiptStatus;
    note: string | null;
    captured_at: string;
  };

  expenses: {
    id: string;
    owner_id: string;
    business_id: string;
    category_id: string | null;
    vendor_id: string | null;
    account_id: string | null;
    receipt_id: string | null;
    amount_minor: number;
    currency: string;
    fx_rate: number;
    base_minor: number;
    tax_minor: number;
    tax_recoverable: boolean;
    spent_on: string;
    memo: string | null;
    is_recurring: boolean;
    recurrence: string | null;
  } & Timestamps;

  income_sources: {
    id: string;
    owner_id: string;
    business_id: string | null;
    name: string;
    position: number;
  };

  income: {
    id: string;
    owner_id: string;
    business_id: string;
    client_id: string | null;
    invoice_id: string | null;
    amount_minor: number;
    currency: string;
    fx_rate: number;
    base_minor: number;
    tax_minor: number;
    received_on: string;
    memo: string | null;
    source_id: string | null;
  } & Timestamps;

  invoices: {
    id: string;
    owner_id: string;
    business_id: string;
    client_id: string | null;
    number: string;
    currency: string;
    fx_rate: number;
    status: InvoiceStatus;
    issue_date: string;
    due_date: string;
    terms_days: number;
    subtotal_minor: number;
    tax_rate: number;
    tax_minor: number;
    total_minor: number;
    base_total_minor: number;
    attach_payment_link: boolean;
    is_recurring: boolean;
    recurrence: string | null;
    notes: string | null;
    pdf_path: string | null;
    sent_at: string | null;
    paid_at: string | null;
    discount_minor: number;
    advance_minor: number;
  } & Timestamps;

  invoice_items: {
    id: string;
    invoice_id: string;
    owner_id: string;
    description: string;
    detail: string | null;
    qty: number;
    unit_minor: number;
    amount_minor: number;
    position: number;
  };

  quotations: {
    id: string;
    owner_id: string;
    business_id: string;
    client_id: string | null;
    number: string;
    currency: string;
    status: QuoteStatus;
    issue_date: string;
    valid_until: string;
    valid_days: number;
    subtotal_minor: number;
    tax_rate: number;
    tax_minor: number;
    total_minor: number;
    summary: string | null;
    allow_online_accept: boolean;
    auto_bill: boolean;
    converted_invoice_id: string | null;
    sent_at: string | null;
    accepted_at: string | null;
    discount_minor: number;
    advance_minor: number;
    pdf_path: string | null;
  } & Timestamps;

  quotation_items: {
    id: string;
    quotation_id: string;
    owner_id: string;
    description: string;
    detail: string | null;
    qty: number;
    unit_minor: number;
    amount_minor: number;
    position: number;
  };

  bank_transactions: {
    id: string;
    owner_id: string;
    account_id: string;
    business_id: string | null;
    category_id: string | null;
    matched_invoice_id: string | null;
    description: string;
    amount_minor: number;
    currency: string;
    posted_on: string;
    status: TxnStatus;
    expense_id: string | null;
  } & Timestamps;

  notifications: {
    id: string;
    owner_id: string;
    severity: AlertSeverity;
    title: string;
    body: string | null;
    entity_type: string | null;
    entity_id: string | null;
    needs_action: boolean;
    read_at: string | null;
  } & Timestamps;

  exports: {
    id: string;
    owner_id: string;
    filename: string;
    kind: 'pdf' | 'csv';
    storage_path: string | null;
  } & Timestamps;
}

/** invoices_view = invoices + the two derived columns. */
export type InvoiceView = Tables['invoices'] & {
  display_status: InvoiceDisplayStatus;
  days_overdue: number;
};

// ------------------------------------------------------------------ RPC shapes

export type HomeSummary = {
  period?: PLPeriod;
  /** Inclusive start and exclusive end of the period, as ISO dates. */
  from?: string;
  to?: string;
  month: string;
  revenue_minor: number;
  expense_minor: number;
  net_minor: number;
  prev_net_minor: number;
  receivable_minor: number;
  overdue: { count: number; total_minor: number; names: string[] };
  businesses: HomeBusiness[];
};

export type HomeBusiness = {
  id: string;
  name: string;
  short_name: string;
  kind: BusinessKind;
  currency: string;
  accent_index: number;
  revenue_minor: number;
  expense_minor: number;
  net_minor: number;
  net_native_minor: number;
  expense_count: number;
};

export type PLPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export type PLSummary = {
  business_id: string;
  period: PLPeriod;
  /** Inclusive start and exclusive end of the period, as ISO dates. */
  from: string;
  to: string;
  month: string;
  revenue_minor: number;
  expense_minor: number;
  net_minor: number;
  tax_collected_minor: number;
  tax_recoverable_minor: number;
  tax_payable_minor: number;
  cash_hand_minor: number;
  cash_bank_minor: number;
  categories: { name: string; total_minor: number }[];
  /** Revenue split by income source, the mirror of `categories`. */
  sources: { name: string; total_minor: number }[];
};

export type TaxSummary = {
  from: string;
  to: string;
  collected_minor: number;
  recoverable_minor: number;
  payable_minor: number;
  business_count: number;
};

export type NetTrendRow = { business_id: string; month: string; net_minor: number };

// ------------------------------------------------------- supabase-js generic

type Row<T extends keyof Tables> = Tables[T];
type Insert<T extends keyof Tables> = Partial<Tables[T]>;

export type Database = {
  public: {
    Tables: { [K in keyof Tables]: { Row: Row<K>; Insert: Insert<K>; Update: Insert<K>; Relationships: [] } };
    Views: { invoices_view: { Row: InvoiceView; Relationships: [] } };
    Functions: {
      home_summary: {
        Args: { p_month?: string; p_period?: PLPeriod };
        Returns: HomeSummary;
      };
      pl_summary: {
        Args: { p_business_id: string; p_month?: string; p_period?: PLPeriod };
        Returns: PLSummary;
      };
      tax_summary: { Args: { p_as_of?: string }; Returns: TaxSummary };
      net_trend: {
        Args: { p_business_id?: string | null; p_months?: number; p_to?: string };
        Returns: NetTrendRow[];
      };
      next_document_number: { Args: { p_business_id: string; p_kind?: string }; Returns: string };
      recent_vendor_amounts: {
        Args: { p_vendor_id: string; p_limit?: number };
        Returns: { amount_minor: number; currency: string; spent_on: string }[];
      };
    };
    Enums: {
      business_kind: BusinessKind;
      contact_kind: ContactKind;
      account_kind: AccountKind;
      account_status: AccountStatus;
      invoice_status: InvoiceStatus;
      quote_status: QuoteStatus;
      receipt_source: ReceiptSource;
      receipt_status: ReceiptStatus;
      txn_status: TxnStatus;
      alert_severity: AlertSeverity;
      member_role: MemberRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ------------------------------------------------------------ domain aliases

export type Business = Tables['businesses'];
export type Category = Tables['categories'];
export type IncomeSource = Tables['income_sources'];
export type Income = Tables['income'];
export type Contact = Tables['contacts'];
export type Account = Tables['accounts'];
export type Expense = Tables['expenses'];
export type Invoice = Tables['invoices'];
export type InvoiceItem = Tables['invoice_items'];
export type Quotation = Tables['quotations'];
export type QuotationItem = Tables['quotation_items'];
export type Receipt = Tables['receipts'];
export type BankTransaction = Tables['bank_transactions'];
export type AppNotification = Tables['notifications'];
export type Profile = Tables['profiles'];
export type ExportRecord = Tables['exports'];
