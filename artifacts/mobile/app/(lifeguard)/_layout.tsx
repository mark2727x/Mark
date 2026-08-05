import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';

const c = nativeTheme.colors.dark;

export default function LifeguardLayout() {
  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : c.sidebar,
          borderTopWidth: 1,
          borderTopColor: c.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: nativeTheme.fontFamily.sansMedium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Shifts',
          tabBarIcon: ({ color }) => <Feather name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-shifts"
        options={{
          title: 'My Shifts',
          tabBarIcon: ({ color }) => <Feather name="check-square" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
