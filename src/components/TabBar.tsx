import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { alpha, color, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { text } from '@/theme/type';

/**
 * expo-router bundles its own copy of the bottom-tabs types, which are not
 * assignable to the ones in @react-navigation/bottom-tabs. Describing only the
 * parts of the tab-bar props this component actually reads keeps it compatible
 * with whichever copy the router hands over.
 */
type TabRoute = { key: string; name: string };

export type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/**
 * HOME · SPEND · (+) · BILLING · MORE.
 *
 * The design's bar is a white strip with a hairline on top, four all-caps labels
 * at 9.5px and a 46px green circle in the middle that overhangs by 4px. The plus
 * is not a tab — it opens the add-expense modal — so it is rendered separately
 * rather than as a fifth route.
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const left = state.routes.slice(0, 2);
  const right = state.routes.slice(2);

  const renderTab = (route: TabRoute) => {
    const index = state.routes.findIndex((r: TabRoute) => r.key === route.key);
    const focused = state.index === index;
    const { options } = descriptors[route.key];
    const label = (options.title ?? route.name).toUpperCase();

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={styles.tab}
        hitSlop={6}
      >
        <Text style={focused ? text.tabActive : text.tab}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 18 }]}>
      {left.map(renderTab)}

      <Pressable
        onPress={() => router.push('/add-expense')}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>

      {right.map(renderTab)}
    </View>
  );
}

const styles = themedStyles(() => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 12,
    backgroundColor: color.card,
    borderTopWidth: 1,
    borderTopColor: alpha.tabBorder,
  },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 2 },
  fab: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
    // The export lifts the circle 4px above the label baseline.
    marginBottom: -4,
  },
  plus: {
    color: color.onAccent,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: 'InstrumentSans_400Regular',
  },
  pressed: { opacity: 0.85 },
}));
