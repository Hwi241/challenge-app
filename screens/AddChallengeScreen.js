// screens/AddChallengeScreen.js
// - 시작/종료일 역순 즉시 경고(되돌리기)
// - 알림 모달 라벨: 주간 알림 / 월간 알림 / 전체 일정 알림
// - 프리뷰 개선
//    * 간단: 작은 원형 요일 + 여러 시간(최대 10, payload.times 지원; 없으면 payload.time 사용)
//    * 주간: 7열 세로 리스트(칩/테두리 X), 글씨 작게
//    * 월간: "매월" 고정 7×5 = 35칸(1~31일까지 항상 표시), 요일헤더/요일정렬 없이 1일부터 첫 칸 시작
//    * 전체일정: 월별 표 위에 요일 헤더(일~토), 프리뷰 박스 **세로 스크롤**(nestedScrollEnabled)로 여러 달 표시
// - 뒤로가기(하드웨어/제스처) 시 항상 ChallengeList로 이동
// - '전체 일정 알림' 진입 전 시작/종료일 필수 + 역순 차단

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, BackHandler
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import { buttonStyles, spacing, radius } from '../styles/common';
import { numericInputProps, createNumberChangeHandler, toNumberOrZero } from '../utils/number';
import { validateInput, saveAndSchedule } from '../utils/challengeStore';

const PALETTE = {
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray600: '#525252',
  gray700: '#374151',
  gray800: '#111111',
};

const DRAFT_KEY = 'draft_add_challenge';
const WEEK_DAYS_KO = ['월','화','수','목','금','토','일'];

function pad2(n){return String(n).padStart(2,'0');}
function fmtDate(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}
function parseDateStr(s) {
  if (!s) return null;
  const [y,m,d] = s.split('-').map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return isNaN(dt.getTime()) ? null : dt;
}
function sortTimesAsc(times = []) {
  return [...times].sort((a,b) => a.localeCompare(b));
}
function timeToHuman(hhmm) {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr); const m = Number(mStr || 0);
  const isAM = h < 12; const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = pad2(m);
  const period = isAM ? '오전' : '오후';
  return `${period} ${h12}:${mm}`;
}

/* =========================
   프리뷰 렌더러
   ========================= */

// 간단 프리뷰: 작은 원형 요일 + 시간(여러개 지원)
function SimplePreview({ days=[], times=[], time, weeks }) {
 const weekLabel = (() => {
    if (weeks === 'every') return '매주';
    if (Array.isArray(weeks) && weeks.length) return `${weeks.sort((a,b)=>a-b).join(',')}번째주`;
    return null;
  })();
  const toShow = (Array.isArray(times) && times.length) ? sortTimesAsc(times) : (time ? [time] : []);
  return (
    <View>
      <View style={styles.simpleDaysRow}>
        {WEEK_DAYS_KO.map(d => {
          const active = days.includes(d);
          return (
            <View key={d} style={[styles.simpleCircle, active ? styles.simpleCircleOn : styles.simpleCircleOff]}>
              <Text allowFontScaling={false} style={[styles.simpleCircleText, active && styles.simpleCircleTextOn]}>{d}</Text>
            </View>
          );
        })}
      </View>
      {toShow.length ? (
        <Text style={styles.previewTextSmall}>{toShow.join('  ')}</Text>
      ) : (
        <Text style={styles.previewTextSmall}>시간 미설정</Text>
      )}
      {!!weekLabel && <Text style={styles.previewNoteText}>{weekLabel}</Text>}
    </View>
  );
}

// 주간 프리뷰: 7열, 요일 라벨 + 세로 텍스트 리스트(작게, 칩 X)
function WeeklyPreview({ byWeekDays = [] }) {
  const map = useMemo(() => {
    const m = new Map();
    for (const { day, times = [] } of byWeekDays) {
      m.set(day, sortTimesAsc(times));
    }
    return m;
  }, [byWeekDays]);

  return (
    <View style={styles.weekGrid}>
      {WEEK_DAYS_KO.map((d, idx) => {
        const t = map.get(d) || [];
        return (
          <View key={d} style={[styles.weekCol, idx < 6 && styles.weekColDivider]}>
            <Text style={styles.weekDayLabel}>{d}</Text>
            <View style={styles.weekTimesWrap}>
              {t.map((tm, i) => (
                <Text key={`${d}-${tm}-${i}`} style={styles.weekTimeText} numberOfLines={1}>{tm}</Text>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// 월간 프리뷰(매월 고정): 7×5 = 35칸, 1~31 표시(항상 31일까지)
function MonthlyPreviewFixed({ byDates = [] }) {
  const dateMap = useMemo(() => {
    const m = new Map();
    for (const { date, times = [] } of byDates) {
      const n = Number(date);
      if (Number.isFinite(n) && n >= 1 && n <= 31) {
        const prev = m.get(n) || [];
        m.set(n, sortTimesAsc([...prev, ...times]));
      }
    }
    return m;
  }, [byDates]);

  // 35칸 배열(1..31, 나머지 null)
  const cells = [];
  for (let d=1; d<=31; d++) cells.push(d);
  while (cells.length < 35) cells.push(null);

  const rows = [];
  for (let i=0; i<35; i+=7) rows.push(cells.slice(i,i+7));

  return (
    <View style={styles.monthOuter}>
      {rows.map((row, rIdx) => (
        <View key={`r-${rIdx}`} style={[styles.monthRow, rIdx < rows.length - 1 && styles.monthRowDivider]}>
          {row.map((d, cIdx) => {
            const times = d ? (dateMap.get(d) || []) : [];
            return (
              <View key={`c-${rIdx}-${cIdx}`} style={[styles.monthCell, cIdx < 6 && styles.monthCellDivider]}>
                {d ? (
                  <>
                    <Text style={styles.monthDateText}>{d}</Text>
                    <View style={styles.monthTimesWrap}>
                      {times.map((tm, i) => (
                        <Text key={`${d}-${tm}-${i}`} style={styles.monthTimeText} numberOfLines={1}>{tm}</Text>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// 전체일정 프리뷰: 월 타이틀 + 요일헤더 + 달력(세로 스크롤, nestedScrollEnabled)
function FullRangePreview({ payload = {}, startDate, endDate }) {
  if (!startDate || !endDate) return <Text style={styles.previewText}>기간이 설정되지 않았습니다.</Text>;

  const byDate = payload?.byDate || {}; // {'YYYY-MM-DD':['HH:MM',...]}

  // 월 리스트(시작~종료, 각 월 1일 기준)
  const months = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cur <= end) {
    months.push({ y: cur.getFullYear(), mi: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1, 1);
  }

  // 범위 포함 여부
  const inRange = (y, mi, d) => {
    const dt = new Date(y, mi, d);
    return dt >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      && dt <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  };

  return (
    <View style={{height: 260}}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
        {months.map(({y,mi}) => {
          const first = new Date(y, mi, 1);
          const daysInMonth = new Date(y, mi + 1, 0).getDate();
          const firstDow = first.getDay(); // 0~6(일~토)
          const cells = [];
          for (let i=0;i<firstDow;i++) cells.push(null);
          for (let d=1; d<=daysInMonth; d++) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);
          const rows = [];
          for (let i=0;i<cells.length;i+=7) rows.push(cells.slice(i,i+7));

          return (
            <View key={`${y}-${mi}`} style={{marginBottom: 10}}>
              <Text style={styles.fullRangeMonthTitle}>{y}.{pad2(mi+1)}</Text>

              {/* 요일 헤더 */}
              <View style={styles.weekHeaderRow}>
                {['일','월','화','수','목','금','토'].map((w,idx)=>(
                  <View key={w} style={[styles.weekHeaderCell, idx<6 && styles.weekHeaderCellDivider]}>
                    <Text style={styles.weekHeaderText}>{w}</Text>
                  </View>
                ))}
              </View>

              {/* 달력 */}
              <View style={styles.monthOuter}>
                {rows.map((row,rIdx)=>(
                  <View key={`fr-r-${y}-${mi}-${rIdx}`} style={[styles.monthRow, rIdx < rows.length-1 && styles.monthRowDivider]}>
                    {row.map((d,cIdx)=>{
                      const show = d ? inRange(y,mi,d) : false;
                      const key = d ? `${y}-${pad2(mi+1)}-${pad2(d)}` : '';
                      const times = d && show ? (Array.isArray(byDate[key]) ? sortTimesAsc(byDate[key]) : []) : [];
                      return (
                        <View key={`fr-c-${y}-${mi}-${rIdx}-${cIdx}`} style={[styles.monthCell, cIdx<6 && styles.monthCellDivider]}>
                          {d ? (
                            <>
                              <Text style={[styles.monthDateText, !show && {opacity:0.25}]}>{d}</Text>
                              {show && (
                                <View style={styles.monthTimesWrap}>
                                  {times.map((tm, i) => (
                                    <Text key={`${y}-${mi}-${d}-${tm}-${i}`} style={styles.monthTimeText} numberOfLines={1}>{tm}</Text>
                                  ))}
                                </View>
                              )}
                            </>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// 프리뷰 선택자
function previewNodeByNotification(notification, startDate, endDate) {
  if (!notification || !notification.mode) {
    return <Text style={styles.previewText}>알림 없음</Text>;
  }
  const { mode, payload = {} } = notification;

  if (mode === 'simple') {
    return <SimplePreview days={payload.days||[]} times={payload.times||[]} time={payload.time} weeks={payload.weeks} />;
  }

  if (mode === 'weekly' && Array.isArray(payload?.byWeekDays)) {
    return <WeeklyPreview byWeekDays={payload.byWeekDays} />;
  }

  if (mode === 'monthly' && Array.isArray(payload?.byDates)) {
    return <MonthlyPreviewFixed byDates={payload.byDates} />;
  }

  if (mode === 'fullrange' && startDate && endDate) {
    return <FullRangePreview payload={payload} startDate={startDate} endDate={endDate} />;
  }

  return <Text style={styles.previewText}>알림 없음</Text>;
}

/* =========================
   화면 본문
   ========================= */

export default function AddChallengeScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // 폼
  const [title, setTitle] = useState('');
  const [goalScore, setGoalScore] = useState('');
  const [reward, setReward] = useState('');

  // 날짜
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // 알림
  const [notification, setNotification] = useState({ mode: null, payload: null });
  const [showNotifPicker, setShowNotifPicker] = useState(false);

  // 저장 중 보호
  const [busy, setBusy] = useState(false);

  // 초안 저장/복원(알림 제외)
  const saveDraftDebounce = useRef(null);
  const saveDraft = useCallback(async (draft) => {
    try { await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, []);
  useEffect(() => {
    const draft = {
      title, goalScore, reward,
      startDate: startDate ? fmtDate(startDate) : null,
      endDate: endDate ? fmtDate(endDate) : null,
    };
    if (saveDraftDebounce.current) clearTimeout(saveDraftDebounce.current);
    saveDraftDebounce.current = setTimeout(() => saveDraft(draft), 200);
    return () => { if (saveDraftDebounce.current) clearTimeout(saveDraftDebounce.current); };
  }, [title, goalScore, reward, startDate, endDate, saveDraft]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (!d || typeof d !== 'object') return;
        setTitle(String(d.title || ''));
        setGoalScore(d.goalScore == null ? '' : String(d.goalScore));
        setReward(String(d.reward || ''));
        setStartDate(d.startDate ? parseDateStr(d.startDate) : null);
        setEndDate(d.endDate ? parseDateStr(d.endDate) : null);
      } catch {}
    })();
  }, []);

  // 새 도전 진입: resetNonce가 있으면 알림 초기화
  useFocusEffect(
    useCallback(() => {
      if (route.params?.resetNonce) {
        setNotification({ mode: null, payload: null });
        navigation.setParams?.({ resetNonce: undefined, notificationResult: undefined, _nonce: undefined });
      }
      return undefined;
    }, [route.params?.resetNonce, navigation])
  );

  // 알림 설정 결과 수신
  useEffect(() => {
    const res = route.params?.notificationResult;
    if (res?.mode && res?.payload) {
      setNotification({ mode: res.mode, payload: res.payload });
      navigation.setParams?.({ notificationResult: undefined, _nonce: undefined });
    }
  }, [route.params?.notificationResult, route.params?._nonce, navigation]);

  // 뒤로가기 → ChallengeList로
  useFocusEffect(
    useCallback(() => {
      const onBack = () => { navigation.navigate('ChallengeList'); return true; };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      const remove = navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
        navigation.navigate('ChallengeList');
      });
      return () => { sub.remove(); navigation.removeListener('beforeRemove', remove); };
    }, [navigation])
  );

  // 날짜 역순 즉시 경고(되돌리기)
  const lastChangedRef = useRef(null); // 'start' | 'end'
  useEffect(() => { if (showStartPicker) lastChangedRef.current = 'start'; }, [showStartPicker]);
  useEffect(() => { if (showEndPicker) lastChangedRef.current = 'end'; }, [showEndPicker]);
  useEffect(() => {
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      Alert.alert('확인', '종료일이 시작일보다 빠를 수 없습니다.');
      if (lastChangedRef.current === 'end') setEndDate(null);
      else setStartDate(null);
    }
  }, [startDate, endDate]);

  const onSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const goalNum = toNumberOrZero(goalScore);

      const dataForValidation = {
        title,
        goalScore: goalScore === '' ? '' : goalNum,
        startDate: startDate ? fmtDate(startDate) : null,
        endDate: endDate ? fmtDate(endDate) : null,
        allowEmptyGoal: false,
        prevGoalScore: 0,
      };

      const v = validateInput(dataForValidation);
      if (!v.ok) {
        if (v.reason === 'TITLE_EMPTY')  { Alert.alert('확인', '도전 제목을 입력해주세요.'); setBusy(false); return; }
        if (v.reason === 'GOAL_INVALID') { Alert.alert('확인', '목표 점수는 1 이상의 숫자여야 합니다.'); setBusy(false); return; }
        if (v.reason === 'DATES_REQUIRED') { Alert.alert('확인', '시작일과 종료일을 선택해주세요.'); setBusy(false); return; }
        if (v.reason === 'DATE_ORDER') { Alert.alert('확인', '종료일이 시작일보다 빠를 수 없습니다.'); setBusy(false); return; }
        Alert.alert('확인', '입력값을 확인하세요.'); setBusy(false); return;
      }

      const id = `ch_${Date.now()}`;
      const newChallenge = {
        id,
        title: (title || '').trim(),
        goalScore: goalNum,
        currentScore: 0,
        startDate: fmtDate(startDate),
        endDate: fmtDate(endDate),
        reward,
        notification: notification?.mode ? notification : { mode: null, payload: null },
        status: 'active',
        createdAt: Date.now(),
        completedAt: 0,
      };

      await saveAndSchedule(newChallenge, { replaceSchedules: true });

      const raw = await AsyncStorage.getItem('challenges');
      const arr = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem('challenges', JSON.stringify([newChallenge, ...arr]));
      await AsyncStorage.setItem(`challenge_${id}`, JSON.stringify(newChallenge));

      // 저장 후 초기화 + 초안 삭제
      setTitle(''); setGoalScore(''); setReward('');
      setStartDate(null); setEndDate(null);
      setNotification({ mode: null, payload: null });
      try { await AsyncStorage.removeItem(DRAFT_KEY); } catch {}

      Alert.alert('완료', '도전이 추가되었습니다.', [
        { text: '확인', onPress: () => navigation.navigate('ChallengeList') },
      ]);
    } catch (e) {
      console.error('AddChallenge save error', e);
      Alert.alert('오류', '도전을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, title, goalScore, reward, startDate, endDate, notification, navigation]);

  // 알림 모달 라우팅
  const goSimple = useCallback(() => {
    if (busy) return;
    const initial = notification?.mode === 'simple' ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('SimpleNotification', { initial, returnTo: 'AddChallenge' });
  }, [busy, navigation, notification]);

  const goWeekly = useCallback(() => {
    if (busy) return;
    const initial = notification?.mode === 'weekly' ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('WeeklyNotification', { initial, returnTo: 'AddChallenge' });
  }, [busy, navigation, notification]);

  const goMonthly = useCallback(() => {
    if (busy) return;
    const initial = notification?.mode === 'monthly'
      ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('MonthlyNotification', { initial, returnTo: 'AddChallenge' });
  }, [busy, navigation, notification]);

  const goFullRange = useCallback(() => {
    if (busy) return;
    if (!startDate || !endDate) {
      Alert.alert('확인', '시작일과 종료일을 먼저 선택해주세요.');
      return;
    }
    if (endDate.getTime() < startDate.getTime()) {
      Alert.alert('확인', '종료일이 시작일보다 빠를 수 없습니다.');
      return;
    }
    const initial = notification?.mode === 'fullrange'
      ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('FullRangeNotification', {
      initial,
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      returnTo: 'AddChallenge',
    });
  }, [busy, navigation, notification, startDate, endDate]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>도전 추가</Text>

      {/* 기본 정보 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>기본 정보</Text>

        <Text style={styles.label}>도전 제목</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="도전 제목"
          style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
          placeholderTextColor={PALETTE.gray400}
          editable={!busy}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>목표 점수</Text>
        <TextInput
          value={goalScore}
          onChangeText={createNumberChangeHandler(setGoalScore)}
          placeholder="숫자만 입력"
          style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
          placeholderTextColor={PALETTE.gray400}
          editable={!busy}
          {...numericInputProps}
        />

        {/* 날짜 */}
        <View style={styles.row}>
          <View style={[styles.col, { marginRight: spacing.sm }]}>
            <Text style={styles.label}>시작일</Text>
            <TouchableOpacity
              style={[buttonStyles.compactRight, { alignSelf: 'flex-start', opacity: busy ? 0.6 : 1 }]}
              onPress={() => !busy && setShowStartPicker(true)}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={buttonStyles.compactRightText}>
                {startDate ? fmtDate(startDate) : '날짜 선택'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.col, { marginLeft: spacing.sm }]}>
            <Text style={styles.label}>종료일</Text>
            <TouchableOpacity
              style={[buttonStyles.compactRight, { alignSelf: 'flex-start', opacity: busy ? 0.6 : 1 }]}
              onPress={() => !busy && setShowEndPicker(true)}
              activeOpacity={0.9}
              disabled={busy}
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
          style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
          placeholderTextColor={PALETTE.gray400}
          editable={!busy}
        />
      </View>

      {/* 알림 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>알림</Text>

          <View style={styles.rightBtnGroup}>
            {notification?.mode && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setNotification({ mode: null, payload: null })}
                activeOpacity={0.9}
                disabled={busy}
              >
                <Text style={styles.deleteBtnText}>알림 삭제</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[buttonStyles.compactRight, { opacity: busy ? 0.6 : 1 }]}
              onPress={() => !busy && setShowNotifPicker(true)}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={buttonStyles.compactRightText}>알림 설정</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.previewBox}>
          {previewNodeByNotification(notification, startDate, endDate)}
        </View>

        <Text style={[styles.previewAssistive]} accessible accessibilityLabel={
          !notification?.mode ? '알림 없음' :
            notification.mode === 'simple' ? '간단 알림' :
            notification.mode === 'weekly' ? '주간 알림' :
            notification.mode === 'monthly' ? '월간 알림' :
            '전체 일정 알림'
        }>
          {''}
        </Text>
      </View>

      {/* 저장 */}
      <TouchableOpacity
        style={[buttonStyles.primary.container, { marginTop: spacing.xl, opacity: busy ? 0.6 : 1 }]}
        onPress={onSave}
        activeOpacity={0.9}
        disabled={busy}
      >
        <Text style={buttonStyles.primary.label}>저장</Text>
      </TouchableOpacity>

      {/* 날짜 모달 */}
      <DateTimePickerModal
        isVisible={showStartPicker}
        mode="date"
        onConfirm={(d) => { setShowStartPicker(false); setStartDate(d); lastChangedRef.current='start'; }}
        onCancel={() => setShowStartPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showEndPicker}
        mode="date"
        onConfirm={(d) => { setShowEndPicker(false); setEndDate(d); lastChangedRef.current='end'; }}
        onCancel={() => setShowEndPicker(false)}
      />

      {/* 알림 방식 모달 */}
      <Modal
        visible={showNotifPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>알림 방식 선택</Text>

            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={goSimple} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>간단 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={goWeekly} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>주간 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={goMonthly} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>월간 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={goFullRange} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>전체 일정 알림</Text>
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
  screenTitle: { fontSize: 20, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.lg, textAlign: 'center', alignSelf: 'center' },

  card: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.gray200,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md },

  label: { fontSize: 13, color: PALETTE.gray600, marginBottom: 6 },
  input: {
    backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray200,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: PALETTE.gray800,
  },

  row: { flexDirection: 'row', marginTop: spacing.md },
  col: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  rightBtnGroup: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  deleteBtn: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray300, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md },
  deleteBtnText: { color: PALETTE.black, fontWeight: '800', fontSize: 12 },

  previewBox: { marginTop: spacing.md, backgroundColor: PALETTE.gray100, borderRadius: radius.md, padding: spacing.md },
  previewText: { color: PALETTE.gray800 },
  previewTextSmall: { color: PALETTE.gray800, fontSize: 12, marginTop: 6 },
  previewAssistive: { height: 0, width: 0 },
  previewTextSmall: { color: PALETTE.gray800, fontSize: 12, marginTop: 6 },
  previewNoteText: { color: PALETTE.gray600, fontSize: 11, marginTop: 2 },

  // 간단
  simpleDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  simpleCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  simpleCircleOff: { borderColor: PALETTE.gray300, backgroundColor: PALETTE.white },
  simpleCircleOn: { borderColor: PALETTE.black, backgroundColor: PALETTE.black },
  simpleCircleText: { fontSize: 12, fontWeight: '800', color: PALETTE.gray700, includeFontPadding: false },
  simpleCircleTextOn: { color: PALETTE.white },

  // 주간
  weekGrid: { flexDirection: 'row' },
  weekCol: { flex: 1, paddingHorizontal: 6 },
  weekColDivider: { borderRightWidth: 1, borderRightColor: PALETTE.gray200 },
  weekDayLabel: { textAlign: 'center', fontSize: 12, fontWeight: '800', color: PALETTE.gray700, marginBottom: 4 },
  weekTimesWrap: { alignItems: 'center' },
  weekTimeText: { fontSize: 11, color: PALETTE.gray800, lineHeight: 14 },

  // 월간/전체일정 공통
  monthOuter: { borderTopWidth: 1, borderTopColor: PALETTE.gray200 },
  monthRow: { flexDirection: 'row' },
  monthRowDivider: { borderBottomWidth: 1, borderBottomColor: PALETTE.gray200 },
  monthCell: { flex: 1, padding: 6 },
  monthCellDivider: { borderRightWidth: 1, borderRightColor: PALETTE.gray200 },
  monthDateText: { fontSize: 11, fontWeight: '800', color: PALETTE.gray700, textAlign: 'right' },
  monthTimesWrap: { marginTop: 2 },
  monthTimeText: { fontSize: 11, color: PALETTE.gray800, lineHeight: 14 },

  // 전체 일정 프리뷰 월 타이틀 + 요일 헤더
  fullRangeMonthTitle: { fontSize: 12, fontWeight: '800', color: PALETTE.gray700, marginBottom: 4 },
  weekHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  weekHeaderCell: { flex: 1, alignItems: 'center' },
  weekHeaderCellDivider: { borderRightWidth: 1, borderRightColor: PALETTE.gray200 },
  weekHeaderText: { fontSize: 11, fontWeight: '800', color: PALETTE.gray700 },

  // 모달
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: PALETTE.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: PALETTE.gray200 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md, textAlign: 'center' },
  modalButton: { marginTop: spacing.sm },
  modalClose: { marginTop: spacing.md, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: PALETTE.black },
  modalCloseText: { color: PALETTE.white, fontWeight: '700', fontSize: 12 },
});
