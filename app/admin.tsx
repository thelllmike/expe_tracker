import React, { useMemo, useState } from 'react';
import { RefreshControl, Text, TextInput, View } from 'react-native';
import {
  Avatar,
  Banner,
  Card,
  ListCard,
  Pill,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  StatRow,
  StatTile,
} from '@/components';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { formatAgo, formatDay } from '@/lib/format';
import { useAdminUsers } from '@/data/queries';
import type { AdminUser } from '@/types/db';

type Filter = 'all' | 'active' | 'unconfirmed';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const within = (iso: string | null, ms: number) =>
  iso !== null && Date.now() - new Date(iso).getTime() <= ms;

const displayName = (user: AdminUser) => user.full_name || user.email || 'Unnamed account';

/**
 * Admin dashboard — everyone who has an account. The list comes from
 * `admin_list_users()`, which refuses any caller not in `public.admins`, so
 * reaching this route by hand shows the refusal rather than the data.
 */
export default function AdminScreen() {
  const users = useAdminUsers();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const all = useMemo(() => users.data ?? [], [users.data]);
  const active = useMemo(() => all.filter((u) => within(u.last_sign_in_at, WEEK_MS)), [all]);
  const unconfirmed = useMemo(() => all.filter((u) => !u.email_confirmed_at), [all]);
  const recent = all.filter((u) => within(u.created_at, MONTH_MS)).length;

  const query = search.trim().toLowerCase();
  const pool = filter === 'active' ? active : filter === 'unconfirmed' ? unconfirmed : all;
  const shown = query
    ? pool.filter(
        (u) =>
          (u.full_name ?? '').toLowerCase().includes(query) ||
          (u.email ?? '').toLowerCase().includes(query),
      )
    : pool;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={users.isRefetching}
          onRefresh={() => void users.refetch()}
          tintColor={color.green}
        />
      }
    >
      <ScreenHeader
        title="Users"
        subtitle={users.data ? `${all.length} account${all.length === 1 ? '' : 's'}` : null}
      />

      {users.isError ? (
        <View style={styles.block}>
          <Banner
            tone="red"
            inset
            title="Could not load users"
            body={users.error instanceof Error ? users.error.message : 'Try again in a moment.'}
          />
        </View>
      ) : users.isLoading ? (
        <View style={styles.block}>
          <Card variant="card" padded>
            <Text style={text.body}>Loading users…</Text>
          </Card>
        </View>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatRow>
              <StatTile label="TOTAL USERS" value={String(all.length)} serif />
              <StatTile label="ACTIVE · 7 DAYS" value={String(active.length)} serif />
            </StatRow>
            <StatRow>
              <StatTile label="NEW · 30 DAYS" value={String(recent)} />
              <StatTile label="UNCONFIRMED" value={String(unconfirmed.length)} />
            </StatRow>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or email"
              placeholderTextColor={color.muted2}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search users"
            />
          </View>

          <View style={styles.tabs}>
            <Pill label={`All ${all.length}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Pill
              label={`Active ${active.length}`}
              selected={filter === 'active'}
              onPress={() => setFilter('active')}
            />
            <Pill
              label={`Unconfirmed ${unconfirmed.length}`}
              selected={filter === 'unconfirmed'}
              onPress={() => setFilter('unconfirmed')}
            />
          </View>

          <SectionLabel style={styles.section}>
            {query
              ? `${shown.length} MATCH${shown.length === 1 ? '' : 'ES'}`
              : 'NEWEST FIRST'}
          </SectionLabel>
          {shown.length > 0 ? (
            <ListCard>
              {shown.map((user) => (
                <Row
                  key={user.id}
                  left={<Avatar name={displayName(user)} />}
                  title={displayName(user) + (user.is_admin ? ' · admin' : '')}
                  meta={[
                    user.full_name ? user.email : null,
                    `${user.business_count} business${user.business_count === 1 ? '' : 'es'}`,
                    user.email_confirmed_at ? null : 'unconfirmed',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={formatDay(user.created_at, true)}
                  valueMeta={user.last_sign_in_at ? `seen ${formatAgo(user.last_sign_in_at)}` : 'never signed in'}
                />
              ))}
            </ListCard>
          ) : (
            <View style={styles.block}>
              <Card variant="card" padded>
                <Text style={text.body}>
                  {query ? `Nobody matches “${search.trim()}”.` : 'No users in this view.'}
                </Text>
              </Card>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  block: { marginTop: 14 },
  tiles: { marginTop: 14, paddingHorizontal: gutter.screen, gap: 8 },
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
