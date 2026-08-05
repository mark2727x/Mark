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

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { setError('Fill in all fields'); return; }
    setError('');
    setLoading(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      router.replace(user.role === 'lifeguard' ? '/(lifeguard)/feed' : '/(manager)/shifts');
    } catch (e: any) {
      if (e?.data?.verificationRequired) {
        router.replace({
          pathname: '/(auth)/verify',
          params: { email: e.data.email ?? email.trim().toLowerCase() },
        });
        return;
      }
      setError(e.message ?? 'Login failed');
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
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Caption style={styles.backText}>← Back</Caption>
        </TouchableOpacity>

        <H1 style={styles.heading}>Welcome back</H1>
        <Body style={styles.sub}>Sign in to your ShiftGuard account</Body>

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
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
          />
          {error ? <Body style={styles.error}>{error}</Body> : null}
          <Button size="lg" loading={loading} onPress={handleLogin} style={styles.btn}>
            Sign in
          </Button>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.switchRow}>
          <Caption style={styles.switchText}>
            Don't have an account?{' '}
            <Caption style={styles.switchLink}>Register</Caption>
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
  sub: { color: c.mutedForeground, marginBottom: 32 },
  form: { gap: 16 },
  error: { color: c.destructive, fontSize: 13 },
  btn: { marginTop: 8 },
  switchRow: { marginTop: 32, alignItems: 'center' },
  switchText: { color: c.mutedForeground },
  switchLink: { color: c.primary, fontFamily: nativeTheme.fontFamily.sansMedium },
});
