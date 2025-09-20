// screens/EditChallengeScreen.js
// - AddChallengeScreen 기반으로 전면 이식
// - 프리뷰: 간단/주간/월간(31일)/전체일정(세로스크롤) 동일
// - 알림 모달 라벨 동일(주간 알림/월간 알림/전체 일정 알림)
// - 시작/종료일 역순 즉시 경고(되돌리기)
// - 알림 삭제 버튼(알림 있을 때만 노출)
// - 저장 시 AsyncStorage 업데이트 + saveAndSchedule(replaceSchedules)

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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

const WEEK_DAYS_KO = ['월','화','수','목','금','토','일'];

const pad2 = (n)=>String(n).padStart(2,'0');
const fmtDate = (d)=>!d?'':`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseDateStr = (s)=>{
  if(!s) return null; const [y,m,d]=s.split('-').map(Number);
  const dt = new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
};
const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
function timeToHuman(hhmm){
  if(!hhmm) return '';
  const [hStr,mStr] = String(hhmm).split(':');
  const h = Number(hStr); const m = Number(mStr||0);
  const isAM = h<12; const h12 = h%12===0?12:h%12;
  return `${isAM?'오전':'오후'} ${h12}:${pad2(m)}`;
}

/* ===== 미리보기 컴포넌트들 (Add와 동일) ===== */

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

  // 폼
  const [title,setTitle] = useState('');
  const [goalScore,setGoalScore] = useState(''); // 비우면 기존값 유지
  const [reward,setReward] = useState('');

  // 날짜
  const [startDate,setStartDate] = useState(null);
  const [endDate,setEndDate] = useState(null);
  const [showStartPicker,setShowStartPicker] = useState(false);
  const [showEndPicker,setShowEndPicker] = useState(false);
  const lastChangedRef = useRef(null);

  // 알림
  const [notification,setNotification] = useState({ mode:null, payload:null });
  const [showNotifPicker,setShowNotifPicker] = useState(false);

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

        setTitle(String(latest?.title ?? ''));
        setGoalScore(
          typeof latest?.goalScore === 'number' && latest.goalScore>0 ? String(latest.goalScore) : ''
        );
        setReward(String(latest?.reward ?? ''));
        setStartDate(latest?.startDate ? parseDateStr(latest.startDate) : null);
        setEndDate(latest?.endDate ? parseDateStr(latest.endDate) : null);
        if (latest?.notification?.mode) setNotification(latest.notification);
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
  const onSave = useCallback(async ()=>{
    if(!baseChallenge?.id) return;
    const effectiveGoal = (goalScore==='' ? Number(baseChallenge.goalScore||0) : toNumberOrZero(goalScore));

    const v = validateInput({
      title,
      goalScore: (goalScore==='' ? '' : effectiveGoal),
      startDate: startDate ? fmtDate(startDate) : null,
      endDate: endDate ? fmtDate(endDate) : null,
      allowEmptyGoal: true,
      prevGoalScore: Number(baseChallenge.goalScore||0),
    });
    if(!v.ok){
      if (v.reason==='TITLE_EMPTY') { Alert.alert('확인','도전 제목을 입력해주세요.'); return; }
      if (v.reason==='GOAL_INVALID'){ Alert.alert('확인','목표 점수는 1 이상의 숫자여야 합니다.'); return; }
      if (v.reason==='DATES_REQUIRED'){ Alert.alert('확인','시작일과 종료일을 선택해주세요.'); return; }
      if (v.reason==='DATE_ORDER'){ Alert.alert('확인','종료일이 시작일보다 빠를 수 없습니다.'); return; }
      Alert.alert('확인','입력값을 확인하세요.'); return;
    }

    const updated = {
      id: baseChallenge.id,
      title: (title||'').trim(),
      goalScore: (goalScore==='' ? Number(baseChallenge.goalScore||0) : effectiveGoal),
      currentScore: Number(baseChallenge.currentScore||0),
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      reward,
      notification: notification?.mode ? notification : { mode:null, payload:null },
      status: baseChallenge.status || 'active',
      createdAt: baseChallenge.createdAt || Date.now(),
      completedAt: baseChallenge.completedAt || 0,
    };

    try{
      await saveAndSchedule(updated, { replaceSchedules:true });

      // 리스트/개별 캐시 업데이트
      try{
        const raw = await AsyncStorage.getItem('challenges');
        const arr = raw ? JSON.parse(raw) : [];
        const next = Array.isArray(arr)
          ? arr.map(c => (String(c.id)===String(updated.id) ? { ...c, ...updated } : c))
          : [updated];
        await AsyncStorage.setItem('challenges', JSON.stringify(next));
        await AsyncStorage.setItem(`challenge_${updated.id}`, JSON.stringify(updated));
      }catch{}

      Alert.alert('저장 완료','도전이 수정되었습니다.',[
        { text:'확인', onPress:()=>navigation.goBack() }
      ]);
    }catch(e){
      console.error('[EditChallenge] save error', e);
      Alert.alert('오류','도전을 저장하지 못했습니다.');
    }
  },[baseChallenge, title, goalScore, reward, startDate, endDate, notification, navigation]);

  // 알림 모달 라우팅 (Add와 동일)
  const goSimple = useCallback(()=>{
    setShowNotifPicker(false);
    const initial = notification?.mode==='simple' ? (notification.payload??null) : null;
    navigation.navigate('SimpleNotification', {
      initial,
      onDone: (result) => { if (result?.mode === 'simple') setNotification(result); },
    });
  },[navigation, notification]);

  const goWeekly = useCallback(()=>{
    setShowNotifPicker(false);
    const initial = notification?.mode==='weekly' ? (notification.payload??null) : null;
    navigation.navigate('WeeklyNotification', {
      initial,
      onDone: (result) => { if (result?.mode === 'weekly') setNotification(result); },
    });
  },[navigation, notification]);

  const goMonthly = useCallback(()=>{
    setShowNotifPicker(false);
    const initial = notification?.mode==='monthly' ? (notification.payload??null) : null;
    navigation.navigate('MonthlyNotification', {
      initial,
      onDone: (result) => { if (result?.mode === 'monthly') setNotification(result); },
    });
  }, [navigation, notification]);

  const goFullRange = useCallback(() => {
    if (!startDate || !endDate) { Alert.alert('확인','시작일과 종료일을 먼저 선택해주세요.'); return; }
    if (endDate.getTime() < startDate.getTime()) { Alert.alert('확인','종료일이 시작일보다 빠를 수 없습니다.'); return; }
    const initial = notification?.mode === 'fullrange' ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('FullRangeNotification', {
      initial,
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      onDone: (result) => { if (result?.mode === 'fullrange') setNotification(result); },
    });
  }, [navigation, notification, startDate, endDate]);

  if(loading){
    return (
      <ScrollView contentContainerStyle={[styles.container,{alignItems:'center', justifyContent:'center'}]}>
        <Text style={{ color: PALETTE.gray600 }}>불러오는 중…</Text>
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
              onPress={()=>setShowStartPicker(true)}
              activeOpacity={0.9}
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
          <View style={styles.rightBtnGroup}>
            {notification?.mode && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={()=>setNotification({ mode:null, payload:null })}
                activeOpacity={0.9}
              >
                <Text style={styles.deleteBtnText}>알림 삭제</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={buttonStyles.compactRight}
              onPress={()=>setShowNotifPicker(true)}
              activeOpacity={0.9}
            >
              <Text style={buttonStyles.compactRightText}>알림 설정</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.previewBox}>
          {previewNodeByNotification(notification, startDate, endDate)}
        </View>
      </View>

      <TouchableOpacity style={[buttonStyles.primary.container, { marginTop: spacing.xl }]} onPress={onSave} activeOpacity={0.9}>
        <Text style={buttonStyles.primary.label}>저장</Text>
      </TouchableOpacity>

      {/* 날짜 모달 */}
      <DateTimePickerModal
        isVisible={showStartPicker}
        mode="date"
        onConfirm={(d)=>{ setShowStartPicker(false); setStartDate(d); lastChangedRef.current='start'; }}
        onCancel={()=>setShowStartPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showEndPicker}
        mode="date"
        onConfirm={(d)=>{ setShowEndPicker(false); setEndDate(d); lastChangedRef.current='end'; }}
        onCancel={()=>setShowEndPicker(false)}
      />

      {/* 알림 방식 선택 모달 (라벨 동일) */}
      <Modal visible={showNotifPicker} transparent animationType="fade" onRequestClose={()=>setShowNotifPicker(false)}>
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

            <TouchableOpacity style={styles.modalClose} onPress={()=>setShowNotifPicker(false)}>
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

  // 전체일정 프리뷰 상단
  fullRangeMonthTitle: { fontSize: 12, fontWeight: '800', color: PALETTE.gray700, marginBottom: 4, textAlign: 'center' },
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
