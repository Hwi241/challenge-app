import { SafeAreaView } from 'react-native-safe-area-context';
// screens/EntryDetailScreen.js
// - 업로드 화면과 동일한 UX 적용
// - 사진 선택(추가/변경), 미리보기 우상단 X로 삭제
// - 텍스트 라벨 제거, 자동 높이 확장 + 500자 제한(표시 X)
// - 소요시간 숫자만, 최대 1440(표시 X), 비워도 저장 시 0
// - 저장/삭제 중 중복 탭 방지(busy)

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { buttonStyles, spacing, radius, colors } from '../styles/common';
import { numericInputProps, toNumberOrZero } from '../utils/number';
import BackButton from '../components/BackButton';
import { syncWidgetChallengeList } from '../utils/widgetSync';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { getAppSettings } from '../utils/appSettings';
import { deleteCalendarRecordEvent, updateCalendarRecordEvent } from '../utils/calendarRecord';

const MAX_TEXT_LEN = 500;
const MAX_MINUTES = 1440;

function stripCalendarRecordMetadata(entry = {}) {
  const {
    calendarEventId,
    calendarRecordedAt,
    calendarRecordCalendarId,
    calendarRecordCalendarTitle,
    ...rest
  } = entry || {};

  return rest;
}

export default function EntryDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { challengeId, entryId, title: routeTitle } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const originalRef = useRef({ text: "", duration: "", imageUri: null });

  const [text, setText] = useState('');
  const [textHeight, setTextHeight] = useState(120);
  const [duration, setDuration] = useState(''); // 빈 문자열 허용
  const [imageUri, setImageUri] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [challengeTitle, setChallengeTitle] = useState(routeTitle || '');

  // 로드
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!challengeId || !entryId) {
          Alert.alert('오류', '인증 정보를 찾을 수 없습니다.', [
            { text: '확인', onPress: () => navigation.goBack() },
          ]);
          return;
        }
        const challengeRaw = await AsyncStorage.getItem('challenges');
    const challenges = challengeRaw ? JSON.parse(challengeRaw) : [];
    const foundChallenge = Array.isArray(challenges)
      ? challenges.find(c => String(c.id) === String(challengeId))
      : null;
    setChallengeTitle(foundChallenge?.title || routeTitle || '');

    const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
        const list = raw ? JSON.parse(raw) : [];
        const found = list.find(e => e.id === entryId);
        if (!found) {
          Alert.alert('오류', '인증 항목이 존재하지 않습니다.', [
            { text: '확인', onPress: () => navigation.goBack() },
          ]);
          return;
        }
        if (!mounted) return;

        const loadedText = String(found.text || '');
      const loadedDuration = typeof found.duration === 'number' && found.duration > 0 ? String(found.duration) : '';
      const loadedImageUri = found.imageUri || null;
      setText(loadedText);
      setDuration(loadedDuration);
      setImageUri(loadedImageUri);
      setTimestamp(found.timestamp || Date.now());
      originalRef.current = { text: loadedText, duration: loadedDuration, imageUri: loadedImageUri };
      } catch (e) {
        console.error(e);
        Alert.alert('오류', '인증 정보를 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [challengeId, entryId, navigation]);

  const hasUnsavedChanges = useCallback(() => {
    const orig = originalRef.current;
    if (!orig) return false;

    const durChanged = (duration || '') !== (orig.duration || '');
    const imgChanged = (imageUri || null) !== (orig.imageUri || null);
    const textChanged = text.trim() !== orig.text.trim();

    return textChanged || durChanged || imgChanged;
  }, [text, duration, imageUri]);

  const { handleBackPress, markAsSaved } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges,
    title: '수정 중인 내용이 있어요',
    message: '뒤로 가면 수정한 내용이 저장되지 않습니다.',
    stayText: '계속 수정',
    leaveText: '나가기',
  });

  // 사진 선택(추가/교체)
  const onPickImage = useCallback(async () => {
    if (busy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('권한 필요', '사진 보관함 접근 권한이 필요합니다.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (asset?.uri) setImageUri(asset.uri);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '사진 선택 중 문제가 발생했습니다.');
    }
  }, [busy]);

  // 사진 삭제(오버레이 X 즉시 삭제)
  const onRemoveImage = useCallback(() => {
    if (busy) return;
    setImageUri(null);
  }, [busy]);

  // 소요시간 입력: 숫자만, 1~1440로 입력 단계에서 클램프(빈 문자열 허용)
  const handleDurationChange = useCallback((txt) => {
    const digits = (txt || '').replace(/[^\d]/g, '');
    if (!digits) { setDuration(''); return; }
    let n = parseInt(digits, 10);
    if (isNaN(n) || n <= 0) { setDuration(''); return; }
    if (n > MAX_MINUTES) n = MAX_MINUTES;
    setDuration(String(n));
  }, []);

  const onSave = useCallback(() => {
    if (busy) return;

    const saveEditedEntry = async ({ updateCalendar = false } = {}) => {
      setBusy(true);

      try {
        if (!challengeId || !entryId) return;

        const rawDur = toNumberOrZero(duration);
        const finalDur = duration ? Math.min(Math.max(rawDur, 1), MAX_MINUTES) : 0;

        const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
        const list = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(e => e.id === entryId);

        if (idx < 0) {
          Alert.alert('오류', '인증 항목이 존재하지 않습니다.');
          return;
        }

        const originalEntry = list[idx] || {};
        const updated = {
          ...originalEntry,
          text: (text || '').trim(),
          imageUri: imageUri || null,
          duration: finalDur,
          timestamp: timestamp || originalEntry.timestamp || Date.now(),
        };

        list[idx] = updated;
        await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(list));
        markAsSaved();

        if (updateCalendar && originalEntry?.calendarEventId) {
          let calendarUpdateResult = null;

          try {
            const latestSettings = await getAppSettings();
            const calendarRecord = latestSettings?.dataIntegrations?.calendarRecord || {};

            calendarUpdateResult = await updateCalendarRecordEvent({
              calendarRecord,
              calendarEventId: originalEntry.calendarEventId,
              challengeTitle: challengeTitle || routeTitle || '도전',
              entry: updated,
              entryDate: new Date(updated.timestamp || Date.now()),
              linkedRecords: updated.linkedRecords || [],
              draft: null,
            });
          } catch (calendarError) {
            calendarUpdateResult = {
              ok: false,
              error: calendarError?.message || '캘린더 일정 수정 중 오류가 발생했습니다.',
            };
          }

          if (calendarUpdateResult?.ok) {
            Alert.alert('완료', '인증과 캘린더 일정이 수정되었습니다.', [
              { text: '확인', onPress: () => navigation.goBack() },
            ]);
            return;
          }

          if (calendarUpdateResult?.shouldClearCalendarRecord) {
            const clearedEntry = stripCalendarRecordMetadata(updated);
            list[idx] = clearedEntry;
            await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(list));
          }

          const reason = calendarUpdateResult?.error || '알 수 없는 오류';
          Alert.alert(
            '인증 수정 완료',
            `인증은 수정되었습니다.\n다만 캘린더 일정은 수정하지 못했습니다.\n\n원인: ${reason}`,
            [{ text: '확인', onPress: () => navigation.goBack() }]
          );
          return;
        }

        Alert.alert('완료', '인증이 수정되었습니다.', [
          { text: '확인', onPress: () => navigation.goBack() },
        ]);
      } catch (e) {
        console.error(e);
        Alert.alert('오류', '인증을 저장하지 못했습니다.');
      } finally {
        setBusy(false);
      }
    };

    Alert.alert(
      '저장하시겠습니까?',
      '이 인증 수정을 저장할까요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '저장',
          onPress: async () => {
            try {
              if (!challengeId || !entryId) return;

              const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
              const list = raw ? JSON.parse(raw) : [];
              const idx = list.findIndex(e => e.id === entryId);

              if (idx < 0) {
                Alert.alert('오류', '인증 항목이 존재하지 않습니다.');
                return;
              }

              const originalEntry = list[idx] || {};

              if (originalEntry?.calendarEventId) {
                Alert.alert(
                  '캘린더에 기록된 인증',
                  '이 인증은 캘린더에도 기록되어 있습니다.\n수정 내용을 캘린더 일정에도 반영할까요?',
                  [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '인증만 수정',
                      onPress: () => saveEditedEntry({ updateCalendar: false }),
                    },
                    {
                      text: '인증+캘린더 수정',
                      onPress: () => saveEditedEntry({ updateCalendar: true }),
                    },
                  ]
                );
                return;
              }

              await saveEditedEntry({ updateCalendar: false });
            } catch (e) {
              console.error(e);
              Alert.alert('오류', '인증 정보를 확인하지 못했습니다.');
            }
          },
        },
      ]
    );
  }, [
    busy,
    challengeId,
    entryId,
    duration,
    imageUri,
    navigation,
    text,
    timestamp,
    markAsSaved,
    challengeTitle,
    routeTitle,
  ]);

  const onDelete = useCallback(() => {
    if (busy) return;

    const deleteEditedEntry = async ({ deleteCalendar = false } = {}) => {
      setBusy(true);
      try {
        const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
        const list = raw ? JSON.parse(raw) : [];
        const originalEntry = list.find(e => e.id === entryId) || null;
        const next = list.filter(e => e.id !== entryId);

        await AsyncStorage.setItem(`entries_${challengeId}`, JSON.stringify(next));

        const challRaw = await AsyncStorage.getItem('challenges');
        const challenges = challRaw ? JSON.parse(challRaw) : [];
        const idx = challenges.findIndex((c) => c.id === challengeId);

        if (idx >= 0) {
          challenges[idx] = { ...challenges[idx], currentScore: next.length };
          await AsyncStorage.setItem('challenges', JSON.stringify(challenges));
          await AsyncStorage.setItem(`challenge_${challengeId}`, JSON.stringify(challenges[idx]));
          await syncWidgetChallengeList();
        }

        markAsSaved();

        if (deleteCalendar && originalEntry?.calendarEventId) {
          let calendarDeleteResult = null;

          try {
            const latestSettings = await getAppSettings();
            const calendarRecord = latestSettings?.dataIntegrations?.calendarRecord || {};

            calendarDeleteResult = await deleteCalendarRecordEvent({
              calendarRecord,
              calendarEventId: originalEntry.calendarEventId,
              entry: originalEntry,
              entryDate: new Date(originalEntry.timestamp || Date.now()),
            });
          } catch (calendarError) {
            calendarDeleteResult = {
              ok: false,
              error: calendarError?.message || '캘린더 일정 삭제 중 오류가 발생했습니다.',
            };
          }

          if (calendarDeleteResult?.ok) {
            const message = calendarDeleteResult?.alreadyMissing
              ? '인증이 삭제되었습니다.\n캘린더 일정은 이미 삭제된 상태였습니다.'
              : '인증과 캘린더 일정이 삭제되었습니다.';

            Alert.alert('삭제됨', message, [
              { text: '확인', onPress: () => navigation.goBack() },
            ]);
            return;
          }

          const reason = calendarDeleteResult?.error || '알 수 없는 오류';
          Alert.alert(
            '삭제 완료',
            `인증은 삭제되었습니다.\n다만 캘린더 일정은 삭제하지 못했습니다.\n\n원인: ${reason}`,
            [{ text: '확인', onPress: () => navigation.goBack() }]
          );
          return;
        }

        Alert.alert('삭제됨', '인증이 삭제되었습니다.', [
          { text: '확인', onPress: () => navigation.goBack() },
        ]);
      } catch (e) {
        console.error(e);
        Alert.alert('오류', '인증을 삭제하지 못했습니다.');
      } finally {
        setBusy(false);
      }
    };

    Alert.alert('삭제 확인', '이 인증을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
            const list = raw ? JSON.parse(raw) : [];
            const originalEntry = list.find(e => e.id === entryId) || null;

            if (originalEntry?.calendarEventId) {
              Alert.alert(
                '캘린더에 기록된 인증',
                '이 인증은 캘린더에도 기록되어 있습니다.\n캘린더 일정도 함께 삭제할까요?',
                [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '인증만 삭제',
                    style: 'destructive',
                    onPress: () => deleteEditedEntry({ deleteCalendar: false }),
                  },
                  {
                    text: '인증+캘린더 삭제',
                    style: 'destructive',
                    onPress: () => deleteEditedEntry({ deleteCalendar: true }),
                  },
                ]
              );
              return;
            }

            await deleteEditedEntry({ deleteCalendar: false });
          } catch (e) {
            console.error(e);
            Alert.alert('오류', '인증 정보를 확인하지 못했습니다.');
          }
        },
      },
    ]);
  }, [busy, challengeId, entryId, navigation, markAsSaved]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <BackButton title="인증 수정" onPress={handleBackPress} />
        <Text style={{ color: colors.textSecondary }}>불러오는 중…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton title="기록 수정" onPress={handleBackPress} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {!!challengeTitle && (
          <View style={styles.titleBox}>
            <Text style={styles.titleBoxText}>{challengeTitle}</Text>
          </View>
        )}

        <View style={styles.card}>
          {/* "내용" + "사진 선택"을 한 줄로 */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>내용</Text>
            <TouchableOpacity
              style={[buttonStyles.compactRight, { opacity: busy ? 0.6 : 1 }]}
              onPress={onPickImage}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={buttonStyles.compactRightText}>사진 선택</Text>
            </TouchableOpacity>
          </View>

          {/* 미리보기 + 우상단 X 삭제 */}
          {!!imageUri && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity
                accessibilityLabel="사진 삭제"
                onPress={onRemoveImage}
                activeOpacity={0.8}
                disabled={busy}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={styles.previewDeleteBtn}
              >
                <Text allowFontScaling={false} style={styles.previewDeleteX}>×</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 텍스트 라벨 제거, 자동 높이 + 500자 제한 */}
          <TextInput
            value={text}
            onChangeText={(t) => setText((t || '').slice(0, MAX_TEXT_LEN))}
            placeholder="인증 내용을 입력하세요"
            style={[styles.input, { height: textHeight, textAlignVertical: 'top' }]}
            multiline
            editable={!busy}
            placeholderTextColor={colors.gray400}
            maxLength={MAX_TEXT_LEN}
            onContentSizeChange={e => {
              const h = e?.nativeEvent?.contentSize?.height || 0;
              const minH = 120;
              const maxH = 240;
              if (h > 0) setTextHeight(Math.max(minH, Math.min(h, maxH)));
            }}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>소요 시간(분)</Text>
          <TextInput
            value={duration}
            onChangeText={handleDurationChange}
            placeholder="숫자만 입력"
            style={styles.input}
            placeholderTextColor={colors.gray400}
            editable={!busy}
            {...numericInputProps}
          />
        </View>

        {/* 저장 / 삭제 버튼 */}
        <TouchableOpacity
          style={[buttonStyles.primary.container, { marginTop: spacing.xl, opacity: busy ? 0.6 : 1 }]}
          onPress={onSave}
          activeOpacity={0.9}
          disabled={busy}
        >
          <Text style={buttonStyles.primary.label}>저장</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[buttonStyles.outlineSoft.container, { marginTop: spacing.md, opacity: busy ? 0.6 : 1 }]}
          onPress={onDelete}
          activeOpacity={0.9}
          disabled={busy}
        >
          <Text style={buttonStyles.outlineSoft.label}>삭제</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
 container: { flex: 1, backgroundColor: colors.background },

 screenTitle: {
 fontSize: 20,
 fontWeight: '800',
 color: colors.textPrimary,
 marginBottom: spacing.lg,
 textAlign: 'center',
 },

 titleBox: {
 backgroundColor: colors.surface,
 borderWidth: 1,
 borderColor: colors.border,
 borderRadius: radius.md,
 paddingVertical: spacing.md,
 paddingHorizontal: spacing.lg,
 marginBottom: spacing.lg,
 },
 titleBoxText: {
 fontSize: 15,
 fontWeight: '700',
 color: colors.textPrimary,
 textAlign: 'center',
 },

 card: {
 backgroundColor: colors.surface,
 borderWidth: 1,
 borderColor: colors.border,
 borderRadius: radius.card,
 paddingHorizontal: spacing.lg,
 paddingVertical: spacing.md,
 },

 cardHeaderRow: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 marginBottom: spacing.sm,
 },

 cardTitle: {
 fontSize: 16,
 fontWeight: '800',
 color: colors.textPrimary,
 },

 label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },

 input: {
 backgroundColor: colors.surface,
 borderWidth: 1,
 borderColor: colors.border,
 borderRadius: radius.md,
 paddingHorizontal: 12,
 paddingVertical: 10,
 fontSize: 14,
 color: colors.textPrimary,
 },

 previewWrap: {
 position: 'relative',
 marginBottom: spacing.md,
 },
 preview: {
 width: '100%',
 height: 200,
 borderRadius: radius.md,
 backgroundColor: colors.surfaceMuted,
 },
 previewDeleteBtn: {
 position: 'absolute',
 top: 8,
 right: 8,
 width: 28,
 height: 28,
 borderRadius: 14,
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: colors.imageDeleteOverlay,
 },
 previewDeleteX: {
 fontSize: 18,
 lineHeight: 18,
 color: colors.black,
 fontWeight: '900',
 includeFontPadding: false,
 },
});
