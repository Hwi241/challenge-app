import AsyncStorage from '@react-native-async-storage/async-storage';

const MINUTES_PREFIX = 'focus_timer_minutes_v1:';
const ALARM_PREFIX = 'focus_timer_alarm_v1:';

const clean = (value) => String(value ?? '').trim();

const clampMinutes = (value, fallback = 60) => {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(1440, number);
};

export function buildFocusTimerMinutesKey(targetId, rotationItemId = null) {
  const target = clean(targetId);
  if (!target) return '';
  const item = clean(rotationItemId);
  return item ? `${target}:rotation:${item}` : target;
}

export async function getFocusTimerMinutesPreference(preferenceKey, fallbackMinutes = 60) {
  const fallback = clampMinutes(fallbackMinutes, 60);
  const key = clean(preferenceKey);
  if (!key) return fallback;
  try {
    const raw = await AsyncStorage.getItem(MINUTES_PREFIX + key);
    if (raw == null) return fallback;
    return clampMinutes(raw, fallback);
  } catch {
    return fallback;
  }
}

export async function setFocusTimerMinutesPreference(preferenceKey, minutes) {
  const key = clean(preferenceKey);
  if (!key) return;
  const safe = clampMinutes(minutes, 60);
  await AsyncStorage.setItem(MINUTES_PREFIX + key, String(safe));
}

export async function getFocusTimerAlarmPreference(targetId) {
  const id = clean(targetId);
  if (!id) return true;
  try {
    const raw = await AsyncStorage.getItem(ALARM_PREFIX + id);
    if (raw == null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

export async function setFocusTimerAlarmPreference(targetId, enabled) {
  const id = clean(targetId);
  if (!id) return;
  await AsyncStorage.setItem(ALARM_PREFIX + id, enabled ? '1' : '0');
}
