import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, BackHandler } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const PALETTE = {
  white: "#FFFFFF",
  black: "#000000",
  gray50: "#FAFAFA",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray600: "#525252",
  gray700: "#374151",
  gray800: "#111111"
};


import { buttonStyles, spacing, radius } from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';
import { validateInput, saveAndSchedule } from '../utils/challengeStore';
import { syncWidgetChallengeList } from '../utils/widgetSync';
import BackButton from '../components/BackButton';


const DRAFT_KEY = 'draft_add_challenge';
const WEEK_DAYS_KO = ['월','화','수','목','금','토','일'];
const sortTimesAsc = (arr=[]) => [...arr].sort((a,b)=>a.localeCompare(b));
const LIMITS = { title: 50, reward: 50, description: 500, maxGoal: 1000 };

// --- 프리뷰 컴포넌트들 ---
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
function asDoneFlags(item) {
  if (!item) return { _isDone: false, _isExpired: false };
  const done = item.status === 'completed' || (item.goalScore > 0 && item.currentScore >= item.goalScore);
  let isExpired = false;
  if (item.endDate) {
    const end = new Date(item.endDate);
    end.setHours(23, 59, 59, 999);
    isExpired = end < new Date();
  }
  return { _isDone: !!done, _isExpired: isExpired };
}

function parseDateStr(s) {
  if (!s) return null;
  const [y,m,d] = s.split('-').map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return isNaN(dt.getTime()) ? null : dt;
}

export default function AddChallengeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [busy, setBusy] = useState(false);
  const [habitMode, setHabitMode] = useState(false);

  // 도전 탭 상태
  const [cTitle, setCTitle] = useState('');
  const [cGoalScore, setCGoalScore] = useState('');
  const [cReward, setCReward] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cStartDate, setCStartDate] = useState(null);
  const [cEndDate, setCEndDate] = useState(null);
  const [challengeNotification, setChallengeNotification] = useState({ mode: null, payload: null });

  // 습관 탭 상태
  const [hTitle, setHTitle] = useState('');
  const [hDescription, setHDescription] = useState('');
  const [hStartDate, setHStartDate] = useState(null);
  const [hEndDate, setHEndDate] = useState(null);
  const [habitNotification, setHabitNotification] = useState({ mode: null, payload: null });

  // UI 매핑 (alias)
  const title = habitMode ? hTitle : cTitle;
  const setTitle = habitMode ? setHTitle : setCTitle;
  const description = habitMode ? hDescription : cDescription;
  const setDescription = habitMode ? setHDescription : setCDescription;
  const startDate = habitMode ? hStartDate : cStartDate;
  const setStartDate = habitMode ? setHStartDate : setCStartDate;
  const endDate = habitMode ? hEndDate : cEndDate;
  const setEndDate = habitMode ? setHEndDate : setCEndDate;
  const notification = habitMode ? habitNotification : challengeNotification;
  const goalScore = cGoalScore;
  const setGoalScore = setCGoalScore;
  const reward = cReward;
  const setReward = setCReward;

  const [showNotifPicker, setShowNotifPicker] = useState(false);
  const [habitCycle, setHabitCycle] = useState(null);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleTab, setCycleTab] = useState('weekly');
  const [cycleDays, setCycleDays] = useState(new Set());
  const [cycleDates, setCycleDates] = useState(new Set());
  const [cycleWeekScope, setCycleWeekScope] = useState('custom');
  const [cycleMonthScope, setCycleMonthScope] = useState('custom');

  const lastChangedRef = useRef(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const saveDraftDebounce = useRef(null);
  const suppressDraftRef = useRef(false);
const handleGoalChange = useCallback((txt)=>{
    const digits = (txt || '').replace(/[^\d]/g, '');
    if (!digits) { setCGoalScore(''); return; }
    let n = parseInt(digits, 10);
    if (isNaN(n)) { setCGoalScore(''); return; }
    if (n > LIMITS.maxGoal) n = LIMITS.maxGoal;
    setCGoalScore(String(n));
  }, []);

  useEffect(() => {
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      Alert.alert('확인', '종료일이 시작일보다 빠를 수 없습니다.');
      if (lastChangedRef.current === 'end') setEndDate(null); else setStartDate(null);
    }
  }, [startDate, endDate]);

  const onSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const t = title.trim();
      const desc = description.trim();
      const id = `ch_${Date.now()}`;
      let item;
      if (habitMode) {
        if (!t) { Alert.alert('확인', '습관 제목을 입력해주세요.'); setBusy(false); return; }
        if (!startDate) { Alert.alert('확인', '시작일을 선택해주세요.'); setBusy(false); return; }
        item = { id, type: 'habit', title: t, description: desc, goalScore: 0, currentScore: 0,
          startDate: startDate ? fmtDate(startDate) : null,
          endDate: endDate ? fmtDate(endDate) : null,
          habitCycle, notification, reward: '', status: 'active', createdAt: Date.now(), completedAt: 0 };
      } else {
        if (!t) { Alert.alert('확인', '도전 제목을 입력해주세요.'); setBusy(false); return; }
        const goalNum = toNumberOrZero(goalScore);
        if (goalNum <= 0) { Alert.alert('확인', '목표 점수를 입력해주세요.'); setBusy(false); return; }
        item = { id, title: t, goalScore: goalNum, currentScore: 0,
          startDate: fmtDate(startDate), endDate: fmtDate(endDate),
          reward: reward.trim(), description: desc, notification, status: 'active',
          createdAt: Date.now(), completedAt: 0 };
      }
      await saveAndSchedule(item, { replaceSchedules: true });
      await AsyncStorage.setItem(`entries_${id}`, JSON.stringify([]));
      await syncWidgetChallengeList();
        
        // 폼 초기화
        if (habitMode) {
          setHTitle(''); setHDescription(''); setHStartDate(null); setHEndDate(null);
          setHabitNotification({ mode: null, payload: null });
          setHabitCycle(null); setCycleDays(new Set()); setCycleDates(new Set());
        } else {
          setCTitle(''); setCGoalScore(''); setCReward(''); setCDescription('');
          setCStartDate(null); setCEndDate(null);
          setChallengeNotification({ mode: null, payload: null });
        }
        
        navigation.navigate('ChallengeList');
    } catch (e) { Alert.alert('오류', '저장 실패'); } finally { setBusy(false); }
  }, [busy, cTitle, cGoalScore, cReward, cDescription, cStartDate, cEndDate, challengeNotification, hTitle, hDescription, hStartDate, hEndDate, habitNotification, habitMode, habitCycle, navigation]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <BackButton title="도전/습관 추가" />
      <View style={styles.tabWrap}>
        <TouchableOpacity style={[styles.tabBtn, !habitMode && styles.tabBtnActive]} onPress={() => setHabitMode(false)}>
          <Text style={[styles.tabText, !habitMode && styles.tabTextActive]}>도전 기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, habitMode && styles.tabBtnActive]} onPress={() => setHabitMode(true)}>
          <Text style={[styles.tabText, habitMode && styles.tabTextActive]}>습관 기록</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>기본 정보</Text>
          <Text style={styles.label}>{habitMode ? '습관 제목' : '도전 제목'}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder={habitMode ? '습관의 제목을 입력하세요' : '도전의 제목을 입력하세요'} style={styles.input} />
          {!habitMode && (
            <>
              <Text style={[styles.label, { marginTop: 15 }]}>목표 점수 혹은 횟수</Text>
              <TextInput value={goalScore} onChangeText={handleGoalChange} placeholder="숫자만 입력" style={styles.input} keyboardType="numeric" inputMode="numeric" maxLength={4} />
            </>
          )}
          <Text style={[styles.label, { marginTop: 15 }]}>{habitMode ? '습관 내용' : '도전 내용'}</Text>
          <TextInput value={description} onChangeText={setDescription} placeholder="도전의 구체적인 내용을 적어주세요" style={[styles.input, styles.textarea]} multiline textAlignVertical="top" maxLength={LIMITS.description} />
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>시작일</Text>
              <TouchableOpacity onPress={() => { setShowStartPicker(true); lastChangedRef.current='start'; }} style={buttonStyles.compactRight}>
                <Text style={buttonStyles.compactRightText}>{startDate ? fmtDate(startDate) : '날짜 선택'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>종료일</Text>
              <TouchableOpacity onPress={() => { setShowEndPicker(true); lastChangedRef.current='end'; }} style={buttonStyles.compactRight}>
                <Text style={buttonStyles.compactRightText}>{endDate ? fmtDate(endDate) : '날짜 선택'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {habitMode ? (
          <View style={[styles.card, { marginTop: 20 }]}>
            <Text style={styles.cardTitle}>목표 주기</Text>
            <TouchableOpacity onPress={() => setShowCycleModal(true)} style={buttonStyles.compactRight}>
              <Text style={buttonStyles.compactRightText}>{habitCycle ? '주기 설정됨' : '주기 선택'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { marginTop: 20 }]}>
            <Text style={styles.cardTitle}>보상</Text>
            <TextInput value={reward} onChangeText={setReward} placeholder="보상을 입력하세요" style={styles.input} />
          </View>
        )}
        <View style={[styles.card, { marginTop: 20 }]}>
          <Text style={styles.cardTitle}>알림</Text>
          <TouchableOpacity onPress={() => setShowNotifPicker(true)} style={buttonStyles.compactRight}>
            <Text style={buttonStyles.compactRightText}>알림 설정</Text>
          </TouchableOpacity>
          <View style={{ marginTop: spacing.md, backgroundColor: PALETTE.gray50, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: PALETTE.gray100 }}>
            <NotiPreviewSwitch notification={notification} startDate={startDate} endDate={endDate} />
          </View>
        </View>
        <TouchableOpacity style={[buttonStyles.primary.container, { marginTop: 30, opacity: busy ? 0.6 : 1 }]} onPress={onSave} disabled={busy}>
          <Text style={buttonStyles.primary.label}>저장하기</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCycleModal} transparent animationType="fade" onRequestClose={() => setShowCycleModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>목표 주기 설정</Text>
            
            <View style={styles.cycleTabRow}>
              {['weekly', 'monthly'].map(t => (
                <TouchableOpacity key={t} style={[styles.cycleTabBtn, cycleTab === t && styles.cycleTabBtnOn]} onPress={() => setCycleTab(t)}>
                  <Text style={[styles.cycleTabText, cycleTab === t && styles.cycleTabTextOn]}>{t === 'weekly' ? '주간' : '월간'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 범위 빠른 선택 */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {cycleTab === 'weekly' ? (
                ['all', 'weekday', 'weekend', 'custom'].map(s => (
                  <TouchableOpacity key={s} onPress={() => {
                    setCycleWeekScope(s);
                    if (s === 'all') setCycleDays(new Set(['월','화','수','목','금','토','일']));
                    else if (s === 'weekday') setCycleDays(new Set(['월','화','수','목','금']));
                    else if (s === 'weekend') setCycleDays(new Set(['토','일']));
                    else if (s === 'custom') setCycleDays(new Set());
                  }} style={{ flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: cycleWeekScope === s ? PALETTE.black : PALETTE.gray100, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: cycleWeekScope === s ? PALETTE.white : PALETTE.gray600 }}>
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
                  }} style={{ flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: cycleMonthScope === s ? PALETTE.black : PALETTE.gray100, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: cycleMonthScope === s ? PALETTE.white : PALETTE.gray600 }}>
                      {{ all: '매일', even: '짝수', odd: '홀수', custom: '직접' }[s]}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* 그리드 영역 */}
            {cycleTab === 'weekly' ? (
              <View style={[styles.cycleDaysRow, { marginBottom: 20 }]}>
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
              <View style={{ marginBottom: 20 }}>
                {Array.from({ length: 5 }).map((_, row) => (
                  <View key={row} style={{ flexDirection: 'row', marginBottom: 4 }}>
                    {Array.from({ length: 7 }).map((__, col) => {
                      const d = row * 7 + col + 1;
                      if (d > 31) return <View key={col} style={{ flex: 1 }} />;
                      const on = cycleDates.has(d);
                      return (
                        <TouchableOpacity key={col} onPress={() => {
                          const next = new Set(cycleDates);
                          if (next.has(d)) next.delete(d); else next.add(d);
                          setCycleDates(next);
                          setCycleMonthScope('custom');
                        }} style={[{ flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: on ? PALETTE.black : PALETTE.gray50, margin: 2 }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: on ? PALETTE.white : PALETTE.gray700 }}>{d}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[buttonStyles.primary.container, { flex: 1, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.black }]} onPress={() => setShowCycleModal(false)}>
                <Text style={[buttonStyles.primary.label, { color: PALETTE.black }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[buttonStyles.primary.container, { flex: 1 }]} onPress={() => {
                if (cycleTab === 'weekly') {
                  setHabitCycle(cycleDays.size ? { type: 'weekly', days: Array.from(cycleDays) } : null);
                } else {
                  setHabitCycle(cycleDates.size ? { type: 'monthly', dates: Array.from(cycleDates) } : null);
                }
                setShowCycleModal(false);
              }}>
                <Text style={buttonStyles.primary.label}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotifPicker} transparent animationType="fade" onRequestClose={() => setShowNotifPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>알림 방식 선택</Text>

            <TouchableOpacity style={[buttonStyles.primary.container, { marginTop: spacing.sm }]} onPress={() => { setShowNotifPicker(false); navigation.navigate('SimpleNotification', { onDone: (res) => { if(habitMode) setHabitNotification(res); else setChallengeNotification(res); }, returnTo: 'AddChallenge' }); }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>간단 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, { marginTop: spacing.sm }]} onPress={() => { setShowNotifPicker(false); navigation.navigate('WeeklyNotification', { onDone: (res) => { if(habitMode) setHabitNotification(res); else setChallengeNotification(res); }, returnTo: 'AddChallenge' }); }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>주간 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, { marginTop: spacing.sm }]} onPress={() => { setShowNotifPicker(false); navigation.navigate('MonthlyNotification', { onDone: (res) => { if(habitMode) setHabitNotification(res); else setChallengeNotification(res); }, returnTo: 'AddChallenge' }); }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>월간 알림</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[buttonStyles.primary.container, { marginTop: spacing.sm }]} onPress={() => { if (!startDate || !endDate) return Alert.alert('확인', '날짜를 먼저 선택하세요.'); setShowNotifPicker(false); navigation.navigate('FullRangeNotification', { startDate: fmtDate(startDate), endDate: fmtDate(endDate), onDone: (res) => { if(habitMode) setHabitNotification(res); else setChallengeNotification(res); }, returnTo: 'AddChallenge' }); }} activeOpacity={0.9}>
              <Text style={buttonStyles.primary.label}>전체 일정 세부 알림</Text>
            </TouchableOpacity>

            <View style={{ marginTop: spacing.md, height: 1, backgroundColor: PALETTE.gray200, opacity: 0.5 }} />

            <TouchableOpacity
              style={[buttonStyles.primary.container, { marginTop: spacing.md, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.black }]}
              onPress={() => { setShowNotifPicker(false); navigation.navigate('NotificationDefaults', { returnTo: 'AddChallenge' }); }}
              activeOpacity={0.9}
            >
              <Text style={[buttonStyles.primary.label, { color: PALETTE.black }]}>알림 기본 설정</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowNotifPicker(false)} style={styles.modalClose}><Text style={styles.modalCloseText}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal isVisible={showStartPicker} mode="date" date={startDate || new Date()} onConfirm={d => { setStartDate(d); setShowStartPicker(false); }} onCancel={() => setShowStartPicker(false)} />
      <DateTimePickerModal isVisible={showEndPicker} mode="date" date={endDate || new Date()} onConfirm={d => { setEndDate(d); setShowEndPicker(false); }} onCancel={() => setShowEndPicker(false)} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: PALETTE.gray50 },
  card: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray200, borderRadius: radius.md, padding: spacing.lg },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md },
  label: { fontSize: 13, color: PALETTE.gray600, marginBottom: 6 },
  input: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.gray200, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: PALETTE.gray800 },
  textarea: { minHeight: 96, lineHeight: 20 },
  row: { flexDirection: 'row', marginTop: spacing.md, gap: 10 },
  col: { flex: 1 },
  tabWrap: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm, borderBottomWidth: 1, borderBottomColor: PALETTE.gray200 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: PALETTE.black },
  tabText: { fontSize: 14, fontWeight: '700', color: PALETTE.gray400 },
  tabTextActive: { color: PALETTE.black },
  previewBox: { marginTop: spacing.md, backgroundColor: PALETTE.gray50, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: PALETTE.gray100 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: PALETTE.white, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md, textAlign: 'center' },
  modalClose: { marginTop: spacing.md, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: PALETTE.black },
  modalCloseText: { color: PALETTE.white, fontWeight: '700', fontSize: 12 },
  cycleTabRow: { flexDirection: 'row', marginBottom: spacing.md, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: PALETTE.gray200 },
  cycleTabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: PALETTE.gray100 },
  cycleTabBtnOn: { backgroundColor: PALETTE.black },
  cycleTabText: { fontSize: 13, fontWeight: '800', color: PALETTE.gray600 },
  cycleTabTextOn: { color: PALETTE.white },
  cycleDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  cycleDayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PALETTE.gray300, backgroundColor: PALETTE.white },
  cycleDayCircleOn: { backgroundColor: PALETTE.black, borderColor: PALETTE.black },
  cycleDayText: { fontSize: 12, fontWeight: '800', color: PALETTE.gray700 },
  cycleDayTextOn: { color: PALETTE.white },
  cycleDateCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.gray100 },
  cycleDateCircleOn: { backgroundColor: PALETTE.black },
  cycleDateText: { fontSize: 12, fontWeight: '700', color: PALETTE.gray700 },
  cycleDateTextOn: { color: PALETTE.white },
});
