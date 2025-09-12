// utils/appSettings.js
// 앱 전역 설정 저장/로드 (AsyncStorage)
// 현재 스키마: { notificationsEnabled: boolean }

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'appSettings';

const DEFAULTS = {
  notificationsEnabled: true,
};

export async function getAppSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setAppSettings(next) {
  const merged = { ...(await getAppSettings()), ...(next || {}) };
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export async function getNotificationsEnabled() {
  const s = await getAppSettings();
  return !!s.notificationsEnabled;
}

export async function setNotificationsEnabled(enabled) {
  return setAppSettings({ notificationsEnabled: !!enabled });
}
