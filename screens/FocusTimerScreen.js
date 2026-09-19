import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, AppState, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import BackButton from '../components/BackButton';
import {
  cancelFocusSession,
  finishFocusSession,
  formatFocusSessionTime,
  getFocusSessionDisplaySeconds,
  getFocusSessionElapsedSeconds,
  loadActiveFocusSession,
  loadFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  setFocusSessionAlarmEnabled,
} from '../utils/focusSessionStore';
import { color, primitive, radius, space, surface, text } from '../styles/common';

const RING_SIZE = 270;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

function formatKoreanDuration(seconds) {
  const total = Math.max(
    0,
    Math.floor(Number(seconds) || 0),
  );
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds}초`);
  }
  return parts.join(' ');
}

function TimerRing({ session, elapsedSeconds, displaySeconds }) {
  const countdown = session?.mode === 'countdown';
  const overtime = countdown && displaySeconds < 0;
  const targetSeconds = Math.max(1, Number(session?.targetSeconds) || 1);
  const progress = countdown
    ? clamp01(elapsedSeconds / targetSeconds)
    : (Math.max(0, elapsedSeconds) % 3600) / 3600;
  const stopwatchHourCycle = !countdown
    ? Math.floor(Math.max(0, elapsedSeconds) / 3600) + 1
    : null;
  const dashOffset = RING_CIRCUMFERENCE * (1 - (overtime ? 1 : progress));
  const activeColor = overtime ? color.danger : color.primary;
  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={color.border} strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={activeColor}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={[RING_CIRCUMFERENCE, RING_CIRCUMFERENCE]}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.timeLabel, overtime && styles.overtimeText]}>
          {countdown ? overtime ? '초과 시간' : '남은 시간' : '경과 시간'}
        </Text>
        <Text style={[styles.clock, overtime && styles.overtimeText]}>
          {formatFocusSessionTime(displaySeconds)}
        </Text>
        {overtime && <Text style={styles.overtimeStatus}>설정 시간을 넘겨 진행 중</Text>}
        {!countdown && stopwatchHourCycle > 1 && (
          <Text style={styles.stopwatchCycle}>{stopwatchHourCycle}시간째</Text>
        )}
      </View>
    </View>
  );
}

export default function FocusTimerScreen({ navigation, route }) {
  const requestedId = String(route.params?.sessionId ?? '');
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [alarmBusy, setAlarmBusy] = useState(false);
  const reload = useCallback(async () => {
    const loaded = requestedId
      ? await loadFocusSession(requestedId)
      : await loadActiveFocusSession();
    setSession(loaded);
    setNow(Date.now());
  }, [requestedId]);

  useEffect(() => {
    reload().catch((error) => Alert.alert('불러오기 실패', error?.message || '타이머를 불러오지 못했습니다.'));
  }, [reload]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload().catch(() => {});
    });
    return () => { clearInterval(timer); appState.remove(); };
  }, [reload]);

  const elapsedSeconds = session ? getFocusSessionElapsedSeconds(session, now) : 0;
  const displaySeconds = session ? getFocusSessionDisplaySeconds(session, now) : 0;
  const overtime = session?.mode === 'countdown' && displaySeconds < 0;

  const togglePause = async () => {
    if (!session || busy || session.status === 'completed') return;
    setBusy(true);
    try {
      const next = session.status === 'paused'
        ? await resumeFocusSession(session.id)
        : await pauseFocusSession(session.id);
      setSession(next);
      setNow(Date.now());
    } catch (error) {
      Alert.alert('처리 실패', error?.message || '타이머 상태를 변경하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const cancelTimer = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      await cancelFocusSession(session.id);
      navigation.goBack();
    } catch (error) {
      Alert.alert('취소 실패', error?.message || '타이머를 취소하지 못했습니다.');
      setBusy(false);
    }
  };
  const confirmCancel = () => {
    if (!session || busy) return;
    Alert.alert('타이머 취소', '측정 중인 시간을 버리고 타이머를 취소할까요?', [
      { text: '계속하기', style: 'cancel' },
      { text: '취소하기', style: 'destructive', onPress: cancelTimer },
    ]);
  };

  const performComplete = async () => {
    if (!session || busy || session.status === 'completed') return;
    setBusy(true);
    try {
      const completed = await finishFocusSession(session.id);
      const measuredSeconds = Math.max(0, Number(completed.elapsedSeconds) || 0);
      setSession(completed);
      setNow(Number(completed.endedAt) || Date.now());
      if (completed.targetSubtype === 'rotation') {
        navigation.replace('RotationRoutineDetail', {
          routineId: completed.targetId,
          timerSessionId: completed.id,
          timerPrefillSeconds: measuredSeconds,
          timerExpectedItemId: completed.rotationItemId ?? null,
          timerExpectedCycleNumber: completed.rotationCycleNumber ?? null,
          timerExpectedProgressSeconds: completed.rotationStartProgressSeconds ?? null,
        });
        return;
      }
      navigation.replace('Upload', {
        challengeId: completed.targetId,
        timerSessionId: completed.id,
        timerPrefillSeconds: measuredSeconds,
      });
    } catch (error) {
      Alert.alert('완료 실패', error?.message || '타이머를 완료하지 못했습니다.');
      setBusy(false);
    }
  };

  const confirmComplete = () => {
    if (!session || busy || session.status === 'completed') return;
    const hasRemainingTime = session.mode === 'countdown' && displaySeconds > 0;
    const message = hasRemainingTime
      ? `설정한 ${formatKoreanDuration(session.targetSeconds)}까지 ${formatKoreanDuration(displaySeconds)} 남았습니다.\n지금 완료할까요?`
      : `측정시간: ${formatKoreanDuration(elapsedSeconds)}\n기록 화면으로 가져갈까요?`;
    Alert.alert('완료하기', message, [
      { text: hasRemainingTime ? '계속하기' : '취소', style: 'cancel' },
      { text: '완료하기', onPress: performComplete },
    ], { cancelable: true });
  };

  const changeAlarm = async (enabled) => {
    if (!session || alarmBusy || session.mode !== 'countdown') return;
    setAlarmBusy(true);
    try {
      const next = await setFocusSessionAlarmEnabled(session.id, enabled);
      setSession(next);
    } catch (error) {
      Alert.alert('알림 설정 실패', error?.message || '알림 설정을 변경하지 못했습니다.');
    } finally { setAlarmBusy(false); }
  };

  return (
    <SafeAreaView style={surface.screen}>
      <BackButton title="집중 타이머" onPress={() => navigation.goBack()} />
      <View style={styles.content}>
        {!session ? <Text style={text.bodyMuted}>실행 중인 집중 세션이 없습니다.</Text> : (
          <>
            <View style={styles.header}>
              <Text style={text.sectionTitle}>{session.targetTitle}</Text>
              <Text style={[text.meta, styles.type]}>
                {session.targetSubtype === 'rotation' ? '순환 루틴' : session.targetType === 'habit' ? '습관' : '도전'}
              </Text>
              {!!session.rotationItemTitle && (
                <View style={styles.activityChip}>
                  <Text style={styles.activityLabel}>지금 할 일</Text>
                  <Text style={styles.activityName}>{session.rotationItemTitle}</Text>
                </View>
              )}
            </View>
            <TimerRing session={session} elapsedSeconds={elapsedSeconds} displaySeconds={displaySeconds} />
            <Text style={[text.bodyMuted, styles.status, overtime && styles.overtimeText]}>
              {session.status === 'paused' ? '일시정지' : overtime ? '초과 진행 중' : session.status === 'completed' ? '완료' : '집중 중'}
            </Text>
            <View style={styles.bottomArea}>
              <View style={styles.optionsSlot}>
                {session.mode === 'countdown' && (
                  <View style={styles.alarmCard}>
                    <View style={styles.alarmTextWrap}>
                      <Text style={styles.alarmTitle}>시간 알림</Text>
                      <Text style={styles.alarmDescription}>설정 시간이 되면 기본 알림을 한 번 울립니다.</Text>
                    </View>
                    <Switch
                      value={session.alarmEnabled === true}
                      onValueChange={changeAlarm}
                      disabled={alarmBusy || session.status === 'completed'}
                      trackColor={{ false: primitive.neutral[300], true: primitive.neutral[800] }}
                      thumbColor={primitive.white}
                      ios_backgroundColor={primitive.neutral[300]}
                    />
                  </View>
                )}
              </View>
              {session.status !== 'completed' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.secondaryButton, busy && styles.disabled]} onPress={togglePause} disabled={busy} activeOpacity={0.85}>
                    <Text style={styles.secondaryButtonText}>{session.status === 'paused' ? '계속하기' : '일시정지'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondaryButton, busy && styles.disabled]} onPress={confirmCancel} disabled={busy} activeOpacity={0.85}>
                    <Text style={styles.secondaryButtonText}>취소하기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.completeButton, busy && styles.disabled]} onPress={confirmComplete} disabled={busy} activeOpacity={0.9}>
                    <Text style={styles.completeButtonText}>완료하기</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.lg },
  header: { width: '100%', maxWidth: 440, alignItems: 'center', marginTop: space.lg },
  type: { marginTop: space.xxs },
  activityChip: { marginTop: space.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.surfaceMuted },
  activityLabel: { ...text.meta, marginRight: space.xs },
  activityName: { ...text.body, color: color.textPrimary, fontWeight: '800' },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, marginTop: space.xl, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute' }, ringCenter: { alignItems: 'center', justifyContent: 'center' },
  timeLabel: { ...text.meta, marginBottom: space.xs },
  clock: { color: color.textPrimary, fontSize: 42, lineHeight: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  overtimeText: { color: color.danger }, overtimeStatus: { ...text.meta, color: color.danger, marginTop: space.xs, fontWeight: '700' },
  stopwatchCycle: { ...text.meta, marginTop: space.xs, color: color.textSecondary, fontWeight: '700' },
  status: { marginTop: space.md },
  bottomArea: { width: '100%', maxWidth: 440, marginTop: 'auto' },
  optionsSlot: { width: '100%', minHeight: 84, justifyContent: 'flex-end' },
  alarmCard: { width: '100%', flexDirection: 'row', alignItems: 'center', padding: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, backgroundColor: color.surface },
  alarmTextWrap: { flex: 1, marginRight: space.md }, alarmTitle: { ...text.body, color: color.textPrimary, fontWeight: '800' },
  alarmDescription: { ...text.meta, marginTop: space.xxs },
  actionRow: { width: '100%', flexDirection: 'row', gap: space.xs, marginTop: space.md },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.primary, borderRadius: radius.md, backgroundColor: color.surface },
  secondaryButtonText: { color: color.textPrimary, fontSize: 13, fontWeight: '800' },
  completeButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.primary, borderRadius: radius.md, backgroundColor: color.primary },
  completeButtonText: { color: color.textInverse, fontSize: 13, fontWeight: '800' }, disabled: { opacity: 0.45 },
});
