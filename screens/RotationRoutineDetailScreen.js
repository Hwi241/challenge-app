import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import BackButton from '../components/BackButton';
import RotationRoutineRecordForm from '../components/RotationRoutineRecordForm';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import {
  deferCurrentRotationItemAndSave,
  loadRotationRoutineSnapshot,
  recordRotationTimeAndSave,
  reorderRotationCycleItemsAndSave,
  setRotationRoutinePausedAndSave,
  undoLastRotationActionAndSave,
} from '../utils/rotationRoutineStore';
import {
  loadActiveFocusSession,
  subscribeFocusSessions,
} from '../utils/focusSessionStore';
import { color, space, surface, text } from '../styles/common';

function confirm(title, message, label) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: label, onPress: () => resolve(true) },
    ], { cancelable: false });
  });
}

export default function RotationRoutineDetailScreen({ navigation, route }) {
  const routineId = String(route.params?.routineId ?? route.params?.challengeId ?? '').trim();
  const timerSessionId = String(route.params?.timerSessionId ?? '').trim();
  const timerPrefillSeconds = Math.floor(Number(route.params?.timerPrefillSeconds));
  const timerExpectedItemId = String(route.params?.timerExpectedItemId ?? '').trim();
  const timerExpectedCycleNumber = Number(route.params?.timerExpectedCycleNumber);
  const timerExpectedProgressSeconds = Number(route.params?.timerExpectedProgressSeconds);
  const [snapshot, setSnapshot] = useState(null);
  const [minutes, setMinutes] = useState('');
  const [timerDurationSeconds, setTimerDurationSeconds] = useState(null);
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderEditing, setOrderEditing] = useState(false);
  const [error, setError] = useState('');
  const [activeFocusSession, setActiveFocusSession] = useState(null);
  const flightRef = useRef(false);
  const submittedRef = useRef(false);
  const activeRef = useRef(false);
  const timerPrefillAppliedRef = useRef(false);

  const fetchSnapshot = useCallback(async () => {
    if (!routineId) throw new Error('루틴 ID가 없습니다.');
    return loadRotationRoutineSnapshot(routineId);
  }, [routineId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    activeRef.current = true;
    setLoading(true);
    fetchSnapshot()
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        if (
          !timerPrefillAppliedRef.current
          && Number.isSafeInteger(timerPrefillSeconds)
          && timerPrefillSeconds > 0
        ) {
          timerPrefillAppliedRef.current = true;
          setTimerDurationSeconds(timerPrefillSeconds);
          const displayMinutes = Math.max(0.1, Math.round(timerPrefillSeconds / 6) / 10);
          setMinutes(String(displayMinutes));
        }
        setError('');
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message ?? '루틴을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      activeRef.current = false;
    };
  }, [fetchSnapshot, timerPrefillSeconds]));

  useFocusEffect(useCallback(() => {
    let active = true;

    const refreshActiveFocusSession = () => {
      loadActiveFocusSession()
        .then((session) => {
          if (active) setActiveFocusSession(session);
        })
        .catch(() => {
          if (active) setActiveFocusSession(null);
        });
    };

    refreshActiveFocusSession();
    const unsubscribe = subscribeFocusSessions(refreshActiveFocusSession);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []));

  const hasDraft = useCallback(() => {
    if (submittedRef.current) return false;
    return [content.trim(), minutes.trim(), imageUri].some(Boolean);
  }, [content, minutes, imageUri]);
const { handleBackPress, markAsSaved } = useUnsavedChangesGuard({
    navigation,
    hasUnsavedChanges: () => orderEditing ? true : hasDraft(),
    title: '작성 중인 기록이 있어요',
    message: '뒤로 가면 작성한 내용이 저장되지 않습니다.',
    stayText: '계속 작성',
    leaveText: '나가기',
  });

  const clearDraft = () => {
    setContent('');
    setMinutes('');
    setTimerDurationSeconds(null);
    setImageUri(null);
  };

  const changeMinutes = (value) => {
    setTimerDurationSeconds(null);
    const digits = String(value).replace(/[^\d]/g, '');
    if (!digits) { setMinutes(''); return; }
    const number = Number(digits);
    setMinutes(number > 0 ? String(Math.min(number, 1440)) : '');
  };

  const chooseImage = async (camera) => {
    if (flightRef.current) return;
    if (submittedRef.current) return;
    flightRef.current = true;
    setBusy(true);
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('권한 필요', camera ? '카메라 접근 권한이 필요합니다.' : '사진 보관함 접근 권한이 필요합니다.');
        return;
      }
      const options = { allowsEditing: false, quality: 0.8, exif: false };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({
            ...options,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('오류', '사진을 가져오지 못했습니다.');
    } finally {
      flightRef.current = false;
      setBusy(false);
    }
  };

  const pickImage = () => {
    if (busy) return;
    Alert.alert('사진 추가', '방법을 선택해주세요', [
      { text: '카메라', onPress: () => chooseImage(true) },
      { text: '앨범', onPress: () => chooseImage(false) },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const record = async () => {
    if (orderEditing) return;
    if (flightRef.current) return;
    if (submittedRef.current) return;
    if (loading) return;
    if (!snapshot?.summary.currentItem) return;
    if (snapshot.summary.paused) return;
    const measuredSeconds = Number(timerDurationSeconds);
    let durationSeconds = 0;
    let durationLabel = '';
    if (Number.isSafeInteger(measuredSeconds) && measuredSeconds > 0) {
      durationSeconds = measuredSeconds;
      const wholeMinutes = Math.floor(measuredSeconds / 60);
      const remainingSeconds = measuredSeconds % 60;
      if (wholeMinutes > 0 && remainingSeconds > 0) {
        durationLabel = `${wholeMinutes}분 ${remainingSeconds}초`;
      } else if (wholeMinutes > 0) {
        durationLabel = `${wholeMinutes}분`;
      } else {
        durationLabel = `${remainingSeconds}초`;
      }
    } else {
      const value = Number(minutes);
      if (!Number.isSafeInteger(value)) {
        Alert.alert('확인', '기록할 시간을 분 단위 숫자로 입력해주세요.');
        return;
      }
      if (value < 1) {
        Alert.alert('확인', '기록할 시간을 입력해주세요.');
        return;
      }
      if (value > 1440) {
        Alert.alert('확인', '시간은 1440분 이내로 입력해주세요.');
        return;
      }
      durationSeconds = value * 60;
      durationLabel = `${value}분`;
    }
    const current = snapshot.summary.currentItem;
    const hasTimerContext = !!timerSessionId;
    const expectedItemId = hasTimerContext && timerExpectedItemId
      ? timerExpectedItemId
      : current.id;
    const expectedCycleNumber = hasTimerContext && Number.isSafeInteger(timerExpectedCycleNumber)
      ? timerExpectedCycleNumber
      : snapshot.summary.currentCycleNumber;
    const expectedProgressSeconds = hasTimerContext && Number.isSafeInteger(timerExpectedProgressSeconds)
      ? timerExpectedProgressSeconds
      : current.progressSeconds;
    if (
      hasTimerContext
      && (
        expectedItemId !== current.id
        || expectedCycleNumber !== snapshot.summary.currentCycleNumber
        || expectedProgressSeconds !== current.progressSeconds
      )
    ) {
      Alert.alert(
        '진행 상태가 변경되었습니다',
        '타이머를 시작한 뒤 현재 활동이나 진행시간이 변경되었습니다. 잘못된 활동에 시간을 기록하지 않도록 자동 기록을 중단했습니다.',
      );
      return;
    }
    flightRef.current = true;
    setBusy(true);
    try {
      const accepted = await confirm(
        '저장하시겠습니까?',
        `${current.name} 활동 ${durationLabel}을 기록할까요?`,
        '저장',
      );
      if (!accepted) return;
      if (!activeRef.current) return;
      const transition = await recordRotationTimeAndSave(routineId, durationSeconds, {
        text: content,
        imageUri,
        expectedItemId,
        expectedCycleNumber,
        expectedProgressSeconds,
      });
      submittedRef.current = true;
      markAsSaved();
      clearDraft();
      const messages = ['기록이 저장되었습니다.'];
      if (transition.result?.completedCycle) {
        messages.push(String(transition.result.nextCycleNumber - 1) + '번째 회전을 완료했습니다.');
      } else if (transition.result?.completedItem) {
        messages.push('현재 활동을 완료하고 다음 활동으로 이동했습니다.');
      }
      if (transition.result?.overflowSeconds > 0) {
        messages.push('초과 시간은 다음 활동에 더하지 않았습니다.');
      }
      Alert.alert('완료', messages.join('\n'), [{
        text: '확인',
        onPress: () => navigation.replace('EntryList', {
          challengeId: routineId,
          title: transition.routine.title,
          type: 'rotation',
          challengeType: 'rotation',
        }),
      }], { cancelable: false });
} catch (saveError) {
      if (saveError?.code === 'ROTATION_RECORD_STATE_CHANGED') {
        try {
          const next = await fetchSnapshot();
          if (activeRef.current) setSnapshot(next);
        } catch {
          if (activeRef.current) setError('최신 진행 상태를 불러오지 못했습니다. 뒤로 갔다가 다시 열어주세요.');
        }
      }
      Alert.alert('저장 실패', saveError?.message ?? '기록을 저장하지 못했습니다.');
    } finally {
      flightRef.current = false;
      if (!submittedRef.current) setBusy(false);
    }
  };

  const applyOrder = async (orderedItemIds, expected) => {
    if (flightRef.current) return false;
    if (submittedRef.current) return false;
    if (loading) return false;
    if (!snapshot) return false;
    if (!expected) return false;
    flightRef.current = true;
    setBusy(true);
    try {
      if (!activeRef.current) return false;
      const result = await reorderRotationCycleItemsAndSave(
        routineId, orderedItemIds, expected,
      );
      setSnapshot((previous) => ({
        ...previous,
        routine: result.routine,
        summary: result.summary,
      }));
      setError('');
      return true;
    } catch (orderError) {
      if (orderError?.code === 'ORDER_STATE_CHANGED') {
        try {
          const next = await fetchSnapshot();
          if (activeRef.current) setSnapshot(next);
        } catch {
          setError('최신 진행 상태를 불러오지 못했습니다. 뒤로 갔다가 다시 열어주세요.');
        }
        Alert.alert('순서 변경 안 됨', '진행 상태가 변경되어 순서를 적용하지 않았습니다. 최신 활동과 작성 내용을 확인해주세요.');
        return 'stale';
      }
      Alert.alert('순서 변경 실패', orderError?.message ?? '순서를 저장하지 못했습니다.');
      return false;
    } finally {
      flightRef.current = false;
      setBusy(false);
    }
  };

  const manage = async (kind) => {
    if (orderEditing) return;
    if (flightRef.current) return;
    if (submittedRef.current) return;
    if (loading) return;
    if (!snapshot) return;
    const discard = kind !== 'pause' && hasDraft();
    let title;
    let message;
    let task;
    if (kind === 'defer') {
      title = '뒤로 미루기';
      message = '현재 활동을 완료 처리하지 않고 이번 회전의 마지막으로 이동할까요?';
      task = () => deferCurrentRotationItemAndSave(routineId);
    } else if (kind === 'undo') {
      title = '마지막 작업 취소';
      message = '마지막 시간 기록 또는 미루기를 되돌릴까요?';
      task = () => undoLastRotationActionAndSave(routineId);
    } else {
      title = snapshot.summary.paused ? '루틴 다시 시작' : '루틴 일시정지';
      message = title + '할까요?';
      task = () => setRotationRoutinePausedAndSave(routineId, !snapshot.summary.paused);
    }
    if (discard) message += '\n작성 중인 내용·사진·시간은 지워집니다.';
    flightRef.current = true;
    setBusy(true);
    try {
      if (!await confirm(title, message, '확인')) return;
      if (!activeRef.current) return;
      const result = await task();
      setSnapshot((previous) => ({
        ...previous,
        routine: result.routine,
        summary: result.summary,
      }));
      if (discard) clearDraft();
      setError('');
    } catch (mutationError) {
      Alert.alert('처리 실패', mutationError?.message ?? '요청을 처리하지 못했습니다.');
    } finally {
      flightRef.current = false;
      setBusy(false);
    }
  };

  if (!snapshot) {
    return (
      <SafeAreaView style={surface.screen}>
        <BackButton title="기록" onPress={handleBackPress} />
        <View style={styles.center}>
          {loading
            ? <ActivityIndicator color={color.primary} />
            : <Text style={text.bodyMuted}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const currentRotationItemId = snapshot?.summary.currentItem?.id ?? null;

  const currentTimerActive = Boolean(
    currentRotationItemId
    && activeFocusSession
    && activeFocusSession.targetSubtype === 'rotation'
    && String(activeFocusSession.targetId ?? '') === routineId
    && String(activeFocusSession.rotationItemId ?? '') === String(currentRotationItemId)
  );

  return (
    <SafeAreaView style={surface.screen}>
      <BackButton title={snapshot.routine.title} onPress={handleBackPress} />
      <RotationRoutineRecordForm
        summary={snapshot.summary}
        minutes={minutes}
        content={content}
        imageUri={imageUri}
        error={error}
        busy={busy ? true : loading}
        currentTimerActive={currentTimerActive}
        onMinutesChange={changeMinutes}
        onContentChange={setContent}
        onPickImage={pickImage}
        onRemoveImage={() => setImageUri(null)}
        onRecord={record}
        orderEditing={orderEditing}
        onOrderEditingChange={setOrderEditing}
        onApplyOrder={applyOrder}
        onUndo={() => manage('undo')}
        onTogglePaused={() => manage('pause')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
});
