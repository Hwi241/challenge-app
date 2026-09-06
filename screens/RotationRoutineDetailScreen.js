import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import RotationRoutineDetailView from '../components/RotationRoutineDetailView';
import {
  deferCurrentRotationItemAndSave,
  loadRotationRoutineSnapshot,
  recordRotationTimeAndSave,
  setRotationRoutinePausedAndSave,
  undoLastRotationActionAndSave,
} from '../utils/rotationRoutineStore';
import { color, space, surface, text } from '../styles/common';

export default function RotationRoutineDetailScreen({ navigation, route }) {
  const routineId = String(route.params?.routineId ?? route.params?.challengeId ?? '').trim();
  const [snapshot, setSnapshot] = useState(null);
  const [minutes, setMinutes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchSnapshot = useCallback(async () => {
    if (!routineId) throw new Error('순환 루틴 ID가 없습니다.');
    return loadRotationRoutineSnapshot(routineId);
  }, [routineId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    fetchSnapshot()
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setError('');
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || '순환 루틴을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchSnapshot]));

  const mutate = async (task) => {
    if (busy) return null;
    setBusy(true);
    try {
      const result = await task();
      const next = await fetchSnapshot();
      setSnapshot(next);
      setError('');
      return result;
    } catch (mutationError) {
      Alert.alert('처리 실패', mutationError?.message || '요청을 처리하지 못했습니다.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const record = async () => {
    const durationMinutes = Number(minutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      Alert.alert('확인', '기록할 시간을 입력해주세요.');
      return;
    }
    const transition = await mutate(() => recordRotationTimeAndSave(routineId, durationMinutes * 60));
    if (!transition) return;
    setMinutes('');

    const messages = [];
    if (transition.result?.completedCycle) {
      messages.push(String(transition.result.nextCycleNumber - 1) + '번째 회전을 완료했습니다.');
    } else if (transition.result?.completedItem) {
      messages.push('현재 활동을 완료하고 다음 활동으로 이동했습니다.');
    }
    if (transition.result?.overflowSeconds > 0) {
      messages.push('초과한 ' + String(Math.round(transition.result.overflowSeconds / 60)) + '분은 다음 활동에 더하지 않았습니다.');
    }
    if (messages.length) Alert.alert('기록 완료', messages.join('\n'));
  };

  const defer = () => Alert.alert(
    '뒤로 미루기',
    '현재 활동을 완료 처리하지 않고 이번 회전의 마지막으로 이동할까요?',
    [
      { text: '취소', style: 'cancel' },
      { text: '미루기', onPress: () => mutate(() => deferCurrentRotationItemAndSave(routineId)) },
    ]
  );

  const undo = () => Alert.alert(
    '마지막 작업 취소',
    '마지막 시간 기록 또는 미루기를 되돌릴까요?',
    [
      { text: '취소', style: 'cancel' },
      { text: '되돌리기', onPress: () => mutate(() => undoLastRotationActionAndSave(routineId)) },
    ]
  );

  const togglePaused = () => mutate(() => setRotationRoutinePausedAndSave(
    routineId,
    !snapshot.summary.paused
  ));

  if (loading && !snapshot) {
    return (
      <SafeAreaView style={surface.screen}>
        <BackButton title="순환 루틴" />
        <View style={styles.center}><ActivityIndicator color={color.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!snapshot) {
    return (
      <SafeAreaView style={surface.screen}>
        <BackButton title="순환 루틴" />
        <View style={styles.center}>
          <Text style={text.bodyMuted}>{error || '순환 루틴을 불러오지 못했습니다.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={surface.screen}>
      <BackButton title={snapshot.routine.title} />
      <RotationRoutineDetailView
        summary={snapshot.summary}
        minutes={minutes}
        busy={busy}
        onMinutesChange={setMinutes}
        onRecord={record}
        onDefer={defer}
        onUndo={undo}
        onTogglePaused={togglePaused}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
});
