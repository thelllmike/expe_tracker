import React from 'react';
import { Text, View } from 'react-native';
import { color, radius, themed } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { text } from '@/theme/type';
import type { InvoiceDisplayStatus, QuoteStatus } from '@/types/db';

export type BadgeTone = 'red' | 'blue' | 'green' | 'amber' | 'neutral';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = themed(() => ({
  red: { bg: color.redSoft, fg: color.red },
  blue: { bg: color.blueSoft, fg: color.blueDark },
  green: { bg: color.greenSoft, fg: color.greenDark },
  amber: { bg: color.amberSoft, fg: color.amberText },
  neutral: { bg: color.line, fg: color.muted },
}));

/**
 * 10.5px / 700 / 0.08em status pill. The label is rendered verbatim: the design
 * sets these in caps but keeps the day suffix lowercase ("OVERDUE 6d"), so the
 * builders below spell each one out rather than upper-casing here.
 */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[text.badge, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** Maps an invoice to the badge the design shows for that state. */
export function invoiceBadge(invoice: {
  display_status: InvoiceDisplayStatus;
  days_overdue: number;
  due_date: string;
  paid_at: string | null;
  is_recurring: boolean;
}): { label: string; tone: BadgeTone } {
  const day = (iso: string) => {
    const d = new Date(iso);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  };

  switch (invoice.display_status) {
    case 'overdue':
      return { label: `OVERDUE ${invoice.days_overdue}d`, tone: 'red' };
    case 'paid':
      return { label: invoice.paid_at ? `PAID ${day(invoice.paid_at)}` : 'PAID', tone: 'green' };
    case 'draft':
      return { label: 'DRAFT', tone: 'neutral' };
    case 'void':
      return { label: 'VOID', tone: 'neutral' };
    case 'sent':
    default:
      return invoice.is_recurring
        ? { label: 'RECURRING', tone: 'blue' }
        : { label: `SENT · DUE ${day(invoice.due_date)}`, tone: 'blue' };
  }
}

/** Quotation states, including the amber "expires in Nd" warning. */
export function quotationBadge(quote: {
  status: QuoteStatus;
  valid_until: string;
  sent_at: string | null;
}): { label: string; tone: BadgeTone } {
  const daysUntil = Math.ceil(
    (new Date(quote.valid_until).getTime() - Date.now()) / 86_400_000,
  );
  const daysSince = quote.sent_at
    ? Math.floor((Date.now() - new Date(quote.sent_at).getTime()) / 86_400_000)
    : 0;

  switch (quote.status) {
    case 'accepted':
      return { label: 'ACCEPTED', tone: 'green' };
    case 'declined':
      return { label: 'DECLINED', tone: 'red' };
    case 'expired':
      return { label: 'EXPIRED', tone: 'neutral' };
    case 'draft':
      return { label: 'DRAFT', tone: 'neutral' };
    case 'sent':
    default:
      // A quote about to lapse is the more useful thing to surface.
      if (daysUntil >= 0 && daysUntil <= 7) {
        return { label: `EXPIRES IN ${daysUntil}d`, tone: 'amber' };
      }
      return { label: `SENT ${daysSince}d`, tone: 'blue' };
  }
}

const styles = themedStyles(() => ({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
}));
