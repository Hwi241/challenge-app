import AsyncStorage from '@react-native-async-storage/async-storage';
import { addGrowthXp } from './growthProgress';
import { applyActivityMilestones } from './growthMilestones';
import { grantStars } from './starWallet';

export const GROWTH_REWARD_KEYS = {
  daily: 'growth_daily_rewards_v1',
  lifetime: 'growth_lifetime_rewards_v1',
};

let rewardQueue = Promise.resolve();
const enqueue = (work) => {
  const next = rewardQueue.catch(() => {}).then(work);
  rewardQueue = next;
  return next;
};
const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const pad = (value) => String(value).padStart(2, '0');
export const getGrowthLocalDateKey = (value = Date.now()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const result = (awarded, xp = 0, stars = 0, reason = 'awarded', extra = {}) => ({ awarded, xp, stars, reason, ...extra });
const isToday = (occurredAt, now) => getGrowthLocalDateKey(occurredAt) === getGrowthLocalDateKey(now);

const readDaily = async () => {
  const value = parse(await AsyncStorage.getItem(GROWTH_REWARD_KEYS.daily), {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const readLifetime = async () => {
  const value = parse(await AsyncStorage.getItem(GROWTH_REWARD_KEYS.lifetime), {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const award = async ({ xp, stars, reason, meta }) => {
  const xpResult = await addGrowthXp(xp, { reason, ...meta });
  const starResult = stars > 0 ? await grantStars(stars, reason, meta) : { amount: 0 };
  return { xp: xpResult.amount, stars: Number(starResult.amount || 0) };
};

const claimDailyActivity = ({ type, activityId, occurredAt = Date.now(), now = Date.now(), xp, stars }) => enqueue(async () => {
  const id = String(activityId ?? '').trim();
  if (!id) return result(false, 0, 0, 'missing_activity_id');
  if (!isToday(occurredAt, now)) return result(false, 0, 0, 'not_today');
  const date = getGrowthLocalDateKey(occurredAt);
  const state = await readDaily();
  const claims = state.claims && typeof state.claims === 'object' ? { ...state.claims } : {};
  const claimKey = `${type}:${id}:${date}`;
  if (claims[claimKey]) return result(false, 0, 0, 'already_rewarded', { date });
  const paid = await award({ xp, stars, reason: `${type}_activity`, meta: { activityId: id, date } });
  claims[claimKey] = { claimedAt: now, xp: paid.xp, stars: paid.stars };
  const activityDates = [...new Set([...(Array.isArray(state.activityDates) ? state.activityDates : []), date])].sort();
  await AsyncStorage.setItem(GROWTH_REWARD_KEYS.daily, JSON.stringify({ ...state, version: 1, claims, activityDates }));
  const milestones = await applyActivityMilestones(activityDates, now);
  const milestoneXp = milestones.awarded.reduce((sum, item) => sum + item.xp, 0);
  const milestoneStars = milestones.awarded.reduce((sum, item) => sum + item.stars, 0);
  return result(true, paid.xp + milestoneXp, paid.stars + milestoneStars, 'awarded', { date, milestones });
});

export const rewardChallengeEntry = (input) => claimDailyActivity({ ...input, type: 'challenge', xp: 5, stars: 1 });
export const rewardHabitCompletion = (input) => claimDailyActivity({ ...input, type: 'habit', xp: 5, stars: 1 });
export const rewardRoutineCycle = (input) => claimDailyActivity({ ...input, type: 'routine', xp: 8, stars: 2 });

export const isHabitScheduledOnDate = (habit, value = Date.now()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const cycle = habit?.habitCycle;
  if (!cycle?.type) return true;
  if (cycle.type === 'weekly') {
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    return Array.isArray(cycle.days) && cycle.days.map(String).includes(labels[date.getDay()]);
  }
  if (cycle.type === 'monthly') {
    return Array.isArray(cycle.dates) && cycle.dates.map(Number).includes(date.getDate());
  }
  return false;
};

export const rewardDailyAppUse = ({ occurredAt = Date.now(), now = Date.now() } = {}) => enqueue(async () => {
  if (!isToday(occurredAt, now)) return result(false, 0, 0, 'not_today');
  const date = getGrowthLocalDateKey(now);
  const state = await readDaily();
  if (state.appVisits?.[date]) return result(false, 0, 0, 'already_rewarded');
  const paid = await award({ xp: 1, stars: 0, reason: 'daily_app_use', meta: { date } });
  await AsyncStorage.setItem(GROWTH_REWARD_KEYS.daily, JSON.stringify({ ...state, version: 1, appVisits: { ...(state.appVisits || {}), [date]: now } }));
  return result(true, paid.xp, 0);
});

const claimLifetime = (claimKey, xp, stars, reason, now = Date.now()) => enqueue(async () => {
  const state = await readLifetime();
  if (state.claims?.[claimKey]) return result(false, 0, 0, 'already_rewarded');
  const paid = await award({ xp, stars, reason, meta: { claimKey } });
  const claims = { ...(state.claims || {}), [claimKey]: { claimedAt: now, xp: paid.xp, stars: paid.stars } };
  await AsyncStorage.setItem(GROWTH_REWARD_KEYS.lifetime, JSON.stringify({ ...state, version: 1, claims }));
  return result(true, paid.xp, paid.stars);
});

export const rewardFirstFeatureUse = (featureId, now) => {
  const id = String(featureId ?? '').trim();
  if (!id) return Promise.resolve(result(false, 0, 0, 'missing_feature_id'));
  return claimLifetime(`feature:${id}`, 8, 0, 'first_feature_use', now);
};
export const rewardChallengeFinalCompletion = (challengeId, now) => {
  const id = String(challengeId ?? '').trim();
  if (!id) return Promise.resolve(result(false, 0, 0, 'missing_activity_id'));
  return claimLifetime(`challenge_complete:${id}`, 20, 5, 'challenge_final_completion', now);
};

export const getFocusRewardTier = (minutes) => {
  const value = Math.max(0, Number(minutes) || 0);
  if (value >= 50) return { xp: 6, stars: 2 };
  if (value >= 25) return { xp: 4, stars: 1 };
  if (value >= 10) return { xp: 2, stars: 0 };
  return { xp: 0, stars: 0 };
};

export const rewardFocusSession = ({ sessionId, durationSeconds, occurredAt = Date.now(), now = Date.now() } = {}) => enqueue(async () => {
  const id = String(sessionId ?? '').trim();
  if (!id) return result(false, 0, 0, 'missing_session_id');
  if (!isToday(occurredAt, now)) return result(false, 0, 0, 'not_today');
  const tier = getFocusRewardTier((Number(durationSeconds) || 0) / 60);
  if (!tier.xp && !tier.stars) return result(false, 0, 0, 'below_minimum');
  const date = getGrowthLocalDateKey(now);
  const state = await readDaily();
  if (state.focusSessions?.[id]) return result(false, 0, 0, 'already_rewarded');
  const totals = state.focusTotals?.[date] || { xp: 0, stars: 0 };
  const xp = Math.max(0, Math.min(tier.xp, 12 - Number(totals.xp || 0)));
  const stars = Math.max(0, Math.min(tier.stars, 2 - Number(totals.stars || 0)));
  if (!xp && !stars) return result(false, 0, 0, 'daily_cap');
  const paid = await award({ xp, stars, reason: 'focus_session', meta: { sessionId: id, date } });
  const activityDates = [...new Set([...(state.activityDates || []), date])].sort();
  await AsyncStorage.setItem(GROWTH_REWARD_KEYS.daily, JSON.stringify({ ...state, version: 1, activityDates, focusSessions: { ...(state.focusSessions || {}), [id]: { date, xp: paid.xp, stars: paid.stars } }, focusTotals: { ...(state.focusTotals || {}), [date]: { xp: Number(totals.xp || 0) + paid.xp, stars: Number(totals.stars || 0) + paid.stars } } }));
  const milestones = await applyActivityMilestones(activityDates, now);
  const milestoneXp = milestones.awarded.reduce((sum, item) => sum + item.xp, 0);
  const milestoneStars = milestones.awarded.reduce((sum, item) => sum + item.stars, 0);
  return result(true, paid.xp + milestoneXp, paid.stars + milestoneStars, xp < tier.xp || stars < tier.stars ? 'daily_cap' : 'awarded', { milestones });
});
