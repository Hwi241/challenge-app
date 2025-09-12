// screens/WeeklyNotificationScreen.js
// - 제목: "주간 알림 설정" 중앙
// - 7개 요일을 '카드'로 구분(인지 쉬움)
// - 각 요일 최대 10개 시간, 중복 방지, 정렬
// - 저장: replace(returnTo)

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { buttonStyles, spacing, radius, colors } from '../styles/common';

const WEEK = ['월','화','수','목','금','토','일'];
const MAX_PER_DAY = 10;

const pad2 = (n)=>String(n).padStart(2,'0');
const fmtHHMM = (d)=>`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export default function WeeklyNotificationScreen(){
  const navigation = useNavigation();
  const route = useRoute();
  const initial = route.params?.initial || null;
  const returnTo = route.params?.returnTo || 'AddChallenge';

  const [map,setMap] = useState(()=>{
    const m = new Map();
    WEEK.forEach(d=>m.set(d, []));
    if (initial && Array.isArray(initial.byWeekDays)) {
      for (const {day, times=[]} of initial.byWeekDays) {
        if (WEEK.includes(day)) m.set(day, [...new Set(times.map(String))].sort());
      }
    }
    return m;
  });

  const [pickerDay,setPickerDay] = useState(null);
  const [pickerVisible,setPickerVisible] = useState(false);

  const openPicker = useCallback((day)=>{ setPickerDay(day); setPickerVisible(true); },[]);
  const onConfirm = useCallback((date)=>{
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
  const onCancel = useCallback(()=>setPickerVisible(false),[]);

  const removeOne = useCallback((day,time)=>{
    setMap(prev=>{
      const arr = prev.get(day) || [];
      const next = arr.filter(t=>t!==time);
      const m = new Map(prev); m.set(day,next); return m;
    });
  },[]);

  const save = useCallback(()=>{
    const byWeekDays = WEEK.map(day=>({ day, times: (map.get(day)||[]) }));
    navigation.replace(returnTo, {
      notificationResult: { mode:'weekly', payload:{ byWeekDays } },
      _nonce: Date.now(),
    });
  },[map, navigation, returnTo]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>주간 알림 설정</Text>

      <View style={{rowGap: spacing.sm}}>
        {WEEK.map(day=>{
          const times = map.get(day)||[];
          const canAdd = times.length < MAX_PER_DAY;
          return (
            <View key={day} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.dayTitle}>{day}</Text>
                {canAdd && (
                  <TouchableOpacity style={styles.addBtn} onPress={()=>openPicker(day)}>
                    <Text style={styles.addBtnPlus}>＋</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.timeChips}>
                {times.map(t=>(
                  <View key={`${day}-${t}`} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>{t}</Text>
                    <TouchableOpacity onPress={()=>removeOne(day,t)}>
                      <Text style={styles.chipRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={[buttonStyles.primary.container,{marginTop:spacing.xl}]} onPress={save}>
        <Text style={buttonStyles.primary.label}>선택완료</Text>
      </TouchableOpacity>

      <DateTimePickerModal isVisible={pickerVisible} mode="time" onConfirm={onConfirm} onCancel={onCancel} is24Hour />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{ padding: spacing.lg, backgroundColor: colors.gray50 },
  title:{ fontSize:20, fontWeight:'800', color: colors.gray800, textAlign:'center', marginBottom: spacing.md },

  card:{ backgroundColor:'#FFF', borderWidth:1, borderColor:'#E5E7EB', borderRadius: radius.lg, padding: spacing.md },
  cardHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  dayTitle:{ fontSize:14, fontWeight:'800', color: colors.gray800 },

  timeChips:{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop: spacing.sm },
  chip:{ flexDirection:'row', alignItems:'center', backgroundColor: colors.gray100, borderRadius: radius.pill, paddingVertical:3, paddingHorizontal:6 },
  chipText:{ color: colors.gray800, fontSize:12, marginRight:6 },
  chipRemove:{ color:'#6B7280', fontSize:14, fontWeight:'800' },

  addBtn:{ width:28, height:28, borderRadius:14, borderWidth:1, borderColor:'#D1D5DB', backgroundColor:'#FFF', alignItems:'center', justifyContent:'center' },
  addBtnPlus:{ color: colors.gray700, fontSize:16, fontWeight:'800', lineHeight:16 }
});
