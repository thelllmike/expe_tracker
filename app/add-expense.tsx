import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  DockedBar,
  FieldRow,
  ListCard,
  NavBar,
  PickerSheet,
  Pill,
  Toggle,
} from '@/components';
import type { PickerOption } from '@/components';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { formatMoney, formatRelativeDay } from '@/lib/format';
import {
  useAccounts,
  useBusinesses,
  useCategories,
  useContacts,
  useVendorHistory,
} from '@/data/queries';
import {
  useCreateAccount,
  useCreateCategory,
  useCreateContact,
  useCreateExpense,
} from '@/data/mutations';

type Field = 'category' | 'vendor' | 'date' | 'account' | null;

const DATE_CHOICES = [0, 1, 2, 3, 7];

/** Screen 02 — two-tap expense entry. */
export default function AddExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const businesses = useBusinesses();
  const categories = useCategories();
  const vendors = useContacts('vendor');
  const accounts = useAccounts();
  const createExpense = useCreateExpense();
  const createCategory = useCreateCategory();
  const createContact = useCreateContact();
  const createAccount = useCreateAccount();

  const [amount, setAmount] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [daysAgo, setDaysAgo] = useState(0);
  const [taxRecoverable, setTaxRecoverable] = useState(true);
  const [recurring, setRecurring] = useState(false);
  const [openField, setOpenField] = useState<Field>(null);
  const [error, setError] = useState<string | null>(null);

  const amountRef = useRef<TextInput>(null);

  const business = useMemo(
    () => businesses.data?.find((b) => b.id === businessId) ?? businesses.data?.[0] ?? null,
    [businesses.data, businessId],
  );
  const activeBusinessId = businessId ?? business?.id ?? null;
  const currency = business?.currency ?? 'USD';

  const vendor = vendors.data?.find((v) => v.id === vendorId) ?? null;
  const category = categories.data?.find((c) => c.id === categoryId) ?? null;
  const account = accounts.data?.find((a) => a.id === accountId) ?? null;
  const history = useVendorHistory(vendorId);

  const spentOn = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d;
  }, [daysAgo]);

  // The keypad writes a raw digit string; parse it as major units.
  const amountMinor = Math.round((Number.parseFloat(amount) || 0) * 100);
  const taxRate = business?.tax_rate ?? 0;
  const taxMinor = taxRecoverable ? Math.round((amountMinor * taxRate) / (100 + taxRate)) : 0;
  const canSave = amountMinor > 0 && Boolean(activeBusinessId) && !createExpense.isPending;

  const [whole, decimals] = splitAmount(amount);

  const onSave = async () => {
    if (!canSave || !activeBusinessId) return;
    setError(null);
    try {
      await createExpense.mutateAsync({
        businessId: activeBusinessId,
        amountMinor,
        currency,
        categoryId,
        vendorId,
        accountId,
        spentOn,
        taxMinor,
        taxRecoverable,
        isRecurring: recurring,
        recurrence: recurring ? 'monthly' : null,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the expense.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 8 }}>
        <NavBar
          left="Cancel"
          title="New expense"
          right="Save"
          onLeft={() => router.back()}
          onRight={onSave}
          rightDisabled={!canSave}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.amountBlock} onPress={() => amountRef.current?.focus()}>
          <Text style={text.microLabel}>AMOUNT</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountSymbol}>{currencySymbolFor(currency)}</Text>
            <Text style={styles.amountValue}>{whole}</Text>
            <Text style={styles.amountSymbol}>{decimals}</Text>
          </View>
          {/* Off-screen field: taps on the big figure raise the numeric keypad. */}
          <TextInput
            ref={amountRef}
            value={amount}
            onChangeText={(next) => setAmount(next.replace(/[^0-9.]/g, '').slice(0, 12))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={styles.hiddenInput}
            accessibilityLabel="Expense amount"
            autoFocus
          />
        </Pressable>

        <View style={styles.pills}>
          {(businesses.data ?? []).map((b) => (
            <Pill
              key={b.id}
              label={b.name}
              large
              selected={b.id === activeBusinessId}
              onPress={() => setBusinessId(b.id)}
            />
          ))}
        </View>

        <ListCard style={styles.fields}>
          <FieldRow
            label="Category"
            value={category?.name ?? 'Choose'}
            onPress={() => setOpenField('category')}
          />
          <FieldRow
            label="Vendor"
            value={vendor?.name ?? 'Choose'}
            onPress={() => setOpenField('vendor')}
          />
          <FieldRow
            label="Date"
            value={formatRelativeDay(spentOn)}
            onPress={() => setOpenField('date')}
          />
          <FieldRow
            label="Paid from"
            value={account ? accountLabel(account.kind, account.name, account.mask) : 'Choose'}
            onPress={() => setOpenField('account')}
          />
          <View style={styles.taxRow}>
            <Text style={text.fieldLabel}>{business?.tax_label ?? 'Tax / VAT'}</Text>
            <View style={styles.taxValue}>
              <Text style={text.fieldValue}>
                {taxRecoverable && taxMinor > 0
                  ? `Recoverable · ${formatMoney(taxMinor, currency, { decimals: true })}`
                  : 'Not recoverable'}
              </Text>
              <Toggle
                value={taxRecoverable}
                onChange={setTaxRecoverable}
                accessibilityLabel="Tax recoverable"
              />
            </View>
          </View>
        </ListCard>

        <View style={styles.tiles}>
          <Pressable
            style={({ pressed }) => [styles.tile, styles.tileDashed, pressed && styles.pressed]}
            onPress={() => router.push('/receipts')}
            accessibilityRole="button"
          >
            <Text style={styles.tileGlyph}>▢</Text>
            <Text style={styles.tileLabel}>Scan receipt</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tile,
              styles.tileSolid,
              recurring && styles.tileActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setRecurring((r) => !r)}
            accessibilityRole="switch"
            accessibilityState={{ checked: recurring }}
          >
            <Text style={[styles.tileGlyph, recurring && styles.tileGlyphActive]}>↻</Text>
            <Text style={[styles.tileLabel, recurring && styles.tileLabelActive]}>
              {recurring ? 'Repeats monthly' : 'Make recurring'}
            </Text>
          </Pressable>
        </View>

        {vendor && (history.data?.length ?? 0) > 0 ? (
          <Text style={styles.hint}>
            {`Last ${history.data!.length} at ${firstWord(vendor.name)}: ` +
              history.data!.map((h) => formatMoney(h.amount_minor, h.currency)).join(' · ')}
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <DockedBar>
        <Button
          label="Save expense"
          onPress={onSave}
          disabled={!canSave}
          loading={createExpense.isPending}
        />
      </DockedBar>

      <PickerSheet
        visible={openField === 'category'}
        title="Category"
        options={(categories.data ?? []).map<PickerOption<string>>((c) => ({
          value: c.id,
          label: c.name,
        }))}
        selected={categoryId}
        onSelect={setCategoryId}
        onClose={() => setOpenField(null)}
        createLabel="New category"
        onCreate={async (name) => {
          const created = await createCategory.mutateAsync(name);
          if (created) setCategoryId(created.id);
        }}
      />
      <PickerSheet
        visible={openField === 'vendor'}
        title="Vendor"
        options={(vendors.data ?? []).map<PickerOption<string>>((v) => ({
          value: v.id,
          label: v.name,
        }))}
        selected={vendorId}
        onSelect={setVendorId}
        onClose={() => setOpenField(null)}
        createLabel="New vendor"
        onCreate={async (name) => {
          const created = await createContact.mutateAsync({
            name,
            kind: 'vendor',
            businessId: activeBusinessId,
            currency,
          });
          if (created) setVendorId(created.id);
        }}
      />
      <PickerSheet
        visible={openField === 'date'}
        title="Date"
        options={DATE_CHOICES.map<PickerOption<number>>((days) => {
          const d = new Date();
          d.setDate(d.getDate() - days);
          return { value: days, label: formatRelativeDay(d) };
        })}
        selected={daysAgo}
        onSelect={setDaysAgo}
        onClose={() => setOpenField(null)}
      />
      <PickerSheet
        visible={openField === 'account'}
        title="Paid from"
        options={(accounts.data ?? []).map<PickerOption<string>>((a) => ({
          value: a.id,
          label: accountLabel(a.kind, a.name, a.mask),
          meta: a.currency,
        }))}
        selected={accountId}
        onSelect={setAccountId}
        onClose={() => setOpenField(null)}
        createLabel="New account, e.g. Cash"
        onCreate={async (name) => {
          const created = await createAccount.mutateAsync({
            name,
            kind: 'cash',
            currency,
            businessId: activeBusinessId,
          });
          if (created) setAccountId(created.id);
        }}
      />
    </View>
  );
}

/** "1240.5" -> ["1,240", ".50"]; empty -> ["0", ".00"]. */
function splitAmount(raw: string): [string, string] {
  const [intPart = '', fracPart] = raw.split('.');
  const whole = Number.parseInt(intPart || '0', 10).toLocaleString('en-US');
  if (fracPart == null) return [whole, '.00'];
  return [whole, `.${fracPart.padEnd(2, '0').slice(0, 2)}`];
}

function accountLabel(kind: string, name: string, mask: string | null): string {
  const prefix = kind === 'bank' ? 'Bank' : kind === 'card' ? 'Card' : 'Cash';
  return mask ? `${prefix} · ${name} ${mask}` : `${prefix} · ${name}`;
}

function firstWord(name: string): string {
  return name.split(/\s+/)[0];
}

function currencySymbolFor(code: string): string {
  return ({ USD: '$', EUR: '€', GBP: '£', INR: '₹' } as Record<string, string>)[code] ?? code;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.paper },
  content: { paddingBottom: 24 },

  amountBlock: { paddingTop: 34, paddingBottom: 26, paddingHorizontal: gutter.screen, alignItems: 'center' },
  amountRow: { marginTop: 8, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  amountSymbol: { fontFamily: font.serif, fontSize: 34, color: color.muted },
  amountValue: { fontFamily: font.serif, fontSize: 64, lineHeight: 66, color: color.ink },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },

  pills: { paddingHorizontal: gutter.screen, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fields: { marginTop: 16 },

  taxRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  taxValue: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },

  tiles: { marginTop: 14, paddingHorizontal: gutter.screen, flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    height: 78,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileDashed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: alpha.dashedLight },
  tileSolid: { backgroundColor: color.card, borderWidth: 1, borderColor: alpha.border },
  tileActive: { borderColor: color.green, backgroundColor: color.greenSoft },
  tileGlyph: { fontSize: 19, color: color.muted },
  tileGlyphActive: { color: color.greenDark },
  tileLabel: { fontFamily: font.sansSemi, fontSize: 12, color: color.muted },
  tileLabelActive: { color: color.greenDark },

  hint: {
    marginTop: 16,
    paddingHorizontal: gutter.screen,
    fontFamily: font.sans,
    fontSize: 12,
    color: color.muted,
    textAlign: 'center',
  },
  error: {
    marginTop: 14,
    paddingHorizontal: gutter.screen,
    fontFamily: font.sans,
    fontSize: 13,
    color: color.red,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
});
