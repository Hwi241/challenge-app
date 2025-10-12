// screens/MonthlyNotificationScreen.js

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { buttonStyles, spacing, radius, colors } from '../styles/common';

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtHHMM(date) { return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`; }

const DAYS_IN_MONTHLY = 31;
const MAX_PER_DATE = 10;
// ── 일괄 시간 적용 모달용 고정 그리드 상수 ──
const BULK_COLS = 7;
const BULK_ITEM = 40;   // 버튼 지름(터치 최소 40 보장)
const BULK_GAP  = 8;    // 가로/세로 간격

// 초기값을 다양한 형태에서 정상화: (1) { byDates: [{date, times:[]}] } (2) { "1":[{time}], "2":[{time}], ... }
function normalizeInitial(initial) {
  const map = {};
  for (let d = 1; d <= DAYS_IN_MONTHLY; d++) map[String(d)] = [];

  // 케이스 (2): 키가 숫자(문자열)이고 값이 배열인 객체
  if (initial && typeof initial === 'object' && !Array.isArray(initial.byDates)) {
    Object.keys(initial).forEach(k => {
      const d = Number(k);
      if (!Number.isFinite(d) || d < 1 || d > DAYS_IN_MONTHLY) return;
      const arr = Array.isArray(initial[k]) ? initial[k] : [];
      map[String(d)] = arr
        .map(x => (typeof x?.time === 'string' ? { time: x.time } : null))
        .filter(Boolean)
        .sort((a,b) => a.time.localeCompare(b.time));
    });
    return map;
  }

  // 케이스 (1): byDates 배열
  if (initial && Array.isArray(initial.byDates)) {
    for (const item of initial.byDates) {
      const d = Number(item?.date);
      if (!Number.isFinite(d) || d < 1 || d > DAYS_IN_MONTHLY) continue;
      const times = Array.isArray(item.times) ? item.times : [];
      map[String(d)] = times
        .map(t => ({ time: String(t) }))
        .sort((a,b) => a.time.localeCompare(b.time));
    }
    return map;
  }

  return map;
}

export default function MonthlyNotificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const initial = route.params?.initial ?? null;
  const returnTo = route.params?.returnTo || 'AddChallenge';

  const [map, setMap] = useState(() => normalizeInitial(initial));
  const [pickerDay, setPickerDay] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  // ===== 일괄 적용 모달 상태 =====
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkScope, setBulkScope] = useState('all'); // 'all' | 'even' | 'odd' | 'custom'
  const [bulkDates, setBulkDates] = useState(new Set(Array.from({length:31},(_,i)=>i+1)));
  const [bulkTimes, setBulkTimes] = useState([]); // 'HH:MM' 배열
  const [bulkTimePickerVisible, setBulkTimePickerVisible] = useState(false);

  // 개별 추가
  const tryAddTime = useCallback((day) => { setPickerDay(day); setPickerVisible(true); }, []);
  const onConfirmTime = useCallback((date) => {
    const t = fmtHHMM(date);
    setPickerVisible(false);

    if (!pickerDay) return;
    const key = String(pickerDay);
    setMap(prev => {
      const arr = Array.isArray(prev[key]) ? [...prev[key]] : [];
      if (arr.length >= MAX_PER_DATE) { Alert.alert('제한', `최대 ${MAX_PER_DATE}개 초과하였습니다.`); return prev; }
      if (arr.some(x => x.time === t)) { Alert.alert('중복', '이미 추가된 시간입니다.'); return prev; }
      arr.push({ time: t });
      arr.sort((a,b) => a.time.localeCompare(b.time));
      return { ...prev, [key]: arr };
    });
  }, [pickerDay]);
  const onCancelTime = useCallback(() => setPickerVisible(false), []);

  // 삭제
  const removeOne = useCallback((day, timeStr) => {
    const key = String(day);
    setMap(prev => {
      const arr = Array.isArray(prev[key]) ? prev[key].filter(x => x.time !== timeStr) : [];
      return { ...prev, [key]: arr };
    });
  }, []);

  // 전체 초기화
  const clearAll = useCallback(() => {
    Alert.alert('초기화', '모든 날짜의 알림 시간을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        const empty = {};
        for (let d=1; d<=DAYS_IN_MONTHLY; d++) empty[String(d)] = [];
        setMap(empty);
      }},
    ]);
  }, []);

  // 저장
  const handleDone = useCallback(() => {
    const byDates = [];
    for (let d=1; d<=DAYS_IN_MONTHLY; d++) {
      const key = String(d);
      const arr = Array.isArray(map[key]) ? map[key] : [];
      byDates.push({ date: d, times: arr.map(x => x.time) });
    }
    const result = { mode:'monthly', payload:{ byDates } };

    const onDone = route.params?.onDone;
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
  }, [map, navigation, route.params?.onDone, returnTo]);

  // ===== 일괄 적용 모달 로직 =====
  const openBulkModal = useCallback(()=>{
    setBulkScope('all');
    setBulkDates(new Set(Array.from({length:31},(_,i)=>i+1)));
    setBulkTimes([]);
    setShowBulkModal(true);
  },[]);

  const applyScopeToDates = useCallback((scope)=>{
    if (scope==='all') return new Set(Array.from({length:31},(_,i)=>i+1));
    if (scope==='even') return new Set(Array.from({length:31},(_,i)=>i+1).filter(n=>n%2===0));
    if (scope==='odd')  return new Set(Array.from({length:31},(_,i)=>i+1).filter(n=>n%2===1));
    return null; // custom은 현 상태 유지
  },[]);

const onChangeScope = useCallback((scope)=>{
  setBulkScope(scope);
  if (scope === 'custom') {
    // 날짜 지정 모드 진입 시 모두 해제
    setBulkDates(new Set());
    return;
  }
  const setFrom = applyScopeToDates(scope);
  if (setFrom) setBulkDates(setFrom);
}, [applyScopeToDates]);

  const toggleBulkDate = useCallback((d)=>{
    setBulkScope('custom');
    setBulkDates(prev=>{
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  },[]);

  const openBulkTimePicker = useCallback(()=>{
    if (bulkTimes.length >= MAX_PER_DATE) {
      Alert.alert('제한', `시간은 최대 ${MAX_PER_DATE}개까지 설정할 수 있습니다.`);
      return;
    }
    setBulkTimePickerVisible(true);
  },[bulkTimes.length]);

  const onTimeConfirmBulk = useCallback((date)=>{
    const t = fmtHHMM(date);
    setBulkTimePickerVisible(false);
    setBulkTimes(prev=>{
      if (prev.includes(t)) return prev;
      if (prev.length >= MAX_PER_DATE) return prev;
      return [...prev, t].sort();
    });
  },[]);
  const onTimeCancelBulk = useCallback(()=>setBulkTimePickerVisible(false),[]);
  const removeBulkTime = useCallback((t)=> setBulkTimes(prev=>prev.filter(x=>x!==t)),[]);

  const confirmBulkApply = useCallback(()=>{
    if (bulkDates.size===0) { Alert.alert('확인','적용할 날짜를 선택하세요.'); return; }
    if (bulkTimes.length===0) { Alert.alert('확인','추가할 시간을 1개 이상 선택하세요.'); return; }

    // 초과 사전검사
    let overflow = null;
    for (const d of bulkDates) {
      const key = String(d);
      const current = Array.isArray(map[key]) ? map[key].map(x=>x.time) : [];
      const union = new Set([...current, ...bulkTimes]);
      if (union.size > MAX_PER_DATE) { overflow = d; break; }
    }
    if (overflow) {
      Alert.alert('제한', `${overflow}일의 시간이 최대 ${MAX_PER_DATE}개를 초과합니다.\n시간 또는 날짜를 조정해주세요.`);
      // 모달은 닫지 않음
      return;
    }

    // 반영
    setMap(prev=>{
      const next = { ...prev };
      for (const d of bulkDates) {
        const key = String(d);
        const current = Array.isArray(next[key]) ? next[key].map(x=>x.time) : [];
        const union = Array.from(new Set([...current, ...bulkTimes])).sort();
        next[key] = union.map(t => ({ time: t }));
      }
      return next;
    });

    setShowBulkModal(false);
  },[bulkDates, bulkTimes, map]);

  // 셀(달력 그리드용)
  const cells = useMemo(() => {
    const a = [];
    for (let d = 1; d <= DAYS_IN_MONTHLY; d++) a.push({ day: d, key: `d${d}` });
    return a;
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>월간 알림 설정</Text>
      <Text style={styles.desc}>각 날짜 최대 {MAX_PER_DATE}개</Text>
      {/* 추가 설명 문구 */}
      <Text style={styles.desc}>매월 같은 날 알람 설정</Text>

      <View style={styles.grid}>
        {cells.map(cell => {
          const d = cell.day;
          const key = String(d);
          const arr = Array.isArray(map[key]) ? map[key] : [];
          const canAdd = arr.length < MAX_PER_DATE;

          return (
            <View key={cell.key} style={styles.cell}>
              <Text style={styles.dateBadge}>{d}</Text>

              <View style={styles.chipsArea}>
                {arr.map(x => (
                  <View key={`${d}-${x.time}`} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1} allowFontScaling={false}>{x.time}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => removeOne(d, x.time)}
                    >
                      <Text style={styles.chipRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {canAdd ? (
                  <TouchableOpacity style={styles.addChip} onPress={() => tryAddTime(d)}>
                    <Text style={styles.addChipPlus}>＋</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.addChip,{opacity:0.35}]}>
                    <Text style={styles.addChipPlus}>＋</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
          <Text style={styles.resetBtnText}>초기화</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[buttonStyles.primary.container, { paddingHorizontal: 14 }]}
          onPress={openBulkModal}
        >
          <Text style={buttonStyles.primary.label}>일괄 시간 적용</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[buttonStyles.primary.container, { marginTop: spacing.xl }]}
        onPress={handleDone}
      >
        <Text style={buttonStyles.primary.label}>선택완료</Text>
      </TouchableOpacity>

      {/* 개별 추가용 피커 */}
      <DateTimePickerModal
        isVisible={pickerVisible}
        mode="time"
        onConfirm={onConfirmTime}
        onCancel={onCancelTime}
        is24Hour
      />

      {/* ==== 일괄 적용 모달 ==== */}
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
                <Text style={[styles.scopeText, bulkScope==='all' && styles.scopeTextOn]}>모든 날짜</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, bulkScope==='even' && styles.scopeBtnOn]}
                onPress={()=>onChangeScope('even')}
              >
                <Text style={[styles.scopeText, bulkScope==='even' && styles.scopeTextOn]}>짝수</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, bulkScope==='odd' && styles.scopeBtnOn]}
                onPress={()=>onChangeScope('odd')}
              >
                <Text style={[styles.scopeText, bulkScope==='odd' && styles.scopeTextOn]}>홀수</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, bulkScope==='custom' && styles.scopeBtnOn]}
                onPress={()=>onChangeScope('custom')}
              >
                <Text style={[styles.scopeText, bulkScope==='custom' && styles.scopeTextOn]}>날짜 지정</Text>
              </TouchableOpacity>
            </View>

{/* 날짜 7×5 고정 그리드 */}
<View style={styles.bulkGridWrap}>
  {Array.from({ length: 5 }).map((_, row) => (
    <View key={`row-${row}`} style={styles.bulkRow}>
      {Array.from({ length: BULK_COLS }).map((__, col) => {
        const d = row * BULK_COLS + col + 1; // 1..35
        const exists = d <= 31;
        const on = exists && bulkDates.has(d);

        return (
          <View key={`cell-${row}-${col}`} style={styles.bulkCell}>
            {exists ? (
              <TouchableOpacity
                style={[
                  styles.dateCircle,
                  on ? styles.dateCircleOn : styles.dateCircleOff,
                ]}
                onPress={() => {
                  // 누르면 '날짜 지정' 모드로 전환 + 토글
                  if (bulkScope !== 'custom') setBulkScope('custom');
                  toggleBulkDate(d);
                }}
                activeOpacity={0.9}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={`${d}일 선택`}
              >
                <Text style={[styles.dateCircleText, on && styles.dateCircleTextOn]}>{d}</Text>
              </TouchableOpacity>
            ) : (
              // 자리 유지용 플레이스홀더(동일 크기, 투명)
              <View style={styles.dateCirclePlaceholder} />
            )}
          </View>
        );
      })}
    </View>
  ))}
</View>



            {/* 선택된 시간 리스트 + 추가 */}
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
  );
}

const CELL = 48;

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.gray50 },
  screenTitle: { fontSize: 20, fontWeight: '800', color: colors.gray800, textAlign:'center' },
  desc: { color: colors.gray600, marginTop: 4, marginBottom: spacing.md, fontSize: 12, textAlign:'center' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    borderLeftWidth: 1, borderLeftColor: '#E5E7EB',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor:'#FFF'
  },
  cell: {
    width: `${100/7}%`,
    minHeight: CELL + 36,
    padding: 6,
    borderRightWidth: 1, borderRightColor: '#E5E7EB',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  dateBadge: { fontSize: 12, fontWeight: '800', color: colors.gray800, marginBottom: 4, textAlign: 'right' },

  chipsArea: { flexDirection:'row', flexWrap:'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 5, marginRight:6, marginBottom:6 },
  chipText: { color: colors.gray800, fontSize: 11, lineHeight: 13, marginRight: 6, includeFontPadding: false },
  chipRemove: { color: '#6B7280', fontSize: 14, fontWeight: '800' },

  addChip: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    alignItems:'center', justifyContent:'center'
  },
  addChipPlus: { color: colors.gray700, fontSize: 16, fontWeight: '800', lineHeight: 16 },

  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  resetBtn: { backgroundColor:'#FFF', borderWidth:1, borderColor:'#D1D5DB', borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  resetBtnText: { color: colors.gray700, fontSize: 14, fontWeight:'600' },

  // ===== 모달 =====
  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', alignItems:'center', justifyContent:'center', padding: spacing.lg },
  modalCard:{ width:'100%', backgroundColor:'#FFF', borderWidth:1, borderColor:'#E5E7EB', borderRadius: radius.lg, padding: spacing.lg },

  modalTitle:{ fontSize:16, fontWeight:'800', color: colors.gray800, textAlign:'center', marginBottom: spacing.md },

  scopeRow:{ flexDirection:'row', flexWrap:'wrap', gap: 8, justifyContent:'center' },
  scopeBtn:{ paddingVertical:8, paddingHorizontal:12, borderRadius: 999, backgroundColor: colors.gray100 },
  scopeBtnOn:{ backgroundColor: colors.gray800 },
  scopeText:{ color: colors.gray800, fontWeight:'800' },
  scopeTextOn:{ color: '#FFF' },
bulkGridWrap: {
  marginTop: spacing.md,
},
bulkRow: {
  flexDirection: 'row',
  // 행 간격(세로 간격)
  marginBottom: BULK_GAP,
},
bulkCell: {
  flex: 1, // 7등분
  alignItems: 'center',
  // 열 간격(가로 간격)
  paddingHorizontal: BULK_GAP / 2,
},
dateCircle: {
  width: BULK_ITEM,
  height: BULK_ITEM,
  borderRadius: BULK_ITEM / 2,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
},
dateCircleOff: {
  backgroundColor: '#FFF',
  borderColor: '#D1D5DB',
},
dateCircleOn: {
  backgroundColor: colors.gray800,
  borderColor: colors.gray800,
},
dateCircleText: { fontSize: 12, fontWeight: '800', color: colors.gray700 },
dateCircleTextOn: { color: '#FFF' },

// 마지막 줄 빈 칸도 동일한 폭/높이로 자리를 차지해 칼럼 정렬 유지
dateCirclePlaceholder: {
  width: BULK_ITEM,
  height: BULK_ITEM,
  borderRadius: BULK_ITEM / 2,
  opacity: 0,
},

  bulkTimesBox:{ marginTop: spacing.md, backgroundColor: colors.gray50, borderRadius: radius.md, padding: spacing.md, borderWidth:1, borderColor:'#E5E7EB' },
  bulkTimesHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  bulkTimesTitle:{ fontSize:13, fontWeight:'800', color: colors.gray700 },
  bulkEmptyHint:{ color: colors.gray500, fontSize:12 },

  addBtn:{ width:28, height:28, borderRadius:14, borderWidth:1, borderColor:'#D1D5DB', backgroundColor:'#FFF', alignItems:'center', justifyContent:'center' },
  addBtnPlus:{ color: colors.gray700, fontSize:16, fontWeight:'800', lineHeight:16 },

  timeChips:{ flexDirection:'row', flexWrap:'wrap', marginTop: spacing.sm },

  modalActions:{ flexDirection:'row', gap: 8, marginTop: spacing.lg },
  modalBtn:{ flex:1, alignItems:'center', paddingVertical:10, borderRadius: radius.md },
  modalBtnGhost:{ backgroundColor: colors.gray100 },
  modalBtnPrimary:{ backgroundColor: colors.gray800 },
  modalBtnGhostText:{ color: colors.gray800, fontWeight:'800' },
  modalBtnPrimaryText:{ color:'#FFF', fontWeight:'800' },
});
