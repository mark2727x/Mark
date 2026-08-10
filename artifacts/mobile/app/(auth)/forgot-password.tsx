import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { Input } from '@workspace/latent-studio-ds/components/native/input';
import { H1, Body, Caption } from '@workspace/latent-studio-ds/components/native/typography';
import { useAuth } from '@/context/auth';

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Enter the email on your account');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { resetCode } = await forgotPassword(email.trim().toLowerCase());
      router.replace({
        pathname: '/(auth)/reset-password',
        params: { email: email.trim().toLowerCase(), code: resetCode ?? '' },
      });
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Caption style={styles.backText}>← Back</Caption>
        </TouchableOpacity>

        <H1 style={styles.heading}>Reset your password</H1>
        <Body style={styles.sub}>
          Enter the email on your account and we'll send you a 6-digit code to
          reset your password.
        </Body>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
          {error ? <Body style={styles.error}>{error}</Body> : null}
          <Button size="lg" loading={loading} onPress={handleSubmit} testID="forgot-submit-btn">
            Send reset code
          </Button>
        </View>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.switchRow}>
          <Caption style={styles.switchText}>
            Remembered it? <Caption style={styles.switchLink}>Sign in</Caption>
          </Caption>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  backRow: { paddingTop: 16, paddingBottom: 24 },
  backText: { color: c.mutedForeground },
  heading: { marginBottom: 6 },
  sub: { color: c.mutedForeground, marginBottom: 24, lineHeight: 22 },
  form: { gap: 16 },
  error: { color: c.destructive, fontSize: 13 },
  switchRow: { marginTop: 28, alignItems: 'center' },
  switchText: { color: c.mutedForeground },
  switchLink: { color: c.primary, fontFamily: f.sansMedium },
});
