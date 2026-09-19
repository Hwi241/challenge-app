import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatFocusSessionTime,
  getFocusSessionDisplaySeconds,
  loadActiveFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  subscribeFocusSessions,
} from '../utils/focusSessionStore';
import {
  getFocusMiniTimerEnabled,
  subscribeAppSettings,
} from '../utils/appSettings';
import { color, radius, space } from '../styles/common';

export default function FocusMiniTimer({ navigationRef, routeName }) {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const refreshSession = useCallback(() => {
    loadActiveFocusSession()
      .then((active) => {
        setSession(active);
        setNow(Date.now());
      })
      .catch(() => setSession(null));
  }, []);

  const refreshSetting = useCallback(() => {
    getFocusMiniTimerEnabled().then(setEnabled).catch(() => setEnabled(true));
  }, []);

  useEffect(() => {
    refreshSession();
    refreshSetting();
    const unsubscribeSessions = subscribeFocusSessions(refreshSession);
    const unsubscribeSettings = subscribeAppSettings((settings) => {
      setEnabled(settings.focusMiniTimerEnabled !== false);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshSession();
      refreshSetting();
    });
    return () => {
      unsubscribeSessions();
      unsubscribeSettings();
      appState.remove();
    };
  }, [refreshSession, refreshSetting]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const displaySeconds = session
    ? getFocusSessionDisplaySeconds(session, now)
    : 0;

  const overtime = session?.mode === 'countdown' && displaySeconds < 0;

  if (!enabled || !session || routeName === 'FocusTimer') return null;

  const openTimer = () => {
    if (!navigationRef?.isReady?.()) return;
    navigationRef.navigate('FocusTimer', { sessionId: session.id });
  };

  const togglePause = async (event) => {
    event?.stopPropagation?.();
    if (busy) return;
    setBusy(true);
    try {
      const next = session.status === 'paused'
        ? await resumeFocusSession(session.id)
        : await pauseFocusSession(session.id);
      setSession(next);
      setNow(Date.now());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: Math.max(insets.bottom, 12) + 72 }]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={openTimer}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${session.targetTitle} 집중 타이머 열기`}
      >
        <View style={styles.statusDot} />
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{session.targetTitle}</Text>
          <Text style={styles.state}>
            {session.status === 'paused' ? '일시정지' : overtime ? '초과 중' : '집중 중'}
          </Text>
        </View>
        <Text style={[styles.time, overtime && styles.overtimeTime]}>
          {formatFocusSessionTime(displaySeconds)}
        </Text>
        <TouchableOpacity
          style={styles.toggle}
          onPress={togglePause}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={session.status === 'paused' ? '타이머 재개' : '타이머 일시정지'}
        >
          <Text style={styles.toggleText}>{session.status === 'paused' ? '▶' : 'Ⅱ'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 12,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.textInverse,
    marginRight: space.sm,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { color: color.textInverse, fontSize: 14, fontWeight: '700' },
  state: { color: color.textDisabled, fontSize: 11, marginTop: 2 },
  time: {
    color: color.textInverse,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginHorizontal: space.sm,
  },
  overtimeTime: { color: color.danger },
  toggle: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.textPrimary,
  },
  toggleText: { color: color.textInverse, fontSize: 15, fontWeight: '800' },
});
