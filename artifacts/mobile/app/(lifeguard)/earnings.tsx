import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Display, H2, H3, Body, Caption, Label, Mono } from '@workspace/latent-studio-ds/components/native/typography';
import { Card, CardContent } from '@workspace/latent-studio-ds/components/native/card';
import { Badge } from '@workspace/latent-studio-ds/components/native/badge';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

interface EarningsShift {
  shiftId: number;
  title: string;
  startTime: string;
  status: 'open' | 'filled' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'payout_pending' | 'paid_out';
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
}
interface EarningsSummary {
  connectOnboarded: boolean;
  platformFeeBps: number;
  totals: {
    pendingCents: number;
    paidCents: number;
    paidOutCents: number;
    lifetimeCents: number;
  };
  shifts: EarningsShift[];
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusLabel(shift: EarningsShift): { text: string; variant: 'success' | 'default' | 'muted' | 'outline' | 'destructive' } {
  if (shift.status === 'cancelled') return { text: 'Cancelled', variant: 'destructive' };
  if (shift.paymentStatus === 'paid_out') return { text: 'Paid out', variant: 'success' };
  if (shift.paymentStatus === 'paid') return { text: 'Awaiting payout', variant: 'default' };
  if (shift.status === 'completed') return { text: 'Awaiting payment', variant: 'muted' };
  return { text: 'Upcoming', variant: 'outline' };
}

export default function EarningsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery<EarningsSummary>({
    queryKey: ['my-earnings'],
    queryFn: () => apiFetch('/users/me/earnings'),
    enabled: !!user,
  });

  const totals = data?.totals;
  const feePct = data ? (data.platformFeeBps / 100).toFixed(0) : '10';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.mutedForeground} />
        }
      >
        <H2 style={styles.pageTitle}>Earnings</H2>

        {/* Hero: lifetime earned */}
        <Card style={styles.heroCard}>
          <CardContent>
            <Caption style={styles.heroLabel}>Lifetime earnings</Caption>
            <Display style={styles.heroAmount} testID="earnings-lifetime">
              {usd(totals?.lifetimeCents ?? 0)}
            </Display>
            <Caption style={styles.feeNote}>
              After a {feePct}% platform fee
            </Caption>
          </CardContent>
        </Card>

        {/* Breakdown grid */}
        <View style={styles.grid}>
          <Card style={styles.gridCard}>
            <CardContent>
              <Caption style={styles.gridLabel}>Pending</Caption>
              <H3 style={styles.gridAmount} testID="earnings-pending">
                {usd(totals?.pendingCents ?? 0)}
              </H3>
              <Caption style={styles.gridSub}>Not yet paid by manager</Caption>
            </CardContent>
          </Card>
          <Card style={styles.gridCard}>
            <CardContent>
              <Caption style={styles.gridLabel}>Awaiting payout</Caption>
              <H3 style={styles.gridAmount} testID="earnings-awaiting">
                {usd(totals?.paidCents ?? 0)}
              </H3>
              <Caption style={styles.gridSub}>Paid, headed to your bank</Caption>
            </CardContent>
          </Card>
        </View>

        {/* Connect status */}
        {!data?.connectOnboarded && (
          <Card style={[styles.card, styles.warnCard]}>
            <CardContent>
              <Label style={{ color: c.destructive, marginBottom: 4 }}>
                Payouts not set up
              </Label>
              <Body style={{ color: c.foreground }}>
                Finish Stripe onboarding from your Profile to receive payouts to your bank.
              </Body>
            </CardContent>
          </Card>
        )}

        {/* Per-shift receipts */}
        <Label style={[styles.sectionLabel, { marginTop: 8 }]}>Shift receipts</Label>
        {data?.shifts.length === 0 && (
          <Body style={styles.emptyText}>No shifts yet — pick one up from the Shifts tab.</Body>
        )}
        {data?.shifts.map((shift) => {
          const badge = statusLabel(shift);
          const date = new Date(shift.startTime);
          return (
            <TouchableOpacity
              key={shift.shiftId}
              activeOpacity={0.85}
              onPress={() => router.push(`/shift/${shift.shiftId}`)}
              testID={`earnings-row-${shift.shiftId}`}
            >
              <Card style={styles.card}>
                <CardContent>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <H3 style={styles.rowTitle}>{shift.title}</H3>
                      <Caption style={styles.rowDate}>
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Caption>
                    </View>
                    <Badge variant={badge.variant} label={badge.text} />
                  </View>
                  <View style={styles.receipt}>
                    <View style={styles.receiptRow}>
                      <Caption style={styles.receiptLabel}>Gross</Caption>
                      <Mono style={styles.receiptValue}>{usd(shift.grossCents)}</Mono>
                    </View>
                    <View style={styles.receiptRow}>
                      <Caption style={styles.receiptLabel}>Platform fee ({feePct}%)</Caption>
                      <Mono style={styles.receiptValue}>−{usd(shift.platformFeeCents)}</Mono>
                    </View>
                    <View style={[styles.receiptRow, styles.receiptTotal]}>
                      <Label style={styles.receiptLabelBold}>You earn</Label>
                      <Mono style={styles.receiptValueBold}>{usd(shift.netCents)}</Mono>
                    </View>
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>
          );
        })}

        {isLoading && (
          <Body style={styles.emptyText}>Loading…</Body>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  pageTitle: { paddingTop: 12, marginBottom: 20 },
  heroCard: {
    marginBottom: 12,
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  heroLabel: { color: c.primaryForeground, opacity: 0.8 },
  heroAmount: { color: c.primaryForeground, fontFamily: f.serif, marginTop: 6, marginBottom: 4 },
  feeNote: { color: c.primaryForeground, opacity: 0.7 },
  grid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  gridCard: { flex: 1 },
  gridLabel: { color: c.mutedForeground, marginBottom: 4 },
  gridAmount: { color: c.foreground, marginBottom: 4 },
  gridSub: { color: c.mutedForeground },
  card: { marginBottom: 10 },
  warnCard: { borderColor: c.destructive },
  sectionLabel: { color: c.mutedForeground, marginBottom: 10 },
  emptyText: { color: c.mutedForeground, paddingVertical: 24, textAlign: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  rowTitle: { color: c.foreground },
  rowDate: { color: c.mutedForeground, marginTop: 2 },
  receipt: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 10,
    gap: 6,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  receiptLabel: { color: c.mutedForeground },
  receiptValue: { color: c.foreground, fontSize: 14 },
  receiptLabelBold: { color: c.foreground },
  receiptValueBold: { color: c.foreground, fontSize: 15, fontFamily: f.mono },
});
