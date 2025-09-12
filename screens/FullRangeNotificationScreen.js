// screens/FullRangeNotificationScreen.js
// - 제목 중앙
// - 월별 달력에 요일 헤더 표시
// - 각 날짜칩(시간) 텍스트 한 줄 유지(칩 내부 줄바꿈 방지), 패딩 축소
// - 각 날짜 최대 10개
// - 저장: replace(returnTo) { mode:'fullrange', payload:{ start,end, byDate } }

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { buttonStyles, spacing, radius, colors } from '../styles/common';

const pad2 = (n)=>String(n).padStart(2,'0');
const fmtHHMM = (d)=>`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

  const [map,setMap] = useState(()=>{
    const m = {};
    if (initial && initial.byDate && typeof initial.byDate==='object') {
      for (const k of Object.keys(initial.byDate)) {
        m[k] = Array.isArray(initial.byDate[k]) ? [...new Set(initial.byDate[k].map(String))].sort() : [];
      }
    }
    return m;
  });

  const [pickerKey,setPickerKey] = useState(null);
  const [pickerVisible,setPickerVisible] = useState(false);

  const months = useMemo(()=>{
    if(!start || !end) return [];
    const arr=[]; const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last= new Date(end.getFullYear(), end.getMonth(), 1);
    while(cur<=last){ arr.push({y:cur.getFullYear(), mi:cur.getMonth()}); cur.setMonth(cur.getMonth()+1,1); }
    return arr;
  },[start,end]);

  const isInRange = useCallback((y,mi,d)=>{
    const dt = new Date(y,mi,d);
    return dt >= new Date(start.getFullYear(), start.getMonth(), start.getDate())
      && dt <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
  },[start,end]);

  const openPicker = useCallback((y,mi,d)=>{
    const key = `${y}-${pad2(mi+1)}-${pad2(d)}`;
    setPickerKey(key); setPickerVisible(true);
  },[]);
  const onConfirm = useCallback((date)=>{
    const t = fmtHHMM(date);
    setPickerVisible(false);
    if(!pickerKey) return;
    setMap(prev=>{
      const arr = Array.isArray(prev[pickerKey]) ? [...prev[pickerKey]] : [];
      if (arr.includes(t)) { Alert.alert('중복','이미 추가한 시간입니다.'); return prev; }
      if (arr.length>=MAX_PER_DATE){ Alert.alert('제한',`하루 최대 ${MAX_PER_DATE}개까지 가능합니다.`); return prev; }
      arr.push(t); arr.sort(); return { ...prev, [pickerKey]: arr };
    });
  },[pickerKey]);
  const onCancel = useCallback(()=>setPickerVisible(false),[]);

  const removeOne = useCallback((key,time)=>{
    setMap(prev=>{
      const arr = Array.isArray(prev[key]) ? prev[key].filter(t=>t!==time) : [];
      return { ...prev, [key]: arr };
    });
  },[]);

  const save = useCallback(()=>{
    navigation.replace(returnTo, {
      notificationResult: {
        mode:'fullrange',
        payload: { start: startStr, end: endStr, byDate: map }
      },
      _nonce: Date.now(),
    });
  },[map, navigation, returnTo, startStr, endStr]);

  if(!start || !end){
    return (
      <View style={{flex:1,alignItems:'center',justifyContent:'center', padding:spacing.lg, backgroundColor: colors.gray50}}>
        <Text style={{color: colors.gray800, fontWeight:'800', fontSize:16, textAlign:'center'}}>시작일과 종료일을 먼저 선택해주세요.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, backgroundColor: colors.gray50 }}>
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
                    const inRange = d ? isInRange(y,mi,d) : false;
                    const key = d ? `${y}-${pad2(mi+1)}-${pad2(d)}` : '';
                    const times = d && inRange ? (map[key]||[]) : [];
                    const canAdd = d && inRange && times.length < MAX_PER_DATE;
                    return (
                      <View key={`c-${y}-${mi}-${rIdx}-${cIdx}`} style={[styles.cell, cIdx<6 && styles.cellDivider]}>
                        {d ? (
                          <>
                            <Text style={[styles.dateText, !inRange && {opacity:0.25}]}>{d}</Text>
                            {inRange && (
                              <View style={styles.timesWrap}>
                                {times.map(t=>(
                                  <View key={`${key}-${t}`} style={styles.chip}>
                                    <Text style={styles.chipText} numberOfLines={1}>{t}</Text>
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

      <TouchableOpacity style={[buttonStyles.primary.container,{marginTop:spacing.xl}]} onPress={save}>
        <Text style={buttonStyles.primary.label}>선택완료</Text>
      </TouchableOpacity>

      <DateTimePickerModal isVisible={pickerVisible} mode="time" onConfirm={onConfirm} onCancel={onCancel} is24Hour />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:20, fontWeight:'800', color: colors.gray800, textAlign:'center' },
  desc:{ color: colors.gray600, marginTop:4, marginBottom: spacing.md, fontSize:13, textAlign:'center' },

  monthTitle:{ fontSize:12, fontWeight:'800', color: colors.gray700, marginBottom:4 },

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

  timesWrap:{ marginTop:2, gap:6, flexDirection:'row', flexWrap:'wrap' },
  chip:{ flexDirection:'row', alignItems:'center', backgroundColor: colors.gray100, borderRadius: radius.pill, paddingVertical:3, paddingHorizontal:6 },
  chipText:{ color: colors.gray800, fontSize:12, marginRight:6 },
  chipRemove:{ color:'#6B7280', fontSize:14, fontWeight:'800' },

  addBtn:{ width:28, height:28, borderRadius:14, borderWidth:1, borderColor:'#D1D5DB', backgroundColor:'#FFF', alignItems:'center', justifyContent:'center' },
  addBtnPlus:{ color: colors.gray700, fontSize:16, fontWeight:'800', lineHeight:16 }
});
