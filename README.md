# Ledger

Multi-business expense tracking, P&L and invoicing. React Native (Expo) + Supabase,
built from the 17-screen design export in `design/`.

## What's here

```
app/                      expo-router routes — one file per screen
  sign-in.tsx             14 · sign in & first run
  (tabs)/index.tsx        01 · home, all businesses
  (tabs)/spend.tsx        03 · expenses list & filters
  (tabs)/billing.tsx      06 · invoices
  (tabs)/more.tsx         11 · settings & business switcher
  add-expense.tsx         02 · fast entry (modal)
  pl.tsx                  04 · monthly P&L, one business
  compare.tsx             05 · compare businesses
  invoice/new.tsx         07 · create invoice
  invoice/[id]/preview    08 · invoice preview & send
  clients.tsx             09 · clients & vendors
  reports.tsx             10 · reports & tax export
  quotations/index.tsx    12 · quotations
  quotations/new.tsx      13 · new quotation & send
  bank-sync.tsx           15 · bank & card sync
  receipts.tsx            16 · receipt inbox
  notifications.tsx       17 · notifications
  business/new.tsx        create / edit a business (not in the original 17)
src/theme/                design tokens + type scale, transcribed from the export
src/components/           the local component library (no UI kit)
src/charts/               bar / grouped bar / share bar, drawn with react-native-svg
src/data/                 auth context, TanStack Query hooks, mutations
src/lib/                  supabase client, money & date formatting
supabase/migrations/      schema, RLS, aggregate RPCs, storage buckets
supabase/functions/       generate-invoice-pdf (Deno edge function)
design/                   the source design export — the spec for every screen
```

## Setup

**1. Install**

```bash
npm install
```

**2. Create a Supabase project** at [supabase.com](https://supabase.com), then:

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
**Project settings → API**. The app throws a clear error on launch if these are
missing — that's deliberate, not a crash to debug.

**3. Push the database**

Either paste `supabase/apply_all.sql` into **Dashboard → SQL Editor → New query →
Run** (it is the migrations concatenated, in order), or use the CLI:

Every migration is written to be safe to run more than once — enums are guarded
with `pg_type` checks, tables and indexes use `if not exists`, and each policy
and trigger is dropped before it is created. Re-running `apply_all.sql` fills in
anything missing and leaves your data alone.

```bash
npm install -g supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

Either way you get: schema → RLS → aggregate functions → storage buckets. **No
demo data** — the database starts empty and the app's first run creates your
first business.

### Starting over

`supabase/reset_all.sql` drops every table, view, function and type this app
created — **and all data in them** — then rebuilds the schema. Paste it into the
SQL Editor the same way. It is safe to run more than once.

Two things it deliberately does not touch:

- **Auth users.** They survive, so you stay signed in. Their `profiles` rows are
  recreated at the end, because the signup trigger only fires on new signups —
  without that backfill an existing account would come back to a missing profile.
- **Storage buckets and their files.** Supabase blocks `delete` on
  `storage.objects` and `storage.buckets` from SQL (`storage.protect_delete`), so
  the reset drops only the storage *policies* and lets the rebuild re-declare the
  buckets. Clear uploaded receipts and PDFs from **Dashboard → Storage**.

**4. Deploy the PDF function**

```bash
supabase functions deploy generate-invoice-pdf
```

It reads `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`,
all of which Supabase injects automatically.

The one function renders **both** invoices and quotations — post `{ invoice_id }`
or `{ quotation_id }`. It returns a signed URL, and the app downloads that to a
cache file before handing it to the system share sheet, which is what puts a real
PDF attachment into WhatsApp rather than a bare link.

### Document branding

The generated PDF reproduces the business's own Canva invoice. Two pieces of
that file are reused directly:

- **Corner artwork.** Extracted from `350.pdf.pdf` as transparent PNGs and
  inlined in `assets.ts`. The Canva page is 630x876pt — A4 plus ~17pt of bleed —
  so the crops are placed against that larger sheet and allowed to run off the
  trimmed page, which is how the original prints.
- **Layout.** Column positions, rule weights and the black header bar with its
  navy overhang are measured from the same file.

**The typeface is a substitution.** The original is set in Garet, which Canva
licenses and does not permit redistributing. The renderer bundles Poppins
(SIL OFL, subset to Latin — 14KB a weight instead of 160KB) as the nearest free
geometric sans. Drop real Garet `.ttf` files into `assets.ts` if you hold a
licence and the documents become exact.

Figures print bare — `1,500`, not `LKR 1,500.00` — matching the reference, with
decimals shown only when an amount actually has them. The printed sheet carries
BILLED TO and DATE only; due dates and quote expiry live in the app.

Each business still supplies its own **logo**, **PAY TO** bank block and
**footer contact** line under DOCUMENT BRANDING when you create or edit it.
Logos live in the public `logos` bucket keyed `<user-id>/<business-id>.<ext>`,
public because the document gets forwarded to clients. PNG and JPEG only —
the two formats pdf-lib can embed.

Invoices and quotations also carry an **advance** and a **discount**, which show
above the total and come off the figure due.

### Checking the PDF layout

The renderer lives in `render.ts`, apart from the request handling, so it can be
run without deploying:

```bash
cd /tmp && mkdir pdfcheck && cd pdfcheck && npm init -y
npm i pdf-lib @pdf-lib/fontkit esbuild
cp <repo>/supabase/functions/generate-invoice-pdf/{render.ts,assets.ts} .
sed -i '' "s|https://esm.sh/pdf-lib@1.17.1|pdf-lib|; \
           s|https://esm.sh/@pdf-lib/fontkit@1.1.1|@pdf-lib/fontkit|; \
           s|'./assets.ts'|'./assets.js'|" render.ts
npx esbuild assets.ts --format=esm --outfile=assets.js
npx esbuild render.ts --bundle --format=esm --platform=node \
  --external:pdf-lib --external:@pdf-lib/fontkit --outfile=render.mjs
# then call render('invoice', row, items, null) and write the bytes to a file
```

`qlmanage -t -s 1600 -o . out.pdf` turns the result into a PNG to eyeball. Worth
doing after any layout change: the totals, PAY TO and footer travel as one tail
block that tightens its leading to stay on the page and breaks to a new one when
it cannot, and that threshold is easy to move by accident.

### These credentials are public, by design

Anything prefixed `EXPO_PUBLIC_` ends up in the shipped binary as plain text.
Running `strings` over the bundle in an APK recovers the Supabase URL and anon
key in seconds. That is expected: the anon key is meant to be public and carries
no authority of its own.

What actually protects the data is Row Level Security, which is why the policies
in `0002_rls.sql` matter more than where the key is stored. Two rules follow:

- **Never** put the `service_role` key in an `EXPO_PUBLIC_*` variable, or in the
  app at all. It bypasses RLS entirely. It belongs only in Edge Functions, where
  Supabase injects it server-side.
- Any new table needs RLS enabled and a policy, or it is world-readable to
  anyone holding the anon key — which, after your first APK, is everyone.

## Currencies

`src/lib/currencies.ts` is the single list. **LKR is the default** for new
profiles and leads the picker; USD, EUR, GBP, INR, AUD, CAD, AED, SGD and JPY
follow. Each business sets its own currency, and figures are converted into the
profile's base currency for the consolidated home, compare and tax screens.

Conversion uses `fx_rates`, which starts empty — `useFxRate` falls back to 1:1
when a pair has no row, so an unconverted figure is shown rather than the screen
blocking. Insert rates as you need them:

```sql
insert into fx_rates (base, quote, rate, as_of)
values ('USD', 'LKR', 305.00, current_date),
       ('LKR', 'USD', 0.00328, current_date);
```

JPY is declared with zero minor units in the currency table; the money helpers
still store and format everything in minor units.

## Architecture notes

**Money is stored in minor units** (`bigint` cents) everywhere. `formatMoney` in
`src/lib/format.ts` is the only place it becomes a string, and it shows decimals
only when the source has them — matching the design, which writes `$13,400` but
`$24.60`.

**Aggregates run in Postgres, not the client.** `home_summary`, `pl_summary`,
`net_trend` and `tax_summary` are `security invoker` functions, so RLS still
decides which rows are counted. The alternative — pulling whole ledgers to sum
them on device — gets slow fast and leaks nothing useful in exchange.

**`overdue` is derived, never stored.** An invoice's `status` is
`draft | sent | paid | void`; `invoices_view` adds `display_status` and
`days_overdue` from `due_date` against the clock. Storing it would mean a cron
job to keep it honest.

**RLS shape**: every business-scoped row carries `owner_id`, so the common policy
is a column compare that uses the indexes. Read access for invited accountants
goes through `business_members` via two `security definer` helpers
(`owns_business`, `is_business_member`) which keep the policies from recursing.

**Storage keys are `<user-id>/…`**, so the first path segment is the ACL. Both
the `receipts` and `documents` buckets are private; the app reads images through
signed URLs.

## Where this departs from the design

Three places, all deliberate:

1. **Sign-in uses email + Google**, not the phone-OTP and Apple buttons drawn in
   screen 14. The layout, type and colour are the design's; the providers follow
   the stack spec, and work against a plain Supabase project with no SMS vendor
   or Apple Developer account.
2. **No donut or sparkline.** The build brief lists them, but neither appears in
   the export — screen 5 draws the share of net profit as a stacked bar and the
   net trend as grouped bars, and that's what's built. `src/charts/` matches what
   the design actually shows.
3. **Derived figures are computed, not transcribed.** Several of the mock's
   illustrative totals don't reconcile against each other (its `TODAY` subtotal
   and its receivables figure don't equal the rows above them). The seeded data
   is internally consistent and every headline is summed from it, so a few
   numbers read slightly differently from the export.

## Verification status

- `npm run typecheck` — clean, strict mode
- `npm run lint` — clean
- `npx expo export` — bundles for iOS (4.9 MB) and Android (5.1 MB)
- `npx expo-doctor` — 21/21

**Database — executed, not just parsed.** All five migrations were run end to end
against PostgreSQL 17, with small stand-ins for the `auth` and `storage` schemas
Supabase provides. That covers the plpgsql bodies (`seed_demo_data`,
`spread_minor`, `handle_new_user`, `next_document_number`) and the two `DO`
blocks that generate the RLS policies. `seed_demo_data()` was confirmed
idempotent, and every aggregate RPC was run against the seeded rows:

| Figure | Design | Computed |
| --- | --- | --- |
| Net profit | $31,848 | $31,848 |
| Money in / out | $84,120 / $52,272 | $84,120 / $52,272 |
| Maple & Co net / margin / expenses | $13,400 · 25.6% · 41 | $13,400 · 25.6% · 41 |
| Northlight net / margin / expenses | $14,588 · 63.1% · 12 | $14,588 · 63.1% · 12 |
| 14 Rivers net / margin / expenses | $3,860 · 44.4% · 9 | $3,860 · 44.4% · 9 |
| P&L revenue / expenses / cash | $52,300 / $38,900 / $50,510 | same |
| Category breakdown (top 5) | 18,400 · 9,100 · 6,200 · 2,150 · 1,850 | same |
| 6-month net trend | 8,900 → 13,400 | same |
| Next document numbers | INV-2096 · QT-120 | same |

**RLS was tested with a non-superuser role** (superusers bypass it). A second
account sees none of the first's rows; granted an accountant membership on one
business it can read that business only, and its attempts to insert, update and
delete are all refused while the owner's data is untouched.

**Rendered on an iPhone 17 Pro simulator.** Sign-in, home, expenses, invoices,
P&L, compare, settings and notifications were screenshotted against the design
export and corrected until they matched.

### Still unverified

- **Nothing has run against a live Supabase instance.** PostgREST query shapes
  (the `select` strings with embedded joins), the auth redirect flow, storage
  uploads and the `generate-invoice-pdf` Edge Function are all unexercised. The
  local test drove the SQL directly, not through the API layer.
- The screenshots were taken with the client swapped for a fixture-backed stub
  fed from the verified local database, since there was no backend to talk to.
  That stub is not in the tree.
- Screens not visually checked: add-expense, create invoice, invoice preview,
  clients, reports, quotations, new quotation, bank sync, receipts.

## Known deviations from the design

Beyond the three above, the design's own illustrative figures do not always
reconcile, and the app computes rather than transcribes:

- **Receivables** reads $17,922, not the design's $18,400 — that figure does not
  equal the invoices drawn beside it at the 0.92 EUR rate the design states.
- **The home delta** reads +6.5%, not +5.4%, because it is derived from the
  seeded prior month rather than written in.
- **Tax payable** on the P&L reads $5,042, not $4,760: the seeded rows carry a
  true 8.5% and 19% of their amounts.
- Screens reached from Settings (clients, reports, quotations, bank sync,
  receipts, notifications) push over the tab bar rather than keeping it visible
  as the mock draws it. Keeping it would mean nesting them under a per-tab
  stack, which would change the flat route names specified for the build.
