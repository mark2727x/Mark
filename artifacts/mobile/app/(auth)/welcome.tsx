import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { Display, Body, Caption } from '@workspace/latent-studio-ds/components/native/typography';

const c = nativeTheme.colors.dark;

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />

      {/* Brand mark */}
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Body style={styles.logoText}>SG</Body>
        </View>
        <Display style={styles.title}>ShiftGuard</Display>
        <Body style={styles.subtitle}>
          The lifeguard shift marketplace.{'\n'}Pick up shifts or post openings — on demand.
        </Body>
      </View>

      {/* Role pills */}
      <View style={styles.roles}>
        <View style={styles.roleCard}>
          <Body style={styles.roleEmoji}>🏊</Body>
          <Body style={styles.roleTitle}>Lifeguard</Body>
          <Caption style={styles.roleDesc}>Browse and pick up shifts near you</Caption>
        </View>
        <View style={styles.roleCard}>
          <Body style={styles.roleEmoji}>🏛</Body>
          <Body style={styles.roleTitle}>Pool Manager</Body>
          <Caption style={styles.roleDesc}>Post openings and hire certified guards</Caption>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <Button size="lg" style={styles.btnPrimary} onPress={() => router.push('/(auth)/register')}>
          Create account
        </Button>
        <Button variant="ghost" size="lg" onPress={() => router.push('/(auth)/login')}>
          Sign in
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
    paddingHorizontal: 24,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: {
    color: c.primaryForeground,
    fontFamily: nativeTheme.fontFamily.sansBold,
    fontSize: 22,
  },
  title: {
    fontSize: 42,
    color: c.foreground,
  },
  subtitle: {
    color: c.mutedForeground,
    lineHeight: 24,
  },
  roles: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  roleCard: {
    flex: 1,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: nativeTheme.radius,
    padding: 14,
    gap: 4,
  },
  roleEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  roleTitle: {
    fontFamily: nativeTheme.fontFamily.sansSemiBold,
    color: c.foreground,
  },
  roleDesc: {
    color: c.mutedForeground,
  },
  cta: {
    gap: 10,
    paddingBottom: 16,
  },
  btnPrimary: {
    width: '100%',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.border,
  },
  dividerText: {
    color: c.mutedForeground,
  },
});
