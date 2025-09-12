// utils/challengeStore.js
// 저장/검증/동기화/스케줄(취소→재등록)까지 한 곳에서 처리 + 타임아웃/에러 방어

import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerNotificationsForChallenge, cancelAllForChallenge } from './notificationScheduler';

// ----- 공용 로그 태그 -----
const TAG = '[ChallengeStore]';

// ----- 타임아웃 유틸 -----
function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label || 'timeout'} after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// ---------- 1) 스키마 보정 ----------
export function normalizeChallenge(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const c = { ...raw };

  c.id = String(c.id || '').trim();
  c.title = String(c.title || '');
  c.goalScore = Number.isFinite(c.goalScore) ? c.goalScore : 0;
  c.currentScore = Number.isFinite(c.currentScore) ? c.currentScore : 0;
  c.startDate = c.startDate || null;      // 'YYYY-MM-DD' 혹은 null
  c.endDate = c.endDate || null;
  c.reward = (c.reward ?? null) === '' ? null : (c.reward ?? null);
  c.status = c.status || 'active';
  c.createdAt = c.createdAt || Date.now();
  c.completedAt = c.completedAt || 0;

  if (!c.notification || !c.notification.mode) {
    c.notification = { mode: null, payload: null };
  }

  return c;
}

// ---------- 2) 공용 로드/저장 ----------
export async function loadChallenges() {
  const raw = await AsyncStorage.getItem('challenges');
  const arr = raw ? JSON.parse(raw) : [];
  return Array.isArray(arr) ? arr.map(normalizeChallenge).filter(Boolean) : [];
}

export async function saveChallenges(list) {
  await AsyncStorage.setItem('challenges', JSON.stringify(list));
}

export async function loadChallengeById(id) {
  const raw = await AsyncStorage.getItem(`challenge_${id}`);
  return raw ? normalizeChallenge(JSON.parse(raw)) : null;
}

export async function saveSingle(ch) {
  await AsyncStorage.setItem(`challenge_${ch.id}`, JSON.stringify(ch));
}

// ---------- 3) upsert & 동기화 ----------
export async function upsertChallenge(ch) {
  const next = normalizeChallenge(ch);
  if (!next?.id) throw new Error('invalid id');

  const list = await loadChallenges();
  const idx = list.findIndex((x) => x.id === next.id);
  if (idx >= 0) list[idx] = next; else list.unshift(next);
  await saveChallenges(list);
  await saveSingle(next);

  console.log(TAG, 'upserted:', next.id);
  return next;
}

// ---------- 4) 입력 검증 ----------
// allowEmptyGoal: true면 goalScore가 ''일 때 prevGoalScore 사용
export function validateInput({ title, goalScore, startDate, endDate, allowEmptyGoal = false, prevGoalScore = 0 }) {
  const name = (title || '').trim();
  if (!name) return { ok: false, reason: 'TITLE_EMPTY' };

  let goal;
  if (allowEmptyGoal && goalScore === '') {
    goal = Number(prevGoalScore || 0);
  } else {
    goal = Number(goalScore);
  }
  if (!Number.isFinite(goal) || goal <= 0) return { ok: false, reason: 'GOAL_INVALID' };

  if (!startDate || !endDate) return { ok: false, reason: 'DATES_REQUIRED' };
  if (new Date(startDate) > new Date(endDate)) return { ok: false, reason: 'DATE_ORDER' };

  return { ok: true };
}

// ---------- 5) 저장 + 스케줄(취소/재등록) ----------
// 스케줄 작업은 실패해도 저장은 완료되도록 분리, 각 3초 타임아웃
export async function saveAndSchedule(ch, { replaceSchedules = true } = {}) {
  const saved = await upsertChallenge(ch);

  if (replaceSchedules) {
    try {
      console.log(TAG, 'cancel schedules start:', saved.id);
      await withTimeout(cancelAllForChallenge(saved.id), 3000, 'cancelAllForChallenge');
      console.log(TAG, 'cancel schedules done:', saved.id);
    } catch (e) {
      console.warn(TAG, 'cancel schedules failed (ignored):', e?.message || e);
    }

    try {
      console.log(TAG, 'register schedules start:', saved.id);
      await withTimeout(registerNotificationsForChallenge(saved), 3000, 'registerNotificationsForChallenge');
      console.log(TAG, 'register schedules done:', saved.id);
    } catch (e) {
      console.warn(TAG, 'register schedules failed (ignored):', e?.message || e);
    }
  }

  return saved;
}
