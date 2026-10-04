import AsyncStorage from '@react-native-async-storage/async-storage';
import { GROWTH_REWARD_KEYS, getFocusRewardTier, getGrowthLocalDateKey, isHabitScheduledOnDate } from './growthRewards';
import { ACTIVITY_STREAK_MILESTONES, calculateLongestActivityStreak, GROWTH_MILESTONES_KEY } from './growthMilestones';
import { setGrowthXpIfEmpty } from './growthProgress';

export const GROWTH_MIGRATION_KEY = 'growth_migration_v1';

const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const validTimestamp = (entry) => {
  const value = Number(entry?.timestamp ?? entry?.completedAt ?? entry?.endedAt);
  return Number.isFinite(value) && getGrowthLocalDateKey(value) ? value : null;
};

export const migrateExistingGrowthData = async (now = Date.now()) => {
  const stored = parse(await AsyncStorage.getItem(GROWTH_MIGRATION_KEY), null);
  if (stored?.version === 1) return { ...stored, migrated: false };

  const challenges = parse(await AsyncStorage.getItem('challenges'), []);
  const safeChallenges = Array.isArray(challenges) ? challenges : [];
  let calculatedXp = 0;
  const activityDates = new Set();
  const dailyClaims = {};
  const focusSessionClaims = {};
  const lifetimeClaims = {};
  const included = { challengeDays: 0, habitDays: 0, routineCycles: 0, focusSessions: 0, completedChallenges: 0, milestones: [] };

  for (const challenge of safeChallenges) {
    const id = String(challenge?.id ?? '').trim();
    if (!id) continue;
    const entries = parse(await AsyncStorage.getItem(`entries_${id}`), []);
    if (!Array.isArray(entries)) continue;
    if (challenge?.type === 'rotation' || challenge?.rotation) {
      const seen = new Set();
      entries.filter((entry) => entry?.completedCycle === true).forEach((entry) => {
        const timestamp = validTimestamp(entry);
        const date = timestamp && getGrowthLocalDateKey(timestamp);
        const key = date && `${id}:${date}`;
        if (!key || seen.has(key)) return;
        seen.add(key); activityDates.add(date); calculatedXp += 8; included.routineCycles += 1;
        dailyClaims[`routine:${id}:${date}`] = { claimedAt: now, xp: 8, stars: 0, migrated: true };
      });
    } else {
      const seen = new Set();
      entries.forEach((entry) => {
        const timestamp = validTimestamp(entry);
        const date = timestamp && getGrowthLocalDateKey(timestamp);
        if (!date || seen.has(date) || (challenge?.type === 'habit' && !isHabitScheduledOnDate(challenge, timestamp))) return;
        seen.add(date); activityDates.add(date); calculatedXp += 5;
        const type = challenge?.type === 'habit' ? 'habit' : 'challenge';
        dailyClaims[`${type}:${id}:${date}`] = { claimedAt: now, xp: 5, stars: 0, migrated: true };
        if (challenge?.type === 'habit') included.habitDays += 1;
        else included.challengeDays += 1;
      });
    }
    if (challenge?.type !== 'habit' && challenge?.type !== 'rotation' && (challenge?.status === 'completed' || Number(challenge?.completedAt) > 0)) {
      calculatedXp += 20;
      included.completedChallenges += 1;
      lifetimeClaims[`challenge_complete:${id}`] = { claimedAt: now, xp: 20, stars: 0, migrated: true };
    }
  }

  const hallOfFame = parse(await AsyncStorage.getItem('hof'), []);
  const completedIds = new Set(
    safeChallenges
      .filter((challenge) => challenge?.type !== 'habit' && challenge?.type !== 'rotation' && (challenge?.status === 'completed' || Number(challenge?.completedAt) > 0))
      .map((challenge) => String(challenge.id)),
  );
  if (Array.isArray(hallOfFame)) hallOfFame.forEach((record) => {
    const id = String(record?.challengeId ?? record?.id ?? '').trim();
    if (!id || completedIds.has(id) || record?.status !== 'completed') return;
    completedIds.add(id);
    calculatedXp += 20;
    included.completedChallenges += 1;
    lifetimeClaims[`challenge_complete:${id}`] = { claimedAt: now, xp: 20, stars: 0, migrated: true };
  });

  const focusSessions = parse(await AsyncStorage.getItem('focus_sessions_v1'), []);
  const focusByDate = {};
  if (Array.isArray(focusSessions)) focusSessions.forEach((session) => {
    if (session?.status !== 'completed') return;
    const timestamp = validTimestamp(session);
    const date = timestamp && getGrowthLocalDateKey(timestamp);
    if (!date) return;
    const tier = getFocusRewardTier((Number(session?.elapsedSeconds) || 0) / 60);
    if (!tier.xp) return;
    const before = Number(focusByDate[date] || 0);
    const amount = Math.max(0, Math.min(tier.xp, 12 - before));
    if (!amount) return;
    focusByDate[date] = before + amount;
    activityDates.add(date); calculatedXp += amount; included.focusSessions += 1;
    focusSessionClaims[String(session.id ?? `${date}:${included.focusSessions}`)] = { date, xp: amount, stars: 0, migrated: true };
  });

  const streak = calculateLongestActivityStreak([...activityDates]);
  ACTIVITY_STREAK_MILESTONES.forEach((milestone) => {
    if (streak >= milestone.days) {
      calculatedXp += milestone.xp;
      included.milestones.push(milestone.id);
    }
  });

  if (included.milestones.length > 0) {
    const existingMilestoneState = parse(await AsyncStorage.getItem(GROWTH_MILESTONES_KEY), {});
    const milestones = { ...(existingMilestoneState?.milestones || {}), ...Object.fromEntries(included.milestones.map((milestoneId) => [
      milestoneId,
      { milestoneId, achievedAt: now, rewardApplied: true, migratedXpOnly: true },
    ])) };
    await AsyncStorage.setItem(GROWTH_MILESTONES_KEY, JSON.stringify({ version: 1, milestones }));
  }

  const existingDaily = parse(await AsyncStorage.getItem(GROWTH_REWARD_KEYS.daily), {});
  await AsyncStorage.setItem(GROWTH_REWARD_KEYS.daily, JSON.stringify({
    ...(existingDaily && typeof existingDaily === 'object' ? existingDaily : {}),
    version: 1,
    claims: { ...dailyClaims, ...(existingDaily?.claims || {}) },
    activityDates: [...new Set([...(existingDaily?.activityDates || []), ...activityDates])].sort(),
    focusSessions: { ...focusSessionClaims, ...(existingDaily?.focusSessions || {}) },
    focusTotals: { ...Object.fromEntries(Object.entries(focusByDate).map(([date, xp]) => [date, { xp, stars: 0 }])), ...(existingDaily?.focusTotals || {}) },
  }));
  const existingLifetime = parse(await AsyncStorage.getItem(GROWTH_REWARD_KEYS.lifetime), {});
  await AsyncStorage.setItem(GROWTH_REWARD_KEYS.lifetime, JSON.stringify({
    ...(existingLifetime && typeof existingLifetime === 'object' ? existingLifetime : {}),
    version: 1,
    claims: { ...lifetimeClaims, ...(existingLifetime?.claims || {}) },
  }));

  const migratedAt = now;
  const progress = await setGrowthXpIfEmpty(calculatedXp, migratedAt);
  const migration = { version: 1, calculatedXp, migratedAt, applied: progress.applied, included };
  await AsyncStorage.setItem(GROWTH_MIGRATION_KEY, JSON.stringify(migration));
  return { ...migration, migrated: true };
};
