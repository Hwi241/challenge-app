import { SafeAreaView } from 'react-native-safe-area-context';

// screens/EditChallengeScreen.js
// - UI 변경 없음(레이아웃/텍스트 그대로)
// - 제목 50자, 보상 50자, 내용 500자: 입력 단계에서 잘라냄 + 저장 시 재검증
// - 목표 점수: 숫자만 입력, 최대 1000으로 클램프(비우면 기존값 유지)
// - 나머지 로직/프리뷰/모달은 기존과 동일

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import {
  buttonStyles,
  card as canonicalCardStyles,
  color,
  font,
  input as canonicalInputStyles,
  layout as canonicalLayoutStyles,
  modal as canonicalModalStyles,
  primitive,
  radius,
  space,
  surface as canonicalSurfaceStyles,
  text as canonicalTextStyles,
} from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';
import { validateInput, saveAndSchedule } from '../utils/challengeStore';
import BackButton from '../components/BackButton';
import { SettingSectionCard, GoalCyclePreview as SettingGoalCyclePreview, NotificationPreview as SettingNotificationPreview } from '../components/ChallengeSettingWidgets';
import { syncWidgetChallengeList } from '../utils/widgetSync';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';

const LIMITS = { title: 50, reward: 50, description: 500, maxGoal: 1000 };

const WEEK_DAYS_KO = ['월','화','수','목','금','토','일'];

const pad2 = (n)=>String(n).padStart(2,'0');
const fmtDate = (d)=>!d?'':`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseDateStr = (s)=>{
  if(!s) return null; const [y,m,d]=s.split('-').map(Number);
  const dt = new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
};
const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));

/* ===== 미리보기 컴포넌트들 (기존과 동일) ===== */

// 간단
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
        {WEEK_DAYS_KO.map(d=>{
          const active = days.includes(d);
          return (
            <View key={d} style={[styles.simpleCircle, active ? styles.simpleCircleOn : styles.simpleCircleOff]}>
              <Text allowFontScaling={false} style={[styles.simpleCircleText, active && styles.simpleCircleTextOn]}>{d}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.previewTextSmall}>{toShow.length ? toShow.join('  ') : '시간 미설정'}</Text>
      {!!weekLabel && <Text style={styles.previewNoteText}>{weekLabel}</Text>}
    </View>
  );
}

// 주간
function WeeklyPreview({ byWeekDays = [] }) {
  const map = useMemo(()=>{
    const m = new Map();
    for(const {day, times=[]} of byWeekDays) m.set(day, sortTimesAsc(times));
    return m;
  },[byWeekDays]);

  return (
    <View style={styles.weekGrid}>
      {WEEK_DAYS_KO.map((d, idx)=>{
        const t = map.get(d)||[];
        return (
          <View key={d} style={[styles.weekCol, idx<6 && styles.weekColDivider]}>
            <Text style={styles.weekDayLabel}>{d}</Text>
            <View style={styles.weekTimesWrap}>
              {t.map((tm, i)=>(
                <Text key={`${d}-${tm}-${i}`} style={styles.weekTimeText} numberOfLines={1}>{tm}</Text>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// 월간(매월 고정 1~31, 35칸)
function MonthlyPreviewFixed({ byDates = [] }) {
  const dateMap = useMemo(()=>{
    const m = new Map();
    for(const {date, times=[]} of byDates){
      const n=Number(date);
      if(Number.isFinite(n) && n>=1 && n<=31){
        const prev=m.get(n)||[];
        m.set(n, sortTimesAsc([...prev,...times]));
      }
    }
    return m;
  },[byDates]);

  const cells=[]; for(let d=1; d<=31; d++) cells.push(d);
  while(cells.length<35) cells.push(null);
  const rows=[]; for(let i=0;i<35;i+=7) rows.push(cells.slice(i,i+7));

  return (
    <View style={styles.monthOuter}>
      {rows.map((row, rIdx)=>(
        <View key={`mr-${rIdx}`} style={[styles.monthRow, rIdx<rows.length-1 && styles.monthRowDivider]}>
          {row.map((d, cIdx)=>{
            const times = d ? (dateMap.get(d)||[]) : [];
            return (
              <View key={`mc-${rIdx}-${cIdx}`} style={[styles.monthCell, cIdx<6 && styles.monthCellDivider]}>
                {d ? (
                  <>
                    <Text style={styles.monthDateText}>{d}</Text>
                    <View style={styles.monthTimesWrap}>
                      {times.map((tm,i)=>(
                        <Text key={`${d}-${tm}-${i}`} style={styles.monthTimeText} numberOfLines={1}>{tm}</Text>
                      ))}
                    </View>
                  </>
                ):null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// 전체 일정 프리뷰(세로 스크롤, 요일 헤더 포함)
function FullRangePreview({ payload={}, startDate, endDate }) {
  if(!startDate || !endDate) return <Text style={styles.previewText}>기간이 설정되지 않았습니다.</Text>;
  const byDate = payload.byDate || {};
  const months=[];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while(cur<=end){ months.push({y:cur.getFullYear(), mi:cur.getMonth()}); cur.setMonth(cur.getMonth()+1,1); }

  const inRange=(y,mi,d)=>{
    const dt = new Date(y,mi,d);
    return dt >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
        && dt <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  };

  return (
    <View style={{height:260}}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
        {months.map(({y,mi})=>{
          const first=new Date(y,mi,1);
          const daysInMonth=new Date(y,mi+1,0).getDate();
          const firstDow=first.getDay();
          const cells=[]; for(let i=0;i<firstDow;i++) cells.push(null);
          for(let d=1; d<=daysInMonth; d++) cells.push(d);
          while(cells.length%7!==0) cells.push(null);
          const rows=[]; for(let i=0;i<cells.length;i+=7) rows.push(cells.slice(i,i+7));

          return (
            <View key={`${y}-${mi}`} style={{marginBottom:10}}>
              <Text style={styles.fullRangeMonthTitle}>{y}.{pad2(mi+1)}</Text>

              <View style={styles.weekHeaderRow}>
                {['일','월','화','수','목','금','토'].map((w,idx)=>(
                  <View key={w} style={[styles.weekHeaderCell, idx<6 && styles.weekHeaderCellDivider]}>
                    <Text style={styles.weekHeaderText}>{w}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.monthOuter}>
                {rows.map((row,rIdx)=>(
                  <View key={`fr-r-${y}-${mi}-${rIdx}`} style={[styles.monthRow, rIdx<rows.length-1 && styles.monthRowDivider]}>
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
                                  {times.map((tm,i)=>(
                                    <Text key={`${y}-${mi}-${d}-${tm}-${i}`} style={styles.monthTimeText} numberOfLines={1}>{tm}</Text>
                                  ))}
                                </View>
                              )}
                            </>
                          ):null}
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
function previewNodeByNotification(notification, startDate, endDate){
  if(!notification || !notification.mode) return <Text style={styles.previewText}>알림 없음</Text>;
  const { mode, payload={} } = notification;
  if (mode==='simple') return <SimplePreview days={payload.days||[]} times={payload.times||[]} time={payload.time} weeks={payload.weeks} />;
  if (mode==='weekly' && Array.isArray(payload.byWeekDays)) return <WeeklyPreview byWeekDays={payload.byWeekDays} />;
  if (mode==='monthly' && Array.isArray(payload.byDates)) return <MonthlyPreviewFixed byDates={payload.byDates} />;
  if (mode==='fullrange') return <FullRangePreview payload={payload} startDate={startDate} endDate={endDate} />;
  return <Text style={styles.previewText}>알림 없음</Text>;
}

export default function EditChallengeScreen(){
  const navigation = useNavigation();
  const route = useRoute();
  const baseChallenge = route.params?.challenge || route.params?.backParams?.challenge || null;

  const [loading,setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isHabit, setIsHabit] = useState(false);
  const [habitCycle, setHabitCycle] = useState(null);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleTab, setCycleTab] = useState('weekly');
  const [cycleDays, setCycleDays] = useState(new Set());
  const [cycleDates, setCycleDates] = useState(new Set());
  const [cycleWeekScope, setCycleWeekScope] = useState('custom');
  const [cycleMonthScope, setCycleMonthScope] = useState('custom');
  const originalRef = useRef(null);
  const formScrollRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const rewardInputRef = useRef(null);
  const focusedInputRef = useRef(null);
  const keyboardFrameRef = useRef(null);
  const keyboardVisibleRef = useRef(false);
  const scrollYRef = useRef(0);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  // 폼
  const [title,setTitle] = useState('');
  const [goalScore,setGoalScore] = useState(''); // 비우면 기존값 유지
  const [reward,setReward] = useState('');
  const [description, setDescription] = useState(''); // 도전 내용

  // 날짜
  const [startDate,setStartDate] = useState(null);
  const [endDate,setEndDate] = useState(null);
  const [showStartPicker,setShowStartPicker] = useState(false);
  const [showEndPicker,setShowEndPicker] = useState(false);
  const lastChangedRef = useRef(null);

  // 알림
  const [notification,setNotification] = useState({ mode:null, payload:null });
  const [showNotifPicker,setShowNotifPicker] = useState(false);

  // 입력 핸들러(제한 적용) — UI 변경 없이 값만 제어
  const handleTitleChange = useCallback((t)=> setTitle((t || '').slice(0, LIMITS.title)), []);
  const handleRewardChange = useCallback((t)=> setReward((t || '').slice(0, LIMITS.reward)), []);
  const handleDescChange = useCallback((t)=> setDescription((t || '').slice(0, LIMITS.description)), []);
  const handleGoalChange = useCallback((txt)=>{
    const digits = (txt || '').replace(/[^\d]/g,'');
    if (!digits) { setGoalScore(''); return; }
    let n = parseInt(digits, 10);
    if (isNaN(n)) { setGoalScore(''); return; }
    if (n > LIMITS.maxGoal) n = LIMITS.maxGoal;
    setGoalScore(String(n));
  }, []);

  const measureAndScrollToInput = useCallback((inputRef, extraOffset = 48) => {
    const input = inputRef?.current;
    const keyboardFrame = keyboardFrameRef.current;

    if (!input?.measureInWindow || !keyboardFrame?.screenY) return;

    requestAnimationFrame(() => {
      input.measureInWindow((x, y, width, height) => {
        const inputBottom = y + height;
        const overlap = inputBottom + extraOffset - keyboardFrame.screenY;

        if (overlap <= 0) return;

        formScrollRef.current?.scrollTo({
          y: Math.max(0, scrollYRef.current + overlap),
          animated: false,
        });
      });
    });
  }, []);

  const scrollToFocusedInput = useCallback((inputRef, extraOffset = 48) => {
    focusedInputRef.current = inputRef;

    if (!keyboardVisibleRef.current) return;

    setTimeout(() => {
      measureAndScrollToInput(inputRef, extraOffset);
    }, 30);
  }, [measureAndScrollToInput]);

  useEffect(() => {
    const handleKeyboardFrame = (event) => {
      const nextFrame = event?.endCoordinates || null;
      keyboardFrameRef.current = nextFrame;
      keyboardVisibleRef.current = true;

      const nextKeyboardHeight = Math.max(0, Number(nextFrame?.height) || 0);
      setKeyboardBottomInset(nextKeyboardHeight);

      if (focusedInputRef.current) {
        setTimeout(() => {
          measureAndScrollToInput(focusedInputRef.current, 48);
        }, 30);
      }
    };

    const showSub = Keyboard.addListener('keyboardDidShow', handleKeyboardFrame);
    const changeSub = Keyboard.addListener('keyboardDidChangeFrame', handleKeyboardFrame);
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardFrameRef.current = null;
      keyboardVisibleRef.current = false;
      focusedInputRef.current = null;
      setKeyboardBottomInset(0);
    });

    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, [measureAndScrollToInput]);

  // 초기 로드
  useEffect(()=>{
    (async ()=>{
      try{
        if(!baseChallenge?.id){
          Alert.alert('오류','수정할 도전 정보를 찾을 수 없습니다.',[{text:'확인', onPress:()=>navigation.goBack()}]);
          return;
        }
        const raw = await AsyncStorage.getItem(`challenge_${baseChallenge.id}`);
        const latest = raw ? JSON.parse(raw) : baseChallenge;

        setIsHabit(latest?.type === 'habit');
      if (latest?.habitCycle) {
        setHabitCycle(latest.habitCycle);
        if (latest.habitCycle.type === 'weekly') {
          setCycleTab('weekly');
          setCycleDays(new Set(latest.habitCycle.days || []));
        } else {
          setCycleTab('monthly');
          setCycleDates(new Set(latest.habitCycle.dates || []));
        }
      }
      setTitle(String(latest?.title ?? '').slice(0, LIMITS.title));
        setGoalScore(
          typeof latest?.goalScore === 'number' && latest.goalScore>0 ? String(latest.goalScore) : ''
        );
        setReward(String(latest?.reward ?? '').slice(0, LIMITS.reward));
        setDescription(String(latest?.description ?? '').slice(0, LIMITS.description));
        setStartDate(latest?.startDate ? parseDateStr(latest.startDate) : null);
        setEndDate(latest?.endDate ? parseDateStr(latest.endDate) : null);
        if (latest?.notification?.mode) setNotification(latest.notification);
        originalRef.current = {
          title: String(latest?.title ?? '').trim(),
          goalScore: typeof latest?.goalScore === 'number' && latest.goalScore > 0 ? String(latest.goalScore) : '',
          reward: String(latest?.reward ?? '').trim(),
          description: String(latest?.description ?? '').trim(),
          startDate: latest?.startDate ?? null,
          endDate: latest?.endDate ?? null,
          notificationMode: latest?.notification?.mode ?? null,
        };
      } catch(e){
        console.error('[EditChallenge] load error', e);
        Alert.alert('오류','도전 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  },[baseChallenge?.id, navigation]);

  // 알림 설정 결과 수신
  useEffect(()=>{
    const res = route.params?.notificationResult;
    if(res?.mode && res?.payload){
      setNotification({ mode: res.mode, payload: res.payload });
      navigation.setParams?.({ notificationResult: undefined, _nonce: undefined });
    }
  },[route.params?.notificationResult, route.params?._nonce, navigation]);

  const hasUnsavedChanges = useCallback(() => {
    const orig = originalRef.current;
    if (!orig) return false;

    const curTitle = title.trim();
    const curGoal = goalScore;
    const curReward = reward.trim();
    const curDesc = description.trim();
    const curStart = startDate ? fmtDate(startDate) : null;
    const curEnd = endDate ? fmtDate(endDate) : null;
    const curNotif = notification?.mode ?? null;

    return (
      curTitle !== orig.title ||
      curGoal !== orig.goalScore ||
      curReward !== orig.reward ||
      curDesc !== orig.description ||
      curStart !== orig.startDate ||
      curEnd !== orig.endDate ||
      curNotif !== orig.notificationMode
    );
  }, [title, goalScore, reward, description, startDate, endDate, notification]);

  const { handleBackPress, markAsSaved } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '수정 중인 내용이 있어요',
    message: '뒤로 가면 수정한 내용이 저장되지 않습니다.',
    stayText: '계속 수정',
    leaveText: '나가기',
  });

  // 날짜 역순 즉시 경고
  useEffect(()=>{ if (showStartPicker) lastChangedRef.current='start'; },[showStartPicker]);
  useEffect(()=>{ if (showEndPicker) lastChangedRef.current='end'; },[showEndPicker]);
  useEffect(()=>{
    if(startDate && endDate && endDate.getTime() < startDate.getTime()){
      Alert.alert('확인','종료일이 시작일보다 빠를 수 없습니다.');
      if (lastChangedRef.current==='end') setEndDate(null); else setStartDate(null);
    }
  },[startDate,endDate]);

  // 저장
  const onSave = useCallback(() => {
    if (!baseChallenge?.id) return;
    if (busy) return;

    const t = (title || '').trim();
    const r = (reward || '').trim();
    const desc = (description || '').trim();

    // 길이 최종 검증(입력 단계에서 잘라도, 혹시 모를 상황 대비)
    if (!t) { Alert.alert('확인', `${isHabit ? '습관' : '도전'} 제목을 입력해주세요.`); return; }
    if (t.length > LIMITS.title) { Alert.alert('확인', `제목은 ${LIMITS.title}자 이내로 입력해주세요.`); return; }
    if (r.length > LIMITS.reward) { Alert.alert('확인', `보상은 ${LIMITS.reward}자 이내로 입력해주세요.`); return; }
    if (desc.length > LIMITS.description) { Alert.alert('확인', `도전 내용은 ${LIMITS.description}자 이내로 입력해주세요.`); return; }

    const effectiveGoal = isHabit
      ? 0
      : (goalScore === '' ? Number(baseChallenge.goalScore || 0) : toNumberOrZero(goalScore));

    if (!isHabit && effectiveGoal <= 0) {
      Alert.alert('확인', '목표 점수는 1 이상의 숫자여야 합니다.');
      return;
    }

    if (!isHabit && effectiveGoal > LIMITS.maxGoal) {
      Alert.alert('확인', `목표 점수는 ${LIMITS.maxGoal}점 이하여야 합니다.`);
      return;
    }

    const v = validateInput({
      title: t,
      goalScore: isHabit ? 1 : (goalScore === '' ? '' : effectiveGoal),
      startDate: startDate ? fmtDate(startDate) : null,
      endDate: endDate ? fmtDate(endDate) : null,
      allowEmptyGoal: true,
      prevGoalScore: isHabit ? 1 : Number(baseChallenge.goalScore || 0),
    });
    if (!v.ok) {
      if (v.reason === 'TITLE_EMPTY') { Alert.alert('확인', '도전 제목을 입력해주세요.'); return; }
      if (v.reason === 'GOAL_INVALID') { Alert.alert('확인', '목표 점수는 1 이상의 숫자여야 합니다.'); return; }
      if (v.reason === 'DATES_REQUIRED') { Alert.alert('확인', '시작일과 종료일을 선택해주세요.'); return; }
      if (v.reason === 'DATE_ORDER') { Alert.alert('확인', '종료일이 시작일보다 빠를 수 없습니다.'); return; }
      Alert.alert('확인', '입력값을 확인하세요.');
      return;
    }

    const updated = {
      id: baseChallenge.id,
      type: isHabit ? 'habit' : (baseChallenge.type || 'challenge'),
      habitCycle: isHabit ? habitCycle : undefined,
      title: t,
      goalScore: isHabit ? 0 : (goalScore === '' ? Number(baseChallenge.goalScore || 0) : effectiveGoal),
      currentScore: Number(baseChallenge.currentScore || 0),
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      reward: r,
      description: desc,
      notification: notification?.mode ? notification : { mode: null, payload: null },
      status: baseChallenge.status || 'active',
      createdAt: baseChallenge.createdAt || Date.now(),
      completedAt: baseChallenge.completedAt || 0,
    };

    Alert.alert(
      '저장하시겠습니까?',
      isHabit ? '이 습관 수정을 저장할까요?' : '이 도전 수정을 저장할까요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '저장',
          onPress: async () => {
            setBusy(true);
            try {
              await saveAndSchedule(updated, { replaceSchedules: true });
              await syncWidgetChallengeList();
              markAsSaved();
              Alert.alert('저장 완료', '도전이 수정되었습니다.', [
                { text: '확인', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              console.error('[EditChallenge] save error', e);
              Alert.alert('오류', '도전을 저장하지 못했습니다.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [
    baseChallenge,
    busy,
    title,
    goalScore,
    reward,
    description,
    startDate,
    endDate,
    notification,
    navigation,
    isHabit,
    habitCycle,
    markAsSaved,
  ]);

  if(loading){
    return (
      <ScrollView
          contentContainerStyle={[
            canonicalLayoutStyles.screenContentMuted,
            styles.loadingContent,
          ]}
        >
          <Text style={canonicalTextStyles.bodyMuted}>
            불러오는 중…
          </Text>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={canonicalSurfaceStyles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <BackButton title={isHabit ? "습관 수정" : "도전 수정"} onPress={handleBackPress} />
      <ScrollView
        ref={formScrollRef}
        contentContainerStyle={[
          canonicalLayoutStyles.screenContentMuted,
          {
            paddingBottom: Math.max(
              space.xl * 3,
              keyboardBottomInset + space.xl * 2
            ),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={(event) => {
          scrollYRef.current = event?.nativeEvent?.contentOffset?.y || 0;
        }}
        scrollEventThrottle={16}
      >
      

      {/* 기본 정보 */}
      <View style={canonicalCardStyles.form}>
        <Text style={canonicalTextStyles.sectionTitleSpaced}>기본 정보</Text>

        <Text
          style={[
            canonicalTextStyles.label,
            styles.fieldLabelSpacing,
          ]}
        >도전 제목</Text>
        <TextInput
          value={title}
          onChangeText={handleTitleChange} // ← 50자 제한
          placeholder="도전 제목"
          style={canonicalInputStyles.compact}
          placeholderTextColor={color.textDisabled}
        />

        {!isHabit && <Text
          style={[
            canonicalTextStyles.label,
            styles.fieldLabelSpacing,
            styles.fieldSpacing,
          ]}
        >목표 점수</Text>}
        {!isHabit && <TextInput
          value={goalScore}
          onChangeText={handleGoalChange} // ← 숫자만 + 최대 1000
          placeholder="숫자만 입력(비우면 기존값 유지)"
          style={canonicalInputStyles.compact}
          placeholderTextColor={color.textDisabled}
          {...numericInputProps}
        />}

        {/* 도전 내용 */}
        <Text
          style={[
            canonicalTextStyles.label,
            styles.fieldLabelSpacing,
            styles.fieldSpacing,
          ]}
        >도전 내용</Text>
        <TextInput
          ref={descriptionInputRef}
          value={description}
          onChangeText={handleDescChange} // ← 500자 제한
          placeholder="도전의 구체적인 내용을 적어주세요"
          style={[
            canonicalInputStyles.compact,
            canonicalInputStyles.multilineCompact,
          ]}
          placeholderTextColor={color.textDisabled}
          multiline
          textAlignVertical="top"
          onFocus={() => scrollToFocusedInput(descriptionInputRef, 48)}
        />

        <View style={styles.row}>
          <View
          style={[
            styles.col,
            styles.dateStartColumn,
          ]}
        >
            <Text
          style={[
            canonicalTextStyles.label,
            styles.fieldLabelSpacing,
          ]}
        >시작일</Text>
            <TouchableOpacity
              style={[
              buttonStyles.compactRight,
              styles.dateButtonAlign,
            ]}
              onPress={()=>setShowStartPicker(true)}
              activeOpacity={0.9}
            >
              <Text style={buttonStyles.compactRightText}>
                {startDate ? fmtDate(startDate) : '날짜 선택'}
              </Text>
            </TouchableOpacity>
          </View>

          <View
          style={[
            styles.col,
            styles.dateEndColumn,
          ]}
        >
            <Text
          style={[
            canonicalTextStyles.label,
            styles.fieldLabelSpacing,
          ]}
        >종료일</Text>
            <TouchableOpacity
              style={[
              buttonStyles.compactRight,
              styles.dateButtonAlign,
            ]}
              onPress={()=>setShowEndPicker(true)}
              activeOpacity={0.9}
            >
              <Text style={buttonStyles.compactRightText}>
                {endDate ? fmtDate(endDate) : '날짜 선택'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 보상 - 도전 전용 */}
      {!isHabit && (
        <View
          style={[
            canonicalCardStyles.form,
            styles.sectionSpacing,
          ]}
        >
        <Text style={canonicalTextStyles.sectionTitleSpaced}>보상</Text>
        <Text
          style={[
            canonicalTextStyles.label,
            styles.fieldLabelSpacing,
          ]}
        >보상 내용</Text>
        <TextInput
          ref={rewardInputRef}
          value={reward}
          onChangeText={handleRewardChange} // ← 50자 제한
          placeholder="원하는 보상을 입력하세요!"
          style={canonicalInputStyles.compact}
          placeholderTextColor={color.textDisabled}
          onFocus={() => scrollToFocusedInput(rewardInputRef, 48)}
        />
              </View>
      )}

      {/* 목표 주기 - 습관 전용 */}
      {isHabit && (
        <SettingSectionCard
          title="목표 주기"
          actionLabel={habitCycle ? '변경' : '선택'}
          onActionPress={() => setShowCycleModal(true)}
          onClear={habitCycle ? () => {
            setHabitCycle(null);
            setCycleDays(new Set());
            setCycleDates(new Set());
            setCycleWeekScope('custom');
            setCycleMonthScope('custom');
          } : undefined}
          clearAccessibilityLabel="목표 주기 삭제"
          style={styles.sectionSpacing}
        >
          <SettingGoalCyclePreview cycle={habitCycle} />
        </SettingSectionCard>
      )}

      {/* 알림 */}
      <SettingSectionCard
        title="알림"
        actionLabel={notification?.mode ? '변경' : '설정'}
        onActionPress={() => setShowNotifPicker(true)}
        onClear={notification?.mode ? () => setNotification({ mode: null, payload: null }) : undefined}
        clearAccessibilityLabel="알림 삭제"
        style={styles.sectionSpacing}
      >
        <SettingNotificationPreview notification={notification} startDate={startDate} endDate={endDate} />
      </SettingSectionCard>

      {/* 목표 주기 모달 - 습관 전용 */}
      <Modal visible={showCycleModal} transparent animationType="fade" onRequestClose={() => setShowCycleModal(false)}>
        <View style={canonicalModalStyles.backdrop}>
          <View style={canonicalModalStyles.sheet}>
            <Text style={canonicalModalStyles.title}>목표 주기 설정</Text>
            
            <View style={styles.cycleTabRow}>
              {['weekly', 'monthly'].map(t => (
                <TouchableOpacity key={t} style={[styles.cycleTabBtn, cycleTab === t && styles.cycleTabBtnOn]} onPress={() => setCycleTab(t)}>
                  <Text style={[styles.cycleTabText, cycleTab === t && styles.cycleTabTextOn]}>{t === 'weekly' ? '주간' : '월간'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.scopeRow}>
              {cycleTab === 'weekly' ? (
                ['all', 'weekday', 'weekend', 'custom'].map(s => (
                  <TouchableOpacity key={s} onPress={() => {
                    setCycleWeekScope(s);
                    if (s === 'all') setCycleDays(new Set(['월','화','수','목','금','토','일']));
                    else if (s === 'weekday') setCycleDays(new Set(['월','화','수','목','금']));
                    else if (s === 'weekend') setCycleDays(new Set(['토','일']));
                    else if (s === 'custom') setCycleDays(new Set());
                  }} style={[
                styles.scopeButton,
                cycleWeekScope === s && styles.scopeButtonOn,
              ]}>
                    <Text style={[
                  styles.scopeButtonText,
                  cycleWeekScope === s && styles.scopeButtonTextOn,
                ]}>
                      {{ all: '매일', weekday: '평일', weekend: '주말', custom: '직접' }[s]}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                ['all', 'even', 'odd', 'custom'].map(s => (
                  <TouchableOpacity key={s} onPress={() => {
                    setCycleMonthScope(s);
                    if (s === 'all') setCycleDates(new Set(Array.from({length:31}, (_,i)=>i+1)));
                    else if (s === 'even') setCycleDates(new Set(Array.from({length:31}, (_,i)=>i+1).filter(n=>n%2===0)));
                    else if (s === 'odd') setCycleDates(new Set(Array.from({length:31}, (_,i)=>i+1).filter(n=>n%2!==0)));
                    else if (s === 'custom') setCycleDates(new Set());
                  }} style={[
                styles.scopeButton,
                cycleMonthScope === s && styles.scopeButtonOn,
              ]}>
                    <Text style={[
                  styles.scopeButtonText,
                  cycleMonthScope === s && styles.scopeButtonTextOn,
                ]}>
                      {{ all: '매일', even: '짝수', odd: '홀수', custom: '직접' }[s]}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {cycleTab === 'weekly' ? (
              <View
              style={[
                styles.cycleDaysRow,
                styles.cycleGridSpacing,
              ]}
            >
                {['월','화','수','목','금','토','일'].map(d => (
                  <TouchableOpacity key={d} onPress={() => {
                    const next = new Set(cycleDays);
                    if (next.has(d)) next.delete(d); else next.add(d);
                    setCycleDays(next);
                    setCycleWeekScope('custom');
                  }} style={[styles.cycleDayCircle, cycleDays.has(d) && styles.cycleDayCircleOn]}>
                    <Text style={[styles.cycleDayText, cycleDays.has(d) && styles.cycleDayTextOn]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.cycleGridSpacing}>
                {Array.from({ length: 5 }).map((_, row) => (
                  <View key={row} style={styles.monthGridRow}>
                    {Array.from({ length: 7 }).map((__, col) => {
                      const d = row * 7 + col + 1;
                      if (d > 31) {
              return (
                <View
                  key={col}
                  style={styles.monthGridBlank}
                />
              );
            }
                      const on = cycleDates.has(d);
                      return (
                        <TouchableOpacity key={col} onPress={() => {
                          const next = new Set(cycleDates);
                          if (next.has(d)) next.delete(d); else next.add(d);
                          setCycleDates(next);
                          setCycleMonthScope('custom');
                        }} style={[
                  styles.monthGridCell,
                  on && styles.monthGridCellOn,
                ]}>
                          <Text
                  style={[
                    styles.monthGridText,
                    on && styles.monthGridTextOn,
                  ]}
                >
                  {d}
                </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.cycleActionRow}>
              <TouchableOpacity
              style={styles.cycleActionButton}
              onPress={() => setShowCycleModal(false)}
            >
                <Text style={styles.cycleActionText}>
              취소
            </Text>
              </TouchableOpacity>
              <TouchableOpacity
              style={[
                styles.cycleActionButton,
                styles.cycleActionButtonPrimary,
              ]}
              onPress={() => {
                if (cycleTab === 'weekly') {
                  setHabitCycle(cycleDays.size ? { type: 'weekly', days: Array.from(cycleDays), dates: [] } : null);
                } else {
                  setHabitCycle(cycleDates.size ? { type: 'monthly', days: [], dates: Array.from(cycleDates) } : null);
                }
                setShowCycleModal(false);
              }}>
                <Text
              style={[
                styles.cycleActionText,
                styles.cycleActionTextPrimary,
              ]}
            >
              저장
            </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
          style={[
            buttonStyles.primary.container,
            styles.saveButton,
          ]}
          onPress={onSave}
          activeOpacity={0.9}
        >
        <Text style={buttonStyles.primary.label}>저장</Text>
      </TouchableOpacity>

      {/* 날짜 모달 */}
      <DateTimePickerModal
        isVisible={showStartPicker}
        mode="date"
        date={startDate ?? new Date()}
        onConfirm={(d)=>{ setShowStartPicker(false); setStartDate(d); lastChangedRef.current='start'; }}
        onCancel={()=>setShowStartPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showEndPicker}
        mode="date"
        date={endDate ?? new Date()}
        onConfirm={(d)=>{ setShowEndPicker(false); setEndDate(d); lastChangedRef.current='end'; }}
        onCancel={()=>setShowEndPicker(false)}
      />

      {/* 알림 방식 선택 모달 */}
      <Modal visible={showNotifPicker} transparent animationType="fade" onRequestClose={()=>setShowNotifPicker(false)}>
        <View style={canonicalModalStyles.backdrop}>
          <View style={canonicalModalStyles.sheet}>
            <Text style={canonicalModalStyles.title}>알림 방식 선택</Text>

            {/* ① 간단 알림 — onDone/returnTo 추가 */}
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={()=>{
              setShowNotifPicker(false);
              const initial = notification?.mode==='simple' ? (notification.payload??null) : null;
              navigation.navigate('SimpleNotification', {
                initial,
                returnTo: 'EditChallenge',
                onDone: (res) => { setNotification(res); },
              });
            }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>간단 알림</Text>
            </TouchableOpacity>

            {/* ② 주간 알림 — onDone/returnTo 추가 */}
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={()=>{
              setShowNotifPicker(false);
              const initial = notification?.mode==='weekly' ? (notification.payload??null) : null;
              navigation.navigate('WeeklyNotification', {
                initial,
                returnTo: 'EditChallenge',
                onDone: (res) => { setNotification(res); },
              });
            }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>주간 알림</Text>
            </TouchableOpacity>

            {/* ③ 월간 알림 — onDone/returnTo 추가 */}
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={()=>{
              setShowNotifPicker(false);
              const initial = notification?.mode==='monthly' ? (notification.payload??null) : null;
              navigation.navigate('MonthlyNotification', {
                initial,
                returnTo: 'EditChallenge',
                onDone: (res) => { setNotification(res); },
              });
            }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>월간 알림</Text>
            </TouchableOpacity>

            {/* ④ 전체 일정 알림 — onDone/returnTo 추가(+ 기간 체크 유지) */}
            <TouchableOpacity style={[buttonStyles.primary.container, styles.modalButton]} onPress={()=>{
              if (!startDate || !endDate) { Alert.alert('확인','시작일과 종료일을 먼저 선택해주세요.'); return; }
              if (endDate.getTime() < startDate.getTime()) { Alert.alert('확인','종료일이 시작일보다 빠를 수 없습니다.'); return; }
              setShowNotifPicker(false);
              const initial = notification?.mode==='fullrange' ? (notification.payload??null) : null;
              navigation.navigate('FullRangeNotification', {
                initial,
                startDate: fmtDate(startDate),
                endDate: fmtDate(endDate),
                returnTo: 'EditChallenge',
                onDone: (res) => { setNotification(res); },
              });
            }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>전체 일정 세부 알림</Text>
            </TouchableOpacity>

            {/* [추가] 얇은 검은 라인 */}
            <View style={styles.modalDivider} />

             {/* 알림 기본 설정 — 모양은 위 버튼들과 1:1, 색만 유지 */}
            <TouchableOpacity
              style={[buttonStyles.primary.container, styles.modalBasicKeepColor, styles.modalButton]}
              onPress={()=>{
                setShowNotifPicker(false);
                navigation.navigate('NotificationDefaults', {
                  returnTo: 'EditChallenge',
                });
              }}
              activeOpacity={0.9}
            >
              <Text style={[buttonStyles.primary.label, styles.modalBasicKeepLabel]}>
                알림 기본 설정
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
                    style={[
                      canonicalModalStyles.closePill,
                      styles.modalCloseColor,
                    ]}
                    onPress={() => setShowNotifPicker(false)}
                  >
                    <Text
                      style={[
                        canonicalModalStyles.closePillText,
                        styles.modalCloseTextColor,
                      ]}
                    >
                      닫기
                    </Text>
                  </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldLabelSpacing: {
    marginBottom: space.xxs + 2,
  },

  fieldSpacing: {
    marginTop: space.sm,
  },

  row: {
    flexDirection: 'row',
    marginTop: space.sm,
  },

  col: {
    flex: 1,
  },

  dateStartColumn: {
    marginRight: space.xs,
  },

  dateEndColumn: {
    marginLeft: space.xs,
  },

  dateButtonAlign: {
    alignSelf: 'flex-start',
  },

  sectionSpacing: {
    marginTop: space.md,
  },

  saveButton: {
    marginTop: space.xl,
  },

  previewBox: {
    marginTop: space.sm,
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.md,
    padding: space.sm,
  },

  previewText: {
    color: color.textPrimary,
  },

  previewTextSmall: {
    color: color.textPrimary,
    fontSize: font.size.meta,
    marginTop: space.xxs + 2,
  },

  previewNoteText: {
    color: color.textSecondary,
    fontSize: font.size.caption,
    marginTop: space.xxs / 2,
  },

  simpleDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.xxs + 2,
  },

  simpleCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  simpleCircleOff: {
    borderColor: primitive.neutral[300],
    backgroundColor: primitive.white,
  },

  simpleCircleOn: {
    borderColor: primitive.black,
    backgroundColor: primitive.black,
  },

  simpleCircleText: {
    fontSize: font.size.meta,
    fontWeight: font.weight.heavy,
    color: primitive.neutral[700],
    includeFontPadding: false,
  },

  simpleCircleTextOn: {
    color: primitive.white,
  },

  weekGrid: {
    flexDirection: 'row',
  },

  weekCol: {
    flex: 1,
    paddingHorizontal: space.xxs + 2,
  },

  weekColDivider: {
    borderRightWidth: 1,
    borderRightColor: color.border,
  },

  weekDayLabel: {
    textAlign: 'center',
    fontSize: font.size.meta,
    fontWeight: font.weight.heavy,
    color: primitive.neutral[700],
    marginBottom: space.xxs,
  },

  weekTimesWrap: {
    alignItems: 'center',
  },

  weekTimeText: {
    fontSize: font.size.caption,
    color: color.textPrimary,
    lineHeight: 14,
  },

  monthOuter: {
    borderTopWidth: 1,
    borderTopColor: color.border,
  },

  monthRow: {
    flexDirection: 'row',
  },

  monthRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },

  monthCell: {
    flex: 1,
    padding: space.xxs + 2,
  },

  monthCellDivider: {
    borderRightWidth: 1,
    borderRightColor: color.border,
  },

  monthDateText: {
    fontSize: font.size.caption,
    fontWeight: font.weight.heavy,
    color: primitive.neutral[700],
    textAlign: 'right',
  },

  monthTimesWrap: {
    marginTop: space.xxs / 2,
  },

  monthTimeText: {
    fontSize: font.size.caption,
    color: color.textPrimary,
    lineHeight: 14,
  },

  fullRangeMonthTitle: {
    fontSize: font.size.meta,
    fontWeight: font.weight.heavy,
    color: primitive.neutral[700],
    marginBottom: space.xxs,
    textAlign: 'center',
  },

  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: space.xxs,
  },

  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },

  weekHeaderCellDivider: {
    borderRightWidth: 1,
    borderRightColor: color.border,
  },

  weekHeaderText: {
    fontSize: font.size.caption,
    fontWeight: font.weight.heavy,
    color: primitive.neutral[700],
  },

  cycleTabRow: {
    flexDirection: 'row',
    marginBottom: space.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
  },

  cycleTabBtn: {
    flex: 1,
    paddingVertical: space.xs,
    alignItems: 'center',
    backgroundColor: color.surfaceMuted,
  },

  cycleTabBtnOn: {
    backgroundColor: primitive.black,
  },

  cycleTabText: {
    fontSize: font.size.bodySmall,
    fontWeight: font.weight.heavy,
    color: color.textSecondary,
  },

  cycleTabTextOn: {
    color: primitive.white,
  },

  scopeRow: {
    flexDirection: 'row',
    gap: space.xxs + 2,
    marginBottom: space.sm,
  },

  scopeButton: {
    flex: 1,
    paddingVertical: space.xxs + 2,
    borderRadius: radius.sm - 2,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
  },

  scopeButtonOn: {
    backgroundColor: primitive.black,
  },

  scopeButtonText: {
    fontSize: font.size.caption,
    fontWeight: font.weight.bold,
    color: color.textSecondary,
  },

  scopeButtonTextOn: {
    color: primitive.white,
  },

  cycleDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },

  cycleGridSpacing: {
    marginBottom: space.lg,
  },

  cycleDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: primitive.neutral[300],
    backgroundColor: primitive.white,
  },

  cycleDayCircleOn: {
    backgroundColor: primitive.black,
    borderColor: primitive.black,
  },

  cycleDayText: {
    fontSize: font.size.meta,
    fontWeight: font.weight.heavy,
    color: primitive.neutral[700],
  },

  cycleDayTextOn: {
    color: primitive.white,
  },

  monthGridRow: {
    flexDirection: 'row',
    marginBottom: space.xxs,
  },

  monthGridBlank: {
    flex: 1,
  },

  monthGridCell: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    backgroundColor: color.backgroundMuted,
    margin: space.xxs / 2,
  },

  monthGridCellOn: {
    backgroundColor: primitive.black,
  },

  monthGridText: {
    fontSize: font.size.caption,
    fontWeight: font.weight.bold,
    color: primitive.neutral[700],
  },

  monthGridTextOn: {
    color: primitive.white,
  },

  cycleActionRow: {
    flexDirection: 'row',
    gap: space.xs,
  },

  cycleActionButton: {
    flex: 1,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
    backgroundColor: primitive.white,
    borderWidth: 1,
    borderColor: primitive.black,
  },

  cycleActionButtonPrimary: {
    backgroundColor: primitive.black,
  },

  cycleActionText: {
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
    color: primitive.black,
  },

  cycleActionTextPrimary: {
    color: primitive.white,
  },

  modalButton: {
    marginTop: space.xs,
  },

  modalDivider: {
    marginTop: space.sm,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.textPrimary,
    opacity: 0.2,
  },

  modalBasicKeepColor: {
    backgroundColor: primitive.white,
    borderWidth: 1,
    borderColor: color.textPrimary,
  },

  modalBasicKeepLabel: {
    color: color.textPrimary,
  },

  modalCloseColor: {
    backgroundColor: primitive.black,
  },

  modalCloseTextColor: {
    color: primitive.white,
  },
});
