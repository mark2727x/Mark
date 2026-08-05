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
  const [location, setLocation] = useState('');
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
    if (!title || !location || !payRate || !hours || !startDate || !startTime || !description || !rules) {
      setError('Please fill in all fields');
      return;
    }
    const startIso = new Date(`${startDate}T${startTime}`).toISOString();
    if (isNaN(new Date(startIso).getTime())) {
      setError('Invalid date or time. Use YYYY-MM-DD and HH:MM');
      return;
    }

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
      setTitle(''); setLocation(''); setPayRate(''); setHours('');
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
          <Input label="Location *" value={location} onChangeText={setLocation} placeholder="Riverside Aquatics, Austin TX" />

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
              <Input label="Time * (HH:MM)" value={startTime} onChangeText={setStartTime} placeholder="08:00" keyboardType="numbers-and-punctuation" />
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
