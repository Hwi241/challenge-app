import React, { useState } from 'react';

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import {
  color,
  font,
  primitive,
  radius,
  space,
  surface as surfaceStyles,
} from '../styles/common';

import { createTogetherRoomDraftV2 } from '../utils/togetherRoomDrafts';
import { getTogetherLocalDateKey } from '../utils/togetherLocalData';

const UNIT_OPTIONS = [
  { value: 'custom', label: '직접 입력' },
  { value: '회', label: '횟수 (회)' },
  { value: 'km', label: '킬로미터 (km)' },
  { value: 'm', label: '미터 (m)' },
  { value: '시간', label: '시간' },
  { value: '분', label: '분' },
  { value: '초', label: '초' },
  { value: '개', label: '개수 (개)' },
  { value: '페이지', label: '페이지' },
  { value: 'kg', label: '킬로그램 (kg)' },
  { value: '원', label: '원' },
  { value: '일', label: '일수 (일)' },
];

const dateKey = () => getTogetherLocalDateKey();

const formatLocalDate = (value) => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value) => {
  const text = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return formatLocalDate(date) === text ? date : null;
};

export default function TogetherSharedGoalCreateScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');

  // 기본 선택은 횟수.
  // 드롭다운의 첫 번째 항목은 직접 입력.
  const [unitChoice, setUnitChoice] = useState('회');
  const [customUnit, setCustomUnit] = useState('');
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  const [showEndPicker, setShowEndPicker] = useState(false);

  const selectedLabel = UNIT_OPTIONS.find(
    (item) => item.value === unitChoice
  )?.label || '횟수 (회)';

  const unit = unitChoice === 'custom'
    ? customUnit.trim()
    : unitChoice;

  const submit = async () => {
    const name = title.trim();
    const amount = Number(target);
    const selectedUnit = unit.trim();
    const endDate = endsAt.trim();
    const startDate = dateKey();
    if (!name) { Alert.alert('공동 목표 확인', '공동 PUSH 이름을 입력해주세요.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { Alert.alert('공동 목표 확인', '0보다 큰 목표량을 입력해주세요.'); return; }
    if (!selectedUnit || selectedUnit.length > 16) { Alert.alert('공동 목표 확인', '1~16자의 목표 단위를 입력해주세요.'); return; }
    if (endDate) {
      const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(endDate);
      const parsed = validFormat ? new Date(`${endDate}T00:00:00Z`) : null;
      const validDate = parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === endDate;
      if (!validDate || endDate < startDate) { Alert.alert('공동 목표 확인', '종료일은 오늘 이후의 올바른 날짜여야 합니다.'); return; }
    }

    const sharedGoal = {
      source: 'room_contributions_v1', target: amount, unit: selectedUnit,
      startsAt: startDate, endsAt: endDate || null,
    };

    try {
      const draft = await createTogetherRoomDraftV2({ mode: 'shared_goal', title: name, card: null, sharedGoal });
      navigation.replace('TogetherInviteDraft', { draft, draftId: draft.id });
    } catch (error) {
      console.warn('[TogetherSharedGoalCreate] draft failed', String(error?.message || 'unknown'));
      Alert.alert('공동 PUSH 생성 실패', '초대 준비 정보를 저장하지 못했어요.');
    }
  };

  return (
    <SafeAreaView style={surfaceStyles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>공동 목표 설정</Text>
        <View style={styles.side} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <Text style={styles.label}>공동 목표명</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />

        <Text style={styles.label}>목표량</Text>
        <TextInput
          style={styles.input}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="예: 100"
        />

        <Text style={styles.label}>목표 단위</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setUnitMenuOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={`목표 단위 ${selectedLabel}`}
          accessibilityState={{ expanded: unitMenuOpen }}
          activeOpacity={0.8}
        >
          <Text style={styles.dropdownValue}>{selectedLabel}</Text>
          <Text style={styles.chevron}>
            {unitMenuOpen ? '⌃' : '⌄'}
          </Text>
        </TouchableOpacity>

        {unitMenuOpen ? (
          <ScrollView
            style={styles.dropdownMenu}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {UNIT_OPTIONS.map((option) => {
              const selected = unitChoice === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    selected && styles.selectedItem,
                  ]}
                  onPress={() => {
                    setUnitChoice(option.value);
                    setUnitMenuOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selected && styles.selectedItemText,
                    ]}
                  >
                    {option.label}
                  </Text>

                  {selected ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {unitChoice === 'custom' ? (
          <View>
            <Text style={styles.label}>사용자 지정 단위</Text>
            <TextInput
              style={styles.input}
              value={customUnit}
              onChangeText={setCustomUnit}
              placeholder="예: 문제, 잔, 장"
              maxLength={16}
              autoCorrect={false}
            />
          </View>
        ) : null}

        <Text style={styles.label}>종료일 (선택)</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowEndPicker(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="공동 PUSH 종료일 선택"
        >
          <Text style={[styles.dateButtonText, !endsAt && styles.dateButtonPlaceholder]}>
            {endsAt || '날짜 선택'}
          </Text>
        </TouchableOpacity>
        {endsAt ? (
          <TouchableOpacity
            style={styles.dateClearButton}
            onPress={() => setEndsAt('')}
            accessibilityRole="button"
            accessibilityLabel="종료일 선택 해제"
          >
            <Text style={styles.dateClearText}>선택 해제</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.button}
          onPress={submit}
          activeOpacity={0.84}
        >
          <Text style={styles.buttonText}>초대 준비하기</Text>
        </TouchableOpacity>
      </ScrollView>
      <DateTimePickerModal
        isVisible={showEndPicker}
        mode="date"
        date={parseLocalDate(endsAt) || new Date()}
        minimumDate={new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}
        onConfirm={(date) => {
          setShowEndPicker(false);
          const value = formatLocalDate(date);
          if (value) setEndsAt(value);
        }}
        onCancel={() => setShowEndPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderColor: color.border,
  },
  back: { fontSize: 34, color: color.textPrimary },
  headerTitle: { fontSize: 16, fontWeight: font.weight.heavy },
  side: { width: 24 },
  content: { padding: space.lg, paddingBottom: 80 },
  label: {
    marginTop: 16,
    marginBottom: 7,
    color: color.textSecondary,
    fontSize: 12,
    fontWeight: font.weight.bold,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    color: color.textPrimary,
  },
  dropdown: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  dropdownValue: { flex: 1, color: color.textPrimary, fontSize: 14 },
  chevron: { marginLeft: 12, color: color.textSecondary, fontSize: 22 },
  dropdownMenu: {
    maxHeight: 240,
    marginTop: 4,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  dropdownItem: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedItem: { backgroundColor: primitive.neutral[100] },
  dropdownItemText: { color: color.textPrimary, fontSize: 14 },
  selectedItemText: { fontWeight: font.weight.bold },
  check: {
    color: color.textPrimary,
    fontSize: 16,
    fontWeight: font.weight.bold,
  },
  dateButton: {
    minHeight: 48, borderWidth: 1, borderColor: color.border, borderRadius: radius.md,
    backgroundColor: color.surface, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
  },
  dateButtonText: { color: color.textPrimary, fontSize: 14, fontWeight: font.weight.bold },
  dateButtonPlaceholder: { color: color.textTertiary, fontWeight: font.weight.regular },
  dateClearButton: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
  dateClearText: { color: color.textSecondary, fontSize: 12 },
  button: {
    marginTop: 28,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: color.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: color.background, fontWeight: font.weight.bold },
});
