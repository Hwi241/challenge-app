// screens/AddChallengeScreen.js
// - 보상: 단일 입력칸(reward)만 사용
// - 목표 점수 숫자 전용, 날짜 선택 버튼, 알림 미리보기/변경 모달(검은 버튼), '알림 삭제'는 설정 있을 때만 노출

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute } from '@react-navigation/native';

import { buttonStyles, colors, spacing, radius, cardStyles } from '../styles/common';
import { numericInputProps, createNumberChangeHandler, toNumberOrZero } from '../utils/number';
import WeeklyNotificationPreview from '../components/WeeklyNotificationPreview';
import MonthlyNotificationPreview from '../components/MonthlyNotificationPreview';
import AsyncStorage from '@react-native-async-storage/async-storage';

function fmtDate(d) {
  if (!d || !(d instanceof Date)) return '-';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatSimpleSummary(payload) {
  if (!payload || !Array.isArray(payload.days) || !payload.time) return '알림 없음';
  const [hStr, mStr = '00'] = String(payload.time).split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const isAM = h < 12;
  const h12 = h % 12 === 0 ? 12 : (h % 12);
  const mm = Number.isFinite(m) && m > 0 ? `${m}분` : '';
  const period = isAM ? '오전' : '오후';
  const dayText = payload.days.map((d) => `[${d}]`).join(' ');
  return `매주 ${dayText} ${period} ${h12}시 ${mm} 반복`.replace(/\s+/g, ' ').trim();
}

export default function AddChallengeScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [title, setTitle] = useState('');
  const [goalScore, setGoalScore] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // 보상(단일 칸)
  const [reward, setReward] = useState('');

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // { mode: 'simple'|'weekly'|'monthly'|null, payload }
  const [notification, setNotification] = useState({ mode: null, payload: null });
  const [showNotifPicker, setShowNotifPicker] = useState(false);

  // 다른 알림 화면에서 되돌아온 값 반영
  useEffect(() => {
    const res = route?.params?.notificationResult;
    if (res && (res.mode === 'simple' || res.mode === 'weekly' || res.mode === 'monthly')) {
      setNotification({ mode: res.mode, payload: res.payload ?? null });
      navigation.setParams({ notificationResult: undefined });
    }
  }, [route?.params?.notificationResult, navigation]);

  const simplePreviewText = useMemo(() => {
    if (notification.mode !== 'simple') return null;
    return formatSimpleSummary(notification.payload);
  }, [notification]);

  const weeklyPreview = useMemo(() => {
    if (notification.mode !== 'weekly') return null;
    return <WeeklyNotificationPreview data={notification.payload ?? {}} style={{ marginTop: spacing.sm }} />;
  }, [notification]);

  const monthlyPreview = useMemo(() => {
    if (notification.mode !== 'monthly') return null;
    const base = startDate || new Date();
    return (
      <MonthlyNotificationPreview
        year={base.getFullYear()}
        month={base.getMonth() + 1}
        data={notification.payload ?? {}}
        style={{ marginTop: spacing.sm }}
      />
    );
  }, [notification, startDate]);

  const openNotifPicker = useCallback(() => setShowNotifPicker(true), []);

  const confirmSwitchMode = useCallback((nextMode, onConfirm) => {
    if (!notification.mode || notification.mode === nextMode) {
      onConfirm?.();
      return;
    }
    Alert.alert(
      '알림 방식 변경',
      '이전 알림 설정은 삭제됩니다. 계속 진행할까요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '확인', style: 'destructive', onPress: () => onConfirm?.() },
      ]
    );
  }, [notification.mode]);

  const goSimple = useCallback(() => {
    setShowNotifPicker(false);
    confirmSwitchMode('simple', () => {
      setNotification({ mode: 'simple', payload: null });
      navigation.navigate('SimpleNotification', {
        initial: notification.mode === 'simple' ? (notification.payload ?? null) : null,
        returnTo: 'AddChallenge',
      });
    });
  }, [confirmSwitchMode, navigation, notification]);

  const goWeekly = useCallback(() => {
    setShowNotifPicker(false);
    confirmSwitchMode('weekly', () => {
      setNotification({ mode: 'weekly', payload: null });
      navigation.navigate('WeeklyNotification', {
        initial: notification.mode === 'weekly' ? (notification.payload ?? null) : null,
        returnTo: 'AddChallenge',
      });
    });
  }, [confirmSwitchMode, navigation, notification]);

  const goMonthly = useCallback(() => {
    setShowNotifPicker(false);
    confirmSwitchMode('monthly', () => {
      setNotification({ mode: 'monthly', payload: null });
      navigation.navigate('MonthlyNotification', {
        initial: notification.mode === 'monthly' ? (notification.payload ?? null) : null,
        returnTo: 'AddChallenge',
      });
    });
  }, [confirmSwitchMode, navigation, notification]);

  const removeNotif = useCallback(() => {
    setShowNotifPicker(false);
    if (!notification.mode) return;
    Alert.alert('알림 삭제', '현재 설정된 알림을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setNotification({ mode: null, payload: null }) },
    ]);
  }, [notification.mode]);

  const onSave = useCallback(async () => {
    const trimmedTitle = (title || '').trim();
    if (!trimmedTitle) {
      Alert.alert('확인', '도전 제목을 입력해주세요.');
      return;
    }
    const goal = toNumberOrZero(goalScore);
    if (goal <= 0) {
      Alert.alert('확인', '목표 점수를 1 이상의 숫자로 입력해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('확인', '시작일과 종료일을 선택해주세요.');
      return;
    }
    if (startDate > endDate) {
      Alert.alert('확인', '종료일이 시작일보다 빠릅니다.');
      return;
    }

    const newChallenge = {
      id: `ch_${Date.now()}`,
      title: trimmedTitle,
      goalScore: goal,
      currentScore: 0,
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      // 보상(단일 칸)
      reward: (reward || '').trim() || null,
      // 알림
      notification,
      status: 'active',
      createdAt: Date.now(),
    };

    const raw = await AsyncStorage.getItem('challenges');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(newChallenge);
    await AsyncStorage.setItem('challenges', JSON.stringify(list));
    await AsyncStorage.setItem(`challenge_${newChallenge.id}`, JSON.stringify(newChallenge));

    Alert.alert('저장 완료', '도전이 추가되었습니다.', [
      { text: '확인', onPress: () => navigation.goBack() },
    ]);
  }, [title, goalScore, startDate, endDate, reward, notification, navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>도전 추가</Text>

      {/* 기본 정보 */}
      <View style={cardStyles.container}>
        <Text style={cardStyles.title}>기본 정보</Text>

        <Text style={styles.label}>도전 제목</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="도전 제목"
          style={styles.input}
          placeholderTextColor={colors.gray400}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>목표 점수</Text>
        <TextInput
          value={goalScore}
          onChangeText={createNumberChangeHandler(setGoalScore)}
          placeholder="숫자만 입력"
          style={styles.input}
          placeholderTextColor={colors.gray400}
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

      {/* 보상 (단일 칸) */}
      <View style={[cardStyles.container, { marginTop: spacing.lg }]}>
        <Text style={cardStyles.title}>보상</Text>
        <Text style={styles.label}>보상 내용</Text>
        <TextInput
          value={reward}
          onChangeText={setReward}
          placeholder="예: 치킨 먹기 / 새 키보드 구매"
          style={styles.input}
          placeholderTextColor={colors.gray400}
        />
      </View>

      {/* 알림 */}
      <View style={[cardStyles.container, { marginTop: spacing.lg }]}>
        <View style={styles.rowBetween}>
          <Text style={cardStyles.title}>알림</Text>
          <TouchableOpacity style={buttonStyles.compactRight} onPress={openNotifPicker}>
            <Text style={buttonStyles.compactRightText}>알림 설정</Text>
          </TouchableOpacity>
        </View>

        {!notification.mode && <Text style={styles.noNotifText}>알림 없음</Text>}
        {!!simplePreviewText && (
          <View style={styles.simpleSummaryBox}>
            <Text style={styles.simpleSummaryText}>{simplePreviewText}</Text>
          </View>
        )}
        {weeklyPreview}
        {monthlyPreview}
      </View>

      <TouchableOpacity style={[buttonStyles.primary, { marginTop: spacing.xl }]} onPress={onSave}>
        <Text style={buttonStyles.primaryText}>저장</Text>
      </TouchableOpacity>

      {/* DatePickers */}
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

            <TouchableOpacity style={[buttonStyles.primary, styles.modalButton]} onPress={goSimple}>
              <Text style={buttonStyles.primaryText}>간단 알림 (요일+시간 1회/일)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[buttonStyles.primary, styles.modalButton]} onPress={goWeekly}>
              <Text style={buttonStyles.primaryText}>주간 상세 알림</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[buttonStyles.primary, styles.modalButton]} onPress={goMonthly}>
              <Text style={buttonStyles.primaryText}>월간 상세 알림</Text>
            </TouchableOpacity>

            {notification.mode && (
              <TouchableOpacity style={[buttonStyles.primary, styles.modalButton]} onPress={removeNotif}>
                <Text style={buttonStyles.primaryText}>알림 삭제</Text>
              </TouchableOpacity>
            )}

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
  container: { padding: spacing.lg, backgroundColor: colors.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: colors.gray800, marginBottom: spacing.lg },
  label: { fontSize: 13, color: colors.gray600, marginBottom: 6 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.gray800,
  },
  row: { flexDirection: 'row', marginTop: spacing.md },
  col: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  noNotifText: { fontSize: 13, color: colors.gray400 },
  simpleSummaryBox: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm,
  },
  simpleSummaryText: { fontSize: 13, color: colors.gray800 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.gray800, marginBottom: spacing.md, textAlign: 'center' },
  modalButton: { marginTop: spacing.sm },
  modalClose: { marginTop: spacing.md, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.black },
  modalCloseText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
