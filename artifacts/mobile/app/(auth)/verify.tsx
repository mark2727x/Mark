import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { Input } from '@workspace/latent-studio-ds/components/native/input';
import { H1, Body, Caption } from '@workspace/latent-studio-ds/components/native/typography';
import { useAuth } from '@/context/auth';

const c = nativeTheme.colors.dark;

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const { verifyEmail, resendVerification } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState(params.code ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    params.code ? `Development verification code: ${params.code}` : ''
  );
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!email.trim() || !code.trim()) {
      setError('Enter your email and 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyEmail(email.trim().toLowerCase(), code.trim());
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    try {
      const result = await resendVerification(email.trim().toLowerCase());
      if (result.verificationCode) {
        setCode(result.verificationCode);
        setNotice(`Development verification code: ${result.verificationCode}`);
      } else {
        setNotice('A new code was requested. Check your email.');
      }
    } catch (e: any) {
      setError(e.message ?? 'Could not resend code');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Caption style={{ color: c.mutedForeground }}>← Back</Caption>
        </TouchableOpacity>
        <H1 style={styles.heading}>Verify your email</H1>
        <Body style={styles.sub}>
          Enter the 6-digit code to activate your ShiftGuard account.
        </Body>
        {notice ? <Body style={styles.notice}>{notice}</Body> : null}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Input
            label="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
          />
          {error ? <Body style={styles.error}>{error}</Body> : null}
          <Button size="lg" loading={loading} onPress={handleVerify}>
            Verify email
          </Button>
          <Button variant="ghost" onPress={handleResend}>
            Resend code
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  back: { paddingTop: 16, paddingBottom: 24 },
  heading: { marginBottom: 6 },
  sub: { color: c.mutedForeground, marginBottom: 20 },
  notice: {
    color: c.primary,
    backgroundColor: `${c.primary}18`,
    borderWidth: 1,
    borderColor: c.primary,
    padding: 12,
    marginBottom: 16,
  },
  form: { gap: 16 },
  error: { color: c.destructive, fontSize: 13 },
});