/**
 * Currencies the app offers. `minorUnits` matters for parsing and display:
 * most are 100 subunits to the major, JPY has none.
 */
export type CurrencyCode = 'LKR' | 'USD' | 'EUR' | 'GBP' | 'INR' | 'AUD' | 'CAD' | 'AED' | 'SGD' | 'JPY';

export type Currency = { code: CurrencyCode; symbol: string; name: string; minorUnits: 0 | 2 };

export const CURRENCIES: Currency[] = [
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan rupee', minorUnits: 2 },
  { code: 'USD', symbol: '$', name: 'US dollar', minorUnits: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', minorUnits: 2 },
  { code: 'GBP', symbol: '£', name: 'Pound sterling', minorUnits: 2 },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', minorUnits: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar', minorUnits: 2 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar', minorUnits: 2 },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham', minorUnits: 2 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', minorUnits: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', minorUnits: 0 },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currency(code: string): Currency | undefined {
  return BY_CODE.get(code as CurrencyCode);
}

/** Options shaped for PickerSheet, e.g. "LKR Rs · Sri Lankan rupee". */
export function currencyOptions() {
  return CURRENCIES.map((c) => ({
    value: c.code as string,
    label: `${c.code} ${c.symbol}`,
    meta: c.name,
  }));
}
