import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { Input } from '@workspace/latent-studio-ds/components/native/input';
import { H1, Body, Caption, Label } from '@workspace/latent-studio-ds/components/native/typography';
import { useAuth } from '@/context/auth';
import type { UserRole } from '@/context/auth';

const c = nativeTheme.colors.dark;
const r = nativeTheme.radius;
const f = nativeTheme.fontFamily;

function RolePill({
  role, label, desc, selected, onPress,
}: { role: UserRole; label: string; desc: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.rolePill, selected && styles.rolePillSelected]}
    >
      <Label style={[styles.rolePillTitle, selected && styles.rolePillTitleSelected]}>{label}</Label>
      <Caption style={styles.rolePillDesc}>{desc}</Caption>
    </TouchableOpacity>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register, verifyCertificate } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('lifeguard');
  const [certificateAssociation, setCertificateAssociation] = useState('American Red Cross');
  const [certificateType, setCertificateType] = useState('Lifeguarding');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [certificateVerifiedKey, setCertificateVerifiedKey] = useState('');
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [additionalCertifications, setAdditionalCertifications] = useState('');
  const [zelleId, setZelleId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const certificateKey = `${certificateAssociation}|${certificateType}|${certificateNumber.trim().toUpperCase()}`;

  async function handleVerifyCertificate() {
    if (!certificateAssociation || !certificateType || !certificateNumber.trim()) {
      setError('Select your association and certificate type, then enter your certificate number');
      return;
    }
    setError('');
    setCertificateLoading(true);
    try {
      await verifyCertificate({
        association: certificateAssociation,
        certificateType,
        certificateNumber: certificateNumber.trim(),
      });
      setCertificateVerifiedKey(certificateKey);
    } catch (e: any) {
      setCertificateVerifiedKey('');
      setError(e.message ?? 'Certificate could not be verified');
    } finally {
      setCertificateLoading(false);
    }
  }

  async function handleRegister() {
    if (!name || !email || !password) { setError('Fill in all required fields'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (role === 'lifeguard' && certificateVerifiedKey !== certificateKey) {
      setError('Verify your lifeguard certificate before creating your account');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        certifications: role === 'lifeguard'
          ? [certificateType, ...additionalCertifications.split(',').map(s => s.trim()).filter(Boolean)]
          : undefined,
        certificateAssociation: role === 'lifeguard' ? certificateAssociation : undefined,
        certificateType: role === 'lifeguard' ? certificateType : undefined,
        certificateNumber: role === 'lifeguard' ? certificateNumber.trim() : undefined,
        zelleId: zelleId.trim() || undefined,
      });
      router.replace({
        pathname: '/(auth)/verify',
        params: { email: result.email, code: result.verificationCode ?? '' },
      });
    } catch (e: any) {
      setError(e.message ?? 'Registration failed');
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

        <H1 style={styles.heading}>Create account</H1>
        <Body style={styles.sub}>Join ShiftGuard as a lifeguard or pool manager</Body>

        {/* Role selector */}
        <View style={styles.roleRow}>
          <RolePill
            role="lifeguard" label="Lifeguard" desc="I pick up shifts"
            selected={role === 'lifeguard'} onPress={() => setRole('lifeguard')}
          />
          <RolePill
            role="manager" label="Pool Manager" desc="I post openings"
            selected={role === 'manager'} onPress={() => setRole('manager')}
          />
        </View>

        <View style={styles.form}>
          <Input label="Full name *" value={name} onChangeText={setName} placeholder="Alex Johnson" autoComplete="name" />
          <Input label="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <Input label="Password *" value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 8 characters" />

          {role === 'lifeguard' && (
            <>
              <View style={styles.certificateSection}>
                <Label style={styles.fieldLabel}>Certificate association *</Label>
                <View style={styles.optionRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setCertificateAssociation('American Red Cross');
                      setCertificateVerifiedKey('');
                    }}
                    style={[styles.option, certificateAssociation === 'American Red Cross' && styles.optionSelected]}
                  >
                    <Label style={[styles.optionText, certificateAssociation === 'American Red Cross' && styles.optionTextSelected]}>
                      American Red Cross
                    </Label>
                  </TouchableOpacity>
                </View>
                <Caption style={styles.helper}>
                  More associations will be added after their verification systems are connected.
                </Caption>
              </View>
              <View style={styles.certificateSection}>
                <Label style={styles.fieldLabel}>Certificate type *</Label>
                <View style={styles.optionRow}>
                  {['Lifeguarding', 'CPR/AED', 'Water Safety Instructor'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      activeOpacity={0.8}
                      onPress={() => {
                        setCertificateType(type);
                        setCertificateVerifiedKey('');
                      }}
                      style={[styles.option, certificateType === type && styles.optionSelected]}
                    >
                      <Label style={[styles.optionText, certificateType === type && styles.optionTextSelected]}>
                        {type}
                      </Label>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Input
                label="Certificate number *"
                value={certificateNumber}
                onChangeText={(value) => {
                  setCertificateNumber(value.toUpperCase());
                  setCertificateVerifiedKey('');
                }}
                placeholder="Enter the ID on your certificate"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => Linking.openURL('https://www.redcross.org/take-a-class/digital-certificate')}
                activeOpacity={0.75}
              >
                <Caption style={styles.lookupLink}>Open the official Red Cross certificate lookup ↗</Caption>
              </TouchableOpacity>
              <Button
                variant="outline"
                loading={certificateLoading}
                onPress={handleVerifyCertificate}
                style={styles.verifyBtn}
              >
                {certificateVerifiedKey === certificateKey ? 'Certificate verified' : 'Verify certificate'}
              </Button>
              <Input
                label="Additional certifications (optional)"
                value={additionalCertifications}
                onChangeText={setAdditionalCertifications}
                placeholder="CPR/AED, WSI"
                autoCapitalize="words"
              />
              <Input
                label="Zelle ID (phone or email)"
                value={zelleId}
                onChangeText={setZelleId}
                placeholder="555-123-4567"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}

          {error ? <Body style={styles.error}>{error}</Body> : null}

          <Button size="lg" loading={loading} onPress={handleRegister} style={styles.btn}>
            Create account
          </Button>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.switchRow}>
          <Caption style={styles.switchText}>
            Already have an account? <Caption style={styles.switchLink}>Sign in</Caption>
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
  sub: { color: c.mutedForeground, marginBottom: 24 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  rolePill: {
    flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: r,
    padding: 14, gap: 4,
  },
  rolePillSelected: { borderColor: c.primary, backgroundColor: `${c.primary}18` },
  rolePillTitle: { color: c.foreground },
  rolePillTitleSelected: { color: c.primary },
  rolePillDesc: { color: c.mutedForeground },
  form: { gap: 16 },
  certificateSection: { gap: 8 },
  fieldLabel: { color: c.foreground },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderWidth: 1, borderColor: c.border, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10,
  },
  optionSelected: { borderColor: c.primary, backgroundColor: `${c.primary}18` },
  optionText: { color: c.mutedForeground, fontSize: 12 },
  optionTextSelected: { color: c.primary },
  helper: { color: c.mutedForeground, lineHeight: 17 },
  lookupLink: { color: c.primary, textDecorationLine: 'underline' },
  verifyBtn: { marginTop: 2 },
  error: { color: c.destructive, fontSize: 13 },
  btn: { marginTop: 8 },
  switchRow: { marginTop: 28, alignItems: 'center' },
  switchText: { color: c.mutedForeground },
  switchLink: { color: c.primary, fontFamily: f.sansMedium },
});
