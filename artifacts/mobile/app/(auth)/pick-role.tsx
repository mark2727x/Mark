import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { Input } from '@workspace/latent-studio-ds/components/native/input';
import { H1, Body, Caption, Label } from '@workspace/latent-studio-ds/components/native/typography';
import { useAuth, type UserRole } from '@/context/auth';

const c = nativeTheme.colors.dark;
const r = nativeTheme.radius;
const f = nativeTheme.fontFamily;

const CERT_TYPES = ['Lifeguarding', 'CPR/AED', 'Water Safety Instructor'] as const;

export default function PickRoleScreen() {
  const router = useRouter();
  const { user, setRole, verifyCertificate, logout } = useAuth();

  const handleUseDifferentAccount = async () => {
    await logout();
    router.replace('/(auth)/welcome');
  };

  const [role, setRoleState] = useState<UserRole>('lifeguard');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [certificateType, setCertificateType] = useState<string>(CERT_TYPES[0]);
  const [certificateNumber, setCertificateNumber] = useState('');
  const [verifiedKey, setVerifiedKey] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const certKey = `American Red Cross|${certificateType}|${certificateNumber.trim().toUpperCase()}`;

  async function handleVerifyCertificate() {
    setError('');
    setVerifying(true);
    try {
      await verifyCertificate({
        association: 'American Red Cross',
        certificateType,
        certificateNumber: certificateNumber.trim(),
      });
      setVerifiedKey(certKey);
    } catch (e: any) {
      setVerifiedKey('');
      setError(e.message ?? 'Certificate could not be verified');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSave() {
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    if (role === 'lifeguard' && verifiedKey !== certKey) {
      setError('Verify your lifeguard certificate first');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await setRole({
        role,
        phone: phone.trim(),
        certificateAssociation: role === 'lifeguard' ? 'American Red Cross' : undefined,
        certificateType: role === 'lifeguard' ? certificateType : undefined,
        certificateNumber:
          role === 'lifeguard' ? certificateNumber.trim().toUpperCase() : undefined,
      });
      router.replace(updated.role === 'lifeguard' ? '/(lifeguard)/feed' : '/(manager)/shifts');
    } catch (e: any) {
      setError(e.message ?? 'Could not save role');
    } finally {
      setSaving(false);
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
        <H1 style={styles.heading}>Welcome, {user?.name?.split(' ')[0] ?? 'friend'}</H1>
        <Body style={styles.sub}>
          One last thing — tell us how you'll use ShiftGuard so we can set your account up.
        </Body>

        <View style={styles.roleRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setRoleState('lifeguard')}
            style={[styles.rolePill, role === 'lifeguard' && styles.rolePillSelected]}
            testID="role-lifeguard-card"
          >
            <Label style={[styles.rolePillTitle, role === 'lifeguard' && styles.rolePillTitleSelected]}>
              Lifeguard
            </Label>
            <Caption style={styles.rolePillDesc}>I pick up shifts</Caption>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setRoleState('manager')}
            style={[styles.rolePill, role === 'manager' && styles.rolePillSelected]}
            testID="role-manager-card"
          >
            <Label style={[styles.rolePillTitle, role === 'manager' && styles.rolePillTitleSelected]}>
              Pool Manager
            </Label>
            <Caption style={styles.rolePillDesc}>I post openings</Caption>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Input
            label="Phone number *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="(555) 123-4567"
          />

          {role === 'lifeguard' && (
            <>
              <View style={styles.section}>
                <Label style={styles.fieldLabel}>Certificate type *</Label>
                <View style={styles.optionRow}>
                  {CERT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      activeOpacity={0.85}
                      onPress={() => {
                        setCertificateType(type);
                        setVerifiedKey('');
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
                onChangeText={(v) => {
                  setCertificateNumber(v.toUpperCase());
                  setVerifiedKey('');
                }}
                placeholder="Enter the ID on your American Red Cross certificate"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://www.redcross.org/take-a-class/digital-certificate')
                }
                activeOpacity={0.75}
              >
                <Caption style={styles.lookupLink}>
                  Open the official Red Cross certificate lookup ↗
                </Caption>
              </TouchableOpacity>
              <Button
                variant="outline"
                loading={verifying}
                onPress={handleVerifyCertificate}
                style={styles.verifyBtn}
              >
                {verifiedKey === certKey ? 'Certificate verified' : 'Verify certificate'}
              </Button>
            </>
          )}

          {error ? <Body style={styles.error}>{error}</Body> : null}

          <Button size="lg" loading={saving} onPress={handleSave} style={styles.btn} testID="finish-signup-btn">
            Finish setting up
          </Button>

          <TouchableOpacity onPress={handleUseDifferentAccount} style={styles.signOut}>
            <Caption style={styles.signOutText}>Use a different account</Caption>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 40 },
  heading: { marginBottom: 6 },
  sub: { color: c.mutedForeground, marginBottom: 24, lineHeight: 22 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  rolePill: {
    flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: r,
    padding: 14, gap: 4,
  },
  rolePillSelected: { borderColor: c.primary, backgroundColor: `${c.primary}18` },
  rolePillTitle: { color: c.foreground },
  rolePillTitleSelected: { color: c.primary },
  rolePillDesc: { color: c.mutedForeground },
  form: { gap: 16 },
  section: { gap: 8 },
  fieldLabel: { color: c.foreground },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderWidth: 1, borderColor: c.border, borderRadius: r, paddingHorizontal: 12, paddingVertical: 10,
  },
  optionSelected: { borderColor: c.primary, backgroundColor: `${c.primary}18` },
  optionText: { color: c.mutedForeground, fontSize: 12 },
  optionTextSelected: { color: c.primary },
  lookupLink: { color: c.primary, textDecorationLine: 'underline' },
  verifyBtn: { marginTop: 2 },
  error: { color: c.destructive, fontSize: 13 },
  btn: { marginTop: 8 },
  signOut: { marginTop: 12, alignItems: 'center' },
  signOutText: { color: c.mutedForeground, fontFamily: f.sansMedium },
});
