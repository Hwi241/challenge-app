// screens/NotificationDefaultsScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Modal, TextInput, Alert, ScrollView, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import {
 buttonStyles,
 card as canonicalCardStyles,
 color,
 control as canonicalControlStyles,
 input as canonicalInputStyles,
 layout as canonicalLayoutStyles,
 modal as canonicalModalStyles,
 primitive,
 spacing,
 surface as canonicalSurfaceStyles,
 text as canonicalTextStyles,
} from '../styles/common';

const STORAGE_KEY = 'notification_defaults';
// defaults shape: { sound: 'system'|'silent'|'vibrate', snooze: { enabled: boolean, minutes: number } }
const PRESETS = [5, 10, 15, 30];

const normalizeDefaults = (source) => {
  const sound = ['system', 'silent', 'vibrate'].includes(source?.sound)
    ? source.sound
    : 'system';

  const rawMinutes = Number(source?.snooze?.minutes);
  const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0
    ? Math.min(240, Math.floor(rawMinutes))
    : 10;

  return {
    sound,
    snooze: {
      enabled: !!source?.snooze?.enabled,
      minutes,
    },
  };
};

const stringifyDefaults = (source) => JSON.stringify(normalizeDefaults(source));

export default function NotificationDefaultsScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState('system'); // 'system' | 'silent' | 'vibrate'
  const [snoozeEnabled, setSnoozeEnabled] = useState(false);
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState(String(snoozeMinutes));

  const originalDefaultsRef = useRef(normalizeDefaults(null));

  useEffect(()=>{
    (async()=>{
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const normalized = normalizeDefaults(parsed);
        originalDefaultsRef.current = normalized;

        setSound(normalized.sound);
        setSnoozeEnabled(normalized.snooze.enabled);
        setSnoozeMinutes(normalized.snooze.minutes);
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

  const currentDefaults = useMemo(() => ({
    sound,
    snooze: { enabled: snoozeEnabled, minutes: snoozeMinutes },
  }), [sound, snoozeEnabled, snoozeMinutes]);

  const hasUnsavedChanges = useCallback(() => {
    if (loading) return false;
    return stringifyDefaults(currentDefaults) !== stringifyDefaults(originalDefaultsRef.current);
  }, [currentDefaults, loading]);

  const { handleBackPress, markAsSaved, confirmSave } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '설정 중인 내용이 있어요',
    message: '뒤로 가면 변경한 알림 기본 설정이 저장되지 않습니다.',
    stayText: '계속 설정',
    leaveText: '나가기',
  });

  const saveAndBack = useCallback(() => {
    confirmSave({
      title: '저장하시겠습니까?',
      message: '알림 기본 설정을 저장할까요?',
      onConfirm: async () => {
        try {
          const toSave = normalizeDefaults(currentDefaults);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));

          originalDefaultsRef.current = toSave;
          markAsSaved();

          Alert.alert('저장됨', '알림 기본 설정이 저장되었습니다.', [
            { text: '확인', onPress: () => navigation.goBack() },
          ]);
        } catch (e) {
          Alert.alert('오류', '설정을 저장하지 못했습니다.');
        }
      },
    });
  }, [confirmSave, currentDefaults, markAsSaved, navigation]);

  const SoundOption = ({value, label})=>(
    <TouchableOpacity
      style={[canonicalControlStyles.radioRowCompact, sound===value && canonicalControlStyles.radioRowActive]}
      onPress={()=>setSound(value)}
      activeOpacity={0.9}
    >
      <View style={[canonicalControlStyles.radioOuterNeutral, sound===value && canonicalControlStyles.radioOuterInfoOn]}>
        {sound===value ? <View style={canonicalControlStyles.radioInnerInfo}/> : null}
      </View>
      <Text style={canonicalControlStyles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const isCustomSelected = !PRESETS.includes(snoozeMinutes);

    return (
    <SafeAreaView style={canonicalSurfaceStyles.screenMuted}>
      <BackButton title="알림 기본 설정" onPress={handleBackPress} />
      <ScrollView contentContainerStyle={canonicalLayoutStyles.screenContent}>
      

      {/* 알림음 */}
      <View style={canonicalCardStyles.base}>
        <Text style={canonicalTextStyles.sectionTitleSpaced}>알림음 선택</Text>
        <SoundOption value="system" label="시스템 기본" />
        <SoundOption value="silent" label="무음(배너만)" />
        <SoundOption value="vibrate" label="진동" />
      </View>

      {/* 스누즈 */}
      <View style={[canonicalCardStyles.base, {marginTop: spacing.lg}]}>
        <View style={canonicalLayoutStyles.rowBetween}>
          <Text style={canonicalTextStyles.sectionTitleSpaced}>스누즈</Text>
          <Switch
  value={snoozeEnabled}
  onValueChange={setSnoozeEnabled}
  trackColor={{ false: primitive.neutral[300], true: primitive.neutral[600] }}
  thumbColor={snoozeEnabled ? color.primary : primitive.white}
  ios_backgroundColor={primitive.neutral[300]}
/>
        </View>

        {snoozeEnabled && (
          <View style={canonicalControlStyles.choiceWrap}>
            {PRESETS.map(min=>(
              <TouchableOpacity
                key={min}
                style={[canonicalControlStyles.choicePill, snoozeMinutes===min && canonicalControlStyles.choicePillActive]}
                onPress={()=>setSnoozeMinutes(min)}
                activeOpacity={0.9}
              >
                <Text style={[canonicalControlStyles.choiceText, snoozeMinutes===min && canonicalControlStyles.choiceTextActive]}>{min}분</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[canonicalControlStyles.choicePill, canonicalControlStyles.choicePillOutline, isCustomSelected && canonicalControlStyles.choicePillActive]}
              onPress={onPickCustom}
              activeOpacity={0.9}
            >
              <Text style={[canonicalControlStyles.choiceText, isCustomSelected && canonicalControlStyles.choiceTextActive]}>
                {isCustomSelected ? `${snoozeMinutes}분` : '사용자 지정'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={buttonStyles.formSave.container} onPress={saveAndBack} activeOpacity={0.9}>
        <Text style={buttonStyles.formSave.label}>저장</Text>
      </TouchableOpacity>

      {/* 사용자 지정 분수 입력 모달 */}
      <Modal visible={showCustomModal} transparent animationType="fade" onRequestClose={()=>setShowCustomModal(false)}>
        <View style={canonicalModalStyles.backdrop}>
          <View style={canonicalModalStyles.sheet}>
            <Text style={canonicalModalStyles.title}>스누즈 분(1~240)</Text>
            <TextInput
              value={customInput}
              onChangeText={t=>setCustomInput((t||'').replace(/[^\d]/g,''))}
              inputMode="numeric"
              keyboardType="number-pad"
              style={canonicalInputStyles.compactStrongCentered}
              placeholder="분 단위 숫자"
              placeholderTextColor={color.textDisabled}
            />
            <View style={canonicalModalStyles.actionRow}>
              <TouchableOpacity style={[canonicalModalStyles.actionButtonCompact, canonicalModalStyles.actionGhost]} onPress={()=>setShowCustomModal(false)}>
                <Text style={canonicalModalStyles.actionGhostText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[canonicalModalStyles.actionButtonCompact, canonicalModalStyles.actionPrimary]} onPress={onConfirmCustom}>
                <Text style={canonicalModalStyles.actionPrimaryText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
          </ScrollView>
    </SafeAreaView>
  );
}
