// screens/FullRangeNotificationScreen.js
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Modal, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { buttonStyles, spacing, radius, colors } from '../styles/common';

const pad2 = (n)=>String(n).padStart(2,'0');
const fmtHHMM = (d)=>`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtYMD = (d)=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const MAX_PER_DATE = 10;

function parseDateStr(s){
  if(!s) return null; const [y,m,d]=s.split('-').map(Number);
  const dt=new Date(y,(m||1)-1,d||1); return isNaN(dt.getTime())?null:dt;
}

export default function FullRangeNotificationScreen(){
  const navigation = useNavigation();
  const route = useRoute();
  const startStr = route.params?.startDate;
  const endStr = route.params?.endDate;
  const initial = route.params?.initial || null;
  const returnTo = route.params?.returnTo || 'AddChallenge';

  const start = parseDateStr(startStr);
  const end = parseDateStr(endStr);

  // 시작 > 종료 보호
  useEffect(() => {
    if (start && end && start > end) {
      Alert.alert('확인', '시작일이 종료일보다 늦습니다. 날짜를 다시 선택해주세요.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    }
  }, [startStr, endStr, start, end, navigation]);

  const [map,setMap] = useState(()=>{
    const m = {};
    if (initial && initial.byDate && typeof initial.byDate==='object') {
      for (const k of Object.keys(initial.byDate)) {
        m[k] = Array.isArray(initial.byDate[k]) ? [...new Set(initial.byDate[k].map(String))].sort() : [];
      }
    }
    return m;
  });

  // 단일 날짜 추가용
  const [pickerKey,setPickerKey] = useState(null);
  const [pickerVisible,setPickerVisible] = useState(false);

  // ── 일괄 적용 모달 ──
  const [bulkVisible, setBulkVisible] = useState(false);
  // 선택: all | weekday | weekend | custom
  const [bulkScope, setBulkScope] = useState('all');

  // 직접 입력 날짜
  const [customStartStr, setCustomStartStr] = useState(start ? fmtYMD(start) : '');
  const [customEndStr, setCustomEndStr] = useState(end ? fmtYMD(end) : '');

  // 대상 날짜(key) 집합(커스텀 제외 모드에서 자동 채움)
  const [bulkDates, setBulkDates] = useState(new Set());
  // 적용 시간들
  const [bulkTimes, setBulkTimes] = useState([]);
  const [bulkTimePickerVisible, setBulkTimePickerVisible] = useState(false);

  const inRangeStart = useMemo(()=> start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null, [start]);
  const inRangeEnd   = useMemo(()=> end   ? new Date(end.getFullYear(), end.getMonth(), end.getDate())     : null, [end]);

  const months = useMemo(()=>{
    if(!start || !end) return [];
    const arr=[]; const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last= new Date(end.getFullYear(), end.getMonth(), 1);
    while(cur<=last){ arr.push({y:cur.getFullYear(), mi:cur.getMonth()}); cur.setMonth(cur.getMonth()+1,1); }
    return arr;
  },[start,end]);

  const isInRange = useCallback((y,mi,d)=>{
    if(!inRangeStart || !inRangeEnd) return false;
    const dt = new Date(y,mi,d);
    return dt >= inRangeStart && dt <= inRangeEnd;
  },[inRangeStart,inRangeEnd]);

  const dateKey = (y,mi,d)=>`${y}-${pad2(mi+1)}-${pad2(d)}`;

  // ── 단일 날짜 + 버튼 ──
  const openPicker = useCallback((y,mi,d)=>{ const key = dateKey(y,mi,d); setPickerKey(key); setPickerVisible(true); },[]);
  const onConfirmSingle = useCallback((date)=>{
    const t = fmtHHMM(date);
    setPickerVisible(false);
    if(!pickerKey) return;
    setMap(prev=>{
      const arr = Array.isArray(prev[pickerKey]) ? [...prev[pickerKey]] : [];
      if (arr.includes(t)) { Alert.alert('중복','이미 추가한 시간입니다.'); return prev; }
      if (arr.length>=MAX_PER_DATE){ Alert.alert('제한',`최대 ${MAX_PER_DATE}개 초과하였습니다.`); return prev; }
      arr.push(t); arr.sort(); return { ...prev, [pickerKey]: arr };
    });
  },[pickerKey]);
  const onCancelSingle = useCallback(()=>setPickerVisible(false),[]);

  // ── 범위 키 산출 ──
  const allRangeDateKeys = useCallback(()=>{
    const keys=[];
    months.forEach(({y,mi})=>{
      const daysInMonth = new Date(y,mi+1,0).getDate();
      for(let d=1; d<=daysInMonth; d++){
        if (!isInRange(y,mi,d)) continue;
        keys.push(dateKey(y,mi,d));
      }
    });
    return keys;
  },[months, isInRange]);

  const weekdayKeys = useCallback(()=>{
    const keys=[];
    months.forEach(({y,mi})=>{
      const daysInMonth = new Date(y,mi+1,0).getDate();
      for(let d=1; d<=daysInMonth; d++){
        if (!isInRange(y,mi,d)) continue;
        const dow = new Date(y,mi,d).getDay(); // 0:일 ~ 6:토
        if (dow>=1 && dow<=5) keys.push(dateKey(y,mi,d));
      }
    });
    return keys;
  },[months, isInRange]);

  const weekendKeys = useCallback(()=>{
    const keys=[];
    months.forEach(({y,mi})=>{
      const daysInMonth = new Date(y,mi+1,0).getDate();
      for(let d=1; d<=daysInMonth; d++){
        if (!isInRange(y,mi,d)) continue;
        const dow = new Date(y,mi,d).getDay();
        if (dow===0 || dow===6) keys.push(dateKey(y,mi,d));
      }
    });
    return keys;
  },[months, isInRange]);

  // ── 모달 열기 ──
  const openBulk = useCallback(()=>{
    setBulkVisible(true);
    setBulkScope('all');
    setBulkDates(new Set(allRangeDateKeys()));
    setBulkTimes([]);
    setCustomStartStr(start ? fmtYMD(start) : '');
    setCustomEndStr(end ? fmtYMD(end) : '');
  },[allRangeDateKeys, start, end]);

  // ── 범위 선택 변경 ──
  const onChangeScope = useCallback((scope)=>{
    setBulkScope(scope);
    if (scope==='all') setBulkDates(new Set(allRangeDateKeys()));
    if (scope==='weekday') setBulkDates(new Set(weekdayKeys()));
    if (scope==='weekend') setBulkDates(new Set(weekendKeys()));
    if (scope==='custom') {
      setBulkDates(new Set());
      setCustomStartStr(start ? fmtYMD(start) : '');
      setCustomEndStr(end ? fmtYMD(end) : '');
    }
  },[allRangeDateKeys, weekdayKeys, weekendKeys, start, end]);

  // ── 모달 시간 편집 ──
  const addBulkTime = useCallback((date)=>{
    const t = fmtHHMM(date);
    setBulkTimePickerVisible(false);
    setBulkTimes(prev=>{
      if (prev.includes(t)) return prev;
      return [...prev, t].sort();
    });
  },[]);
  const removeBulkTime = useCallback((t)=>{
    setBulkTimes(prev=>prev.filter(x=>x!==t));
  },[]);

  // ── 유효성 ──
  function validYMD(str){
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const dt = parseDateStr(str);
    return dt;
  }
  const inMainRange = useCallback((dt)=> dt && inRangeStart && inRangeEnd && dt>=inRangeStart && dt<=inRangeEnd, [inRangeStart, inRangeEnd]);

  // ── 일괄 적용 ──
  const applyBulk = useCallback(()=>{
    let targetsSet = bulkDates;

    if (bulkScope === 'custom') {
      const sdt = validYMD(customStartStr);
      const edt = validYMD(customEndStr);
      if (!sdt || !edt) { Alert.alert('확인','날짜는 YYYY-MM-DD 형식으로 입력해 주세요.'); return; }
      if (sdt > edt) { Alert.alert('확인','시작일이 종료일보다 늦을 수 없습니다.'); return; }
      if (!inMainRange(sdt) || !inMainRange(edt)) { Alert.alert('범위 초과','설정 가능한 날짜 범위를 벗어났습니다.'); return; }

      const tmp = new Set();
      const cur = new Date(sdt);
      while (cur <= edt) {
        const key = dateKey(cur.getFullYear(), cur.getMonth(), cur.getDate());
        tmp.add(key);
        cur.setDate(cur.getDate()+1);
      }
      targetsSet = tmp;
    }

    if (bulkTimes.length === 0) { Alert.alert('확인','적용할 시간을 추가해주세요.'); return; }
    const targets = Array.from(targetsSet || []);
    if (targets.length === 0) { Alert.alert('확인','적용할 날짜를 선택해주세요.'); return; }

    // 초과 검사(모달 유지)
    const overflow = targets.some(k=>{
      const current = Array.isArray(map[k]) ? map[k] : [];
      const uniqueNew = bulkTimes.filter(t=>!current.includes(t));
      return (current.length + uniqueNew.length) > MAX_PER_DATE;
    });
    if (overflow) {
      Alert.alert('제한', `어느 날짜는 이미 ${MAX_PER_DATE}개여서 더 추가할 수 없어요.\n선택을 조정한 뒤 다시 시도해 주세요.`);
      return;
    }

    setMap(prev=>{
      const next = { ...prev };
      targets.forEach(k=>{
        const cur = Array.isArray(next[k]) ? [...next[k]] : [];
        const merged = Array.from(new Set([...cur, ...bulkTimes])).sort();
        next[k] = merged;
      });
      return next;
    });
    setBulkVisible(false);
  },[bulkScope, bulkDates, bulkTimes, customStartStr, customEndStr, map, inMainRange]);

  const removeOne = useCallback((key,time)=>{
    setMap(prev=>{
      const arr = Array.isArray(prev[key]) ? prev[key].filter(t=>t!==time) : [];
      return { ...prev, [key]: arr };
    });
  },[]);

  const clearAll = useCallback(()=>{
    Alert.alert('초기화','범위 내 모든 날짜의 시간을 삭제할까요?',[
      { text:'취소', style:'cancel' },
      { text:'삭제', style:'destructive', onPress:()=> setMap({}) }
    ]);
  },[]);

  const save = useCallback(()=>{
    const result = { mode:'fullrange', payload:{ start: startStr, end: endStr, byDate: map } };
    const onDone = route.params?.onDone;
    if (typeof onDone === 'function') { onDone(result); navigation.goBack(); return; }
    navigation.navigate({
      name: returnTo || 'AddChallenge',
      params: { notificationResult: result, _nonce: Date.now() },
      merge: true,
    });
  },[map, navigation, returnTo, startStr, endStr, route.params?.onDone]);

  if(!start || !end){
    return (
      <View style={{flex:1,alignItems:'center',justifyContent:'center', padding:spacing.lg, backgroundColor: colors.gray50}}>
        <Text style={{color: colors.gray800, fontWeight:'800', fontSize:16, textAlign:'center'}}>시작일과 종료일을 먼저 선택해주세요.</Text>
      </View>
    );
  }
  if (start > end) return <View style={{flex:1, backgroundColor: colors.gray50}} />;

  return (
    <View style={{flex:1, backgroundColor: colors.gray50}}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 /* 고정 바 높이만큼 여백 */ }}
      >
        <Text style={styles.title}>전체 일정 알림</Text>
        <Text style={styles.desc}>{startStr} ~ {endStr} 범위에서 날짜별로 시간을 추가하세요. (하루 최대 {MAX_PER_DATE}개)</Text>

        {months.map(({y,mi})=>{
          const first = new Date(y,mi,1);
          const daysInMonth = new Date(y,mi+1,0).getDate();
          const firstDow=first.getDay(); // 0~6
          const cells=[];
          for(let i=0;i<firstDow;i++) cells.push(null);
          for(let d=1; d<=daysInMonth; d++) cells.push(d);
          while(cells.length%7!==0) cells.push(null);
          const rows=[];
          for(let i=0;i<cells.length;i+=7) rows.push(cells.slice(i,i+7));

          return (
            <View key={`${y}-${mi}`} style={{marginBottom:10}}>
              <Text style={styles.monthTitle}>{y}.{pad2(mi+1)}</Text>

              {/* 요일 헤더 */}
              <View style={styles.weekHeaderRow}>
                {['일','월','화','수','목','금','토'].map((w,idx)=>(
                  <View key={w} style={[styles.weekHeaderCell, idx<6 && styles.weekHeaderCellDivider]}>
                    <Text style={styles.weekHeaderText}>{w}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.gridOuter}>
                {rows.map((row,rIdx)=>(
                  <View key={`r-${y}-${mi}-${rIdx}`} style={[styles.row, rIdx<rows.length-1 && styles.rowDivider]}>
                    {row.map((d,cIdx)=>{
                      const inR = d ? isInRange(y,mi,d) : false;
                      const key = d ? dateKey(y,mi,d) : '';
                      const times = d && inR ? (map[key]||[]) : [];
                      const canAdd = d && inR && times.length < MAX_PER_DATE;
                      return (
                        <View key={`c-${y}-${mi}-${rIdx}-${cIdx}`} style={[styles.cell, cIdx<6 && styles.cellDivider]}>
                          {d ? (
                            <>
                              <Text style={[styles.dateText, !inR && {opacity:0.25}]}>{d}</Text>
                              {inR && (
                                <View style={styles.timesWrap}>
                                  {times.map(t=>(
                                    <View key={`${key}-${t}`} style={styles.chip}>
                                      <Text style={styles.chipText} numberOfLines={1} allowFontScaling={false}>{t}</Text>
                                      <TouchableOpacity onPress={()=>removeOne(key,t)}>
                                        <Text style={styles.chipRemove}>×</Text>
                                      </TouchableOpacity>
                                    </View>
                                  ))}
                                  {canAdd && (
                                    <TouchableOpacity style={styles.addBtn} onPress={()=>openPicker(y,mi,d)}>
                                      <Text style={styles.addBtnPlus}>＋</Text>
                                    </TouchableOpacity>
                                  )}
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

      {/* ▼ 하단 고정 바 */}
      <View style={styles.fixedBar} pointerEvents="box-none">
        <View style={styles.fixedTopRow}>
          <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
            <Text style={styles.resetBtnText}>초기화</Text>
          </TouchableOpacity>
          <View style={{flex:1}} />
          <TouchableOpacity style={[buttonStyles.primary.container, { paddingHorizontal: 14 }]} onPress={openBulk}>
            <Text style={buttonStyles.primary.label}>일괄 시간 적용</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[buttonStyles.primary.container, styles.fixedSave]} onPress={save}>
          <Text style={buttonStyles.primary.label}>선택완료</Text>
        </TouchableOpacity>
      </View>

      {/* 단일 시간 피커 */}
      <DateTimePickerModal
        isVisible={pickerVisible}
        mode="time"
        onConfirm={onConfirmSingle}
        onCancel={onCancelSingle}
        is24Hour
      />

      {/* ─────────────────────────────────────────────
           일괄 시간 적용 모달 (화면/뷰포트 정중앙)
         ───────────────────────────────────────────── */}
      <Modal
        visible={bulkVisible}
        transparent
        animationType="fade"
        onRequestClose={()=>setBulkVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>일괄 시간 적용</Text>

            {/* 범위 선택 */}
            <View style={styles.scopeWrap}>
              {[
                {key:'all', label:'모든 날짜'},
                {key:'weekday', label:'평일'},
                {key:'weekend', label:'주말'},
                {key:'custom', label:'날짜 지정'},
              ].map(opt=>(
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.radioRow, bulkScope===opt.key && styles.radioRowActive]}
                  onPress={()=>onChangeScope(opt.key)}
                  activeOpacity={0.9}
                >
                  <View style={[styles.radioOuter, bulkScope===opt.key && styles.radioOuterOn]}>
                    {bulkScope===opt.key ? <View style={styles.radioInner}/> : null}
                  </View>
                  <Text style={styles.radioLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 날짜 직접 입력 */}
            {bulkScope === 'custom' && (
              <View style={styles.customInputWrap}>
                <View style={styles.customRow}>
                  <Text style={styles.customInputLabel}>시작</Text>
                  <TextInput
                    value={customStartStr}
                    onChangeText={setCustomStartStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.gray400}
                    style={styles.customInput}
                    inputMode="numeric"
                  />
                </View>
                <View style={styles.customRow}>
                  <Text style={styles.customInputLabel}>종료</Text>
                  <TextInput
                    value={customEndStr}
                    onChangeText={setCustomEndStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.gray400}
                    style={styles.customInput}
                    inputMode="numeric"
                  />
                </View>
                <Text style={styles.customHint}>설정 가능한 범위: {startStr} ~ {endStr}</Text>
              </View>
            )}

            {/* 시간 추가 */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.sectionLabel}>적용할 시간</Text>
              <View style={styles.timesEditRow}>
                <TouchableOpacity style={styles.addBtn} onPress={()=>setBulkTimePickerVisible(true)}>
                  <Text style={styles.addBtnPlus}>＋</Text>
                </TouchableOpacity>
                <View style={{flex:1}} />
              </View>
              <View style={[styles.timesWrap, { marginTop: spacing.sm }]}>
                {bulkTimes.map(t=>(
                  <View key={t} style={styles.chip}>
                    <Text style={styles.chipText}>{t}</Text>
                    <TouchableOpacity onPress={()=>setBulkTimes(prev=>prev.filter(x=>x!==t))}>
                      <Text style={styles.chipRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* 하단 행동 버튼 */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalGhost]} onPress={()=>setBulkVisible(false)}>
                <Text style={styles.modalGhostText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalPrimary]} onPress={applyBulk}>
                <Text style={styles.modalPrimaryText}>적용</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 모달 내부 시간 피커 */}
          <DateTimePickerModal
            isVisible={bulkTimePickerVisible}
            mode="time"
            onConfirm={addBulkTime}
            onCancel={()=>setBulkTimePickerVisible(false)}
            is24Hour
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:20, fontWeight:'800', color: colors.gray800, textAlign:'center' },
  desc:{ color: colors.gray600, marginTop:4, marginBottom: spacing.md, fontSize:13, textAlign:'center' },

  monthTitle:{ fontSize:12, fontWeight:'800', color: colors.gray700, marginBottom:4, textAlign:'center' },

  weekHeaderRow:{ flexDirection:'row', marginBottom:4 },
  weekHeaderCell:{ flex:1, alignItems:'center' },
  weekHeaderCellDivider:{ borderRightWidth:1, borderRightColor:'#E5E7EB' },
  weekHeaderText:{ fontSize:11, fontWeight:'800', color: colors.gray700 },

  gridOuter:{ borderTopWidth:1, borderTopColor:'#E5E7EB' },
  row:{ flexDirection:'row' },
  rowDivider:{ borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
  cell:{ flex:1, padding:6 },
  cellDivider:{ borderRightWidth:1, borderRightColor:'#E5E7EB' },
  dateText:{ fontSize:11, fontWeight:'800', color: colors.gray700, textAlign:'right' },




  
    // 시간 토큰 컨테이너 (간격 살짝 축소)
  timesWrap:{ marginTop:2, gap:4, flexDirection:'row', flexWrap:'wrap' },
  // 토큰(시간 + ×)
  chip:{
    flexDirection:'row',
    alignItems:'center',
    backgroundColor: colors.gray100,
    borderRadius: radius.pill,
    paddingVertical: 2,         // 3 → 2
    paddingHorizontal: 4,       // 6 → 4
    maxWidth: '100%',
  },
  chipText:{
    color: colors.gray800,
    fontSize: 11,               // 12 → 11
    lineHeight: 13,             // 고정 라인 높이로 세로 정렬 안정화
    marginRight: 4,             // 6 → 4 (×와의 간격 축소)
    includeFontPadding: false,  // 안드로이드 내장 패딩 제거
  },
  chipRemove:{
    color: '#6B7280',
    fontSize: 12,               // 14 → 12
    fontWeight: '800',
    // 여백 없애서 칸 안에서 깔끔하게
    // (필요시 hitSlop은 개별 요소에서 유지)
  },

  // + 버튼은 그대로 두되, 칸이 좁을 때를 대비해 유지
  addBtn:{ width:28, height:28, borderRadius:14, borderWidth:1, borderColor:'#D1D5DB', backgroundColor:'#FFF', alignItems:'center', justifyContent:'center' },
  addBtnPlus:{ color: colors.gray700, fontSize:16, fontWeight:'800', lineHeight:16 },

  /* 하단 고정 바 */
  fixedBar:{
    position:'absolute',
    left:0, right:0, bottom:0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: Platform.select({ ios: spacing.lg, android: spacing.md }),
    backgroundColor: colors.gray50,
    borderTopWidth: 0,
    borderTopColor: '#E5E7EB',
  },
  fixedTopRow:{ flexDirection:'row', alignItems:'center', marginBottom: spacing.sm },
  fixedSave:{ marginTop: spacing.sm },

  // 고정 바 안 버튼들
  resetBtn:{ backgroundColor:'#FFF', borderWidth:1, borderColor:'#D1D5DB', borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  resetBtnText:{ color: colors.gray700, fontSize: 14, fontWeight:'600' },

  /* 모달(정중앙) */
  modalBackdrop:{
    flex:1,
    backgroundColor:'rgba(0,0,0,0.35)',
    alignItems:'center',
    justifyContent:'center',
    padding: spacing.lg
  },
  modalCard:{
    width:'92%',
    maxWidth: 460,
    backgroundColor:'#FFF',
    borderWidth:1, borderColor:'#E5E7EB',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle:{ fontSize:16, fontWeight:'800', color: colors.gray800, textAlign:'center', marginBottom: spacing.md },

  scopeWrap:{ marginBottom: spacing.md },
  radioRow:{ flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:8, borderRadius: radius.md },
  radioRowActive:{ backgroundColor: colors.gray100 },
  radioOuter:{ width:18, height:18, borderRadius:9, borderWidth:2, borderColor: colors.gray800, alignItems:'center', justifyContent:'center', marginRight:10 },
  radioOuterOn:{ borderColor: colors.gray800 },
  radioInner:{ width:8, height:8, borderRadius:4, backgroundColor: colors.gray800 },
  radioLabel:{ color: colors.gray800, fontWeight:'700' },

  // 날짜 직접 입력
  customInputWrap:{ marginTop: spacing.sm },
  customRow:{ flexDirection:'row', alignItems:'center', marginBottom: 8 },
  customInputLabel:{ width:36, color: colors.gray700, fontWeight:'700' },
  customInput:{
    flex:1,
    backgroundColor:'#FFF',
    borderWidth:1, borderColor:'#E5E7EB',
    borderRadius: radius.md,
    paddingHorizontal:12, paddingVertical:10,
    fontSize:14, color: colors.gray800
  },
  customHint:{ marginTop:4, fontSize:11, color: colors.gray600, textAlign:'right' },

  sectionLabel:{ fontSize:13, fontWeight:'800', color: colors.gray800 },
  timesEditRow:{ flexDirection:'row', alignItems:'center', marginTop:6 },

  modalActions:{ flexDirection:'row', gap:8, marginTop: spacing.lg },
  modalBtn:{ flex:1, paddingVertical:10, borderRadius: radius.md, alignItems:'center' },
  modalGhost:{ backgroundColor: colors.gray100 },
  modalGhostText:{ color: colors.gray800, fontWeight:'800' },
  modalPrimary:{ backgroundColor: colors.gray800 },
  modalPrimaryText:{ color:'#FFF', fontWeight:'800' },
});
