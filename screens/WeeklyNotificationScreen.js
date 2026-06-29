import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { buttonStyles, spacing, radius, colors } from '../styles/common';
import BackButton from '../components/BackButton';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';

const WEEK = ['월','화','수','목','금','토','일'];
const MAX_PER_DAY = 10;

const pad2 = (n)=>String(n).padStart(2,'0');
const fmtHHMM = (d)=>`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const createEmptyWeeklyMap = () => {
  const m = new Map();
  WEEK.forEach((day) => m.set(day, []));
  return m;
};

const normalizeWeeklyMap = (source) => {
  const m = createEmptyWeeklyMap();

  if (source instanceof Map) {
    WEEK.forEach((day) => {
      const times = Array.isArray(source.get(day))
        ? [...new Set(source.get(day).map(String).filter(Boolean))].sort()
        : [];
      m.set(day, times);
    });
    return m;
  }

  if (source && Array.isArray(source.byWeekDays)) {
    for (const item of source.byWeekDays) {
      const day = item?.day;
      if (!WEEK.includes(day)) continue;

      const times = Array.isArray(item?.times)
        ? [...new Set(item.times.map(String).filter(Boolean))].sort()
        : [];

      m.set(day, times);
    }
  }

  return m;
};

const stringifyWeeklyMap = (source) => {
  const normalized = normalizeWeeklyMap(source);
  return JSON.stringify(
    WEEK.map((day) => ({
      day,
      times: normalized.get(day) || [],
    }))
  );
};

export default function WeeklyNotificationScreen(){
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const initial = route.params?.initial || null;
  const returnTo = route.params?.returnTo || 'AddChallenge';

  // 요일 -> 시간목록
  const [map,setMap] = useState(() => normalizeWeeklyMap(initial));

  useFocusEffect(
    useCallback(() => {
      setMap(normalizeWeeklyMap(initial));
      return undefined;
    }, [initial])
  );

  // 개별 추가용 피커
  const [pickerDay,setPickerDay] = useState(null);

  const [pickerVisible,setPickerVisible] = useState(false);

  const initialMapKey = useMemo(() => stringifyWeeklyMap(initial), [initial]);
  const currentMapKey = useMemo(() => stringifyWeeklyMap(map), [map]);

  const hasUnsavedChanges = useCallback(() => (
    currentMapKey !== initialMapKey
  ), [currentMapKey, initialMapKey]);

  const { handleBackPress, markAsSaved, confirmSave } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '설정 중인 내용이 있어요',
    message: '뒤로 가면 변경한 알림 설정이 저장되지 않습니다.',
    stayText: '계속 설정',
    leaveText: '나가기',
  });

  // 일괄 적용 모달
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkScope, setBulkScope] = useState('all'); // 'all' | 'weekday' | 'weekend' | 'custom'
  const [bulkDays, setBulkDays] = useState(new Set(WEEK)); // 선택된 요일
  const [bulkTimes, setBulkTimes] = useState([]); // 'HH:MM' 배열
  const [bulkTimePickerVisible, setBulkTimePickerVisible] = useState(false);

  // ---- 개별 추가 ----
  const openPicker = useCallback((day)=>{ setPickerDay(day); setPickerVisible(true); },[]);
  const onTimeConfirmSingle = useCallback((date)=>{
    const t = fmtHHMM(date);
    setPickerVisible(false);
    if (!pickerDay) return;
    setMap(prev=>{
      const arr = prev.get(pickerDay) || [];
      if (arr.includes(t)) { Alert.alert('중복','이미 추가한 시간입니다.'); return prev; }
      if (arr.length>=MAX_PER_DAY){ Alert.alert('제한',`하루 최대 ${MAX_PER_DAY}개까지 가능합니다.`); return prev; }
      const next = [...arr, t].sort();
      const m = new Map(prev); m.set(pickerDay,next); return m;
    });
  },[pickerDay]);
  const onTimeCancelSingle = useCallback(()=>setPickerVisible(false),[]);

  // ---- 일괄 적용 모달 열기/초기화 ----
  const openBulk = useCallback(()=> {
    // 초기 상태: 모든 요일 + 빈 시간
    setBulkScope('all');
    setBulkDays(new Set(WEEK));
    setBulkTimes([]);
    setShowBulkModal(true);
  }, []);

  // ---- 범위 선택 시 요일 세트 갱신 ----
  const applyScopeToDays = useCallback((scope)=>{
    if (scope==='all') return new Set(WEEK);
    if (scope==='weekday') return new Set(['월','화','수','목','금']);
    if (scope==='weekend') return new Set(['토','일']);
    // custom은 현재 선택 유지
    return null;
  },[]);
  const onChangeScope = useCallback((scope)=>{
    setBulkScope(scope);
    const setFromScope = applyScopeToDays(scope);
    if (setFromScope) setBulkDays(setFromScope);
  },[applyScopeToDays]);

  // 요일 토글(원형 버튼) — 누르면 자동으로 'custom'
  const toggleBulkDay = useCallback((d)=>{
    setBulkScope('custom');
    setBulkDays(prev=>{
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  },[]);

  // ---- 일괄 시간 추가/삭제 ----
  const openBulkTimePicker = useCallback(()=> {
    if (bulkTimes.length >= MAX_PER_DAY) {
      Alert.alert('제한', `시간은 최대 ${MAX_PER_DAY}개까지 설정할 수 있습니다.`);
      return;
    }
    setBulkTimePickerVisible(true);
  }, [bulkTimes.length]);

  const onTimeConfirmBulk = useCallback((date)=>{
    const t = fmtHHMM(date);
    setBulkTimePickerVisible(false);
    setBulkTimes(prev=>{
      if (prev.includes(t)) return prev; // 중복 방지
      if (prev.length >= MAX_PER_DAY) return prev;
      return [...prev, t].sort();
    });
  },[]);
  const onTimeCancelBulk = useCallback(()=>setBulkTimePickerVisible(false),[]);

  const removeBulkTime = useCallback((t)=>{
    setBulkTimes(prev => prev.filter(x=>x!==t));
  },[]);

  // ---- 일괄 적용 확인 ----
  const confirmBulkApply = useCallback(()=>{
    if (bulkDays.size === 0) { Alert.alert('확인','적용할 요일을 선택하세요.'); return; }
    if (bulkTimes.length === 0) { Alert.alert('확인','추가할 시간을 1개 이상 선택하세요.'); return; }

    // 요일별 적용 후 개수가 10 초과하는지 미리 체크
    let overflow = null;
    for (const d of bulkDays) {
      const current = map.get(d) || [];
      const unionSet = new Set([...current, ...bulkTimes]);
      if (unionSet.size > MAX_PER_DAY) { overflow = d; break; }
    }
    if (overflow) {
      Alert.alert('제한', `${overflow}의 시간이 최대 ${MAX_PER_DAY}개를 초과합니다.\n시간 또는 요일을 조정해주세요.`);
      // 모달 상태 유지 (닫지 않음)
      return;
    }

    // 문제 없으면 실제 반영
    setMap(prev=>{
      const m = new Map(prev);
      for (const d of bulkDays) {
        const current = m.get(d) || [];
        const union = Array.from(new Set([...current, ...bulkTimes])).sort();
        m.set(d, union);
      }
      return m;
    });

    setShowBulkModal(false);
  },[bulkDays, bulkTimes, map]);

  // 개별 시간 삭제
  const removeOne = useCallback((day,time)=>{
    setMap(prev=>{
      const arr = prev.get(day) || [];
      const next = arr.filter(t=>t!==time);
      const m = new Map(prev); m.set(day,next); return m;
    });
  },[]);

  // 전체 초기화
  const clearAll = useCallback(()=>{
    const empty = new Map(); WEEK.forEach(d=>empty.set(d,[]));
    setMap(empty);
  },[]);

  // 저장
  const save = useCallback(() => {
    const byWeekDays = WEEK.map(day => ({ day, times: (map.get(day) || []) }));

    confirmSave({
      title: '저장하시겠습니까?',
      message: '주간 알림 설정을 저장할까요?',
      onConfirm: () => {
        const result = { mode: 'weekly', payload: { byWeekDays } };
        const onDone = route.params?.onDone;

        markAsSaved();

        if (typeof onDone === 'function') {
          onDone(result);
          navigation.goBack();
          return;
        }
        navigation.navigate({
          name: returnTo || 'AddChallenge',
          params: { notificationResult: result, _nonce: Date.now() },
          merge: true,
        });
      },
    });
  }, [confirmSave, map, markAsSaved, navigation, returnTo, route.params?.onDone]);

  const scopeIsCustom = useMemo(()=>bulkScope==='custom', [bulkScope]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <BackButton title="주간 알림 설정" onPress={handleBackPress} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xxl + Math.max(insets.bottom, spacing.lg) }]}>
      
      <Text style={styles.desc}>각 요일 최대 10개</Text>

      <View style={{ marginTop: spacing.sm }}>
        {WEEK.map(day=>{
          const times = map.get(day)||[];
          const canAdd = times.length < MAX_PER_DAY;
          return (
            <View key={day} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.dayTitle}>{day}</Text>
                {canAdd ? (
                  <TouchableOpacity style={styles.addBtn} onPress={()=>openPicker(day)} accessibilityLabel={`${day} 시간 추가`}>
                    <Text style={styles.addBtnPlus}>＋</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.addBtn,{opacity:0.35}]}>
                    <Text style={styles.addBtnPlus}>＋</Text>
                  </View>
                )}
              </View>

              <View style={styles.timeChips}>
                {times.map(t=>(
                  <View key={`${day}-${t}`} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>{t}</Text>
                    <TouchableOpacity onPress={()=>removeOne(day,t)} accessibilityLabel={`${t} 삭제`}>
                      <Text style={styles.chipRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
          <Text style={styles.resetBtnText}>초기화</Text>
        </TouchableOpacity>
        <View style={{flex:1}} />
        <TouchableOpacity
          style={[buttonStyles.primary.container, { paddingHorizontal: 14 }]}
          onPress={openBulk}
        >
          <Text style={buttonStyles.primary.label}>일괄 시간 적용</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[buttonStyles.primary.container,{marginTop:spacing.xl}]} onPress={save}>
        <Text style={buttonStyles.primary.label}>선택완료</Text>
      </TouchableOpacity>

      {/* 개별 추가용 시간 피커 */}
      <DateTimePickerModal
        isVisible={pickerVisible}
        mode="time"
        onConfirm={onTimeConfirmSingle}
        onCancel={onTimeCancelSingle}
        is24Hour
      />

      {/* 일괄 적용 모달 */}
      <Modal visible={showBulkModal} transparent animationType="fade" onRequestClose={()=>setShowBulkModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>일괄 시간 적용</Text>

            {/* 범위 선택 */}
            <View style={styles.scopeRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, bulkScope==='all' && styles.scopeBtnOn]}
                onPress={()=>onChangeScope('all')}
              >
                <Text style={[styles.scopeText, bulkScope==='all' && styles.scopeTextOn]}>모든 요일</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, bulkScope==='weekday' && styles.scopeBtnOn]}
                onPress={()=>onChangeScope('weekday')}
              >
                <Text style={[styles.scopeText, bulkScope==='weekday' && styles.scopeTextOn]}>평일</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, bulkScope==='weekend' && styles.scopeBtnOn]}
                onPress={()=>onChangeScope('weekend')}
              >
                <Text style={[styles.scopeText, bulkScope==='weekend' && styles.scopeTextOn]}>주말</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, bulkScope==='custom' && styles.scopeBtnOn]}
                onPress={()=>onChangeScope('custom')}
              >
                <Text style={[styles.scopeText, bulkScope==='custom' && styles.scopeTextOn]}>요일 지정</Text>
              </TouchableOpacity>
            </View>

            {/* 요일 원형 선택 */}
            <View style={styles.bulkDaysRow}>
              {WEEK.map(d=>{
                const on = bulkDays.has(d);
                return (
                  <TouchableOpacity
                    key={`b-${d}`}
                    style={[styles.dayCircle, on ? styles.dayCircleOn : styles.dayCircleOff]}
                    onPress={()=>toggleBulkDay(d)}
                    activeOpacity={0.9}
                    accessibilityLabel={`${d} 선택`}
                  >
                    <Text style={[styles.dayCircleText, on && styles.dayCircleTextOn]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 선택된 시간 리스트 */}
            <View style={styles.bulkTimesBox}>
              <View style={styles.bulkTimesHeader}>
                <Text style={styles.bulkTimesTitle}>시간 ({bulkTimes.length}/10)</Text>
                <TouchableOpacity style={styles.addBtn} onPress={openBulkTimePicker} accessibilityLabel="시간 추가">
                  <Text style={styles.addBtnPlus}>＋</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timeChips}>
                {bulkTimes.map(t=>(
                  <View key={`bt-${t}`} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>{t}</Text>
                    <TouchableOpacity onPress={()=>removeBulkTime(t)} accessibilityLabel={`${t} 삭제`}>
                      <Text style={styles.chipRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {bulkTimes.length===0 && (
                  <Text style={styles.bulkEmptyHint}>시간 + 버튼으로 시간을 추가하세요.</Text>
                )}
              </View>
            </View>

            {/* 하단 액션 */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={()=>setShowBulkModal(false)}>
                <Text style={styles.modalBtnGhostText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={confirmBulkApply}>
                <Text style={styles.modalBtnPrimaryText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 모달 내부 전용 시간 피커 */}
        <DateTimePickerModal
          isVisible={bulkTimePickerVisible}
          mode="time"
          onConfirm={onTimeConfirmBulk}
          onCancel={onTimeCancelBulk}
          is24Hour
        />
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{ padding: spacing.lg, backgroundColor: colors.background },
  title:{ fontSize:20, fontWeight:'800', color: colors.textPrimary, textAlign:'center' },
  desc:{ color: colors.textSecondary, marginTop:4, marginBottom: spacing.md, fontSize:12, textAlign:'center' },

  card:{ backgroundColor: colors.surface, borderWidth:1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  cardHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  dayTitle:{ fontSize:14, fontWeight:'800', color: colors.textPrimary },

  timeChips:{ flexDirection:'row', flexWrap:'wrap', marginTop: spacing.sm },
  chip:{ flexDirection:'row', alignItems:'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingVertical:3, paddingHorizontal:6, marginRight:6, marginBottom:6 },
  chipText:{ color: colors.textPrimary, fontSize:12, marginRight:6 },
  chipRemove:{ color: colors.textTertiary, fontSize:14, fontWeight:'800' },

  addBtn:{ width:28, height:28, borderRadius:14, borderWidth:1, borderColor: colors.gray300, backgroundColor: colors.surface, alignItems:'center', justifyContent:'center' },
  addBtnPlus:{ color: colors.textSecondary, fontSize:16, fontWeight:'800', lineHeight:16 },

  actions:{ flexDirection:'row', alignItems:'center', marginTop: spacing.lg },
  resetBtn:{ backgroundColor: colors.surface, borderWidth:1, borderColor: colors.gray300, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  resetBtnText:{ color: colors.textSecondary, fontSize: 14, fontWeight:'600' },

  // ==== 일괄 모달 ====
  modalBackdrop:{ flex:1, backgroundColor: colors.overlay, alignItems:'center', justifyContent:'center', padding: spacing.lg },
  modalCard:{ width:'100%', backgroundColor: colors.surface, borderWidth:1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },

  modalTitle:{ fontSize:16, fontWeight:'800', color: colors.textPrimary, textAlign:'center', marginBottom: spacing.md },

  scopeRow:{ flexDirection:'row', flexWrap:'wrap', gap: spacing.sm, justifyContent:'center' },
  scopeBtn:{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  scopeBtnOn:{ backgroundColor: colors.primary },
  scopeText:{ color: colors.textPrimary, fontWeight:'800' },
  scopeTextOn:{ color: colors.textInverse },

  bulkDaysRow:{ flexDirection:'row', justifyContent:'space-between', marginTop: spacing.md },
  dayCircle:{
    width:28, height:28, borderRadius:14, alignItems:'center', justifyContent:'center',
    borderWidth:1,
  },
  dayCircleOff:{ backgroundColor: colors.surface, borderColor: colors.gray300 },
  dayCircleOn:{ backgroundColor: colors.primary, borderColor: colors.primary },
  dayCircleText:{ fontSize:12, fontWeight:'800', color: colors.textSecondary },
  dayCircleTextOn:{ color: colors.textInverse },

  bulkTimesBox:{ marginTop: spacing.md, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, borderWidth:1, borderColor: colors.border },
  bulkTimesHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  bulkTimesTitle:{ fontSize:13, fontWeight:'800', color: colors.textSecondary },

  bulkEmptyHint:{ color: colors.textTertiary, fontSize:12 },

  modalActions:{ flexDirection:'row', gap: 8, marginTop: spacing.lg },
  modalBtn:{ flex:1, alignItems:'center', paddingVertical:10, borderRadius: radius.md },
  modalBtnGhost:{ backgroundColor: colors.surfaceMuted },
  modalBtnPrimary:{ backgroundColor: colors.primary },
  modalBtnGhostText:{ color: colors.textPrimary, fontWeight:'800' },
  modalBtnPrimaryText:{ color: colors.textInverse, fontWeight:'800' },
});
