import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

const NOTIFICATION_DEFAULTS_KEY = 'notification_defaults';
let notificationsPromise = null;

const getNotifications = async () => {
  if (
    Platform.OS === 'android'
    && isRunningInExpoGo()
  ) {
    return null;
  }

  if (!notificationsPromise) {
    notificationsPromise = import('expo-notifications');
  }

  return notificationsPromise;
};

const normalizeSoundMode = (value) => (
  ['system', 'silent', 'vibrate'].includes(value) ? value : 'system'
);

async function readSoundMode() {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_DEFAULTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeSoundMode(parsed?.sound);
  } catch {
    return 'system';
  }
}

async function ensurePermission(Notifications) {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

async function ensureAndroidChannel(Notifications, soundMode) {
  if (Platform.OS !== 'android') return null;
  const channelId = `focus-timer-${soundMode}`;
  const channel = {
    name: '집중 타이머',
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: soundMode !== 'silent',
  };
  if (soundMode === 'system') {
    channel.sound = 'default';
    channel.vibrationPattern = [0, 300, 150, 300];
  } else if (soundMode === 'vibrate') {
    channel.sound = null;
    channel.vibrationPattern = [0, 400, 180, 400];
  } else {
    channel.sound = null;
    channel.enableVibrate = false;
  }
  await Notifications.setNotificationChannelAsync(channelId, channel);
  return channelId;
}

function elapsedSecondsOf(session, now = Date.now()) {
  if (!session) return 0;
  const startedAt = Number(session.startedAt);
  if (!Number.isFinite(startedAt)) return 0;
  const end = session.status === 'paused' ? Number(session.pausedAt) : Number(now);
  if (!Number.isFinite(end)) return 0;
  const pausedMs = Math.max(0, Number(session.accumulatedPausedMs) || 0);
  return Math.max(0, Math.floor((end - startedAt - pausedMs) / 1000));
}

export async function cancelFocusTimerAlarmForSession(sessionId) {
  const id = String(sessionId ?? '').trim();
  if (!id) return false;
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return false;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const matched = scheduled.filter((request) => (
      String(request?.content?.data?.focusSessionId ?? '') === id
    ));
    await Promise.all(matched.map((request) => (
      Notifications.cancelScheduledNotificationAsync(request.identifier)
    )));
    return true;
  } catch {
    return false;
  }
}

export async function syncFocusTimerAlarmForSession(session) {
  const sessionId = String(session?.id ?? '').trim();
  if (!sessionId) return false;
  await cancelFocusTimerAlarmForSession(sessionId);
  if (
    session.status !== 'running'
    || session.mode !== 'countdown'
    || session.alarmEnabled !== true
  ) return false;
  const targetSeconds = Number(session.targetSeconds);
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return false;
  const remainingSeconds = targetSeconds - elapsedSecondsOf(session);
  if (remainingSeconds <= 0) return false;
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return false;
    const permitted = await ensurePermission(Notifications);
    if (!permitted) return false;
    const soundMode = await readSoundMode();
    const channelId = await ensureAndroidChannel(Notifications, soundMode);
    const content = {
      title: '타이머 알림',
      body: `${session.targetTitle || '집중 타이머'} 설정 시간이 지났습니다. 계속 진행 중입니다.`,
      data: {
        focusTimerAlarm: true,
        focusTimerSound: soundMode,
        focusSessionId: sessionId,
      },
    };
    if (soundMode === 'system') content.sound = 'default';
    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.ceil(remainingSeconds)),
      repeats: false,
    };
    if (channelId) trigger.channelId = channelId;
    await Notifications.scheduleNotificationAsync({ content, trigger });
    return true;
  } catch (error) {
    console.warn('[FocusTimerAlarm] schedule failed:', error?.message || error);
    return false;
  }
}
