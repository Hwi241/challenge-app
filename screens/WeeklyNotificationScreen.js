// screens/WeeklyNotificationScreen.js

import React, { useCallback, useState } from 'react';
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
        if (WEEK.includes(day)) {
          const unique = Array.from(new Set(times.map(String))).sort();
          m.set(day, unique);
        }
      }
    }
    return m;
  });

  const [pickerDay,setPickerDay] = useState(null);
  const [pickerVisible,setPickerVisible] = useState(false);
  const [bulkMode,setBulkMode] = useState(false); // 모든 요일 추가

  const openPicker = useCallback((day)=>{ setPickerDay(day); setBulkMode(false); setPickerVisible(true); },[]);
  const openBulkPicker = useCallback(()=>{ setPickerDay(null); setBulkMode(true); setPickerVisible(true); },[]);

  const onConfirm = useCallback((date)=>{
    const t = fmtHHMM(date);
    setPickerVisible(false);

    if (bulkMode) {
      const targets = WEEK.filter(d=>{
        const arr = map.get(d) || [];
        return !arr.includes(t);
      });
      const overflow = targets.some(d=>{
        const arr = map.get(d) || [];
        return arr.length >= MAX_PER_DAY;
      });
      if (overflow) { Alert.alert('제한', `최대 ${MAX_PER_DAY}개를 초과하였습니다.`); return; }

      setMap(prev=>{
        const m = new Map(prev);
        targets.forEach(d=>{
          const arr = m.get(d) || [];
          const next = [...arr, t].sort();
          m.set(d,next);
        });
        return m;
      });
      return;
    }

    if (!pickerDay) return;
    setMap(prev=>{
      const arr = prev.get(pickerDay) || [];
      if (arr.includes(t)) { Alert.alert('중복','이미 추가한 시간입니다.'); return prev; }
      if (arr.length>=MAX_PER_DAY){ Alert.alert('제한',`하루 최대 ${MAX_PER_DAY}개까지 가능합니다.`); return prev; }
      const next = [...arr, t].sort();
      const m = new Map(prev); m.set(pickerDay,next); return m;
    });
  },[pickerDay, bulkMode, map]);

  const onCancel = useCallback(()=>setPickerVisible(false),[]);

  const removeOne = useCallback((day,time)=>{
    setMap(prev=>{
      const arr = prev.get(day) || [];
      const next = arr.filter(t=>t!==time);
      const m = new Map(prev); m.set(day,next); return m;
    });
  },[]);

  const clearAll = useCallback(()=>{
    const empty = new Map(); WEEK.forEach(d=>empty.set(d,[]));
    setMap(empty);
  },[]);

  const save = useCallback(()=>{
    const byWeekDays = WEEK.map(day=>({ day, times: (map.get(day)||[]) }));
    const result = { mode:'weekly', payload:{ byWeekDays } };

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
  },[map, navigation, returnTo, route.params?.onDone]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>주간 알림 설정</Text>
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
                  <TouchableOpacity style={styles.addBtn} onPress={()=>openPicker(day)}>
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

      <View style={styles.actions}>
        <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
          <Text style={styles.resetBtnText}>초기화</Text>
        </TouchableOpacity>
        <View style={{flex:1}} />
        <TouchableOpacity style={[buttonStyles.primary.container, { paddingHorizontal: 14 }]} onPress={openBulkPicker}>
          <Text style={buttonStyles.primary.label}>모든 요일 시간+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[buttonStyles.primary.container,{marginTop:spacing.xl}]} onPress={save}>
        <Text style={buttonStyles.primary.label}>선택완료</Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={pickerVisible}
        mode="time"
        onConfirm={onConfirm}
        onCancel={onCancel}
        is24Hour
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{ padding: spacing.lg, backgroundColor: colors.gray50 },
  title:{ fontSize:20, fontWeight:'800', color: colors.gray800, textAlign:'center' },
  desc:{ color: colors.gray600, marginTop:4, marginBottom: spacing.md, fontSize:12, textAlign:'center' },

  card:{ backgroundColor:'#FFF', borderWidth:1, borderColor:'#E5E7EB', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  cardHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  dayTitle:{ fontSize:14, fontWeight:'800', color: colors.gray800 },

  timeChips:{ flexDirection:'row', flexWrap:'wrap', marginTop: spacing.sm },
  chip:{ flexDirection:'row', alignItems:'center', backgroundColor: colors.gray100, borderRadius: radius.pill, paddingVertical:3, paddingHorizontal:6, marginRight:6, marginBottom:6 },
  chipText:{ color: colors.gray800, fontSize:12, marginRight:6 },
  chipRemove:{ color:'#6B7280', fontSize:14, fontWeight:'800' },

  addBtn:{ width:28, height:28, borderRadius:14, borderWidth:1, borderColor:'#D1D5DB', backgroundColor:'#FFF', alignItems:'center', justifyContent:'center' },
  addBtnPlus:{ color: colors.gray700, fontSize:16, fontWeight:'800', lineHeight:16 },

  actions:{ flexDirection:'row', alignItems:'center', marginTop: spacing.lg },
  resetBtn:{ backgroundColor:'#FFF', borderWidth:1, borderColor:'#D1D5DB', borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  resetBtnText:{ color: colors.gray700, fontSize: 14, fontWeight:'600' },
});
