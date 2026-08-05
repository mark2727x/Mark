/**
 * Shared shift card — composed from DS primitives.
 * Works for both feed items and "my shifts" lists.
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Card, CardHeader, CardContent } from '@workspace/latent-studio-ds/components/native/card';
import { Badge } from '@workspace/latent-studio-ds/components/native/badge';
import { H3, Body, Caption, Label } from '@workspace/latent-studio-ds/components/native/typography';
import type { BadgeVariant } from '@workspace/latent-studio-ds/components/native/badge';

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

export interface ShiftCardData {
  id: number;
  title: string;
  location: string;
  payRate: number;
  totalHours: number;
  startTime: string;
  certificationRequired: string;
  status: string;
  manager?: { name: string } | null;
  worker?: { name: string } | null;
}

function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'open': return 'success';
    case 'filled': return 'default';
    case 'completed': return 'muted';
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
}

interface Props {
  shift: ShiftCardData;
  showManager?: boolean;
  showWorker?: boolean;
}

export function ShiftCard({ shift, showManager, showWorker }: Props) {
  const router = useRouter();
  const date = new Date(shift.startTime);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const earnStr = `$${(shift.payRate * shift.totalHours).toFixed(2)}`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/shift/${shift.id}`)}
    >
      <Card style={styles.card}>
        <CardHeader style={styles.header}>
          <View style={styles.headerRow}>
            <H3 style={styles.title} numberOfLines={1}>{shift.title}</H3>
            <Badge variant={statusBadgeVariant(shift.status)} label={shift.status} />
          </View>
          <View style={styles.metaRow}>
            <Caption style={styles.location}>📍 {shift.location}</Caption>
          </View>
        </CardHeader>
        <CardContent style={styles.content}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Label style={styles.statValue}>${shift.payRate}/hr</Label>
              <Caption style={styles.statLabel}>Pay rate</Caption>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Label style={styles.statValue}>{shift.totalHours}h</Label>
              <Caption style={styles.statLabel}>Duration</Caption>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Label style={styles.statValue}>{earnStr}</Label>
              <Caption style={styles.statLabel}>Total earn</Caption>
            </View>
          </View>
          <View style={styles.footerRow}>
            <Caption style={styles.date}>{dateStr} · {timeStr}</Caption>
            <Badge variant="outline" label={shift.certificationRequired} />
          </View>
          {showManager && shift.manager && (
            <Caption style={styles.person}>Posted by {shift.manager.name}</Caption>
          )}
          {showWorker && shift.worker && (
            <Caption style={styles.person}>Assigned to {shift.worker.name}</Caption>
          )}
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  header: { paddingBottom: 10 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flex: 1, color: c.foreground },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  location: { color: c.mutedForeground },
  content: { paddingTop: 0, gap: 12 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.muted,
    borderRadius: nativeTheme.radius,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 0,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: c.foreground, fontFamily: f.sansSemiBold },
  statLabel: { color: c.mutedForeground },
  divider: { width: 1, height: 28, backgroundColor: c.border },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: { color: c.mutedForeground },
  person: { color: c.mutedForeground, marginTop: -4 },
});
