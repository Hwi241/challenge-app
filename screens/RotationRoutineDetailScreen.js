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
  const [snapshot, setSnapshot] = useState(null);
  const [minutes, setMinutes] = useState('');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderEditing, setOrderEditing] = useState(false);
  const [error, setError] = useState('');
  const flightRef = useRef(false);
  const submittedRef = useRef(false);
  const activeRef = useRef(false);

  const fetchSnapshot = useCallback(async () => {
    if (!routineId) throw new Error('순환 루틴 ID가 없습니다.');
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
        setError('');
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message ?? '순환 루틴을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      activeRef.current = false;
    };
  }, [fetchSnapshot]));

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
    setImageUri(null);
  };

  const changeMinutes = (value) => {
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
    const current = snapshot.summary.currentItem;
    flightRef.current = true;
    setBusy(true);
    try {
      const accepted = await confirm(
        '저장하시겠습니까?',
        current.name + ' 활동 ' + value + '분을 기록할까요?',
        '저장',
      );
      if (!accepted) return;
      if (!activeRef.current) return;
      const transition = await recordRotationTimeAndSave(routineId, value * 60, {
        text: content,
        imageUri,
        expectedItemId: current.id,
        expectedCycleNumber: snapshot.summary.currentCycleNumber,
        expectedProgressSeconds: current.progressSeconds,
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
    const changesCurrent = orderedItemIds[0] !== snapshot.summary.currentItem?.id;
    const discard = changesCurrent && hasDraft();
    flightRef.current = true;
    setBusy(true);
    try {
      if (discard) {
        const accepted = await confirm(
          '현재 활동 변경',
          '현재 활동이 바뀝니다. 작성 중인 내용·사진·시간을 비우고 순서를 적용할까요?',
          '비우고 적용',
        );
        if (!accepted) return false;
      }
      if (!activeRef.current) return false;
      const result = await reorderRotationCycleItemsAndSave(
        routineId, orderedItemIds, expected,
      );
      setSnapshot((previous) => ({
        ...previous,
        routine: result.routine,
        summary: result.summary,
      }));
      if (discard) clearDraft();
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
