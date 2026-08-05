import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Pressable,
} from 'react-native';
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
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const STATE_CODE = /^[A-Z]{2}$/;
const ZIP_CODE = /^\d{5}(?:-\d{4})?$/;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  if (!value) return 'Select a date';
  const [year, month, day] = value.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function formatTimeLabel(hour: number | null, minute: number | null) {
  if (hour === null || minute === null) return 'Select a time';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function calendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
}

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
  const [startHour, setStartHour] = useState<number | null>(null);
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [openPicker, setOpenPicker] = useState<'date' | 'time' | null>(null);
  const [cert, setCert] = useState('Lifeguard');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handlePost() {
    if (!title.trim() || !streetAddress.trim() || !city.trim() || !stateCode.trim() || !zipCode.trim() ||
      !payRate || !hours || !startDate || startHour === null || startMinute === null ||
      !description.trim() || !rules.trim()) {
      setError('Please fill in all fields');
      return;
    }
    const [year, month, day] = startDate.split('-').map(Number);
    const localStart = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    if (isNaN(localStart.getTime()) ||
      localStart.getFullYear() !== year ||
      localStart.getMonth() + 1 !== month ||
      localStart.getDate() !== day ||
      localStart.getHours() !== startHour ||
      localStart.getMinutes() !== startMinute) {
      setError('Enter a real calendar date and time');
      return;
    }
    if (localStart.getTime() <= Date.now()) {
      setError('The shift must start in the future');
      return;
    }
    const normalizedState = stateCode.trim().toUpperCase();
    const normalizedZip = zipCode.replace(/\D/g, '');
    const formattedZip = normalizedZip.length === 9
      ? `${normalizedZip.slice(0, 5)}-${normalizedZip.slice(5)}`
      : normalizedZip;
    if (!STATE_CODE.test(normalizedState) || !ZIP_CODE.test(formattedZip)) {
      setError('Enter a 2-letter state abbreviation and 5-digit ZIP code');
      return;
    }
    const location = `${streetAddress.trim()}, ${city.trim()}, ${normalizedState} ${formattedZip}`;
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
      setStartDate(''); setStartHour(null); setStartMinute(null); setDescription(''); setRules('');
      setOpenPicker(null);
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
              <Input label="State *" value={stateCode} onChangeText={(value) => setStateCode(value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} placeholder="TX" autoCapitalize="characters" maxLength={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="ZIP code *"
                value={zipCode}
                onChangeText={(value) => setZipCode(value.replace(/\D/g, '').slice(0, 9))}
                placeholder="78701"
                keyboardType="number-pad"
                maxLength={9}
              />
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
              <Caption style={styles.fieldLabel}>Date *</Caption>
              <TouchableOpacity
                style={[styles.pickerTrigger, openPicker === 'date' && styles.pickerTriggerActive]}
                onPress={() => setOpenPicker(openPicker === 'date' ? null : 'date')}
                accessibilityRole="button"
                accessibilityLabel="Choose shift date"
              >
                <Body style={startDate ? styles.pickerValue : styles.pickerPlaceholder}>
                  {startDate ? formatDateLabel(startDate) : 'Choose date'}
                </Body>
                <Caption style={styles.chevron}>⌄</Caption>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Caption style={styles.fieldLabel}>Time *</Caption>
              <TouchableOpacity
                style={[styles.pickerTrigger, openPicker === 'time' && styles.pickerTriggerActive]}
                onPress={() => setOpenPicker(openPicker === 'time' ? null : 'time')}
                accessibilityRole="button"
                accessibilityLabel="Choose shift time"
              >
                <Body style={startHour !== null && startMinute !== null ? styles.pickerValue : styles.pickerPlaceholder}>
                  {formatTimeLabel(startHour, startMinute)}
                </Body>
                <Caption style={styles.chevron}>⌄</Caption>
              </TouchableOpacity>
            </View>
          </View>

          {openPicker === 'date' && (
            <View style={styles.pickerPanel}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  style={styles.monthButton}
                  accessibilityLabel="Previous month"
                >
                  <Body style={styles.monthButtonText}>‹</Body>
                </TouchableOpacity>
                <Body style={styles.monthTitle}>
                  {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </Body>
                <TouchableOpacity
                  onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  style={styles.monthButton}
                  accessibilityLabel="Next month"
                >
                  <Body style={styles.monthButtonText}>›</Body>
                </TouchableOpacity>
              </View>
              <View style={styles.calendarGrid}>
                {WEEKDAYS.map((weekday, index) => (
                  <Caption key={`${weekday}-${index}`} style={styles.weekday}>{weekday}</Caption>
                ))}
                {calendarDays(calendarMonth).map((day, index) => {
                  const value = day === null
                    ? ''
                    : dateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                  const isPast = day !== null && value < dateKey(new Date());
                  const isSelected = value === startDate;
                  return (
                    <Pressable
                      key={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-${index}`}
                      disabled={day === null || isPast}
                      onPress={() => {
                        if (day !== null) {
                          setStartDate(value);
                          setOpenPicker(null);
                        }
                      }}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected, isPast && styles.dayCellDisabled]}
                    >
                      <Body style={[styles.dayText, isSelected && styles.dayTextSelected, isPast && styles.dayTextDisabled]}>
                        {day ?? ''}
                      </Body>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {openPicker === 'time' && (
            <View style={styles.pickerPanel}>
              <Caption style={styles.pickerHint}>Choose an hour, then minutes</Caption>
              <View style={styles.periodRow}>
                {[['AM', 0], ['PM', 12]].map(([label, offset]) => (
                  <TouchableOpacity
                    key={label as string}
                    style={[
                      styles.periodButton,
                      startHour !== null && (startHour >= 12 ? offset === 12 : offset === 0) && styles.periodButtonActive,
                    ]}
                    onPress={() => {
                      const current = startHour ?? 8;
                      const hour12 = current % 12 || 12;
                      setStartHour((offset as number) + (hour12 === 12 ? 0 : hour12));
                    }}
                  >
                    <Caption style={styles.periodText}>{label as string}</Caption>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.timeSection}>
                <Caption style={styles.timeSectionLabel}>Hour</Caption>
                <View style={styles.timeOptions}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => {
                    const selectedHour = startHour === null ? null : (startHour % 12 || 12);
                    return (
                      <TouchableOpacity
                        key={hour}
                        style={[styles.timeOption, selectedHour === hour && styles.timeOptionActive]}
                        onPress={() => {
                          const isPm = startHour !== null && startHour >= 12;
                          setStartHour((isPm ? 12 : 0) + (hour === 12 ? 0 : hour));
                        }}
                      >
                        <Caption style={[styles.timeOptionText, selectedHour === hour && styles.timeOptionTextActive]}>
                          {hour}
                        </Caption>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.timeSection}>
                <Caption style={styles.timeSectionLabel}>Minutes</Caption>
                <View style={styles.timeOptions}>
                  {Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.timeOption, startMinute === minute && styles.timeOptionActive]}
                      onPress={() => {
                        setStartMinute(minute);
                        if (startHour !== null) setOpenPicker(null);
                      }}
                    >
                      <Caption style={[styles.timeOptionText, startMinute === minute && styles.timeOptionTextActive]}>
                        {String(minute).padStart(2, '0')}
                      </Caption>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

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
  fieldLabel: {
    color: c2.foreground,
    fontFamily: nativeTheme.fontFamily.sansMedium,
    marginBottom: 4,
  },
  pickerTrigger: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: nativeTheme.radius,
    borderWidth: 1,
    borderColor: c2.border,
    backgroundColor: c2.input,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTriggerActive: { borderColor: c2.primary },
  pickerValue: { color: c2.foreground, fontSize: 13 },
  pickerPlaceholder: { color: c2.mutedForeground, fontSize: 13 },
  chevron: { color: c2.mutedForeground, fontSize: 18, lineHeight: 18 },
  pickerPanel: {
    padding: 14,
    borderRadius: nativeTheme.radius,
    borderWidth: 1,
    borderColor: c2.border,
    backgroundColor: c2.card,
    marginTop: -4,
  },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthTitle: { color: c2.foreground, fontFamily: nativeTheme.fontFamily.sansMedium },
  monthButton: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: c2.input },
  monthButtonText: { color: c2.primary, fontSize: 25, lineHeight: 26 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: c2.mutedForeground, fontSize: 11, paddingBottom: 6 },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  dayCellSelected: { backgroundColor: c2.primary },
  dayCellDisabled: { opacity: 0.3 },
  dayText: { color: c2.foreground, fontSize: 13 },
  dayTextSelected: { color: c2.primaryForeground, fontFamily: nativeTheme.fontFamily.sansMedium },
  dayTextDisabled: { color: c2.mutedForeground },
  pickerHint: { color: c2.mutedForeground, marginBottom: 10 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodButton: { flex: 1, paddingVertical: 9, borderWidth: 1, borderColor: c2.border, borderRadius: 8, alignItems: 'center' },
  periodButtonActive: { borderColor: c2.primary, backgroundColor: `${c2.primary}22` },
  periodText: { color: c2.foreground },
  timeSection: { marginTop: 4 },
  timeSectionLabel: { color: c2.mutedForeground, marginBottom: 6 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeOption: { width: 42, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: c2.border },
  timeOptionActive: { borderColor: c2.primary, backgroundColor: `${c2.primary}22` },
  timeOptionText: { color: c2.foreground },
  timeOptionTextActive: { color: c2.primary, fontFamily: nativeTheme.fontFamily.sansMedium },
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
