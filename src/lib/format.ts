/**
 * Money is held in minor units everywhere (cents), so every display path goes
 * through here. The design writes whole amounts without decimals ("$13,400")
 * and only shows cents where the source has them ("$24.60", "€4,998.00").
 */

import { currency } from './currencies';

export function currencySymbol(code: string): string {
  return currency(code)?.symbol ?? `${code} `;
}

type MoneyOptions = {
  /**
   * Show cents. Off by default: the design writes whole amounts in every list,
   * total and headline, and only spells out cents on receipts and the invoice
   * document, which opt in explicitly.
   */
  decimals?: boolean;
  /** Prefix a '+' on positive values, as the bank feed does for money in. */
  signed?: boolean;
  /** Drop the currency symbol (for table columns that label the unit once). */
  bare?: boolean;
};

export function formatMoney(
  minor: number | null | undefined,
  currency = 'USD',
  options: MoneyOptions = {},
): string {
  const value = (minor ?? 0) / 100;
  const showDecimals = options.decimals ?? false;

  const body = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  const symbol = options.bare ? '' : currencySymbol(currency);
  const negative = value < 0;
  const sign = negative ? '-' : options.signed ? '+' : '';

  return `${sign}${symbol}${body}`;
}

/** "37.9%" — the design uses one decimal place for every margin. */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Margin as net / revenue, guarding the zero-revenue month. */
export function margin(netMinor: number, revenueMinor: number): number | null {
  if (!revenueMinor) return null;
  return netMinor / revenueMinor;
}

/** Percent change between two periods, e.g. the "+5.4%" on the home hero. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / Math.abs(previous);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "September 2026" */
export function formatMonthYear(date: Date | string): string {
  const d = toDate(date);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "September" */
export function formatMonth(date: Date | string): string {
  return MONTHS[toDate(date).getMonth()];
}

/** "SEP" — the bar-chart tick labels. */
export function formatMonthShort(date: Date | string): string {
  return MONTHS_SHORT[toDate(date).getMonth()];
}

/** "4 Sep" / "4 Sep 2026" */
export function formatDay(date: Date | string, withYear = false): string {
  const d = toDate(date);
  const month = MONTHS_SHORT[d.getMonth()];
  const cased = month.charAt(0) + month.slice(1).toLowerCase();
  return `${d.getDate()} ${cased}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

/** "Today, 4 Sep" / "Yesterday" / "2 Sep" — the add-expense date row. */
export function formatRelativeDay(date: Date | string): string {
  const days = daysBetween(new Date(), toDate(date));
  if (days === 0) return `Today, ${formatDay(date)}`;
  if (days === 1) return `Yesterday, ${formatDay(date)}`;
  return formatDay(date);
}

/** Section heading in the expenses list: "TODAY" / "YESTERDAY" / "2 SEP". */
export function formatDayGroup(date: Date | string): string {
  const days = daysBetween(new Date(), toDate(date));
  if (days === 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  return formatDay(date).toUpperCase();
}

/** "12 minutes ago", "2 days ago" — the accounts sync line. */
export function formatAgo(date: Date | string | null | undefined): string {
  if (!date) return 'never';
  const seconds = Math.max(0, (Date.now() - toDate(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Whole days from `from` to `to`, ignoring clock time. */
export function daysBetween(from: Date | string, to: Date | string): number {
  const a = startOfDay(toDate(from));
  const b = startOfDay(toDate(to));
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** "HF" for Harbor Foods — the contact avatars. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** ISO date (YYYY-MM-DD) for the Postgres `date` columns. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // 'YYYY-MM-DD' parses as UTC midnight, which shifts a day in western zones.
  // Pin bare dates to local time so "today" means today wherever the user is.
  const bare = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (bare) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}
