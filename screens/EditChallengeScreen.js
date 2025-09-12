// screens/EditChallengeScreen.js
// - UI/색/기능 변경 없음. 공통 스타일 의존 최소화(버튼/spacing만 공통 사용)
// - 기존 onDone 콜백 흐름 유지(개발 경고만, 기능 영향 없음)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import { buttonStyles, spacing } from '../styles/common';
import { numericInputProps, createNumberChangeHandler, toNumberOrZero } from '../utils/number';
import { validateInput, saveAndSchedule } from '../utils/challengeStore';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const TAG = '[EditChallenge]';

// 로컬 팔레트(기존 톤 유지)
const PALETTE = {
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#525252',
  gray800: '#111111',
};
const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 };

function fmtDate(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function timeToHuman(hhmm) {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr); const m = Number(mStr || 0);
  const isAM = h < 12; const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m > 0 ? `${m}분` : '';
  const period = isAM ? '오전' : '오후';
  return `${period} ${h12}시 ${mm}`.trim();
}
function previewTextByNotification(notification) {
  if (!notification || !notification.mode) return '알림 없음';
  const { mode, payload } = notification;
  if (mode === 'simple' && payload?.time && Array.isArray(payload.days)) {
    const days = payload.days.map(d => `[${d}]`).join(' ');
    return `간단 알림: ${days} ${timeToHuman(payload.time)} 반복`;
  }
  if (mode === 'weekly' && Array.isArray(payload?.byWeekDays)) {
    if (!payload.byWeekDays.length) return '주간 상세 알림: 설정 없음';
    const parts = payload.byWeekDays.map(({ day, times = [] }) =>
      `${day} ${times.map(timeToHuman).join(', ')}`);
    return `주간 상세 알림: ${parts.join(' | ')}`;
  }
  if (mode === 'monthly') {
    if (Array.isArray(payload?.byDates) && payload.byDates.length) {
      const parts = payload.byDates.map(({ date, times = [] }) =>
        `${date}일 ${times.map(timeToHuman).join(', ')}`);
      return `월간 상세 알림(날짜): ${parts.join(' | ')}`;
    }
    if (Array.isArray(payload?.byNthWeek) && payload.byNthWeek.length) {
      const parts = payload.byNthWeek.map(({ week, day, times = [] }) =>
        `${week}째주 ${day} ${times.map(timeToHuman).join(', ')}`);
      return `월간 상세 알림(몇째주): ${parts.join(' | ')}`;
    }
    return '월간 상세 알림: 설정 없음';
  }
  return '알림 없음';
}

export default function EditChallengeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const baseChallenge =
    route.params?.challenge || route.params?.backParams?.challenge || null;

  const [loading, setLoading] = useState(true);

  // 폼
  const [title, setTitle] = useState('');
  const [goalScore, setGoalScore] = useState(''); // 빈 문자열 허용
  const [reward, setReward] = useState('');

  // 날짜
  const [startDate, setStartDate] = useState(null); // Date
  const [endDate, setEndDate] = useState(null);     // Date
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // 알림
  const [notification, setNotification] = useState({ mode: null, payload: null });
  const [showNotifPicker, setShowNotifPicker] = useState(false);

  // 초기 로드
  useEffect(() => {
    (async () => {
      try {
        if (!baseChallenge?.id) {
          Alert.alert('오류', '수정할 도전 정보를 찾을 수 없습니다.', [
            { text: '확인', onPress: () => navigation.goBack() },
          ]);
          return;
        }
        const raw = await AsyncStorage.getItem(`challenge_${baseChallenge.id}`);
        const latest = raw ? JSON.parse(raw) : baseChallenge;

        setTitle(String(latest?.title ?? ''));
        setGoalScore(
          typeof latest?.goalScore === 'number' && latest.goalScore > 0
            ? String(latest.goalScore) : ''
        );
        setReward(String(latest?.reward ?? ''));

        setStartDate(latest?.startDate ? new Date(latest.startDate) : null);
        setEndDate(latest?.endDate ? new Date(latest.endDate) : null);

        if (latest?.notification?.mode) setNotification(latest.notification);

        console.log(TAG, 'loaded', latest?.id);
      } catch (e) {
        console.error(TAG, 'load error', e);
        Alert.alert('오류', '도전 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [baseChallenge?.id, navigation]);

  // (안전망) 다른 경로에서 navigate로 넘겨오는 경우도 대비
  useEffect(() => {
    const res = route.params?.notificationResult;
    if (res?.mode && res?.payload) {
      setNotification({ mode: res.mode, payload: res.payload });
      console.log(TAG, 'notificationResult applied:', res.mode);
    }
  }, [route.params?.notificationResult]);

  const notifPreview = useMemo(() => previewTextByNotification(notification), [notification]);

  // 저장
  const onSave = useCallback(async () => {
    if (!baseChallenge?.id) return;

    const effectiveGoal = (goalScore === '' ? Number(baseChallenge.goalScore || 0) : toNumberOrZero(goalScore));

    const dataForValidation = {
      title,
      goalScore: (goalScore === '' ? '' : effectiveGoal),
      startDate: startDate ? fmtDate(startDate) : null,
      endDate: endDate ? fmtDate(endDate) : null,
      allowEmptyGoal: true,
      prevGoalScore: Number(baseChallenge.goalScore || 0),
    };

    const v = validateInput(dataForValidation);
    if (!v.ok) {
      if (v.reason === 'TITLE_EMPTY')  { Alert.alert('확인', '도전 제목을 입력해주세요.'); return; }
      if (v.reason === 'GOAL_INVALID') { Alert.alert('확인', '목표 점수는 1 이상의 숫자여야 합니다.'); return; }
      if (v.reason === 'DATES_REQUIRED') { Alert.alert('확인', '시작일과 종료일을 선택해주세요.'); return; }
      if (v.reason === 'DATE_ORDER') { Alert.alert('확인', '종료일이 시작일보다 빠를 수 없습니다.'); return; }
      Alert.alert('확인', '입력값을 확인하세요.'); return;
    }

    const updated = {
      id: baseChallenge.id,
      title: (title || '').trim(),
      goalScore: (goalScore === '' ? Number(baseChallenge.goalScore || 0) : effectiveGoal),
      currentScore: Number(baseChallenge.currentScore || 0),
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      reward,
      notification: notification?.mode ? notification : { mode: null, payload: null },
      status: baseChallenge.status || 'active',
      createdAt: baseChallenge.createdAt || Date.now(),
      completedAt: baseChallenge.completedAt || 0,
    };

    try {
      console.log(TAG, 'save start:', updated.id);
      await saveAndSchedule(updated, { replaceSchedules: true });
      console.log(TAG, 'save done:', updated.id);
      Alert.alert('저장 완료', '도전이 수정되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error(TAG, 'save error', e);
      Alert.alert('오류', '도전을 저장하지 못했습니다.');
    }
  }, [baseChallenge?.id, baseChallenge, title, goalScore, reward, startDate, endDate, notification, navigation]);

  // 알림 모달 이동 (onDone 콜백으로 즉시 반영)
  const goSimple = useCallback(() => {
    setShowNotifPicker(false);
    const initial = notification?.mode === 'simple' ? (notification.payload ?? null) : null;
    navigation.navigate('SimpleNotification', {
      initial,
      onDone: (result) => { if (result?.mode === 'simple') setNotification(result); },
    });
  }, [navigation, notification]);

  const goWeekly = useCallback(() => {
    setShowNotifPicker(false);
    const initial = notification?.mode === 'weekly' ? (notification.payload ?? null) : null;
    navigation.navigate('WeeklyNotification', {
      initial,
      onDone: (result) => { if (result?.mode === 'weekly') setNotification(result); },
    });
  }, [navigation, notification]);

  const goMonthly = useCallback(() => {
    setShowNotifPicker(false);
    const initial = notification?.mode === 'monthly' ? (notification.payload ?? null) : null;
    navigation.navigate('MonthlyNotification', {
      initial,
      onDone: (result) => { if (result?.mode === 'monthly') setNotification(result); },
    });
  }, [navigation, notification]);

  if (loading) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: PALETTE.gray500 }}>불러오는 중…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>도전 수정</Text>

      {/* 기본 정보 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>기본 정보</Text>

        <Text style={styles.label}>도전 제목</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="도전 제목"
          style={styles.input}
          placeholderTextColor={PALETTE.gray400}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>목표 점수</Text>
        <TextInput
          value={goalScore}
          onChangeText={createNumberChangeHandler(setGoalScore)}
          placeholder="숫자만 입력(비우면 기존값 유지)"
          style={styles.input}
          placeholderTextColor={PALETTE.gray400}
          {...numericInputProps}
        />

        <View style={styles.row}>
          <View style={[styles.col, { marginRight: spacing.sm }]}>
            <Text style={styles.label}>시작일</Text>
            <TouchableOpacity
              style={[buttonStyles.compactRight, { alignSelf: 'flex-start' }]}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={buttonStyles.compactRightText}>
                {startDate ? fmtDate(startDate) : '날짜 선택'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.col, { marginLeft: spacing.sm }]}>
            <Text style={styles.label}>종료일</Text>
            <TouchableOpacity
              style={[buttonStyles.compactRight, { alignSelf: 'flex-start' }]}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={buttonStyles.compactRightText}>
                {endDate ? fmtDate(endDate) : '날짜 선택'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 보상 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>보상</Text>
        <Text style={styles.label}>보상 내용</Text>
        <TextInput
          value={reward}
          onChangeText={setReward}
          placeholder="원하는 보상을 입력하세요!"
          style={styles.input}
          placeholderTextColor={PALETTE.gray400}
        />
      </View>

      {/* 알림 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>알림</Text>
          <TouchableOpacity style={buttonStyles.compactRight} onPress={() => setShowNotifPicker(true)}>
            <Text style={buttonStyles.compactRightText}>알림 설정</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{notifPreview}</Text>
        </View>
      </View>

      <TouchableOpacity style={[buttonStyles.primary.container, { marginTop: spacing.xl }]} onPress={onSave}>
        <Text style={buttonStyles.primary.label}>저장</Text>
      </TouchableOpacity>

      {/* 날짜 모달 */}
      <DateTimePickerModal
        isVisible={showStartPicker}
        mode="date"
        onConfirm={(d) => { setShowStartPicker(false); setStartDate(d); }}
        onCancel={() => setShowStartPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showEndPicker}
        mode="date"
        onConfirm={(d) => { setShowEndPicker(false); setEndDate(d); }}
        onCancel={() => setShowEndPicker(false)}
      />

      {/* 알림 방식 선택 모달 */}
      <Modal visible={showNotifPicker} transparent animationType="fade" onRequestClose={() => setShowNotifPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>알림 방식 선택</Text>

            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={goSimple}>
              <Text style={buttonStyles.primary.label}>간단 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={goWeekly}>
              <Text style={buttonStyles.primary.label}>주간 상세 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={goMonthly}>
              <Text style={buttonStyles.primary.label}>월간 상세 알림</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalClose} onPress={() => setShowNotifPicker(false)}>
              <Text style={styles.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: PALETTE.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.lg },

  // 카드 공통(기존 cardStyles.container 톤에 맞춤)
  card: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.gray200,
    borderRadius: RADIUS.md,
    padding: spacing.lg,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md },

  label: { fontSize: 13, color: PALETTE.gray600, marginBottom: 6 },
  input: {
    backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray200,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: PALETTE.gray800,
  },

  row: { flexDirection: 'row', marginTop: spacing.md },
  col: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  previewBox: {
    marginTop: spacing.md,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: PALETTE.gray100, borderRadius: RADIUS.md,
  },
  previewText: { color: PALETTE.gray800 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: PALETTE.white, borderRadius: RADIUS.lg, padding: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md, textAlign: 'center' },
  modalButton: { marginTop: spacing.sm },
  modalClose: { marginTop: spacing.md, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: PALETTE.black },
  modalCloseText: { color: PALETTE.white, fontWeight: '700', fontSize: 12 },
});
