import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'appSettings';
const listeners = new Set();

const DEFAULTS = {
  notificationsEnabled: true,
  focusMiniTimerEnabled: true,
  focusOverlayTimerEnabled: false,
  dataIntegrations: {
    healthConnect: {
      enabled: false,
      status: 'notConnected',
      sdkStatus: null,
      permissions: { readSteps: false },
      updatedAt: null,
      lastError: null,
    },
    calendarRecord: {
      enabled: false,
      status: 'notConnected',
      selectedCalendarId: null,
      selectedCalendarTitle: null,
      writeMode: 'manual',
      updatedAt: null,
      lastError: null,
    },
  },
};

function normalizeAppSettings(settings) {
  const source = settings || {};
  const sourceIntegrations = source.dataIntegrations || {};
  const sourceHealthConnect = sourceIntegrations.healthConnect || {};
  const sourceHealthPermissions = sourceHealthConnect.permissions || {};
  const sourceCalendarRecord = sourceIntegrations.calendarRecord || {};
  return {
    ...DEFAULTS,
    ...source,
    dataIntegrations: {
      ...DEFAULTS.dataIntegrations,
      ...sourceIntegrations,
      healthConnect: {
        ...DEFAULTS.dataIntegrations.healthConnect,
        ...sourceHealthConnect,
        permissions: {
          ...DEFAULTS.dataIntegrations.healthConnect.permissions,
          ...sourceHealthPermissions,
        },
      },
      calendarRecord: {
        ...DEFAULTS.dataIntegrations.calendarRecord,
        ...sourceCalendarRecord,
      },
    },
  };
}

export async function getAppSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return normalizeAppSettings({});
    const parsed = JSON.parse(raw);
    return normalizeAppSettings(parsed);
  } catch {
    return normalizeAppSettings({});
  }
}

export async function setAppSettings(next) {
  const current = await getAppSettings();
  const merged = normalizeAppSettings({ ...current, ...(next || {}) });
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  listeners.forEach((listener) => listener(merged));
  return merged;
}

export async function setDataIntegrationSettings(provider, next) {
  const current = await getAppSettings();
  const currentIntegrations = current.dataIntegrations || {};
  const currentProvider = currentIntegrations[provider] || {};
  const nextProvider = next || {};
  const mergedProvider = {
    ...currentProvider,
    ...nextProvider,
    permissions: {
      ...(currentProvider.permissions || {}),
      ...(nextProvider.permissions || {}),
    },
  };
  return setAppSettings({
    dataIntegrations: {
      ...currentIntegrations,
      [provider]: mergedProvider,
    },
  });
}

export async function getNotificationsEnabled() {
  const s = await getAppSettings();
  return !!s.notificationsEnabled;
}

export async function setNotificationsEnabled(enabled) {
  return setAppSettings({ notificationsEnabled: !!enabled });
}

export async function getFocusMiniTimerEnabled() {
  const settings = await getAppSettings();
  return settings.focusMiniTimerEnabled !== false;
}

export async function setFocusMiniTimerEnabled(enabled) {
  return setAppSettings({ focusMiniTimerEnabled: !!enabled });
}

export async function getFocusOverlayTimerEnabled() {
  const settings = await getAppSettings();
  return settings.focusOverlayTimerEnabled === true;
}

export async function setFocusOverlayTimerEnabled(enabled) {
  return setAppSettings({ focusOverlayTimerEnabled: !!enabled });
}

export function subscribeAppSettings(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}
