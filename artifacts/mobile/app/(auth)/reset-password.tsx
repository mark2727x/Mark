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
const f = nativeTheme.fontFamily;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const { resetPassword, forgotPassword } = useAuth();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState(params.code ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(
    params.code ? 'We\'ve pre-filled your reset code — pick a new password below.' : '',
  );

  async function handleSubmit() {
    if (!email.trim() || !code.trim() || !newPassword) {
      setError('Enter your email, the 6-digit code, and a new password');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const user = await resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      if (!user.role) {
        router.replace('/(auth)/pick-role');
      } else {
        router.replace(user.role === 'lifeguard' ? '/(lifeguard)/feed' : '/(manager)/shifts');
      }
    } catch (e: any) {
      setError(e.message ?? 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) { setError('Enter your email first'); return; }
    setError('');
    setResendLoading(true);
    try {
      const { resetCode } = await forgotPassword(email.trim().toLowerCase());
      if (resetCode) setCode(resetCode);
      setInfo('New reset code sent — check your email.');
    } catch (e: any) {
      setError(e.message ?? 'Could not send a new code');
    } finally {
      setResendLoading(false);
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

        <H1 style={styles.heading}>Choose a new password</H1>
        <Body style={styles.sub}>
          Paste the 6-digit code we sent to your email and pick a new password.
        </Body>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
          />
          <Input
            label="Reset code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="123456"
            maxLength={6}
          />
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Min 8 characters"
          />
          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Repeat your new password"
          />

          {info ? <Caption style={styles.info}>{info}</Caption> : null}
          {error ? <Body style={styles.error}>{error}</Body> : null}

          <Button size="lg" loading={loading} onPress={handleSubmit} testID="reset-submit-btn">
            Reset password
          </Button>
          <Button variant="ghost" loading={resendLoading} onPress={handleResend}>
            Send me a new code
          </Button>
        </View>
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
  info: { color: c.mutedForeground, lineHeight: 17 },
});
