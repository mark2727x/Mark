import React, { useState } from 'react';
import { View, StyleSheet, FlatList, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { H2, Body, Caption } from '@workspace/latent-studio-ds/components/native/typography';
import { ShiftCard, type ShiftCardData } from '@/components/ShiftCard';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

type Tab = 'filled' | 'completed';

export default function MyShiftsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('filled');

  const { data, isLoading, refetch, isRefetching } = useQuery<ShiftCardData[]>({
    queryKey: ['user-shifts', user?.id],
    queryFn: () => apiFetch(`/users/${user?.id}/shifts`),
    enabled: !!user,
  });

  const filtered = (data ?? []).filter(s => s.status === tab);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />

      <View style={styles.header}>
        <H2>My Shifts</H2>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['filled', 'completed'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Body style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'filled' ? 'Upcoming' : 'Completed'}
            </Body>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <ShiftCard shift={item} showManager />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Body style={styles.emptyText}>
              {isLoading ? 'Loading…' : `No ${tab === 'filled' ? 'upcoming' : 'completed'} shifts`}
            </Body>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: c.muted,
    borderRadius: nativeTheme.radius,
    padding: 3,
    borderWidth: 1,
    borderColor: c.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: nativeTheme.radius,
  },
  tabActive: { backgroundColor: c.card },
  tabText: { fontFamily: f.sansMedium, fontSize: 14, color: c.mutedForeground },
  tabTextActive: { color: c.foreground },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: c.mutedForeground },
});
