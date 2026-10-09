import React from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  LinkButton,
  ListCard,
  PillButton,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
} from '@/components';
import { alpha, color, gutter, themed } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { formatDay } from '@/lib/format';
import { useNotifications } from '@/data/queries';
import { useMarkAllNotificationsRead } from '@/data/mutations';
import type { AlertSeverity, AppNotification } from '@/types/db';

const SEVERITY: Record<AlertSeverity, { dot: string; border: string }> = themed(() => ({
  critical: { dot: color.red, border: alpha.redBorder },
  positive: { dot: color.green, border: alpha.greenBorder },
  warning: { dot: color.amber, border: alpha.amberBorder },
  info: { dot: color.muted2, border: alpha.border },
}));

/** Screen 17 — what needs you, then everything else. */
export default function NotificationsScreen() {
  const router = useRouter();
  const notifications = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const rows = notifications.data ?? [];
  const needsYou = rows.filter((n) => n.needs_action && !n.read_at);
  const earlier = rows.filter((n) => !n.needs_action || n.read_at);

  /** Each alert routes to whatever it is about. */
  const actionFor = (alert: AppNotification): { label: string; onPress: () => void } | null => {
    if (alert.entity_type === 'invoice' && alert.entity_id) {
      return {
        label: 'Send reminder',
        onPress: () => router.push(`/invoice/${alert.entity_id}/preview`),
      };
    }
    if (alert.entity_type === 'quotation') {
      return { label: 'Raise invoice', onPress: () => router.push('/quotations') };
    }
    if (alert.entity_type === 'tax') {
      return { label: 'Open reports', onPress: () => router.push('/reports') };
    }
    return null;
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={notifications.isRefetching}
          onRefresh={() => void notifications.refetch()}
        />
      }
    >
      <ScreenHeader
        title="Alerts"
        right={
          <LinkButton label="Mark all read" onPress={() => void markAllRead.mutateAsync()} />
        }
      />

      <SectionLabel style={styles.section}>NEEDS YOU</SectionLabel>
      {needsYou.length > 0 ? (
        <View style={styles.list}>
          {needsYou.map((alert) => {
            const tone = SEVERITY[alert.severity];
            const action = actionFor(alert);
            return (
              <Card
                key={alert.id}
                variant="card"
                inset={false}
                borderColor={tone.border}
                style={styles.alertCard}
              >
                <View style={[styles.dot, { backgroundColor: tone.dot }]} />
                <View style={styles.alertBody}>
                  <Text style={text.rowTitle}>{alert.title}</Text>
                  {alert.body ? <Text style={styles.alertMeta}>{alert.body}</Text> : null}
                  {action ? (
                    <View style={styles.alertActions}>
                      <PillButton
                        label={action.label}
                        variant={alert.severity === 'positive' ? 'primary' : 'ink'}
                        onPress={action.onPress}
                      />
                      {alert.severity === 'critical' ? (
                        <PillButton label="Call" variant="outline" onPress={action.onPress} />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <Card variant="card" padded>
          <Text style={text.body}>Nothing needs you right now.</Text>
        </Card>
      )}

      <SectionLabel style={styles.section}>EARLIER</SectionLabel>
      {earlier.length > 0 ? (
        <ListCard>
          {earlier.map((alert) => (
            <Row
              key={alert.id}
              title={alert.title}
              meta={[formatDay(alert.created_at), alert.body].filter(Boolean).join(' · ')}
            />
          ))}
        </ListCard>
      ) : (
        <Card variant="card" padded>
          <Text style={text.body}>No earlier activity.</Text>
        </Card>
      )}

      <View style={styles.footer}>
        <Card variant="card" style={styles.footerCard} inset={false}>
          <Text style={styles.footerLabel}>Which alerts you get</Text>
          <LinkButton label="Manage" onPress={() => router.push('/(tabs)/more')} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  section: { marginTop: 18, marginBottom: 8 },
  list: { paddingHorizontal: gutter.screen, gap: 8 },
  alertCard: { flexDirection: 'row', gap: 12, paddingVertical: 15, paddingHorizontal: 16 },
  dot: { width: 8, height: 8, borderRadius: 99, marginTop: 5 },
  alertBody: { flex: 1 },
  alertMeta: { marginTop: 3, fontFamily: font.sans, fontSize: 12, lineHeight: 18, color: color.muted },
  alertActions: { marginTop: 9, flexDirection: 'row', gap: 8 },

  footer: { marginTop: 20, paddingHorizontal: gutter.screen },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  footerLabel: { fontFamily: font.sans, fontSize: 13, color: color.muted },
}));
