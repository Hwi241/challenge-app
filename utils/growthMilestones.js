import AsyncStorage from '@react-native-async-storage/async-storage';
import { addGrowthXp } from './growthProgress';
import { grantStars } from './starWallet';

export const GROWTH_MILESTONES_KEY = 'growth_milestones_v1';
export const ACTIVITY_STREAK_MILESTONES = [
  { id: 'activity_streak_7', days: 7, xp: 15, stars: 3 },
  { id: 'activity_streak_30', days: 30, xp: 40, stars: 8 },
  { id: 'activity_streak_100', days: 100, xp: 100, stars: 20 },
];

const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };

export const calculateCurrentActivityStreak = (dateKeys = []) => {
  const days = [...new Set(dateKeys)].map((key) => {
    const value = new Date(`${key}T12:00:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }).filter(Boolean).sort((a, b) => b - a);
  if (!days.length) return 0;
  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    const difference = Math.round((days[index - 1] - days[index]) / 86400000);
    if (difference !== 1) break;
    streak += 1;
  }
  return streak;
};

export const calculateLongestActivityStreak = (dateKeys = []) => {
  const days = [...new Set(dateKeys)].map((key) => {
    const value = new Date(`${key}T12:00:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }).filter(Boolean).sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous = null;
  days.forEach((day) => {
    const difference = previous == null ? null : Math.round((day - previous) / 86400000);
    current = difference === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  });
  return longest;
};

export const applyActivityMilestones = async (dateKeys, achievedAt = Date.now()) => {
  const raw = await AsyncStorage.getItem(GROWTH_MILESTONES_KEY);
  const stored = parse(raw, { version: 1, milestones: {} });
  const milestones = stored?.milestones && typeof stored.milestones === 'object' ? { ...stored.milestones } : {};
  const streak = calculateCurrentActivityStreak(dateKeys);
  const awarded = [];
  for (const definition of ACTIVITY_STREAK_MILESTONES) {
    if (streak < definition.days || milestones[definition.id]?.rewardApplied) continue;
    const pending = { milestoneId: definition.id, achievedAt, rewardApplied: false };
    milestones[definition.id] = pending;
    await AsyncStorage.setItem(GROWTH_MILESTONES_KEY, JSON.stringify({ version: 1, milestones }));
    await addGrowthXp(definition.xp, { reason: 'activity_milestone', milestoneId: definition.id });
    await grantStars(definition.stars, 'activity_milestone', { milestoneId: definition.id });
    milestones[definition.id] = { ...pending, rewardApplied: true };
    awarded.push(definition);
  }
  await AsyncStorage.setItem(GROWTH_MILESTONES_KEY, JSON.stringify({ version: 1, milestones }));
  return { streak, awarded };
};
