import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  buttonStyles,
  color,
  modal,
  radius,
  space,
} from '../styles/common';
import { isRotationRoutine } from '../utils/challengeType';
import { getRotationRoutineSummary } from '../utils/rotationRoutine';
import {
  buildFocusTimerMinutesKey,
  getFocusTimerAlarmPreference,
  getFocusTimerMinutesPreference,
  setFocusTimerAlarmPreference,
  setFocusTimerMinutesPreference,
} from '../utils/focusTimerPreferences';

const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;
const MINUTE_STEP = 5;

const clampMinutes = (value) => {
  const number = Math.round(Number(value) || 0);
  return Math.min(
    MAX_MINUTES,
    Math.max(MIN_MINUTES, number || MIN_MINUTES)
  );
};

export default function FocusSessionStartModal({
  visible,
  target,
  busy = false,
  onClose,
  onStart,
}) {
  const [mode, setMode] = useState('countdown');
  const [timerMinutes, setTimerMinutes] = useState(60);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [editingTime, setEditingTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const isHabit = target?.type === 'habit';

  const rotationSummary = useMemo(() => {
    if (!isRotationRoutine(target)) return null;
    try {
      return getRotationRoutineSummary(target);
    } catch {
      return null;
    }
  }, [target]);

  const rotationCurrent = rotationSummary?.currentItem ?? null;
  const defaultMinutes = useMemo(
    () => (
      rotationCurrent?.targetSeconds > 0
        ? clampMinutes(Math.round(rotationCurrent.targetSeconds / 60))
        : 60
    ),
    [rotationCurrent?.targetSeconds]
  );
  const minutesPreferenceKey = useMemo(
    () => buildFocusTimerMinutesKey(
      target?.id,
      rotationCurrent?.id ?? null
    ),
    [target?.id, rotationCurrent?.id]
  );

  useEffect(() => {
    if (!visible || !target?.id) return undefined;

    let alive = true;
    setMode('countdown');
    setEditingTime(false);
    setLoading(true);

    Promise.all([
      getFocusTimerMinutesPreference(minutesPreferenceKey, defaultMinutes),
      getFocusTimerAlarmPreference(target.id),
    ])
      .then(([rememberedMinutes, rememberedAlarm]) => {
        if (!alive) return;
        setTimerMinutes(clampMinutes(rememberedMinutes));
        setAlarmEnabled(rememberedAlarm !== false);
      })
      .catch(() => {
        if (!alive) return;
        setTimerMinutes(defaultMinutes);
        setAlarmEnabled(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [defaultMinutes, minutesPreferenceKey, target?.id, visible]);

  const moveMinutes = (direction) => {
    setMode('countdown');
    setTimerMinutes((previous) => {
      const current = clampMinutes(previous);
      if (direction < 0) {
        return current <= 5 ? 1 : Math.max(1, current - MINUTE_STEP);
      }
      return current < 5 ? 5 : Math.min(MAX_MINUTES, current + MINUTE_STEP);
    });
  };

  const changeAlarm = async (next) => {
    setAlarmEnabled(next);
    try {
      await setFocusTimerAlarmPreference(target?.id, next);
    } catch {}
  };

  const start = () => {
    if (mode === 'countdown') {
      const safeMinutes = clampMinutes(timerMinutes);
      setFocusTimerMinutesPreference(minutesPreferenceKey, safeMinutes).catch(() => {});
      setFocusTimerAlarmPreference(target?.id, alarmEnabled).catch(() => {});
      onStart?.({
        mode: 'countdown',
        targetSeconds: safeMinutes * 60,
        alarmEnabled,
      });
      return;
    }

    setFocusTimerAlarmPreference(target?.id, alarmEnabled).catch(() => {});
    onStart?.({
      mode: 'stopwatch',
      targetSeconds: null,
      alarmEnabled,
    });
  };

  const typeLabel = rotationSummary
    ? '순환루틴'
    : isHabit
      ? '습관'
      : '도전';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={modal.backdrop}>
        <View style={[modal.sheetWide, styles.sheet]}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>집중 타이머</Text>
              <Text style={styles.targetTitle} numberOfLines={2}>
                {target?.title || '집중 타이머'}
              </Text>
              <Text style={styles.targetType}>{typeLabel}</Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          {rotationSummary && (
            <View style={styles.currentTaskRow}>
              <Text style={styles.currentTaskLabel}>현재 작업</Text>
              <Text style={styles.currentTaskName} numberOfLines={1}>
                {rotationCurrent?.name ?? '현재 활동 없음'}
              </Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <>
              <View style={styles.modeRow}>
                {[
                  ['countdown', '목표 시간'],
                  ['stopwatch', '자유 타이머'],
                ].map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.modeButton,
                      mode === value && styles.modeButtonSelected,
                    ]}
                    onPress={() => {
                      setMode(value);
                      setEditingTime(false);
                    }}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.modeText,
                      mode === value && styles.modeTextSelected,
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.settingsCard}>
                {mode === 'countdown' ? (
                  <>
                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>목표 시간</Text>
                      <View style={styles.settingValueRow}>
                        <Text style={styles.settingValue}>{timerMinutes}분</Text>
                        <TouchableOpacity
                          style={styles.editTimeButton}
                          onPress={() => setEditingTime((current) => !current)}
                          disabled={busy}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.editTimeText}>
                            {editingTime ? '완료' : '수정'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {editingTime && (
                      <View style={styles.timeEditor}>
                        <TouchableOpacity
                          style={styles.timeStepButton}
                          onPress={() => moveMinutes(-1)}
                          disabled={busy}
                        >
                          <Text style={styles.timeStepText}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.timeEditorValue}>{timerMinutes}분</Text>
                        <TouchableOpacity
                          style={styles.timeStepButton}
                          onPress={() => moveMinutes(1)}
                          disabled={busy}
                        >
                          <Text style={styles.timeStepText}>›</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>측정 방식</Text>
                    <Text style={styles.settingValue}>시간 제한 없음</Text>
                  </View>
                )}

                <View style={styles.settingDivider} />
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>알림</Text>
                  <Switch
                    value={alarmEnabled}
                    onValueChange={changeAlarm}
                    disabled={busy}
                    trackColor={{ false: color.border, true: color.textPrimary }}
                    thumbColor={color.background}
                  />
                </View>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[
              buttonStyles.primary.container,
              styles.startButton,
              (busy || loading) && styles.disabled,
            ]}
            onPress={start}
            disabled={busy || loading}
            activeOpacity={0.88}
          >
            <Text style={buttonStyles.primary.label}>
              {busy ? '시작 중…' : '타이머 시작'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { maxWidth: 420, paddingTop: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: color.textSecondary, fontSize: 11, fontWeight: '800' },
  targetTitle: { marginTop: 4, color: color.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  targetType: { marginTop: 4, color: color.textTertiary, fontSize: 11, fontWeight: '800' },
  closeButton: { width: 36, height: 36, marginTop: -5, marginRight: -5, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: color.textSecondary, fontSize: 27, lineHeight: 30, fontWeight: '300' },
  currentTaskRow: { marginTop: space.md, minHeight: 44, paddingHorizontal: space.sm, borderRadius: radius.md, backgroundColor: color.surfaceMuted, flexDirection: 'row', alignItems: 'center', columnGap: space.sm },
  currentTaskLabel: { color: color.textSecondary, fontSize: 11, fontWeight: '800' },
  currentTaskName: { flex: 1, color: color.textPrimary, fontSize: 14, fontWeight: '900' },
  loader: { marginVertical: space.xl },
  modeRow: { flexDirection: 'row', columnGap: 6, marginTop: space.lg },
  modeButton: { flex: 1, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.background, alignItems: 'center', justifyContent: 'center' },
  modeButtonSelected: { borderColor: color.primary, backgroundColor: color.primary },
  modeText: { color: color.textSecondary, fontSize: 12, fontWeight: '800' },
  modeTextSelected: { color: color.textInverse },
  settingsCard: { marginTop: space.sm, paddingHorizontal: space.md, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, backgroundColor: color.surface },
  settingRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: space.sm },
  settingLabel: { color: color.textSecondary, fontSize: 12, fontWeight: '800' },
  settingValueRow: { flexDirection: 'row', alignItems: 'center', columnGap: 9 },
  settingValue: { color: color.textPrimary, fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  editTimeButton: { minWidth: 38, height: 30, alignItems: 'center', justifyContent: 'center' },
  editTimeText: { color: color.textSecondary, fontSize: 11, fontWeight: '800' },
  timeEditor: { height: 48, marginBottom: space.sm, borderRadius: radius.md, backgroundColor: color.surfaceMuted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  timeStepButton: { width: 52, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  timeStepText: { color: color.textPrimary, fontSize: 28, lineHeight: 30, fontWeight: '300' },
  timeEditorValue: { minWidth: 88, textAlign: 'center', color: color.textPrimary, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  settingDivider: { height: StyleSheet.hairlineWidth, backgroundColor: color.divider },
  startButton: { marginTop: space.lg, justifyContent: 'center' },
  disabled: { opacity: 0.45 },
});
