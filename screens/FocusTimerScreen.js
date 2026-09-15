import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import {
  finishFocusSession,
  formatFocusSessionTime,
  getFocusSessionDisplaySeconds,
  loadActiveFocusSession,
  loadFocusSession,
  pauseFocusSession,
  resumeFocusSession,
} from '../utils/focusSessionStore';
import { buttonStyles, color, space, surface, text } from '../styles/common';

export default function FocusTimerScreen({ navigation, route }) {
  const requestedId = String(route.params?.sessionId ?? '');
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const completedRef = useRef(false);

  const reload = useCallback(async () => {
    const loaded = requestedId
      ? await loadFocusSession(requestedId)
      : await loadActiveFocusSession();
    setSession(loaded);
    setNow(Date.now());
  }, [requestedId]);

  useEffect(() => {
    reload().catch((error) => Alert.alert('불러오기 실패', error?.message));
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload().catch(() => {});
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [reload]);

  const displaySeconds = session ? getFocusSessionDisplaySeconds(session, now) : 0;

  const finish = useCallback(async (automatic = false) => {
    if (!session || busy || completedRef.current || session.status === 'completed') return;
    completedRef.current = true;
    setBusy(true);
    try {
      const completed = await finishFocusSession(session.id);
      setSession(completed);
      setNow(Number(completed.endedAt) || Date.now());
      if (automatic) Alert.alert('완료', '집중 시간이 완료되었습니다.');
    } catch (error) {
      completedRef.current = false;
      Alert.alert('종료 실패', error?.message || '세션을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, session]);

  useEffect(() => {
    if (
      session?.status === 'running'
      && session.mode === 'countdown'
      && displaySeconds === 0
    ) {
      finish(true);
    }
  }, [displaySeconds, finish, session?.mode, session?.status]);

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
    } finally {
      setBusy(false);
    }
  };

  const confirmFinish = () => {
    if (!session || session.status === 'completed') return;
    Alert.alert('집중 종료', '현재까지의 실행 시간을 저장하고 종료할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '종료', style: 'destructive', onPress: () => finish(false) },
    ]);
  };

  return (
    <SafeAreaView style={surface.screen}>
      <BackButton title="집중 타이머" onPress={() => navigation.goBack()} />
      <View style={styles.content}>
        {!session ? (
          <Text style={text.bodyMuted}>실행 중인 집중 세션이 없습니다.</Text>
        ) : (
          <>
            <Text style={text.sectionTitle}>{session.targetTitle}</Text>
            <Text style={[text.meta, styles.type]}>
              {session.targetSubtype === 'rotation'
                ? '순환 루틴'
                : session.targetType === 'habit' ? '습관' : '도전'} · {session.mode === 'stopwatch' ? '스톱워치' : `${Math.round(session.targetSeconds / 60)}분`}
            </Text>
            {!!session.rotationItemTitle && (
              <Text style={[text.bodyMuted, styles.currentItem]}>
                현재 활동 · {session.rotationItemTitle}
              </Text>
            )}
            <Text style={styles.clock}>
              {formatFocusSessionTime(displaySeconds)}
            </Text>
            <Text style={[text.bodyMuted, styles.status]}>
              {session.status === 'running' ? '집중 중' : session.status === 'paused' ? '일시정지' : '완료'}
            </Text>

            {session.status !== 'completed' && (
              <>
                <TouchableOpacity
                  style={[buttonStyles.primary.container, styles.button]}
                  onPress={togglePause}
                  disabled={busy}
                >
                  <Text style={buttonStyles.primary.label}>
                    {session.status === 'paused' ? '재개' : '일시정지'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[buttonStyles.secondary.container, styles.button]}
                  onPress={confirmFinish}
                  disabled={busy}
                >
                  <Text style={buttonStyles.secondary.label}>종료</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  type: { marginTop: space.xs },
  currentItem: { marginTop: space.sm },
  clock: {
    marginVertical: space.xl,
    fontSize: 52,
    fontWeight: '800',
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  status: { marginBottom: space.xl },
  button: { marginTop: space.sm, justifyContent: 'center' },
});
