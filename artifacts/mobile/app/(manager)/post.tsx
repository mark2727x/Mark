import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { H2, Body, Caption } from '@workspace/latent-studio-ds/components/native/typography';
import { Input, Textarea } from '@workspace/latent-studio-ds/components/native/input';
import { Button } from '@workspace/latent-studio-ds/components/native/button';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

const c = nativeTheme.colors.dark;

const CERTS = ['Lifeguard', 'CPR/AED', 'WSI', 'Water Safety', 'First Aid'];

export default function PostShiftScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [payRate, setPayRate] = useState('');
  const [hours, setHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [cert, setCert] = useState('Lifeguard');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handlePost() {
    if (!title.trim() || !streetAddress.trim() || !city.trim() || !stateCode.trim() || !zipCode.trim() ||
      !payRate || !hours || !startDate.trim() || !startTime.trim() || !description.trim() || !rules.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()) || !/^\d{2}:\d{2}$/.test(startTime.trim())) {
      setError('Use the date format YYYY-MM-DD and time format HH:MM');
      return;
    }
    const month = Number(startDate.slice(5, 7));
    const day = Number(startDate.slice(8, 10));
    const hour = Number(startTime.slice(0, 2));
    const minute = Number(startTime.slice(3, 5));
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
      setError('Enter a real calendar date and time');
      return;
    }
    const localStart = new Date(`${startDate.trim()}T${startTime.trim()}:00`);
    if (isNaN(localStart.getTime()) ||
      localStart.getFullYear() !== Number(startDate.slice(0, 4)) ||
      localStart.getMonth() + 1 !== month ||
      localStart.getDate() !== day ||
      localStart.getHours() !== hour ||
      localStart.getMinutes() !== minute) {
      setError('Enter a real calendar date and time');
      return;
    }
    if (localStart.getTime() <= Date.now()) {
      setError('The shift must start in the future');
      return;
    }
    if (!/^\d{2}$/.test(stateCode.trim().toUpperCase()) || !/^\d{5}(?:-\d{4})?$/.test(zipCode.trim())) {
      setError('Enter a 2-letter state abbreviation and 5-digit ZIP code');
      return;
    }
    const location = `${streetAddress.trim()}, ${city.trim()}, ${stateCode.trim().toUpperCase()} ${zipCode.trim()}`;
    const startIso = localStart.toISOString();

    setError('');
    setLoading(true);
    try {
      await apiFetch('/shifts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          location,
          payRate: parseFloat(payRate),
          totalHours: parseFloat(hours),
          startTime: startIso,
          certificationRequired: cert,
          description,
          rules,
        }),
      });
      await qc.invalidateQueries({ queryKey: ['manager-shifts', user?.id] });
      setSuccess(true);
      // Reset
      setTitle(''); setStreetAddress(''); setCity(''); setStateCode(''); setZipCode('');
      setPayRate(''); setHours('');
      setStartDate(''); setStartTime(''); setDescription(''); setRules('');
    } catch (e: any) {
      setError(e.message ?? 'Failed to post shift');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={c.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <H2 style={styles.heading}>Post a Shift</H2>

        {success && (
          <View style={styles.successBanner}>
            <Body style={styles.successText}>✓ Shift posted!</Body>
          </View>
        )}

        <View style={styles.form}>
          <Input label="Job title *" value={title} onChangeText={setTitle} placeholder="Morning Lifeguard" />
          <Caption style={styles.sectionHint}>Enter the exact pool address so the lifeguard knows where to report.</Caption>
          <Input label="Street address *" value={streetAddress} onChangeText={setStreetAddress} placeholder="123 Main Street" autoComplete="street-address" />
          <Input label="City *" value={city} onChangeText={setCity} placeholder="Austin" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="State *" value={stateCode} onChangeText={(value) => setStateCode(value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} placeholder="TX" autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="ZIP code *" value={zipCode} onChangeText={setZipCode} placeholder="78701" keyboardType="numbers-and-punctuation" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Pay rate ($/hr) *" value={payRate} onChangeText={setPayRate} keyboardType="decimal-pad" placeholder="18.00" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Total hours *" value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="4" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Date * (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-08-10" keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Time * (HH:MM, 24-hour)" value={startTime} onChangeText={setStartTime} placeholder="08:00" keyboardType="numbers-and-punctuation" />
            </View>
          </View>

          {/* Cert selector */}
          <View>
            <Caption style={styles.certLabel}>Required certification *</Caption>
            <View style={styles.certRow}>
              {CERTS.map(c_ => (
                <TouchableOpacity
                  key={c_}
                  style={[styles.certChip, cert === c_ && styles.certChipActive]}
                  onPress={() => setCert(c_)}
                >
                  <Caption style={[styles.certChipText, cert === c_ && styles.certChipTextActive]}>{c_}</Caption>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Textarea label="Description *" value={description} onChangeText={setDescription} placeholder="What the lifeguard will be doing…" rows={3} />
          <Textarea label="Rules & requirements *" value={rules} onChangeText={setRules} placeholder="Uniform required, arrive 10 min early…" rows={3} />

          {error ? <Body style={styles.error}>{error}</Body> : null}

          <Button size="lg" loading={loading} onPress={handlePost} style={styles.btn}>
            Post shift
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const c2 = nativeTheme.colors.dark;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c2.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  heading: { paddingTop: 12, marginBottom: 24 },
  form: { gap: 16 },
  sectionHint: { color: c2.mutedForeground, lineHeight: 18, marginBottom: -8 },
  row: { flexDirection: 'row', gap: 12 },
  certLabel: { color: c2.mutedForeground, marginBottom: 8 },
  certRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  certChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: nativeTheme.radius,
    borderWidth: 1, borderColor: c2.border,
    backgroundColor: 'transparent',
  },
  certChipActive: { borderColor: c2.primary, backgroundColor: `${c2.primary}22` },
  certChipText: { color: c2.mutedForeground },
  certChipTextActive: { color: c2.primary, fontFamily: nativeTheme.fontFamily.sansMedium },
  successBanner: {
    backgroundColor: '#7fd06822',
    borderWidth: 1, borderColor: '#7fd068',
    borderRadius: nativeTheme.radius,
    padding: 12, marginBottom: 16,
  },
  successText: { color: '#7fd068', fontFamily: nativeTheme.fontFamily.sansMedium },
  error: { color: c2.destructive, fontSize: 13 },
  btn: { marginTop: 8 },
});
