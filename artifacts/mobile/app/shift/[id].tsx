import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Badge } from '@workspace/latent-studio-ds/components/native/badge';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { Card, CardContent } from '@workspace/latent-studio-ds/components/native/card';
import {
  Display, H3, Body, Caption, Label, Mono,
} from '@workspace/latent-studio-ds/components/native/typography';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import type { BadgeVariant } from '@workspace/latent-studio-ds/components/native/badge';

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'open': return 'success';
    case 'filled': return 'default';
    case 'completed': return 'muted';
    default: return 'outline';
  }
}

interface ShiftDetail {
  id: number;
  title: string;
  location: string;
  payRate: number;
  totalHours: number;
  startTime: string;
  certificationRequired: string;
  description: string;
  rules: string;
  status: string;
  paymentStatus?: string;
  managerId: number;
  workerId?: number | null;
  manager?: { id: number; name: string; ratingAvg: number; ratingCount: number } | null;
  worker?: { id: number; name: string; ratingAvg: number; ratingCount: number; zelleId?: string | null; stripeConnectOnboarded?: boolean } | null;
  managerContact?: { name: string; phone: string } | null;
  workerContact?: { name: string; phone: string } | null;
}

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: shift, isLoading } = useQuery<ShiftDetail>({
    queryKey: ['shift', id],
    queryFn: () => apiFetch(`/shifts/${id}`),
    enabled: !!id,
  });

  const pickupMutation = useMutation({
    mutationFn: () => apiFetch(`/shifts/${id}/pickup`, { method: 'POST' }),
    onSuccess: (updatedShift) => {
      qc.setQueryData(['shift', id], updatedShift);
      qc.invalidateQueries({ queryKey: ['shift', id] });
      qc.invalidateQueries({ queryKey: ['shifts', 'open'] });
      qc.invalidateQueries({ queryKey: ['user-shifts', user?.id] });
    },
  });

  const dropMutation = useMutation({
    mutationFn: () => apiFetch(`/shifts/${id}/drop`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift', id] });
      qc.invalidateQueries({ queryKey: ['shifts', 'open'] });
      qc.invalidateQueries({ queryKey: ['user-shifts', user?.id] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => apiFetch(`/shifts/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift', id] });
      qc.invalidateQueries({ queryKey: ['manager-shifts', user?.id] });
    },
  });

  const payMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ checkout_url: string; session_id: string }>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          shift_id: Number(id),
          origin_url: `https://${process.env.EXPO_PUBLIC_DOMAIN}`,
        }),
      }),
    onSuccess: async (data) => {
      if (data.checkout_url) {
        await WebBrowser.openBrowserAsync(data.checkout_url);
      }
      qc.invalidateQueries({ queryKey: ['shift', id] });
    },
  });

  const payoutMutation = useMutation({
    mutationFn: () => apiFetch(`/shifts/${id}/payout`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift', id] });
    },
  });

  function handleDrop() {
    Alert.alert('Drop shift?', 'The shift will return to the open pool.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Drop', style: 'destructive', onPress: () => dropMutation.mutate() },
    ]);
  }

  function handleComplete() {
    Alert.alert('Mark as completed?', 'This signals the lifeguard has worked the shift.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => completeMutation.mutate() },
    ]);
  }

  if (!shift || isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Body style={{ color: c.mutedForeground, padding: 24 }}>Loading…</Body>
      </SafeAreaView>
    );
  }

  const date = new Date(shift.startTime);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = new Date(date.getTime() + shift.totalHours * 3600_000);
  const endStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const base = shift.payRate * shift.totalHours;
  const total = base.toFixed(2);
  // Manager pays 1.5% surcharge on top; lifeguard has 1.5% deducted from payout.
  const managerCharge = (base * 1.015).toFixed(2);
  const lifeguardNet = (base * 0.985).toFixed(2);

  const isLifeguard = user?.role === 'lifeguard';
  const isManager = user?.role === 'manager' && shift.managerId === user.id;
  const isAssigned = shift.workerId === user?.id;
  const otherContact = isLifeguard ? shift.managerContact : isManager ? shift.workerContact : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Body style={styles.backText}>←</Body>
        </TouchableOpacity>
        <Badge variant={statusVariant(shift.status)} label={shift.status} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Display style={styles.title}>{shift.title}</Display>
        <Body style={styles.location}>📍 {shift.location}</Body>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Label style={styles.statVal}>${shift.payRate}/hr</Label>
            <Caption style={styles.statLbl}>Pay rate</Caption>
          </View>
          <View style={styles.statBox}>
            <Label style={styles.statVal}>{shift.totalHours}h</Label>
            <Caption style={styles.statLbl}>Duration</Caption>
          </View>
          <View style={styles.statBox}>
            <Label style={styles.statVal}>${isManager ? managerCharge : lifeguardNet}</Label>
            <Caption style={styles.statLbl}>{isManager ? 'You pay' : 'You earn'}</Caption>
          </View>
        </View>

        {/* Date */}
        <Card style={styles.card}>
          <CardContent>
            <Label style={styles.sectionLabel}>Schedule</Label>
            <Body style={styles.dateText}>{dateStr}</Body>
            <Caption style={{ color: c.mutedForeground }}>{timeStr} – {endStr}</Caption>
          </CardContent>
        </Card>

        {/* Cert */}
        <Card style={styles.card}>
          <CardContent>
            <Label style={styles.sectionLabel}>Required certification</Label>
            <Badge variant="outline" label={shift.certificationRequired} />
          </CardContent>
        </Card>

        {/* Description */}
        <Card style={styles.card}>
          <CardContent>
            <Label style={styles.sectionLabel}>Description</Label>
            <Body style={styles.descText}>{shift.description}</Body>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card style={styles.card}>
          <CardContent>
            <Label style={styles.sectionLabel}>Rules & requirements</Label>
            <Body style={styles.descText}>{shift.rules}</Body>
          </CardContent>
        </Card>

        {/* Employer */}
        {shift.manager && (
          <Card style={styles.card}>
            <CardContent>
              <Label style={styles.sectionLabel}>Posted by</Label>
              <H3 style={styles.personName}>{shift.manager.name}</H3>
              {shift.manager.ratingCount > 0 && (
                <Caption style={{ color: c.mutedForeground }}>
                  ★ {shift.manager.ratingAvg.toFixed(1)} ({shift.manager.ratingCount} reviews)
                </Caption>
              )}
            </CardContent>
          </Card>
        )}

        {/* Worker */}
        {shift.worker && (
          <Card style={styles.card}>
            <CardContent>
              <Label style={styles.sectionLabel}>Assigned lifeguard</Label>
              <H3 style={styles.personName}>{shift.worker.name}</H3>
              {shift.worker.ratingCount > 0 && (
                <Caption style={{ color: c.mutedForeground }}>
                  ★ {shift.worker.ratingAvg.toFixed(1)} ({shift.worker.ratingCount} reviews)
                </Caption>
              )}
              {shift.status === 'completed' && shift.worker.zelleId && (
                <View style={styles.zelleBox}>
                  <Caption style={styles.zelleLabel}>Zelle to:</Caption>
                  <Mono style={styles.zelleId}>{shift.worker.zelleId}</Mono>
                </View>
              )}
            </CardContent>
          </Card>
        )}

        {shift.status === 'filled' && otherContact && (
          <Card style={styles.card}>
            <CardContent>
              <Label style={styles.sectionLabel}>Shift contact</Label>
              <H3 style={styles.personName}>{otherContact.name}</H3>
              <Caption style={styles.contactNote}>
                This contact is shared because you are assigned to this shift.
              </Caption>
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${otherContact.phone.replace(/[^\d+]/g, '')}`)}
                style={styles.phoneButton}
              >
                <Mono style={styles.phoneText}>☎ {otherContact.phone}</Mono>
              </TouchableOpacity>
            </CardContent>
          </Card>
        )}

        {/* Mutaton errors */}
        {(pickupMutation.error || dropMutation.error || completeMutation.error || payMutation.error || payoutMutation.error) && (
          <Body style={styles.mutError}>
            {((pickupMutation.error || dropMutation.error || completeMutation.error || payMutation.error || payoutMutation.error) as Error).message}
          </Body>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isLifeguard && shift.status === 'open' && !isAssigned && (
            <Button
              size="lg"
              loading={pickupMutation.isPending}
              onPress={() => pickupMutation.mutate()}
              style={styles.actionBtn}
            >
              Pick up shift — earn ${lifeguardNet}
            </Button>
          )}
          {isLifeguard && shift.status === 'filled' && isAssigned && (
            <Button variant="outline" size="lg" loading={dropMutation.isPending} onPress={handleDrop} style={styles.actionBtn}>
              Drop shift
            </Button>
          )}
          {isManager && shift.status === 'filled' && shift.paymentStatus !== 'paid' && shift.paymentStatus !== 'paid_out' && (
            <>
              <Button
                size="lg"
                loading={payMutation.isPending}
                onPress={() => payMutation.mutate()}
                style={styles.actionBtn}
                testID="pay-shift-btn"
              >
                Pay ${managerCharge} with Stripe
              </Button>
              <Caption style={{ color: c.mutedForeground, textAlign: 'center' }}>
                ${total} shift + 1.5% service fee. Lifeguard receives ${lifeguardNet} after their 1.5%.
              </Caption>
            </>
          )}
          {isManager && shift.status === 'filled' && (shift.paymentStatus === 'paid' || shift.paymentStatus === 'paid_out') && (
            <Button size="lg" loading={completeMutation.isPending} onPress={handleComplete} style={styles.actionBtn}>
              Mark completed
            </Button>
          )}
          {isManager && shift.status === 'completed' && shift.paymentStatus === 'paid' && (
            <Button
              size="lg"
              loading={payoutMutation.isPending}
              onPress={() => payoutMutation.mutate()}
              style={styles.actionBtn}
              testID="send-payout-btn"
            >
              Send payout to lifeguard
            </Button>
          )}
          {isManager && shift.status === 'completed' && shift.paymentStatus === 'paid_out' && (
            <Badge variant="success" label="Payout sent" />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  backText: { color: c.foreground, fontSize: 22 },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  title: { marginBottom: 6, marginTop: 4 },
  location: { color: c.mutedForeground, marginBottom: 24 },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: c.muted,
    borderRadius: nativeTheme.radius,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 2,
  },
  statVal: { color: c.foreground, fontFamily: f.sansSemiBold },
  statLbl: { color: c.mutedForeground },
  card: { marginBottom: 12 },
  sectionLabel: { color: c.mutedForeground, marginBottom: 8 },
  dateText: { color: c.foreground },
  descText: { color: c.foreground, lineHeight: 22 },
  personName: { color: c.foreground, marginBottom: 4 },
  zelleBox: {
    marginTop: 10,
    backgroundColor: c.accent,
    borderRadius: nativeTheme.radius,
    padding: 10,
    gap: 4,
  },
  zelleLabel: { color: c.mutedForeground },
  zelleId: { color: c.foreground, fontSize: 14 },
  contactNote: { color: c.mutedForeground, marginBottom: 10 },
  phoneButton: {
    backgroundColor: c.primary,
    borderRadius: nativeTheme.radius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  phoneText: { color: c.primaryForeground, fontSize: 14 },
  mutError: { color: c.destructive, fontSize: 13, marginBottom: 8 },
  actions: { gap: 10, marginTop: 8 },
  actionBtn: { width: '100%' },
});
