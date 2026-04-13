// screens/NotificationDefaultsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Modal, TextInput, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../components/BackButton';

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
  blue600: '#2563EB',
};

const radius = { md: 12, lg: 16 };
const spacing = { sm: 8, md: 12, lg: 16, xl: 20 };

const STORAGE_KEY = 'notification_defaults';
// defaults shape: { sound: 'system'|'silent'|'vibrate', snooze: { enabled: boolean, minutes: number } }
const PRESETS = [5, 10, 15, 30];

export default function NotificationDefaultsScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState('system'); // 'system' | 'silent' | 'vibrate'
  const [snoozeEnabled, setSnoozeEnabled] = useState(false);
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState(String(snoozeMinutes));

  useEffect(()=>{
    (async()=>{
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const v = JSON.parse(raw);
          if (v?.sound) setSound(v.sound);
          if (v?.snooze?.enabled !== undefined) setSnoozeEnabled(!!v.snooze.enabled);
          if (v?.snooze?.minutes) setSnoozeMinutes(Number(v.snooze.minutes) || 10);
        }
      } catch(e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  },[]);

  const onPickCustom = ()=>{
    setCustomInput(String(snoozeMinutes));
    setShowCustomModal(true);
  };

  const onConfirmCustom = ()=>{
    const n = parseInt((customInput||'').replace(/[^\d]/g,''), 10);
    if (!Number.isFinite(n) || n <= 0) { Alert.alert('확인','1분 이상의 숫자를 입력하세요.'); return; }
    if (n > 240) { Alert.alert('확인','최대 240분까지 설정할 수 있습니다.'); return; }
    setSnoozeMinutes(n);
    setShowCustomModal(false);
  };

  const saveAndBack = async()=>{
    try {
      const toSave = { sound, snooze: { enabled: snoozeEnabled, minutes: snoozeMinutes } };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      Alert.alert('저장됨','알림 기본 설정이 저장되었습니다.',[
        { text:'확인', onPress:()=>navigation.goBack() }
      ]);
    } catch(e) {
      Alert.alert('오류','설정을 저장하지 못했습니다.');
    }
  };

  const SoundOption = ({value, label})=>(
    <TouchableOpacity
      style={[styles.radioRow, sound===value && styles.radioRowActive]}
      onPress={()=>setSound(value)}
      activeOpacity={0.9}
    >
      <View style={[styles.radioOuter, sound===value && styles.radioOuterOn]}>
      <BackButton title="알림 기본 설정" />
        {sound===value ? <View style={styles.radioInner}/> : null}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const isCustomSelected = !PRESETS.includes(snoozeMinutes);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      

      {/* 알림음 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>알림음 선택</Text>
        <SoundOption value="system" label="시스템 기본" />
        <SoundOption value="silent" label="무음(배너만)" />
        <SoundOption value="vibrate" label="진동" />
      </View>

      {/* 스누즈 */}
      <View style={[styles.card, {marginTop: spacing.lg}]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>스누즈</Text>
          <Switch
  value={snoozeEnabled}
  onValueChange={setSnoozeEnabled}
  trackColor={{ false: PALETTE.gray300, true: PALETTE.gray600 }}
  thumbColor={snoozeEnabled ? PALETTE.gray800 : PALETTE.white}
  ios_backgroundColor={PALETTE.gray300}
/>
        </View>

        {snoozeEnabled && (
          <View style={styles.choicesWrap}>
            {PRESETS.map(min=>(
              <TouchableOpacity
                key={min}
                style={[styles.choiceBtn, snoozeMinutes===min && styles.choiceBtnOn]}
                onPress={()=>setSnoozeMinutes(min)}
                activeOpacity={0.9}
              >
                <Text style={[styles.choiceText, snoozeMinutes===min && styles.choiceTextOn]}>{min}분</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.choiceBtn, styles.choiceBtnOutline, isCustomSelected && styles.choiceBtnOn]}
              onPress={onPickCustom}
              activeOpacity={0.9}
            >
              <Text style={[styles.choiceText, isCustomSelected && styles.choiceTextOn]}>
                {isCustomSelected ? `${snoozeMinutes}분` : '사용자 지정'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveAndBack} activeOpacity={0.9}>
        <Text style={styles.saveBtnText}>저장</Text>
      </TouchableOpacity>

      {/* 사용자 지정 분수 입력 모달 */}
      <Modal visible={showCustomModal} transparent animationType="fade" onRequestClose={()=>setShowCustomModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>스누즈 분(1~240)</Text>
            <TextInput
              value={customInput}
              onChangeText={t=>setCustomInput((t||'').replace(/[^\d]/g,''))}
              inputMode="numeric"
              keyboardType="number-pad"
              style={styles.modalInput}
              placeholder="분 단위 숫자"
              placeholderTextColor={PALETTE.gray400}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={()=>setShowCustomModal(false)}>
                <Text style={[styles.modalBtnText, {color: PALETTE.gray800}]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={onConfirmCustom}>
                <Text style={[styles.modalBtnText, {color: PALETTE.white}]}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: PALETTE.gray50 },
  title: { fontSize: 20, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.lg, textAlign:'center' },

  card: {
    backgroundColor: PALETTE.white,
    borderWidth: 1, borderColor: PALETTE.gray200,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PALETTE.gray800, marginBottom: spacing.md },

  // radio
  radioRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  radioRowActive: { backgroundColor: PALETTE.gray100 },
  radioOuter: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: PALETTE.gray800,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  radioOuterOn: { borderColor: PALETTE.blue600 },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.blue600 },
  radioLabel: { color: PALETTE.gray800, fontWeight:'700' },

  // snooze choices
  rowBetween: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  choicesWrap: { flexDirection:'row', flexWrap:'wrap', gap: 8, marginTop: spacing.md },
  choiceBtn: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 999, backgroundColor: PALETTE.gray100,
  },
  choiceBtnOutline: { borderWidth: 1, borderColor: PALETTE.gray800, backgroundColor: PALETTE.white },
  choiceBtnOn: { backgroundColor: PALETTE.black, borderColor: PALETTE.black },
  choiceText: { color: PALETTE.gray800, fontWeight: '800' },
  choiceTextOn: { color: PALETTE.white },

  // save
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: PALETTE.black, borderRadius: radius.md,
    paddingVertical: 12, alignItems:'center'
  },
  saveBtnText: { color: PALETTE.white, fontWeight:'800' },

  // modal
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.35)', alignItems:'center', justifyContent:'center', padding: spacing.lg },
  modalCard: { width:'100%', backgroundColor:PALETTE.white, borderRadius:radius.lg, padding:spacing.lg, borderWidth:1, borderColor:PALETTE.gray200 },
  modalTitle: { fontSize:16, fontWeight:'800', color:PALETTE.gray800, marginBottom:spacing.md, textAlign:'center' },
  modalInput: {
    backgroundColor:PALETTE.white, borderWidth:1, borderColor:PALETTE.gray300,
    borderRadius: radius.md, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:PALETTE.gray800, textAlign:'center'
  },
  modalRow: { flexDirection:'row', gap: 8, marginTop: spacing.lg },
  modalBtn: { flex:1, paddingVertical:10, borderRadius:radius.md, alignItems:'center' },
  modalBtnGhost: { backgroundColor: PALETTE.gray100 },
  modalBtnPrimary: { backgroundColor: PALETTE.black },
  modalBtnText: { fontWeight:'800' },
});
