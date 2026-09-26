import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cancelFocusTimerAlarmForSession,
  syncFocusTimerAlarmForSession,
} from './focusTimerAlarm';
import { setFocusTimerAlarmPreference } from './focusTimerPreferences';

const FOCUS_SESSIONS_KEY = 'focus_sessions_v1';
let mutationQueue = Promise.resolve();
const listeners = new Set();

const emitChange = () => listeners.forEach((listener) => listener());

const enqueue = (task) => {
  const next = mutationQueue.catch(() => {}).then(task);
  mutationQueue = next;
  return next;
};

const parseSessions = (raw) => {
  if (raw == null) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('집중 세션 저장 형식이 올바르지 않습니다.');
  return parsed.filter((session) => session && typeof session === 'object');
};

const readSessions = async () => parseSessions(
  await AsyncStorage.getItem(FOCUS_SESSIONS_KEY),
);

const writeSessions = async (sessions) => {
  await AsyncStorage.setItem(FOCUS_SESSIONS_KEY, JSON.stringify(sessions));
  emitChange();
};

const syncAlarm = (session) => {
  syncFocusTimerAlarmForSession(session).catch((error) => {
    console.warn('[FocusSession] alarm sync failed:', error?.message || error);
  });
};

const cancelAlarm = (sessionId) => {
  cancelFocusTimerAlarmForSession(sessionId).catch((error) => {
    console.warn('[FocusSession] alarm cancel failed:', error?.message || error);
  });
};

const isActive = (session) => (
  session?.status === 'running' || session?.status === 'paused'
);

export function getFocusSessionElapsedSeconds(session, now = Date.now()) {
  if (!session || !Number.isFinite(Number(session.startedAt))) return 0;
  const end = session.status === 'paused'
    ? Number(session.pausedAt)
    : session.status === 'completed'
    ? Number(session.endedAt)
    : Number(now);
  if (!Number.isFinite(end)) return 0;
  const elapsedMs = end
    - Number(session.startedAt)
    - Math.max(0, Number(session.accumulatedPausedMs) || 0);
  return Math.max(0, Math.floor(elapsedMs / 1000));
}

export function getFocusSessionDisplaySeconds(session, now = Date.now()) {
  const elapsed = getFocusSessionElapsedSeconds(session, now);
  return session?.mode === 'countdown'
    ? Number(session.targetSeconds) - elapsed
    : elapsed;
}

export function formatFocusSessionTime(seconds) {
  const raw = Number(seconds) || 0;
  const negative = raw < 0;
  const total = Math.max(0, Math.floor(Math.abs(raw)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const formatted = [hours, minutes, remaining]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return negative ? `-${formatted}` : formatted;
}

export function subscribeFocusSessions(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const loadFocusSessions = () => readSessions();

export async function loadFocusSession(sessionId) {
  const sessions = await readSessions();
  return sessions.find((session) => session.id === String(sessionId)) ?? null;
}

export async function loadActiveFocusSession() {
  const sessions = await readSessions();
  return sessions.find(isActive) ?? null;
}

export function createFocusSession(input, options = {}) {
  const targetType = input?.targetType;
  const targetId = String(input?.targetId ?? '').trim();
  const targetTitle = String(input?.targetTitle ?? '').trim();
  const targetSubtype = input?.targetSubtype === 'rotation' ? 'rotation' : null;
  const rotationItemId = targetSubtype
    ? String(input?.rotationItemId ?? '').trim() || null
    : null;
  const rotationItemTitle = targetSubtype
    ? String(input?.rotationItemTitle ?? '').trim() || null
    : null;
  const rotationCycleNumber = targetSubtype ? Number(input?.rotationCycleNumber) : null;
  const rotationStartProgressSeconds = targetSubtype
    ? Number(input?.rotationStartProgressSeconds)
    : null;
  const alarmEnabled = input?.alarmEnabled !== false;
  const mode = input?.mode;
  const targetSeconds = mode === 'countdown' ? Number(input?.targetSeconds) : null;
  if (!['challenge', 'habit'].includes(targetType) || !targetId || !targetTitle) {
    throw new Error('집중할 도전 또는 습관 정보가 올바르지 않습니다.');
  }
  if (targetSubtype) {
    if (!rotationItemId || !rotationItemTitle) {
      throw new Error('루틴 현재 활동 정보가 올바르지 않습니다.');
    }
    if (!Number.isSafeInteger(rotationCycleNumber) || rotationCycleNumber < 1) {
      throw new Error('루틴 회차 정보가 올바르지 않습니다.');
    }
    if (
      !Number.isSafeInteger(rotationStartProgressSeconds)
      || rotationStartProgressSeconds < 0
    ) {
      throw new Error('루틴 시작 진행시간이 올바르지 않습니다.');
    }
  }
  if (!['stopwatch', 'countdown'].includes(mode)) {
    throw new Error('타이머 방식을 확인해주세요.');
  }
  if (
    mode === 'countdown'
    && (!Number.isSafeInteger(targetSeconds) || targetSeconds < 60 || targetSeconds > 86400)
  ) {
    throw new Error('카운트다운은 1~1440분이어야 합니다.');
  }
  const now = options.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('시작 시각이 올바르지 않습니다.');
  return {
    id: options.id ?? `focus_${now}_${Math.random().toString(36).slice(2, 9)}`,
    targetType,
    targetId,
    targetTitle,
    ...(targetSubtype ? {
      targetSubtype,
      rotationItemId,
      rotationItemTitle,
      rotationCycleNumber,
      rotationStartProgressSeconds,
    } : {}),
    mode,
    targetSeconds,
    alarmEnabled,
    startedAt: now,
    pausedAt: null,
    accumulatedPausedMs: 0,
    endedAt: null,
    status: 'running',
    elapsedSeconds: null,
  };
}

export function startFocusSession(input, options = {}) {
  return enqueue(async () => {
    const sessions = await readSessions();
    const active = sessions.find(isActive);
    if (active) {
      const error = new Error('이미 실행 중인 집중 타이머가 있습니다.');
      error.code = 'FOCUS_SESSION_ACTIVE';
      error.session = active;
      throw error;
    }
    const session = createFocusSession(input, options);
    await writeSessions([session, ...sessions]);
    syncAlarm(session);
    return session;
  });
}

const updateSession = (sessionId, transition) => enqueue(async () => {
  const sessions = await readSessions();
  const index = sessions.findIndex((session) => session.id === String(sessionId));
  if (index < 0) throw new Error('집중 세션을 찾지 못했습니다.');
  const next = transition(sessions[index]);
  if (next === sessions[index]) return next;
  sessions[index] = next;
  await writeSessions(sessions);
  return next;
});

export async function pauseFocusSession(sessionId, options = {}) {
  const next = await updateSession(sessionId, (session) => {
    if (session.status !== 'running') return session;
    const now = options.now ?? Date.now();
    return { ...session, status: 'paused', pausedAt: now };
  });
  syncAlarm(next);
  return next;
}

export async function resumeFocusSession(sessionId, options = {}) {
  const next = await updateSession(sessionId, (session) => {
    if (session.status !== 'paused') return session;
    const now = options.now ?? Date.now();
    const pausedMs = Math.max(0, now - Number(session.pausedAt || now));
    return {
      ...session,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: (Number(session.accumulatedPausedMs) || 0) + pausedMs,
    };
  });
  syncAlarm(next);
  return next;
}

export async function finishFocusSession(sessionId, options = {}) {
  const completed = await updateSession(sessionId, (session) => {
    if (session.status === 'completed') return session;
    const now = options.now ?? Date.now();
    const endedAt = session.status === 'paused' ? Number(session.pausedAt) : now;
    const next = { ...session, status: 'completed', endedAt, pausedAt: null };
    return {
      ...next,
      elapsedSeconds: getFocusSessionElapsedSeconds(next, endedAt),
    };
  });
  cancelAlarm(sessionId);
  return completed;
}

export async function setFocusSessionAlarmEnabled(sessionId, enabled) {
  const alarmEnabled = !!enabled;
  const next = await updateSession(sessionId, (session) => ({
    ...session,
    alarmEnabled,
  }));
  await setFocusTimerAlarmPreference(next.targetId, alarmEnabled);
  syncAlarm(next);
  return next;
}

export const cancelFocusSession = (sessionId) => enqueue(async () => {
  const id = String(sessionId ?? '');
  const sessions = await readSessions();
  const index = sessions.findIndex((session) => session.id === id);
  if (index < 0) return null;
  const [removed] = sessions.splice(index, 1);
  await writeSessions(sessions);
  cancelAlarm(id);
  return removed;
});

export { FOCUS_SESSIONS_KEY };
