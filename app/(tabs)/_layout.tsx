import { Tabs } from 'expo-router';
import React from 'react';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HapticTab } from '@/components/haptic-tab';
import { AppColors } from '@/constants/app-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomSpacing = Math.max(insets.bottom, 4);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AppColors.orange,
        tabBarInactiveTintColor: '#8D8179',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 58 + bottomSpacing,
          paddingTop: 0,
          paddingBottom: bottomSpacing,
          backgroundColor: '#FFFFFF',
          borderTopColor: AppColors.line,
        },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Órdenes',
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="receipt-long" color={color} />,
        }}
      />
      <Tabs.Screen
        name="new-order"
        options={{
          title: 'Nueva orden',
          tabBarIcon: ({ color }) => <MaterialIcons size={29} name="add-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cash"
        options={{
          title: 'Caja',
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="point-of-sale" color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menú',
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="restaurant-menu" color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
