import React, { useState } from 'react';
import {
  View, StyleSheet, FlatList, StatusBar, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { H2, Body, Caption } from '@workspace/latent-studio-ds/components/native/typography';
import { ShiftCard, type ShiftCardData } from '@/components/ShiftCard';
import { apiFetch } from '@/lib/api';

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

export default function FeedScreen() {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery<ShiftCardData[]>({
    queryKey: ['shifts', 'open'],
    queryFn: () => apiFetch('/shifts?status=open'),
  });

  const filtered = (data ?? []).filter(s =>
    search === '' ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.location.toLowerCase().includes(search.toLowerCase()) ||
    s.certificationRequired.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <H2>Available Shifts</H2>
          <Caption style={styles.subhead}>
            {data ? `${data.length} open` : 'Loading…'}
          </Caption>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title, location, cert…"
          placeholderTextColor={c.mutedForeground}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={c.primary}
          />
        }
        renderItem={({ item }) => (
          <ShiftCard shift={item} showManager />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Body style={styles.emptyText}>
              {isLoading ? 'Loading shifts…' : 'No open shifts right now'}
            </Body>
            <Caption style={styles.emptyCaption}>Pull to refresh</Caption>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subhead: { color: c.mutedForeground, marginTop: 2 },
  searchRow: { paddingHorizontal: 20, paddingBottom: 12 },
  searchInput: {
    backgroundColor: c.muted,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: nativeTheme.radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: f.sans,
    fontSize: 14,
    color: c.foreground,
  },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: c.mutedForeground },
  emptyCaption: { color: c.muted },
});
