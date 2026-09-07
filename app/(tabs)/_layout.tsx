import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/components';
import { color } from '@/theme/tokens';

/**
 * Four tabs; the centre "+" in TabBar is a modal trigger, not a route, which is
 * why it does not appear here.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="spend" options={{ title: 'Spend' }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
