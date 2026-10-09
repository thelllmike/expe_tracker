import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  Avatar,
  Card,
  ListCard,
  Pill,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
} from '@/components';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { daysBetween, formatDay, formatMoney } from '@/lib/format';
import { useContacts, useExpenses, useInvoices, useProfile } from '@/data/queries';

type Tab = 'clients' | 'vendors';

/** Screen 09 — who owes you, and where the money goes. */
export default function ClientsScreen() {
  const profile = useProfile();
  const clients = useContacts('client');
  const vendors = useContacts('vendor');
  const invoices = useInvoices();
  const expenses = useExpenses();

  const [tab, setTab] = useState<Tab>('clients');
  const [search, setSearch] = useState('');

  const base = profile.data?.base_currency ?? 'USD';
  const query = search.trim().toLowerCase();

  /** Outstanding per client, newest due date first. */
  const owing = useMemo(() => {
    const open = (invoices.data ?? []).filter((i) => i.status === 'sent');
    const map = new Map<
      string,
      { id: string; name: string; business: string | null; total: number; currency: string; due: string; late: number; count: number }
    >();

    for (const invoice of open) {
      const key = invoice.client?.id ?? invoice.id;
      const existing = map.get(key);
      const late = Math.max(0, daysBetween(new Date(), invoice.due_date));
      if (existing) {
        existing.total += invoice.total_minor;
        existing.count += 1;
        if (late > existing.late) {
          existing.late = late;
          existing.due = invoice.due_date;
        }
      } else {
        map.set(key, {
          id: key,
          name: invoice.client?.name ?? 'No client',
          business: invoice.business?.name ?? null,
          total: invoice.total_minor,
          currency: invoice.currency,
          due: invoice.due_date,
          late,
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [invoices.data]);

  /** Spend per vendor this month. */
  const topVendors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; category: string | null; total: number; bills: number }>();
    for (const expense of expenses.data ?? []) {
      if (!expense.vendor) continue;
      const existing = map.get(expense.vendor.id);
      if (existing) {
        existing.total += expense.base_minor;
        existing.bills += 1;
      } else {
        map.set(expense.vendor.id, {
          id: expense.vendor.id,
          name: expense.vendor.name,
          category: expense.category?.name ?? null,
          total: expense.base_minor,
          bills: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [expenses.data]);

  const directory = (tab === 'clients' ? clients.data : vendors.data) ?? [];
  const filtered = query
    ? directory.filter((c) => c.name.toLowerCase().includes(query))
    : directory;

  return (
    <Screen>
      <ScreenHeader title="People" />

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search clients, vendors"
          placeholderTextColor={color.muted2}
          style={styles.search}
          autoCorrect={false}
          accessibilityLabel="Search clients and vendors"
        />
      </View>

      <View style={styles.tabs}>
        <Pill
          label={`Clients ${clients.data?.length ?? 0}`}
          selected={tab === 'clients'}
          onPress={() => setTab('clients')}
        />
        <Pill
          label={`Vendors ${vendors.data?.length ?? 0}`}
          selected={tab === 'vendors'}
          onPress={() => setTab('vendors')}
        />
      </View>

      {query ? (
        <>
          <SectionLabel style={styles.section}>
            {`${filtered.length} MATCH${filtered.length === 1 ? '' : 'ES'}`}
          </SectionLabel>
          {filtered.length > 0 ? (
            <ListCard>
              {filtered.map((contact) => (
                <Row
                  key={contact.id}
                  left={<Avatar name={contact.name} />}
                  title={contact.name}
                  meta={[contact.email, contact.currency].filter(Boolean).join(' · ') || null}
                />
              ))}
            </ListCard>
          ) : (
            <Card variant="card" padded>
              <Text style={text.body}>Nobody matches “{search.trim()}”.</Text>
            </Card>
          )}
        </>
      ) : (
        <>
          <SectionLabel style={styles.section}>OWES YOU</SectionLabel>
          {owing.length > 0 ? (
            <ListCard>
              {owing.map((entry) => (
                <Row
                  key={entry.id}
                  left={<Avatar name={entry.name} />}
                  title={entry.name}
                  meta={[
                    entry.business,
                    entry.count > 1 ? `${entry.count} invoices` : entry.currency,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={formatMoney(entry.total, entry.currency)}
                  valueColor={entry.late > 0 ? color.red : color.ink}
                  valueMeta={entry.late > 0 ? `${entry.late}d late` : `due ${formatDay(entry.due)}`}
                />
              ))}
            </ListCard>
          ) : (
            <Card variant="card" padded>
              <Text style={text.body}>Nothing outstanding — every invoice is settled.</Text>
            </Card>
          )}

          <SectionLabel style={styles.section}>TOP VENDORS · THIS MONTH</SectionLabel>
          {topVendors.length > 0 ? (
            <ListCard>
              {topVendors.map((vendor) => (
                <Row
                  key={vendor.id}
                  left={<Avatar name={vendor.name} />}
                  title={vendor.name}
                  meta={[vendor.category, `${vendor.bills} bill${vendor.bills === 1 ? '' : 's'}`]
                    .filter(Boolean)
                    .join(' · ')}
                  value={formatMoney(vendor.total, base)}
                />
              ))}
            </ListCard>
          ) : (
            <Card variant="card" padded>
              <Text style={text.body}>No vendor spend recorded this month.</Text>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  searchWrap: { marginTop: 14, paddingHorizontal: gutter.screen },
  search: {
    height: 40,
    borderRadius: radius.button,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: alpha.tabBorder,
    paddingHorizontal: 14,
    fontFamily: font.sans,
    fontSize: 13.5,
    color: color.ink,
  },
  tabs: { marginTop: 14, paddingHorizontal: gutter.screen, flexDirection: 'row', gap: 7 },
  section: { marginTop: 20, marginBottom: 8 },
}));
