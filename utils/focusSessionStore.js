import AsyncStorage from '@react-native-async-storage/async-storage';

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
    ? Math.max(0, Number(session.targetSeconds) - elapsed)
    : elapsed;
}

export function formatFocusSessionTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return [hours, minutes, remaining]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
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
  const mode = input?.mode;
  const targetSeconds = mode === 'countdown' ? Number(input?.targetSeconds) : null;
  if (!['challenge', 'habit'].includes(targetType) || !targetId || !targetTitle) {
    throw new Error('집중할 도전 또는 습관 정보가 올바르지 않습니다.');
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
    } : {}),
    mode,
    targetSeconds,
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

export const pauseFocusSession = (sessionId, options = {}) => updateSession(
  sessionId,
  (session) => {
    if (session.status !== 'running') return session;
    const now = options.now ?? Date.now();
    return { ...session, status: 'paused', pausedAt: now };
  },
);

export const resumeFocusSession = (sessionId, options = {}) => updateSession(
  sessionId,
  (session) => {
    if (session.status !== 'paused') return session;
    const now = options.now ?? Date.now();
    const pausedMs = Math.max(0, now - Number(session.pausedAt || now));
    return {
      ...session,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: (Number(session.accumulatedPausedMs) || 0) + pausedMs,
    };
  },
);

export const finishFocusSession = (sessionId, options = {}) => updateSession(
  sessionId,
  (session) => {
    if (session.status === 'completed') return session;
    const now = options.now ?? Date.now();
    const endedAt = session.status === 'paused' ? Number(session.pausedAt) : now;
    const completed = { ...session, status: 'completed', endedAt, pausedAt: null };
    return {
      ...completed,
      elapsedSeconds: getFocusSessionElapsedSeconds(completed, endedAt),
    };
  },
);

export { FOCUS_SESSIONS_KEY };
