import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buttonStyles, color, modal, radius, space, text,
} from '../styles/common';
import { isRotationRoutine } from '../utils/challengeType';
import { getRotationRoutineSummary } from '../utils/rotationRoutine';

const MODES = [
  { key: 'stopwatch', label: '스톱워치' },
  { key: '25', label: '25분' },
  { key: '50', label: '50분' },
  { key: 'custom', label: '직접 설정' },
];

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
  const day = Number.isFinite(date.getTime()) ? date.toLocaleDateString() : '날짜 없음';
  const duration = Number(entry.duration);
  return `최근 기록 · ${day}${duration > 0 ? ` · ${duration}분` : ''}`;
};

export default function FocusSessionStartModal({
  visible,
  target,
  busy = false,
  onClose,
  onStart,
}) {
  const [mode, setMode] = useState('stopwatch');
  const [customMinutes, setCustomMinutes] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !target?.id) return undefined;
    let alive = true;
    setMode('stopwatch');
    setCustomMinutes('');
    setLoading(true);
    AsyncStorage.getItem(`entries_${target.id}`)
      .then((raw) => {
        if (!alive) return;
        const parsed = raw ? JSON.parse(raw) : [];
        setEntries(Array.isArray(parsed) ? parsed : []);
      })
      .catch(() => { if (alive) setEntries([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [target?.id, visible]);

  const orderedEntries = useMemo(() => [...entries].sort(
    (a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0),
  ), [entries]);
  const todayCount = entries.filter((entry) => sameLocalDay(entry?.timestamp)).length;
  const isHabit = target?.type === 'habit';
  const rotationSummary = useMemo(() => {
    if (!isRotationRoutine(target)) return null;
    try { return getRotationRoutineSummary(target); } catch { return null; }
  }, [target]);

  const start = () => {
    let targetSeconds = null;
    if (mode !== 'stopwatch') {
      const minutes = mode === 'custom' ? Number(customMinutes) : Number(mode);
      if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440) return;
      targetSeconds = minutes * 60;
    }
    onStart?.({
      mode: mode === 'stopwatch' ? 'stopwatch' : 'countdown',
      targetSeconds,
    });
  };

  const customValid = mode !== 'custom'
    || (
      Number.isSafeInteger(Number(customMinutes))
      && Number(customMinutes) >= 1
      && Number(customMinutes) <= 1440
    );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.backdrop}>
        <View style={[modal.sheetWide, styles.sheet]}>
          <Text style={text.sectionTitle}>{target?.title || '집중 타이머'}</Text>
          <Text style={[text.meta, styles.type]}>
            {rotationSummary ? '순환 루틴' : isHabit ? '습관' : '도전'}
          </Text>

          {loading ? <ActivityIndicator style={styles.loader} /> : (
            <View style={styles.infoGrid}>
              <Text style={text.bodyMuted}>총 기록 {entries.length}회</Text>
              <Text style={text.bodyMuted}>오늘 {todayCount}회</Text>
              {rotationSummary ? (
                <>
                  <Text style={[text.bodyStrong, styles.currentItem]}>
                    현재 활동 · {rotationSummary.currentItem?.name ?? '회전 완료'}
                  </Text>
                  <Text style={text.bodyMuted}>
                    {rotationSummary.currentCycleNumber}번째 회전 · 완료 {rotationSummary.completedItemsCount}/{rotationSummary.cycleItems.length}
                  </Text>
                  <Text style={text.bodyMuted}>이번 회전 진행률 {rotationSummary.progressPct}%</Text>
                </>
              ) : isHabit ? (
                <Text style={text.bodyMuted}>현재 기록 {Number(target?.currentScore || 0)}회</Text>
              ) : (
                <Text style={text.bodyMuted}>
                  진행 {Number(target?.currentScore || 0)} / {Number(target?.goalScore || 0)}
                </Text>
              )}
              <Text style={[text.bodyMuted, styles.recent]}>
                {recentLabel(orderedEntries[0])}
              </Text>
            </View>
          )}

          <View style={styles.modeRow}>
            {MODES.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.modeButton, mode === option.key && styles.modeButtonSelected]}
                onPress={() => setMode(option.key)}
                disabled={busy}
              >
                <Text style={[styles.modeText, mode === option.key && styles.modeTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'custom' && (
            <TextInput
              value={customMinutes}
              onChangeText={(value) => setCustomMinutes(value.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="분 단위로 입력 (1~1440분)"
              style={styles.input}
              editable={!busy}
            />
          )}

          <TouchableOpacity
            style={[buttonStyles.primary.container, styles.startButton, (!customValid || busy) && styles.disabled]}
            onPress={start}
            disabled={!customValid || busy}
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
  sheet: { maxWidth: 420 },
  type: { marginTop: space.xxs },
  loader: { marginVertical: space.lg },
  infoGrid: { marginTop: space.md, gap: space.xs },
  recent: { marginTop: space.xs },
  currentItem: { marginTop: space.xs },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.lg,
  },
  modeButton: {
    flexGrow: 1,
    minWidth: '46%',
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modeButtonSelected: { backgroundColor: color.primary, borderColor: color.primary },
  modeText: { ...text.body, color: color.textPrimary },
  modeTextSelected: { color: color.textInverse, fontWeight: '700' },
  input: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    minHeight: 46,
    color: color.textPrimary,
  },
  startButton: { marginTop: space.lg, justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  cancelButton: { alignItems: 'center', paddingTop: space.md },
});
