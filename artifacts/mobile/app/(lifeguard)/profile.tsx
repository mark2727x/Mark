import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { H2, H3, Body, Caption, Label } from '@workspace/latent-studio-ds/components/native/typography';
import { Badge } from '@workspace/latent-studio-ds/components/native/badge';
import { Card, CardContent } from '@workspace/latent-studio-ds/components/native/card';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { Input } from '@workspace/latent-studio-ds/components/native/input';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

function StarRating({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Body key={i} style={{ color: i <= Math.round(value) ? c.primary : c.border, fontSize: 16 }}>
          ★
        </Body>
      ))}
    </View>
  );
}

export default function LifeguardProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');

  const connectStatus = useQuery<{ hasAccount: boolean; onboarded: boolean }>({
    queryKey: ['connect-status'],
    queryFn: () => apiFetch('/connect/status'),
    enabled: !!user,
  });

  const onboardMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ url: string }>('/connect/onboarding-link', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: async (data) => {
      await Linking.openURL(data.url);
      qc.invalidateQueries({ queryKey: ['connect-status'] });
    },
  });

  if (!user) return null;

  async function savePhone() {
    if (phone.replace(/\D/g, '').length < 10) {
      setPhoneMessage('Enter a valid 10-digit phone number');
      return;
    }
    setSavingPhone(true);
    setPhoneMessage('');
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ phone: phone.trim() }),
      });
      await refreshUser();
      setPhoneMessage('Phone number saved');
    } catch (error: any) {
      setPhoneMessage(error.message ?? 'Could not save phone number');
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <H2 style={styles.pageTitle}>Profile</H2>

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Body style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Body>
          </View>
          <View style={{ gap: 4 }}>
            <H3>{user.name}</H3>
            <Caption style={styles.role}>Lifeguard</Caption>
            {user.ratingCount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <StarRating value={user.ratingAvg} />
                <Caption style={{ color: c.mutedForeground }}>
                  {user.ratingAvg.toFixed(1)} ({user.ratingCount} reviews)
                </Caption>
              </View>
            )}
          </View>
        </View>

        {/* Info */}
        <Card style={styles.card}>
          <CardContent>
            <Label style={styles.cardLabel}>Email</Label>
            <Body style={styles.cardValue}>{user.email}</Body>
            <Label style={[styles.cardLabel, { marginTop: 12 }]}>Phone</Label>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Button size="sm" loading={savingPhone} onPress={savePhone} style={styles.savePhoneBtn}>
              Save phone
            </Button>
            {phoneMessage ? <Caption style={styles.phoneMessage}>{phoneMessage}</Caption> : null}
            {user.bio && (
              <>
                <Label style={[styles.cardLabel, { marginTop: 12 }]}>Bio</Label>
                <Body style={styles.cardValue}>{user.bio}</Body>
              </>
            )}
            {user.zelleId && (
              <>
                <Label style={[styles.cardLabel, { marginTop: 12 }]}>Zelle ID</Label>
                <Body style={styles.cardValue}>{user.zelleId}</Body>
              </>
            )}
          </CardContent>
        </Card>

        {/* Certifications */}
        {user.certifications && user.certifications.length > 0 && (
          <Card style={styles.card}>
            <CardContent>
              <Label style={styles.cardLabel}>Certifications</Label>
              <View style={styles.certRow}>
                {user.certifications.map(cert => (
                  <Badge key={cert} variant="outline" label={cert} />
                ))}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Payment note */}
        <Card style={styles.card}>
          <CardContent>
            <Label style={styles.cardLabel}>Stripe payouts</Label>
            {connectStatus.data?.onboarded ? (
              <>
                <Badge variant="success" label="Payouts enabled" />
                <Body style={[styles.cardValue, { marginTop: 8 }]}>
                  You're all set to receive payouts to your bank on completed shifts.
                </Body>
              </>
            ) : (
              <>
                <Body style={styles.cardValue}>
                  Connect a bank account through Stripe to receive payouts on completed shifts.
                  Managers pay via Stripe Checkout — you get the payout minus a 1.5% service fee
                  (managers pay a matching 1.5%, so the platform's total fee is 3%).
                </Body>
                <Button
                  size="sm"
                  loading={onboardMutation.isPending}
                  onPress={() => onboardMutation.mutate()}
                  style={styles.savePhoneBtn}
                  testID="connect-stripe-btn"
                >
                  {connectStatus.data?.hasAccount ? 'Continue Stripe onboarding' : 'Set up Stripe payouts'}
                </Button>
                {onboardMutation.error ? (
                  <Caption style={[styles.phoneMessage, { color: c.destructive }]}>
                    {(onboardMutation.error as Error).message}
                  </Caption>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" style={styles.logoutBtn} onPress={logout}>
          Sign out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  pageTitle: { paddingTop: 12, marginBottom: 24 },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 64, height: 64,
    borderRadius: 4,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: c.primaryForeground,
    fontFamily: f.sansBold,
    fontSize: 28,
  },
  role: { color: c.mutedForeground },
  card: { marginBottom: 12 },
  cardLabel: { color: c.mutedForeground, marginBottom: 4 },
  cardValue: { color: c.foreground },
  certRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  logoutBtn: { marginTop: 12 },
  savePhoneBtn: { alignSelf: 'flex-start', marginTop: 10 },
  phoneMessage: { color: c.mutedForeground, marginTop: 8 },
});
