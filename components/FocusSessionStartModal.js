import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buttonStyles, color, modal, radius, space, text } from '../styles/common';
import { isRotationRoutine } from '../utils/challengeType';
import { getRotationRoutineSummary } from '../utils/rotationRoutine';
import {
  buildFocusTimerMinutesKey,
  getFocusTimerAlarmPreference,
  getFocusTimerMinutesPreference,
  setFocusTimerMinutesPreference,
} from '../utils/focusTimerPreferences';

const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;
const MINUTE_STEP = 5;
const clampMinutes = (value) => {
  const number = Math.round(Number(value) || 0);
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, number || MIN_MINUTES));
};
const sameLocalDay = (timestamp, now = Date.now()) => {
  const date = new Date(timestamp);
  const today = new Date(now);
  return Number.isFinite(date.getTime())
    && date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};
const recentLabel = (entry) => {
  if (!entry) return '최근 기록 없음';
  const date = new Date(entry.timestamp);
  return Number.isFinite(date.getTime()) ? `최근 ${date.toLocaleDateString()}` : '최근 기록 있음';
};
const minutesOf = (seconds) => {
  const value = Number(seconds);
  return Number.isFinite(value) ? String(Math.round(value / 6) / 10) : '0';
};

export default function FocusSessionStartModal({ visible, target, busy = false, onClose, onStart }) {
  const [mode, setMode] = useState('countdown');
  const [timerMinutes, setTimerMinutes] = useState(60);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const isHabit = target?.type === 'habit';
  const rotationSummary = useMemo(() => {
    if (!isRotationRoutine(target)) return null;
    try { return getRotationRoutineSummary(target); } catch { return null; }
  }, [target]);
  const rotationCurrent = rotationSummary?.currentItem ?? null;
  const rotationNext = rotationSummary?.nextItem ?? null;
  const defaultMinutes = useMemo(() => (
    rotationCurrent?.targetSeconds > 0
      ? clampMinutes(Math.round(rotationCurrent.targetSeconds / 60))
      : 60
  ), [rotationCurrent?.targetSeconds]);
  const minutesPreferenceKey = useMemo(() => buildFocusTimerMinutesKey(
    target?.id,
    rotationCurrent?.id ?? null,
  ), [target?.id, rotationCurrent?.id]);

  useEffect(() => {
    if (!visible || !target?.id) return undefined;
    let alive = true;
    setMode('countdown');
    setLoading(true);
    Promise.all([
      AsyncStorage.getItem(`entries_${target.id}`),
      getFocusTimerMinutesPreference(minutesPreferenceKey, defaultMinutes),
      getFocusTimerAlarmPreference(target.id),
    ]).then(([rawEntries, rememberedMinutes, rememberedAlarm]) => {
      if (!alive) return;
      let parsed = [];
      try { parsed = rawEntries ? JSON.parse(rawEntries) : []; } catch { parsed = []; }
      setEntries(Array.isArray(parsed) ? parsed : []);
      setTimerMinutes(clampMinutes(rememberedMinutes));
      setAlarmEnabled(rememberedAlarm !== false);
    }).catch(() => {
      if (!alive) return;
      setEntries([]);
      setTimerMinutes(defaultMinutes);
      setAlarmEnabled(true);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [defaultMinutes, minutesPreferenceKey, target?.id, visible]);

  const orderedEntries = useMemo(() => [...entries].sort(
    (a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0),
  ), [entries]);
  const todayCount = entries.filter((entry) => sameLocalDay(entry?.timestamp)).length;
  const moveMinutes = (direction) => {
    setMode('countdown');
    setTimerMinutes((previous) => {
      const current = clampMinutes(previous);
      if (direction < 0) return current <= 5 ? 1 : Math.max(1, current - MINUTE_STEP);
      return current < 5 ? 5 : Math.min(MAX_MINUTES, current + MINUTE_STEP);
    });
  };
  const start = () => {
    if (mode === 'countdown') {
      const safeMinutes = clampMinutes(timerMinutes);
      setFocusTimerMinutesPreference(minutesPreferenceKey, safeMinutes).catch(() => {});
      onStart?.({ mode: 'countdown', targetSeconds: safeMinutes * 60, alarmEnabled });
      return;
    }
    onStart?.({ mode: 'stopwatch', targetSeconds: null, alarmEnabled });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.backdrop}>
        <View style={[modal.sheetWide, styles.sheet]}>
          <Text style={text.sectionTitle}>{target?.title || '집중 타이머'}</Text>
          <Text style={[text.meta, styles.type]}>
            {rotationSummary ? '순환 루틴' : isHabit ? '습관' : '도전'}
          </Text>
          {loading ? <ActivityIndicator style={styles.loader} /> : (
            <>
              {rotationSummary ? (
                <View style={styles.rotationCard}>
                  <Text style={styles.eyebrow}>지금 할 일</Text>
                  <Text style={styles.currentName}>{rotationCurrent?.name ?? '현재 활동 없음'}</Text>
                  {rotationCurrent && (
                    <View style={styles.progressRow}>
                      <Text style={text.bodyMuted}>
                        진행 {minutesOf(rotationCurrent.progressSeconds)} / {minutesOf(rotationCurrent.targetSeconds)}분
                      </Text>
                      <Text style={text.bodyMuted}>남은 {minutesOf(rotationCurrent.remainingSeconds)}분</Text>
                    </View>
                  )}
                  <View style={styles.divider} />
                  <View style={styles.rotationBottom}>
                    <View style={styles.rotationInfoBlock}>
                      <Text style={styles.infoLabel}>다음 활동</Text>
                      <Text style={text.bodyStrong}>{rotationNext?.name ?? '이번 회차 완료'}</Text>
                    </View>
                    <View style={[styles.rotationInfoBlock, styles.rotationInfoRight]}>
                      <Text style={styles.infoLabel}>회차</Text>
                      <Text style={text.body}>
                        {rotationSummary.currentCycleNumber}번째 · {rotationSummary.completedCycleCount}회 완료
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.generalInfoCard}>
                  <View style={styles.generalStatRow}>
                    <View style={styles.generalStat}><Text style={styles.infoLabel}>총 기록</Text><Text style={text.bodyStrong}>{entries.length}회</Text></View>
                    <View style={styles.generalStat}><Text style={styles.infoLabel}>오늘</Text><Text style={text.bodyStrong}>{todayCount}회</Text></View>
                    <View style={styles.generalStat}><Text style={styles.infoLabel}>현재</Text><Text style={text.bodyStrong}>{Number(target?.currentScore || 0)}{isHabit ? '회' : ''}</Text></View>
                  </View>
                </View>
              )}
              <View style={styles.recentRow}><Text style={text.meta}>{recentLabel(orderedEntries[0])}</Text></View>
            </>
          )}

          <Text style={[text.sectionTitle, styles.timerHeading]}>타이머 방식</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.stopwatchButton, mode === 'stopwatch' && styles.modeSelected]}
              onPress={() => setMode('stopwatch')}
              disabled={busy}
            >
              <Text style={[styles.modeText, mode === 'stopwatch' && styles.modeTextSelected]}>스톱워치</Text>
            </TouchableOpacity>
            <View style={[styles.minuteSelector, mode === 'countdown' && styles.modeSelected]}>
              <TouchableOpacity style={styles.arrowButton} onPress={() => moveMinutes(-1)} disabled={busy}>
                <Text style={[styles.arrowText, mode === 'countdown' && styles.modeTextSelected]}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.minuteCenter} onPress={() => setMode('countdown')} disabled={busy}>
                <Text style={[styles.minuteValue, mode === 'countdown' && styles.modeTextSelected]}>{timerMinutes}</Text>
                <Text style={[styles.minuteUnit, mode === 'countdown' && styles.modeTextSelected]}>분</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.arrowButton} onPress={() => moveMinutes(1)} disabled={busy}>
                <Text style={[styles.arrowText, mode === 'countdown' && styles.modeTextSelected]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.timerHelp}>
            {rotationSummary
              ? '처음에는 현재 활동의 목표시간을 사용합니다.'
              : '처음에는 60분으로 시작하며 마지막 설정시간을 기억합니다.'}
          </Text>
          <TouchableOpacity
            style={[buttonStyles.primary.container, styles.startButton, busy && styles.disabled]}
            onPress={start}
            disabled={busy}
          >
            <Text style={buttonStyles.primary.label}>{busy ? '시작 중…' : '▶ 시작하기'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} disabled={busy} style={styles.cancelButton}>
            <Text style={text.bodyMuted}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { maxWidth: 420 }, type: { marginTop: space.xxs }, loader: { marginVertical: space.xl },
  rotationCard: { marginTop: space.md, padding: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, backgroundColor: color.surface },
  eyebrow: { ...text.meta, color: color.textSecondary, fontWeight: '700' },
  currentName: { marginTop: space.xxs, color: color.textPrimary, fontSize: 22, fontWeight: '800' },
  progressRow: { marginTop: space.sm, flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.divider, marginVertical: space.md },
  rotationBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  rotationInfoBlock: { flex: 1 }, rotationInfoRight: { alignItems: 'flex-end' },
  infoLabel: { ...text.meta, color: color.textSecondary, marginBottom: space.xxs },
  generalInfoCard: { marginTop: space.md, padding: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, backgroundColor: color.surface },
  generalStatRow: { flexDirection: 'row', gap: space.sm }, generalStat: { flex: 1 },
  recentRow: { marginTop: space.sm, paddingHorizontal: space.xxs }, timerHeading: { marginTop: space.xl },
  modeRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  stopwatchButton: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, backgroundColor: color.surface },
  minuteSelector: { flex: 1.5, minHeight: 64, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, backgroundColor: color.surface, overflow: 'hidden' },
  modeSelected: { backgroundColor: color.primary, borderColor: color.primary },
  modeText: { ...text.body, color: color.textPrimary, fontWeight: '700' }, modeTextSelected: { color: color.textInverse },
  arrowButton: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: color.textPrimary, fontSize: 34, lineHeight: 36, fontWeight: '400' },
  minuteCenter: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  minuteValue: { color: color.textPrimary, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  minuteUnit: { marginLeft: 3, color: color.textPrimary, fontSize: 13, fontWeight: '700' },
  timerHelp: { ...text.help, marginTop: space.sm }, startButton: { marginTop: space.lg, justifyContent: 'center' },
  disabled: { opacity: 0.45 }, cancelButton: { alignItems: 'center', paddingTop: space.md },
});
