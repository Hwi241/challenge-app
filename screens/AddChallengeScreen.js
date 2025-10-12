// screens/AddChallengeScreen.js
// - 시작/종료일 역순 즉시 경고(되돌리기)
// - 알림 모달 라벨: 주간 알림 / 월간 알림 / 전체 일정 알림
// - 프리뷰 개선
// - 뒤로가기(하드웨어/제스처) 시 항상 ChallengeList로 이동
// - '전체 일정 알림' 진입 전 시작/종료일 필수 + 역순 차단
// - ✅ 입력 제한 추가(제목 50, 목표점수 ≤1000, 내용 500, 보상 50)
// - ✅ 뒤로가기로 나갈 때 초안 초기화 + 폼 리셋

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, BackHandler
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import { buttonStyles, spacing, radius } from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';
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

const LIMITS = { title: 50, reward: 50, description: 500, maxGoal: 1000 };

const DRAFT_KEY = 'draft_add_challenge';
const WEEK_DAYS_KO = ['월','화','수','목','금','토','일'];
const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));

const SimplePreviewMini = ({ days=[], times=[], time }) => {
  const toShow = (Array.isArray(times) && times.length) ? sortTimesAsc(times) : (time ? [time] : []);
  return (
    <View>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
        {WEEK_DAYS_KO.map(d=>{
          const on = days.includes(d);
          return (
            <View key={d} style={{
              width:22, height:22, borderRadius:11, alignItems:'center', justifyContent:'center',
              borderWidth:1, borderColor: on? '#111':'#ddd', backgroundColor:on? '#111':'#fff'
            }}>
              <Text style={{ fontSize:11, fontWeight:'800', color:on?'#fff':'#333' }}>{d}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize:12, color:'#333', textAlign:'center' }}>
        {toShow.length? toShow.join('  ') : '시간 미설정'}
      </Text>
    </View>
  );
};

const WeeklyPreviewMini = ({ byWeekDays=[] })=>{
  const map = React.useMemo(()=>{
    const m=new Map();
    for(const {day, times=[]} of byWeekDays) m.set(day, sortTimesAsc(times));
    return m;
  },[byWeekDays]);
  return (
    <View style={{ flexDirection:'row' }}>
      {WEEK_DAYS_KO.map((d,i)=>(
        <View key={d} style={{ flex:1, paddingHorizontal:4, borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}>
          <Text style={{ fontSize:12, fontWeight:'800', color:'#555', textAlign:'center', marginBottom:2 }}>{d}</Text>
          {(map.get(d)||[]).map((t,idx)=><Text key={`${d}-${t}-${idx}`} style={{ fontSize:11, textAlign:'center' }}>{t}</Text>)}
        </View>
      ))}
    </View>
  );
};

const MonthlyPreviewMini = ({ byDates=[] })=>{
  const map = React.useMemo(()=>{
    const m=new Map();
    for(const {date, times=[]} of byDates){
      const n=Number(date);
      if(n>=1&&n<=31){ m.set(n, sortTimesAsc([...(m.get(n)||[]), ...times])); }
    }
    return m;
  },[byDates]);
  const cells=[]; for(let d=1; d<=31; d++) cells.push(d); while(cells.length<35) cells.push(null);
  return (
    <View style={{ borderTopWidth:1, borderTopColor:'#eee' }}>
      {Array.from({length:5}).map((_,r)=>(
        <View key={`r${r}`} style={{ flexDirection:'row', borderBottomWidth:r<4?1:0, borderBottomColor:'#eee' }}>
          {cells.slice(r*7, r*7+7).map((d,c)=>(
            <View key={`c${r}-${c}`} style={{ flex:1, padding:4, borderRightWidth:c<6?1:0, borderRightColor:'#eee' }}>
              {d && <>
                <Text style={{ fontSize:11, fontWeight:'800', color:'#555', textAlign:'right' }}>{d}</Text>
                {(map.get(d)||[]).map((t,idx)=><Text key={`${d}-${t}-${idx}`} style={{ fontSize:11 }}>{t}</Text>)}
              </>}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const FullRangePreviewMini = ({ payload={}, startDate, endDate }) => {
  if(!startDate || !endDate) return <Text style={{fontSize:12, textAlign:'center'}}>기간이 설정되지 않았습니다.</Text>;
  const byDate = payload.byDate || {};
  const months=[]; const cur=new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while(cur<=end){ months.push({y:cur.getFullYear(), mi:cur.getMonth()}); cur.setMonth(cur.getMonth()+1,1); }
  const inRange=(y,mi,d)=>{
    const dt=new Date(y,mi,d);
    return dt>=new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
        && dt<=new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  };
  const pad2=(n)=>String(n).padStart(2,'0');
  return (
    <View style={{ maxHeight:260 }}>
      <ScrollView nestedScrollEnabled>
        {months.map(({y,mi})=>{
          const firstDow=new Date(y,mi,1).getDay();
          const dim=new Date(y,mi+1,0).getDate();
          const cells=[]; for(let i=0;i<firstDow;i++) cells.push(null); for(let d=1; d<=dim; d++) cells.push(d);
          while(cells.length%7!==0) cells.push(null);
          return (
            <View key={`${y}-${mi}`} style={{ marginBottom:8 }}>
              <Text style={{ fontSize:12, fontWeight:'800', color:'#555', textAlign:'center' }}>{y}.{pad2(mi+1)}</Text>
              <View style={{ flexDirection:'row', marginBottom:4 }}>
                {['일','월','화','수','목','금','토'].map((w,i)=>
                  <View key={w} style={{ flex:1, alignItems:'center', borderRightWidth:i<6?1:0, borderRightColor:'#eee' }}>
                    <Text style={{fontSize:11, fontWeight:'800', color:'#777'}}>{w}</Text>
                  </View>
                )}
              </View>
              <View style={{ borderTopWidth:1, borderTopColor:'#eee' }}>
                {Array.from({length: Math.ceil(cells.length/7)}).map((__,r)=>(
                  <View key={`r${r}`} style={{ flexDirection:'row', borderBottomWidth:1, borderBottomColor:'#eee' }}>
                    {cells.slice(r*7, r*7+7).map((d,c)=>{
                      const show = d && inRange(y,mi,d);
                      const key = d? `${y}-${pad2(mi+1)}-${pad2(d)}` : '';
                      const t = show? (Array.isArray(byDate[key])? sortTimesAsc(byDate[key]):[]) : [];
                      return (
                        <View key={`c${r}-${c}`} style={{ flex:1, padding:4, borderRightWidth:c<6?1:0, borderRightColor:'#eee' }}>
                          {d && <>
                            <Text style={{ fontSize:11, fontWeight:'800', color: show?'#555':'#bbb', textAlign:'right' }}>{d}</Text>
                            {show && t.map((x,idx)=><Text key={`${d}-${x}-${idx}`} style={{ fontSize:11 }}>{x}</Text>)}
                          </>}
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
};

const NotiPreviewSwitch = ({ notification, startDate, endDate })=>{
  if(!notification?.mode) return <Text style={{ fontSize:12, color:'#555', textAlign:'center' }}>알림 없음</Text>;
  const { mode, payload={} } = notification;
  if (mode==='simple')  return <SimplePreviewMini days={payload.days||[]} times={payload.times||[]} time={payload.time} />;
  if (mode==='weekly' && Array.isArray(payload.byWeekDays)) return <WeeklyPreviewMini byWeekDays={payload.byWeekDays} />;
  if (mode==='monthly' && Array.isArray(payload.byDates))   return <MonthlyPreviewMini byDates={payload.byDates} />;
  if (mode==='fullrange') return <FullRangePreviewMini payload={payload} startDate={startDate} endDate={endDate} />;
  return <Text style={{ fontSize:12, color:'#555', textAlign:'center' }}>알림 없음</Text>;
};


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
   화면 본문
   ========================= */

export default function AddChallengeScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // 폼
  const [title, setTitle] = useState('');
  const [goalScore, setGoalScore] = useState('');
  const [reward, setReward] = useState('');
  const [description, setDescription] = useState(''); // ✅ 도전 내용

  // 날짜
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);


  // 알림
  const [notification, setNotification] = useState({ mode: null, payload: null });
  const [showNotifPicker, setShowNotifPicker] = useState(false);

  // 저장 중 보호
  const [busy, setBusy] = useState(false);

  // 임시저장 제어
  const saveDraftDebounce = useRef(null);
  const suppressDraftRef = useRef(false);
  const saveDraft = useCallback(async (draft) => {
    try { await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, []);

  // ✅ 목표 점수 입력: 숫자만, 최대 1000으로 클램프
  const handleGoalChange = useCallback((txt)=>{
    const digits = (txt || '').replace(/[^\d]/g,'');
    if (!digits) { setGoalScore(''); return; }
    let n = parseInt(digits, 10);
    if (isNaN(n)) { setGoalScore(''); return; }
    if (n > LIMITS.maxGoal) n = LIMITS.maxGoal;
    setGoalScore(String(n));
  }, []);

  // ✅ 임시저장: 제한 적용된 값으로 저장 (suppress 시 저장 안 함)
  useEffect(() => {
    if (suppressDraftRef.current) return;
    const draft = {
      title, goalScore, reward, description,
      startDate: startDate ? fmtDate(startDate) : null,
      endDate: endDate ? fmtDate(endDate) : null,
    };
    if (saveDraftDebounce.current) clearTimeout(saveDraftDebounce.current);
    saveDraftDebounce.current = setTimeout(() => saveDraft(draft), 200);
    return () => { if (saveDraftDebounce.current) clearTimeout(saveDraftDebounce.current); };
  }, [title, goalScore, reward, description, startDate, endDate, saveDraft]);

  // 최초 진입 시 초안 복원
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
        setDescription(String(d.description || ''));
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

  // ✅ 뒤로가기 시: 초안 삭제 + 폼 리셋 + 리스트로 이동
  const clearDraftAndReset = useCallback(async () => {
    try {
      suppressDraftRef.current = true; // 저장 억제
      if (saveDraftDebounce.current) { clearTimeout(saveDraftDebounce.current); saveDraftDebounce.current = null; }
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch {}
    // 폼 리셋
    setTitle(''); setGoalScore(''); setReward(''); setDescription('');
    setStartDate(null); setEndDate(null);
    setNotification({ mode: null, payload: null });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        clearDraftAndReset();
        navigation.navigate('ChallengeList');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      const remove = navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
        clearDraftAndReset();
        navigation.navigate('ChallengeList');
      });
      return () => { sub.remove(); navigation.removeListener('beforeRemove', remove); };
    }, [navigation, clearDraftAndReset])
  );

  // 날짜 역순 즉시 경고(되돌리기)
  const lastChangedRef = useRef(null); // 'start' | 'end'
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
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
      const t = (title || '').trim();
      const r = (reward || '').trim();
      const desc = (description || '').trim();

      // ✅ 길이/값 검증
      if (!t) { Alert.alert('확인', '도전 제목을 입력해주세요.'); setBusy(false); return; }
      if (t.length > LIMITS.title) { Alert.alert('확인', `제목은 ${LIMITS.title}자 이내로 입력해주세요.`); setBusy(false); return; }
      if (r.length > LIMITS.reward) { Alert.alert('확인', `보상은 ${LIMITS.reward}자 이내로 입력해주세요.`); setBusy(false); return; }
      if (desc.length > LIMITS.description) { Alert.alert('확인', `도전 내용은 ${LIMITS.description}자 이내로 입력해주세요.`); setBusy(false); return; }

      const goalNum = toNumberOrZero(goalScore);
      if (goalNum <= 0) { Alert.alert('확인', '목표 점수는 1 이상의 숫자여야 합니다.'); setBusy(false); return; }
      if (goalNum > LIMITS.maxGoal) { Alert.alert('확인', `목표 점수는 ${LIMITS.maxGoal}점 이하여야 합니다.`); setBusy(false); return; }

      const dataForValidation = {
        title: t,
        goalScore: goalNum,
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
        title: t,
        goalScore: goalNum,
        currentScore: 0,
        startDate: fmtDate(startDate),
        endDate: fmtDate(endDate),
        reward: r,
        description: desc,
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
      try { await AsyncStorage.removeItem(DRAFT_KEY); } catch {}
      suppressDraftRef.current = true;
      setTitle(''); setGoalScore(''); setReward(''); setDescription('');
      setStartDate(null); setEndDate(null);
      setNotification({ mode: null, payload: null });

      Alert.alert('완료', '도전이 추가되었습니다.', [
        { text: '확인', onPress: () => navigation.navigate('ChallengeList') },
      ]);
    } catch (e) {
      console.error('AddChallenge save error', e);
      Alert.alert('오류', '도전을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, title, goalScore, reward, description, startDate, endDate, notification, navigation]);

  // 알림 모달 라우팅 (onDone 콜백 추가)
  const goSimple = useCallback(() => {
    if (busy) return;
    const initial = notification?.mode === 'simple' ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('SimpleNotification', {
      initial,
      returnTo: 'AddChallenge',
      onDone: (res) => { setNotification(res); },
    });
  }, [busy, navigation, notification]);
  const goWeekly = useCallback(() => {
    if (busy) return;
    const initial = notification?.mode === 'weekly' ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('WeeklyNotification', {
      initial,
      returnTo: 'AddChallenge',
      onDone: (res) => { setNotification(res); },
    });
  }, [busy, navigation, notification]);
  const goMonthly = useCallback(() => {
    if (busy) return;
    const initial = notification?.mode === 'monthly'
      ? (notification.payload ?? null) : null;
    setShowNotifPicker(false);
    navigation.navigate('MonthlyNotification', {
      initial,
      returnTo: 'AddChallenge',
      onDone: (res) => { setNotification(res); },
    });
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
      onDone: (res) => { setNotification(res); },
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
          onChangeText={(t)=>setTitle(t.slice(0, LIMITS.title))}
          placeholder="도전 제목"
          style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
          placeholderTextColor={PALETTE.gray400}
          editable={!busy}
          maxLength={LIMITS.title} // ✅ 50자 제한
        />
       

        <Text style={[styles.label, { marginTop: spacing.md }]}>목표 점수</Text>
        <TextInput
          value={goalScore}
          onChangeText={handleGoalChange}
          placeholder="숫자만 입력"
          style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
          placeholderTextColor={PALETTE.gray400}
          editable={!busy}
          maxLength={4} // ✅ 4자리로 제한(1000까지)
          {...numericInputProps}
        />
        

        {/* ✅ 도전 내용 */}
        <Text style={[styles.label, { marginTop: spacing.md }]}>도전 내용</Text>
        <TextInput
          value={description}
          onChangeText={(t)=>setDescription(t.slice(0, LIMITS.description))}
          placeholder="도전의 구체적인 내용을 적어주세요"
          style={[styles.input, styles.textarea, { opacity: busy ? 0.75 : 1 }]}
          placeholderTextColor={PALETTE.gray400}
          editable={!busy}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.description} // ✅ 500자 제한
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
    onChangeText={(t)=>setReward(t.slice(0, LIMITS.reward))}
    placeholder="원하는 보상을 입력하세요!"
    style={[styles.input, { opacity: busy ? 0.75 : 1 }]}
    placeholderTextColor={PALETTE.gray400}
    editable={!busy}
    maxLength={LIMITS.reward} // 50자 제한
  />
  
</View>

      {/* 알림 */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>알림</Text>

          <View style={styles.rightBtnGroup}>
            {notification?.mode && (
              // [변경] 원형 X 아이콘 삭제 버튼
              <TouchableOpacity
                style={styles.notifDeleteCircle}
                onPress={() => setNotification({ mode: null, payload: null })}
                activeOpacity={0.8}
                disabled={busy}
                accessibilityLabel="알림 삭제"
              >
                <Text style={styles.notifDeleteX}>×</Text>
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
  <NotiPreviewSwitch
    notification={notification}
    startDate={startDate}
    endDate={endDate}
  />
</View>

        <Text style={[styles.previewAssistive]}>
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

            {/* [추가] 얇은 검은 라인 */}
            <View style={styles.modalDivider} />

            {/* [추가] 알림 기본 설정 버튼 (흰 배경, 검은 글씨) */}
            <TouchableOpacity
   style={[buttonStyles.primary.container, styles.modalBasicKeepColor, styles.modalButton]}
   onPress={()=>{
     setShowNotifPicker(false);
     navigation.navigate('NotificationDefaults', { returnTo: 'AddChallenge' });
   }}
   activeOpacity={0.9}
 >
   <Text style={[buttonStyles.primary.label, styles.modalBasicKeepLabel]}>
     알림 기본 설정
   </Text>
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
  textarea: { minHeight: 96, lineHeight: 20 },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: PALETTE.gray400, marginTop: 4 },

  row: { flexDirection: 'row', marginTop: spacing.md },
  col: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  rightBtnGroup: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },

  // (구) 텍스트 삭제 버튼 스타일(호환용 남김, 사용 안 함)
  deleteBtn: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray300, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md },
  deleteBtnText: { color: PALETTE.black, fontWeight: '800', fontSize: 12 },

  // [추가] 원형 X 아이콘 삭제 버튼
  notifDeleteCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: PALETTE.white,
    borderWidth: 1, borderColor: PALETTE.gray800,
  },
  notifDeleteX: { color: PALETTE.gray800, fontSize: 18, lineHeight: 18, fontWeight: '800' },

  previewBox: { marginTop: spacing.md, backgroundColor: PALETTE.gray100, borderRadius: radius.md, padding: spacing.md },
  previewText: { color: PALETTE.gray800 },
  previewTextSmall: { color: PALETTE.gray800, fontSize: 12, marginTop: 6 },
  previewNoteText: { color: PALETTE.gray600, fontSize: 11, marginTop: 2 },

  // 모달
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: PALETTE.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: PALETTE.gray200 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md, textAlign: 'center' },
  modalButton: { marginTop: spacing.sm },

  // [추가] 얇은 검은 라인 + 알림 기본설정 버튼
  modalDivider: {
    marginTop: spacing.md,
    height: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.gray800,
    opacity: 0.2,
  },
  // 모양은 primary.container 그대로(라운드/패딩/높이 1:1)
 // 색상만 기존대로 유지
 modalBasicKeepColor: {
   backgroundColor: PALETTE.white,
   borderWidth: 1,
   borderColor: PALETTE.gray800,
 },
 modalBasicKeepLabel: {
   color: PALETTE.gray800,
 },

  modalClose: { marginTop: spacing.md, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: PALETTE.black },
  modalCloseText: { color: PALETTE.white, fontWeight: '700', fontSize: 12 },
});
