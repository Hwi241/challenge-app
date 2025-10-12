// screens/SimpleNotificationScreen.js
// - 요일 원형(중앙정렬), 폰트 작게
// - '매일 반복' + '매주 반복' 버튼(동일 높이): 매주는 모달로 1~5번째주 또는 매주 선택, 라벨 동적 변경
// - 시간 여러 개(최대 10개) 추가/삭제
// - 저장 시 payload: { days, time(첫번째), times[], weeks: 'every' | number[] } 로 AddChallenge에 replace

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { buttonStyles, colors, spacing, radius, card as cardStyles } from '../styles/common';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const CIRCLE = 40;
const MAX_TIMES = 10;

const pad2 = (n) => String(n).padStart(2, '0');
const toHHmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export default function SimpleNotificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { initial, returnTo } = route.params || {};

  const [selectedDays, setSelectedDays] = useState([]); // ['월'..]
  const [times, setTimes] = useState([]);               // ['HH:MM', ...]
  const [showTimePicker, setShowTimePicker] = useState(false);

  // 매주 반복(주차) 선택
  const [weekModal, setWeekModal] = useState(false);
  const [weeks, setWeeks] = useState('every'); // 'every' | number[]

  // 초기값 반영
  useEffect(() => {
    if (!initial) return;
    try {
      if (Array.isArray(initial.days)) {
        const valid = initial.days.filter((d) => DAY_LABELS.includes(d));
        setSelectedDays(valid.length ? valid : []);
      }
      if (Array.isArray(initial.times) && initial.times.length) {
        setTimes([...new Set(initial.times.map(String))].sort());
      } else if (typeof initial.time === 'string') {
        setTimes([initial.time]);
      }
      if (Array.isArray(initial.weeks) && initial.weeks.length) {
        const norm = initial.weeks
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5)
          .sort((a, b) => a - b);
        setWeeks(norm.length ? norm : 'every');
      } else if (initial.weeks === 'every') {
        setWeeks('every');
      }
    } catch {}
  }, [initial]);

  const isDaily = useMemo(() => selectedDays.length === 7, [selectedDays]);
  const weekLabel = useMemo(() => {
    if (weeks === 'every') return '매주 반복';
    if (!Array.isArray(weeks) || weeks.length === 0) return '매주 반복';
    return weeks.slice().sort((a, b) => a - b).join(',') + '번째주';
  }, [weeks]);

  // 요일 토글
  const toggleDay = useCallback((d) => {
    setSelectedDays((prev) => {
      const has = prev.includes(d);
      const next = has ? prev.filter((x) => x !== d) : [...prev, d];
      return next.sort((a, b) => DAY_LABELS.indexOf(a) - DAY_LABELS.indexOf(b));
    });
  }, []);

  // 매일 반복 토글
  const toggleDaily = useCallback(() => {
    setSelectedDays((prev) => (prev.length === 7 ? [] : DAY_LABELS.slice()));
  }, []);

  // 시간 추가/삭제
  const onConfirmTime = (d) => {
    const t = toHHmm(d);
    setShowTimePicker(false);
    setTimes((prev) => {
      if (prev.includes(t)) {
        Alert.alert('중복', '이미 추가된 시간입니다.');
        return prev;
      }
      if (prev.length >= MAX_TIMES) {
        Alert.alert('제한', `최대 ${MAX_TIMES}개까지 가능합니다.`);
        return prev;
      }
      const arr = [...prev, t].sort();
      return arr;
    });
  };
  const removeTime = useCallback((t) => {
    setTimes((prev) => prev.filter((x) => x !== t));
  }, []);

  // 주차 선택
  const toggleWeek = useCallback((n) => {
    if (n === 'every') {
      setWeeks('every');
      return;
    }
    setWeeks((prev) => {
      if (prev === 'every') return [n];
      const set = new Set(prev);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      const arr = Array.from(set).sort((a, b) => a - b);
      return arr.length ? arr : 'every';
    });
  }, []);

  // 저장
  const save = useCallback(() => {
    if (!times.length) {
      Alert.alert('확인', '알림 시간을 1개 이상 선택해주세요.');
      return;
    }
    if (!selectedDays.length) {
      Alert.alert('확인', '요일을 한 개 이상 선택해주세요.');
      return;
    }
    const firstTime = times.slice().sort()[0];
    const payload = {
      days: selectedDays,
      time: firstTime,
      times: times.slice().sort(),
      weeks: (Array.isArray(weeks) && weeks.length) ? weeks : 'every',
    };
    const result = { mode: 'simple', payload };

    // onDone 콜백 우선 (편집 화면 등)
    const onDone = route.params?.onDone;
    if (typeof onDone === 'function') {
      onDone(result);
      navigation.goBack();
      return;
    }
    // AddChallenge로 교체 navigate (뒤로가기 루프 방지)
    navigation.navigate(returnTo || 'AddChallenge', {
      notificationResult: result,
      _nonce: Date.now(),
    });
  }, [navigation, returnTo, route.params?.onDone, selectedDays, times, weeks]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>간단 알림 설정</Text>

      {/* 요일 선택 */}
      <View style={cardStyles.base}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>요일 선택</Text>
          <View style={{ flexDirection: 'row', columnGap: 8 }}>
            <TouchableOpacity
              onPress={toggleDaily}
              activeOpacity={0.9}
              style={[styles.toggleBtn, isDaily && styles.toggleBtnOn]}
            >
              <Text style={[styles.toggleBtnText, isDaily && styles.toggleBtnTextOn]}>매일 반복</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setWeekModal(true)}
              activeOpacity={0.9}
              style={[styles.toggleBtn, styles.toggleBtnOn /* 기본 검정 */]}
            >
              <Text style={[styles.toggleBtnText, styles.toggleBtnTextOn]} numberOfLines={1}>
                {weekLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.daysWrap}>
          {DAY_LABELS.map((d) => {
            const active = selectedDays.includes(d);
            return (
              <TouchableOpacity
                key={d}
                style={[styles.dayCircle, active ? styles.dayCircleOn : styles.dayCircleOff]}
                onPress={() => toggleDay(d)}
                activeOpacity={0.9}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text allowFontScaling={false} style={[styles.dayText, active && styles.dayTextOn]}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 시간 선택 */}
      <View style={[cardStyles.base, { marginTop: spacing.lg }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>알림 시간</Text>
          <Text style={styles.helpText}>최대 {MAX_TIMES}개</Text>
        </View>

        <View style={styles.timeChips}>
          {times.map((t) => (
            <View key={t} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1} allowFontScaling={false}>
                {t}
              </Text>
              <TouchableOpacity onPress={() => removeTime(t)}>
                <Text style={styles.chipRemove}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {times.length < MAX_TIMES && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.addBtnPlus}>＋</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 완료 */}
      <TouchableOpacity
        style={[buttonStyles.primary.container, { marginTop: spacing.xl }]}
        onPress={save}
        activeOpacity={0.9}
      >
        <Text style={buttonStyles.primary.label}>선택완료</Text>
      </TouchableOpacity>

      {/* 시간 피커 */}
      <DateTimePickerModal
        isVisible={showTimePicker}
        mode="time"
        onConfirm={onConfirmTime}
        onCancel={() => setShowTimePicker(false)}
        is24Hour
      />

      {/* 주차 선택 모달 */}
      <Modal visible={weekModal} transparent animationType="fade" onRequestClose={() => setWeekModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>반복 주차 선택</Text>
            <View style={{ rowGap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = Array.isArray(weeks) && weeks.includes(n);
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.modalRow, active && styles.modalRowOn]}
                    onPress={() => toggleWeek(n)}
                  >
                    <Text style={[styles.modalRowText, active && styles.modalRowTextOn]}>{n}번째 주</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.modalRow, weeks === 'every' && styles.modalRowOn]}
                onPress={() => toggleWeek('every')}
              >
                <Text style={[styles.modalRowText, weeks === 'every' && styles.modalRowTextOn]}>매주</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalClose} onPress={() => setWeekModal(false)}>
              <Text style={styles.modalCloseText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: colors.gray800, marginBottom: spacing.lg, textAlign: 'center' },

  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.gray800 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helpText: { color: colors.gray600, fontSize: 12, marginTop: 4 },

  daysWrap: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },

  // 원 컨테이너 자체에서 중앙 정렬
  dayCircle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayCircleOff: { borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  dayCircleOn: { borderColor: '#000000', backgroundColor: '#000000' },
  dayText: { fontSize: 12, fontWeight: '800', color: '#374151', includeFontPadding: false, textAlign: 'center' }, // 작게
  dayTextOn: { color: '#FFFFFF' },

  toggleBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  toggleBtnOn: { borderColor: '#000000', backgroundColor: '#000000' },
  toggleBtnText: { fontSize: 12, fontWeight: '800', color: '#111111' },
  toggleBtnTextOn: { color: '#FFFFFF' },

  timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 6 },
  chipText: { color: colors.gray800, fontSize: 12, marginRight: 6 },
  chipRemove: { color: '#6B7280', fontSize: 14, fontWeight: '800' },
  addBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  addBtnPlus: { color: colors.gray700, fontSize: 16, fontWeight: '800', lineHeight: 16 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: '#FFF', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.gray800, marginBottom: spacing.md, textAlign: 'center' },
  modalRow: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: radius.md },
  modalRowOn: { backgroundColor: '#000', borderColor: '#000' },
  modalRowText: { color: colors.gray800, fontWeight: '700' },
  modalRowTextOn: { color: '#FFF' },
  modalClose: { marginTop: spacing.md, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#000' },
  modalCloseText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
});
