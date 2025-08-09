// screens/SimpleNotificationScreen.js
// - onDone 콜백으로 결과 전달 + goBack()
// - 경고/중복 네비게이션 없이 Edit 화면 미리보기 즉시 갱신

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { buttonStyles, colors, spacing, radius, cardStyles } from '../styles/common';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const toHHmm = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

export default function SimpleNotificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { initial, onDone } = route.params || {};

  const [mode, setMode] = useState('daily');       // 'daily' | 'weeklyDays'
  const [selectedDays, setSelectedDays] = useState([]);
  const [time, setTime] = useState(null);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (!initial) return;
    try {
      if (Array.isArray(initial.days) && typeof initial.time === 'string') {
        setTime(initial.time);
        const isDaily = initial.days.length === 7 && DAY_LABELS.every(d => initial.days.includes(d));
        if (isDaily) { setMode('daily'); setSelectedDays(DAY_LABELS.slice()); }
        else { setMode('weeklyDays'); setSelectedDays(initial.days.filter(d => DAY_LABELS.includes(d))); }
      }
    } catch {}
  }, [initial]);

  useEffect(() => {
    if (mode === 'daily') setSelectedDays(DAY_LABELS.slice());
    else if (selectedDays.length === 7) setSelectedDays([]);
  }, [mode]);

  const previewText = useMemo(() => {
    if (!time) return '시간을 아직 선택하지 않았습니다.';
    const [hStr, mStr] = time.split(':'); const h = Number(hStr); const m = Number(mStr);
    const isAM = h < 12; const h12 = h % 12 === 0 ? 12 : h % 12; const mm = m > 0 ? `${m}분` : ''; const period = isAM ? '오전' : '오후';
    if (mode === 'daily') return `매일 ${period} ${h12}시 ${mm} 알림`;
    const daysText = selectedDays.length ? selectedDays.map(d => `[${d}]`).join(' ') : '[요일 미선택]';
    return `선택요일 매주 반복: ${daysText} ${period} ${h12}시 ${mm} 알림`;
  }, [mode, time, selectedDays]);

  const toggleDay = (d) => { if (mode !== 'weeklyDays') return;
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); };
  const onConfirmTime = (d) => { setShowTimePicker(false); setTime(toHHmm(d)); };

  const save = useCallback(() => {
    if (!time) { Alert.alert('확인', '알림 시간을 선택해주세요.'); return; }
    let daysToSave = selectedDays;
    if (mode === 'daily') daysToSave = DAY_LABELS.slice();
    else if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      Alert.alert('확인', '요일을 한 개 이상 선택해주세요.'); return;
    }

    onDone && onDone({
      mode: 'simple',
      payload: { days: daysToSave, time },
    });
    navigation.goBack();
  }, [navigation, onDone, mode, time, selectedDays]);

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>간단 알림 설정</Text>

      <View style={cardStyles.container}>
        <Text style={cardStyles.title}>알림 방식</Text>
        <View style={{ marginTop: spacing.sm }}>
          <TouchableOpacity style={[styles.radioRow, mode === 'daily' && styles.radioRowActive]} onPress={() => setMode('daily')}>
            <View style={[styles.radioDot, mode === 'daily' && styles.radioDotActive]} />
            <Text style={styles.radioLabel}>매일 반복</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.radioRow, mode === 'weeklyDays' && styles.radioRowActive]} onPress={() => setMode('weeklyDays')}>
            <View style={[styles.radioDot, mode === 'weeklyDays' && styles.radioDotActive]} />
            <Text style={styles.radioLabel}>선택요일 매주 반복</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[cardStyles.container, { marginTop: spacing.lg }]}>
        <Text style={cardStyles.title}>세부 설정</Text>

        {mode === 'weeklyDays' && (
          <TouchableOpacity style={[buttonStyles.compactRight, { alignSelf: 'flex-start', marginTop: spacing.sm }]} onPress={() => setShowDayPicker(true)}>
            <Text style={buttonStyles.compactRightText}>요일 선택</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[buttonStyles.compactRight, { alignSelf: 'flex-start', marginTop: spacing.sm }]} onPress={() => setShowTimePicker(true)}>
          <Text style={buttonStyles.compactRightText}>알림 시간 선택</Text>
        </TouchableOpacity>

        <View style={styles.previewBox}><Text style={styles.previewText}>{previewText}</Text></View>
      </View>

      <TouchableOpacity style={[buttonStyles.primary, { marginTop: spacing.xl }]} onPress={save}>
        <Text style={buttonStyles.primaryText}>선택완료</Text>
      </TouchableOpacity>

      {/* 요일 모달 */}
      <Modal visible={showDayPicker} transparent animationType="fade" onRequestClose={() => setShowDayPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>요일 선택</Text>
            <View style={styles.weekRow}>
              {DAY_LABELS.map((d) => {
                const active = selectedDays.includes(d);
                return (
                  <TouchableOpacity key={d} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => toggleDay(d)}>
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowDayPicker(false)}>
              <Text style={styles.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 시간 모달 */}
      <DateTimePickerModal isVisible={showTimePicker} mode="time" onConfirm={onConfirmTime} onCancel={() => setShowTimePicker(false)} is24Hour />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: colors.gray800, marginBottom: spacing.lg },

  radioRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md, marginTop: spacing.sm,
  },
  radioRowActive: { borderColor: colors.black },
  radioDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: colors.gray400, marginRight: 10, backgroundColor: colors.white,
  },
  radioDotActive: { borderColor: colors.black, backgroundColor: colors.black },
  radioLabel: { color: colors.gray800, fontWeight: '600' },

  previewBox: {
    marginTop: spacing.md,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: colors.gray100, borderRadius: radius.md,
  },
  previewText: { color: colors.gray800 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.gray800, marginBottom: spacing.md, textAlign: 'center' },
  modalClose: { marginTop: spacing.md, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.black },
  modalCloseText: { color: colors.white, fontWeight: '700', fontSize: 12 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayChip: {
    borderWidth: 1, borderColor: colors.gray300,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  dayChipActive: { borderColor: colors.black, backgroundColor: colors.white },
  dayChipText: { color: colors.gray700, fontWeight: '600' },
  dayChipTextActive: { color: colors.black },
});
