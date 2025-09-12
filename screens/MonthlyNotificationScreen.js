// screens/MonthlyNotificationScreen.js
// - 제목: "월간 알림 설정" 중앙
// - 날짜별 최대 10개(증가)
// - + 버튼 원형, 시간칩 한 줄 표시
// - 저장: replace(returnTo)

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { buttonStyles, spacing, radius, colors } from '../styles/common';

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtHHMM(date) { return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`; }

const DAYS_IN_MONTHLY = 31;
const MAX_PER_DATE = 10;

function normalizeInitial(initial) {
  const map = {};
  for (let d = 1; d <= DAYS_IN_MONTHLY; d++) map[String(d)] = [];

  if (initial && typeof initial === 'object' && !Array.isArray(initial.byDates)) {
    Object.keys(initial).forEach(k => {
      const d = Number(k);
      if (!Number.isFinite(d) || d < 1 || d > DAYS_IN_MONTHLY) return;
      const arr = Array.isArray(initial[k]) ? initial[k] : [];
      map[String(d)] = arr
        .map(x => (typeof x?.time === 'string' ? { time: x.time } : null))
        .filter(Boolean)
        .sort((a,b) => a.time.localeCompare(b.time));
    });
    return map;
  }

  if (initial && Array.isArray(initial.byDates)) {
    for (const item of initial.byDates) {
      const d = Number(item?.date);
      if (!Number.isFinite(d) || d < 1 || d > DAYS_IN_MONTHLY) continue;
      const times = Array.isArray(item.times) ? item.times : [];
      map[String(d)] = times.map(t => ({ time: String(t) }))
                            .sort((a,b) => a.time.localeCompare(b.time));
    }
    return map;
  }

  return map;
}

export default function MonthlyNotificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const initial = route.params?.initial ?? null;
  const returnTo = route.params?.returnTo || 'AddChallenge';

  const [map, setMap] = useState(() => normalizeInitial(initial));
  const [pickerDay, setPickerDay] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const tryAddTime = useCallback((day) => { setPickerDay(day); setPickerVisible(true); }, []);

  const onConfirmTime = useCallback((date) => {
    const t = fmtHHMM(date);
    setPickerVisible(false);
    if (!pickerDay) return;

    const key = String(pickerDay);
    setMap(prev => {
      const arr = Array.isArray(prev[key]) ? [...prev[key]] : [];
      if (arr.length >= MAX_PER_DATE) { Alert.alert('제한', `각 날짜는 최대 ${MAX_PER_DATE}개까지 가능합니다.`); return prev; }
      if (arr.some(x => x.time === t)) { Alert.alert('중복', '이미 추가된 시간입니다.'); return prev; }
      arr.push({ time: t });
      arr.sort((a,b) => a.time.localeCompare(b.time));
      return { ...prev, [key]: arr };
    });
  }, [pickerDay]);

  const onCancelTime = useCallback(() => setPickerVisible(false), []);

  const removeOne = useCallback((day, timeStr) => {
    const key = String(day);
    setMap(prev => {
      const arr = Array.isArray(prev[key]) ? prev[key].filter(x => x.time !== timeStr) : [];
      return { ...prev, [key]: arr };
    });
  }, []);

  const clearAll = useCallback(() => {
    Alert.alert('초기화', '모든 날짜의 알림 시간을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        const empty = {};
        for (let d=1; d<=DAYS_IN_MONTHLY; d++) empty[String(d)] = [];
        setMap(empty);
      }},
    ]);
  }, []);

  const handleDone = useCallback(() => {
    const byDates = [];
    for (let d = 1; d <= DAYS_IN_MONTHLY; d++) {
      const key = String(d);
      const arr = Array.isArray(map[key]) ? map[key] : [];
      if (arr.length) byDates.push({ date: d, times: arr.map(x => x.time) });
    }
    navigation.replace(returnTo, {
      notificationResult: { mode: 'monthly', payload: { byDates } },
      _nonce: Date.now(),
    });
  }, [map, navigation, returnTo]);

  const cells = useMemo(() => {
    const a = [];
    for (let d = 1; d <= DAYS_IN_MONTHLY; d++) a.push({ day: d, key: `d${d}` });
    return a;
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>월간 알림 설정</Text>

      <View style={styles.grid}>
        {cells.map(cell => {
          const d = cell.day;
          const key = String(d);
          const arr = Array.isArray(map[key]) ? map[key] : [];
          const canAdd = arr.length < MAX_PER_DATE;

          return (
            <View key={cell.key} style={styles.cell}>
              <Text style={styles.dateBadge}>{d}</Text>

              <View style={styles.chipsArea}>
                {arr.map(x => (
                  <View key={x.time} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>{x.time}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => removeOne(d, x.time)}
                    >
                      <Text style={styles.chipRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {canAdd && (
                  <TouchableOpacity style={styles.addChip} onPress={() => tryAddTime(d)}>
                    <Text style={styles.addChipPlus}>＋</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
          <Text style={styles.resetBtnText}>초기화</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[buttonStyles.primary.container, { paddingHorizontal: 18 }]}
          onPress={handleDone}
        >
          <Text style={buttonStyles.primary.label}>선택완료</Text>
        </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={pickerVisible}
        mode="time"
        onConfirm={onConfirmTime}
        onCancel={onCancelTime}
        is24Hour
      />
    </ScrollView>
  );
}

const CELL = 48;

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: colors.gray800, textAlign:'center', marginBottom: spacing.sm },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    borderLeftWidth: 1, borderLeftColor: '#E5E7EB',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor:'#FFF'
  },
  cell: {
    width: `${100/7}%`,
    minHeight: CELL + 36,
    padding: 6,
    borderRightWidth: 1, borderRightColor: '#E5E7EB',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  dateBadge: { fontSize: 12, fontWeight: '800', color: colors.gray800, marginBottom: 4, textAlign: 'right' },

  chipsArea: { gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 6 },
  chipText: { color: colors.gray800, fontSize: 12, marginRight: 6 },
  chipRemove: { color: '#6B7280', fontSize: 14, fontWeight: '800' },

  addChip: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    alignItems:'center', justifyContent:'center'
  },
  addChipPlus: { color: colors.gray700, fontSize: 16, fontWeight: '800', lineHeight: 16 },

  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  resetBtn: { backgroundColor:'#FFF', borderWidth:1, borderColor:'#D1D5DB', borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  resetBtnText: { color: colors.gray700, fontSize: 14, fontWeight: '600' },
});
