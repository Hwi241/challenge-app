import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { buttonStyles, card as canonicalCardStyles, control as canonicalControlStyles, layout as canonicalLayoutStyles, modal as canonicalModalStyles, space, surface as canonicalSurfaceStyles, text as canonicalTextStyles } from '../styles/common';
import BackButton from '../components/BackButton';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const CIRCLE = 40;
const MAX_TIMES = 10;

const pad2 = (n) => String(n).padStart(2, '0');
const toHHmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const normalizeSimpleConfig = (source) => {
  const days = Array.isArray(source?.days)
    ? source.days
        .map(String)
        .filter((d) => DAY_LABELS.includes(d))
        .sort((a, b) => DAY_LABELS.indexOf(a) - DAY_LABELS.indexOf(b))
    : [];

  const rawTimes = Array.isArray(source?.times) && source.times.length
    ? source.times
    : (typeof source?.time === 'string' && source.time ? [source.time] : []);

  const times = [...new Set(rawTimes.map(String).filter(Boolean))].sort();

  const weeks = Array.isArray(source?.weeks) && source.weeks.length
    ? source.weeks
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5)
        .sort((a, b) => a - b)
    : 'every';

  return {
    days,
    times,
    weeks: Array.isArray(weeks) && weeks.length ? weeks : 'every',
  };
};

const stringifySimpleConfig = (source) => JSON.stringify(normalizeSimpleConfig(source));

export default function SimpleNotificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
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

  const initialConfigKey = useMemo(() => stringifySimpleConfig(initial), [initial]);

  const currentConfig = useMemo(() => ({
    days: selectedDays,
    times,
    weeks,
  }), [selectedDays, times, weeks]);

  const currentConfigKey = useMemo(() => stringifySimpleConfig(currentConfig), [currentConfig]);

  const hasUnsavedChanges = useCallback(() => (
    currentConfigKey !== initialConfigKey
  ), [currentConfigKey, initialConfigKey]);

  const { handleBackPress, markAsSaved, confirmSave } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '설정 중인 내용이 있어요',
    message: '뒤로 가면 변경한 알림 설정이 저장되지 않습니다.',
    stayText: '계속 설정',
    leaveText: '나가기',
  });

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

    confirmSave({
      title: '저장하시겠습니까?',
      message: '간단 알림 설정을 저장할까요?',
      onConfirm: () => {
        const firstTime = times.slice().sort()[0];
        const payload = {
          days: selectedDays,
          time: firstTime,
          times: times.slice().sort(),
          weeks: (Array.isArray(weeks) && weeks.length) ? weeks : 'every',
        };
        const result = { mode: 'simple', payload };

        markAsSaved();

        const onDone = route.params?.onDone;
        if (typeof onDone === 'function') {
          onDone(result);
          navigation.goBack();
          return;
        }
        navigation.navigate(returnTo || 'AddChallenge', {
          notificationResult: result,
          _nonce: Date.now(),
        });
      },
    });
  }, [confirmSave, markAsSaved, navigation, returnTo, route.params?.onDone, selectedDays, times, weeks]);

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen} edges={['top', 'bottom']}>
      <BackButton title="간단 알림 설정" onPress={handleBackPress} />
      <ScrollView contentContainerStyle={[canonicalLayoutStyles.screenContent, { paddingBottom: space.xxl + space.xxs + Math.max(insets.bottom, space.md) }]}>
      

      {/* 요일 선택 */}
      <View style={canonicalCardStyles.base}>
        <View style={canonicalLayoutStyles.rowBetween}>
          <Text style={canonicalTextStyles.sectionTitle}>요일 선택</Text>
          <View style={[canonicalLayoutStyles.row, styles.headerActions]}>
            <TouchableOpacity
              onPress={toggleDaily}
              activeOpacity={0.9}
              style={[canonicalControlStyles.pill, isDaily && canonicalControlStyles.pillActive]}
            >
              <Text style={[canonicalControlStyles.pillText, isDaily && canonicalControlStyles.pillTextActive]}>매일 반복</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setWeekModal(true)}
              activeOpacity={0.9}
              style={[canonicalControlStyles.pill, canonicalControlStyles.pillActive /* 기본 검정 */]}
            >
              <Text style={[canonicalControlStyles.pillText, canonicalControlStyles.pillTextActive]} numberOfLines={1}>
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
                style={[canonicalControlStyles.selectCircle40, active ? canonicalControlStyles.selectCircleOn : canonicalControlStyles.selectCircleOff]}
                onPress={() => toggleDay(d)}
                activeOpacity={0.9}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text allowFontScaling={false} style={[canonicalControlStyles.selectCircleText, active && canonicalControlStyles.selectCircleTextOn]}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 시간 선택 */}
      <View style={[canonicalCardStyles.base, styles.timeCard]}>
        <View style={canonicalLayoutStyles.rowBetween}>
          <Text style={canonicalTextStyles.sectionTitle}>알림 시간</Text>
          <Text style={[canonicalTextStyles.help, styles.timeLimit]}>최대 {MAX_TIMES}개</Text>
        </View>

        <View style={styles.timeChips}>
          {times.map((t) => (
            <View key={t} style={canonicalControlStyles.chip}>
              <Text style={canonicalControlStyles.chipText} numberOfLines={1} allowFontScaling={false}>
                {t}
              </Text>
              <TouchableOpacity onPress={() => removeTime(t)}>
                <Text style={canonicalControlStyles.chipRemove}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {times.length < MAX_TIMES && (
            <TouchableOpacity style={canonicalControlStyles.addCircle} onPress={() => setShowTimePicker(true)}>
              <Text style={canonicalControlStyles.addCircleText}>＋</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 완료 */}
      <TouchableOpacity
        style={[buttonStyles.primary.container, styles.saveButton]}
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
        <View style={canonicalModalStyles.backdrop}>
          <View style={canonicalModalStyles.sheetBorderless}>
            <Text style={canonicalModalStyles.title}>반복 주차 선택</Text>
            <View style={styles.weekOptions}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = Array.isArray(weeks) && weeks.includes(n);
                return (
                  <TouchableOpacity
                    key={n}
                    style={[canonicalControlStyles.optionRow, active && canonicalControlStyles.optionRowActive]}
                    onPress={() => toggleWeek(n)}
                  >
                    <Text style={[canonicalControlStyles.optionText, active && canonicalControlStyles.optionTextActive]}>{n}번째 주</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[canonicalControlStyles.optionRow, weeks === 'every' && canonicalControlStyles.optionRowActive]}
                onPress={() => toggleWeek('every')}
              >
                <Text style={[canonicalControlStyles.optionText, weeks === 'every' && canonicalControlStyles.optionTextActive]}>매주</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={canonicalModalStyles.closePill} onPress={() => setWeekModal(false)}>
              <Text style={canonicalModalStyles.closePillText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
 headerActions: {
 columnGap: space.xs,
 },

 daysWrap: {
 marginTop: space.sm,
 flexDirection: 'row',
 justifyContent: 'space-between',
 },

 timeCard: {
 marginTop: space.md,
 },

 timeLimit: {
 marginTop: space.xxs,
 },

 timeChips: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 gap: space.xxs + 2,
 marginTop: space.xs,
 },

 saveButton: {
 marginTop: space.xl,
 },

 weekOptions: {
 rowGap: space.xs,
 },
});
