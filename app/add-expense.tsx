import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import type { Expense, Income } from '@/types/db';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { formatMoney, formatRelativeDay } from '@/lib/format';
import {
  useAccounts,
  useBusinesses,
  useCategories,
  useContacts,
  useExpense,
  useIncomeEntry,
  useIncomeSources,
  useVendorHistory,
} from '@/data/queries';
import {
  useCreateAccount,
  useCreateCategory,
  useCreateContact,
  useCreateExpense,
  useCreateIncome,
  useCreateIncomeSource,
  useDeleteExpense,
  useDeleteIncome,
  useUpdateExpense,
  useUpdateIncome,
} from '@/data/mutations';

type Field = 'category' | 'vendor' | 'date' | 'account' | 'source' | 'client' | null;
type Kind = 'expense' | 'income';

const DATE_CHOICES = [0, 1, 2, 3, 7];

/**
 * Screen 02 — two-tap entry for money out and money in.
 *
 * The route is still /add-expense: it is what the tab bar's centre button
 * pushes, and renaming it would break that for no gain.
 */
/**
 * Loads the row being edited, if any, and only then mounts the form — so every
 * field can initialise from it directly instead of being pushed values by an
 * effect after the first render.
 */
export default function AddEntryScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const editingId = params.id;
  const editingIncome = params.kind === 'income';

  const expenseQuery = useExpense(editingId && !editingIncome ? editingId : undefined);
  const incomeQuery = useIncomeEntry(editingId && editingIncome ? editingId : undefined);

  const expenseRow = editingIncome ? undefined : expenseQuery.data;
  const incomeRow = editingIncome ? incomeQuery.data : undefined;
  const loaded = !editingId || Boolean(expenseRow ?? incomeRow);

  if (!loaded) return <View style={styles.root} />;

  return (
    <EntryForm
      key={editingId ?? 'new'}
      editingId={editingId}
      expenseRow={expenseRow}
      incomeRow={incomeRow}
    />
  );
}

function EntryForm({
  editingId,
  expenseRow,
  incomeRow,
}: {
  editingId?: string;
  expenseRow?: Expense;
  incomeRow?: Income;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const editingIncome = Boolean(incomeRow);
  const row = expenseRow ?? incomeRow;

  const businesses = useBusinesses();
  const categories = useCategories();
  const vendors = useContacts('vendor');
  const clients = useContacts('client');
  const accounts = useAccounts();
  const sources = useIncomeSources();
  const createExpense = useCreateExpense();
  const createIncome = useCreateIncome();
  const createSource = useCreateIncomeSource();
  const updateExpense = useUpdateExpense();
  const updateIncome = useUpdateIncome();
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();

  const createCategory = useCreateCategory();
  const createContact = useCreateContact();
  const createAccount = useCreateAccount();

  const [kind, setKind] = useState<Kind>(editingIncome ? 'income' : 'expense');
  const [amount, setAmount] = useState(row ? (row.amount_minor / 100).toString() : '');
  const [businessId, setBusinessId] = useState<string | null>(row?.business_id ?? null);
  const [sourceId, setSourceId] = useState<string | null>(incomeRow?.source_id ?? null);
  const [clientId, setClientId] = useState<string | null>(incomeRow?.client_id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(expenseRow?.category_id ?? null);
  const [vendorId, setVendorId] = useState<string | null>(expenseRow?.vendor_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(expenseRow?.account_id ?? null);
  const [daysAgo, setDaysAgo] = useState(0);
  /** Set when editing: the row's own date, which the day picker then overrides. */
  const [editedDate, setEditedDate] = useState<Date | null>(
    row
      ? new Date(`${incomeRow ? incomeRow.received_on : expenseRow!.spent_on}T00:00:00`)
      : null,
  );
  const [taxRecoverable, setTaxRecoverable] = useState(
    incomeRow ? (incomeRow.tax_minor ?? 0) > 0 : (expenseRow?.tax_recoverable ?? true),
  );
  const [recurring, setRecurring] = useState<boolean>(expenseRow?.is_recurring ?? false);
  const [openField, setOpenField] = useState<Field>(null);
  const [error, setError] = useState<string | null>(null);

  const amountRef = useRef<TextInput>(null);

  const business = useMemo(
    () => businesses.data?.find((b) => b.id === businessId) ?? businesses.data?.[0] ?? null,
    [businesses.data, businessId],
  );
  const activeBusinessId = businessId ?? business?.id ?? null;
  const currency = business?.currency ?? 'USD';

  const income = kind === 'income';
  const vendor = vendors.data?.find((v) => v.id === vendorId) ?? null;
  const client = clients.data?.find((c) => c.id === clientId) ?? null;
  const source = sources.data?.find((x) => x.id === sourceId) ?? null;
  const category = categories.data?.find((c) => c.id === categoryId) ?? null;
  const account = accounts.data?.find((a) => a.id === accountId) ?? null;
  const history = useVendorHistory(vendorId);

  const spentOn = useMemo(() => {
    if (editedDate) return editedDate;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d;
  }, [daysAgo, editedDate]);

  // The keypad writes a raw digit string; parse it as major units.
  const amountMinor = Math.round((Number.parseFloat(amount) || 0) * 100);
  const taxRate = business?.tax_rate ?? 0;
  const taxMinor = taxRecoverable ? Math.round((amountMinor * taxRate) / (100 + taxRate)) : 0;
  const pending = income
    ? createIncome.isPending || updateIncome.isPending
    : createExpense.isPending || updateExpense.isPending;
  const canSave = amountMinor > 0 && Boolean(activeBusinessId) && !pending;

  const [whole, decimals] = splitAmount(amount);

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert(
      income ? 'Delete this income?' : 'Delete this expense?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (income) await deleteIncome.mutateAsync(editingId);
              else await deleteExpense.mutateAsync(editingId);
              router.back();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete the entry.');
            }
          },
        },
      ],
    );
  };

  const onSave = async () => {
    if (!canSave || !activeBusinessId) return;
    setError(null);
    try {
      if (income && editingId) {
        await updateIncome.mutateAsync({
          id: editingId,
          input: {
            businessId: activeBusinessId,
            amountMinor,
            currency,
            sourceId,
            clientId,
            receivedOn: spentOn,
            taxMinor,
          },
        });
      } else if (!income && editingId) {
        await updateExpense.mutateAsync({
          id: editingId,
          input: {
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
          },
        });
      } else if (income) {
        await createIncome.mutateAsync({
          businessId: activeBusinessId,
          amountMinor,
          currency,
          sourceId,
          clientId,
          receivedOn: spentOn,
          taxMinor,
        });
      } else {
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
      }
      router.back();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Could not save the ${income ? 'income' : 'expense'}.`,
      );
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 8 }}>
        <NavBar
          left="Cancel"
          title={
            editingId
              ? income
                ? 'Edit income'
                : 'Edit expense'
              : income
                ? 'New income'
                : 'New expense'
          }
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
        {editingId ? null : (
        <View style={styles.segment}>
          {(['expense', 'income'] as Kind[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                setKind(k);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === k }}
              style={[styles.segmentItem, kind === k && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentLabel, kind === k && styles.segmentLabelActive]}>
                {k === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </Pressable>
          ))}
        </View>
        )}

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
            accessibilityLabel={income ? 'Income amount' : 'Expense amount'}
            autoFocus={!editingId}
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
          {income ? (
            <>
              <FieldRow
                label="Source"
                value={source?.name ?? 'Choose'}
                onPress={() => setOpenField('source')}
              />
              <FieldRow
                label="Client"
                value={client?.name ?? 'Optional'}
                onPress={() => setOpenField('client')}
              />
            </>
          ) : (
            <>
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
            </>
          )}
          <FieldRow
            label="Date"
            value={formatRelativeDay(spentOn)}
            onPress={() => setOpenField('date')}
          />
          {income ? null : (
            <FieldRow
              label="Paid from"
              value={account ? accountLabel(account.kind, account.name, account.mask) : 'Choose'}
              onPress={() => setOpenField('account')}
            />
          )}
          <View style={styles.taxRow}>
            <Text style={text.fieldLabel}>{business?.tax_label ?? 'Tax / VAT'}</Text>
            <View style={styles.taxValue}>
              <Text style={text.fieldValue}>
                {taxRecoverable && taxMinor > 0
                  ? `${income ? 'Collected' : 'Recoverable'} · ${formatMoney(taxMinor, currency, { decimals: true })}`
                  : income
                    ? 'No tax'
                    : 'Not recoverable'}
              </Text>
              <Toggle
                value={taxRecoverable}
                onChange={setTaxRecoverable}
                accessibilityLabel={income ? 'Tax collected' : 'Tax recoverable'}
              />
            </View>
          </View>
        </ListCard>

        {income ? null : (
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
        )}

        {!income && vendor && (history.data?.length ?? 0) > 0 ? (
          <Text style={styles.hint}>
            {`Last ${history.data!.length} at ${firstWord(vendor.name)}: ` +
              history.data!.map((h) => formatMoney(h.amount_minor, h.currency)).join(' · ')}
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {editingId ? (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
          >
            <Text style={styles.deleteLabel}>
              {income ? 'Delete this income' : 'Delete this expense'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <DockedBar>
        <Button
          label={
            editingId ? 'Save changes' : income ? 'Save income' : 'Save expense'
          }
          onPress={onSave}
          disabled={!canSave}
          loading={pending}
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
        visible={openField === 'source'}
        title="Source"
        options={(sources.data ?? []).map<PickerOption<string>>((x) => ({
          value: x.id,
          label: x.name,
        }))}
        selected={sourceId}
        onSelect={setSourceId}
        onClose={() => setOpenField(null)}
        createLabel="New source"
        onCreate={async (name) => {
          const created = await createSource.mutateAsync(name);
          if (created) setSourceId(created.id);
        }}
      />
      <PickerSheet
        visible={openField === 'client'}
        title="Client"
        options={(clients.data ?? []).map<PickerOption<string>>((c) => ({
          value: c.id,
          label: c.name,
        }))}
        selected={clientId}
        onSelect={setClientId}
        onClose={() => setOpenField(null)}
        createLabel="New client"
        onCreate={async (name) => {
          const created = await createContact.mutateAsync({
            name,
            kind: 'client',
            businessId: activeBusinessId,
            currency,
          });
          if (created) setClientId(created.id);
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
        onSelect={(days) => {
          setDaysAgo(days);
          // Choosing a day overrides the date an edited row arrived with.
          setEditedDate(null);
        }}
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

const styles = themedStyles(() => ({
  // Expense / Income switch. Sits above the amount so the choice is made before
  // the figure is typed, which is the order the two-tap flow depends on.
  segment: {
    flexDirection: 'row',
    marginTop: 14,
    marginHorizontal: 22,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: alpha.divider,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: { backgroundColor: color.card },
  segmentLabel: { fontFamily: font.sansSemi, fontSize: 14, color: color.muted },
  segmentLabelActive: { color: color.ink },
  deleteRow: { marginTop: 26, paddingVertical: 14, alignItems: 'center' },
  deleteLabel: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.red },
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
}));
