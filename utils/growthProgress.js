import AsyncStorage from '@react-native-async-storage/async-storage';

export const GROWTH_PROGRESS_KEY = 'growth_progress_v1';

const safeXp = (value) => Math.max(0, Math.floor(Number(value) || 0));

export const getXpForLevel = (level) => {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return 10 * (safeLevel * safeLevel - 1);
};

export const getLevelFromXp = (totalXp) => (
  Math.max(1, Math.floor(Math.sqrt((safeXp(totalXp) / 10) + 1)))
);

export const getLevelProgress = (totalXp) => {
  const xp = safeXp(totalXp);
  const level = getLevelFromXp(xp);
  const currentLevelStartXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const xpNeededForLevel = nextLevelXp - currentLevelStartXp;
  const xpIntoLevel = xp - currentLevelStartXp;
  return {
    level,
    totalXp: xp,
    currentLevelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeededForLevel,
    progress: Math.min(1, Math.max(0, xpIntoLevel / xpNeededForLevel)),
  };
};

export const getStarPurchaseDiscountTier = (level) => {
  const value = Math.max(1, Math.floor(Number(level) || 1));
  if (value >= 50) return { id: 'lv50', rate: 0.3 };
  if (value >= 30) return { id: 'lv30', rate: 0.1 };
  if (value >= 20) return { id: 'lv20', rate: 0.05 };
  return { id: 'base', rate: 0 };
};

export const getStarPurchaseDiscountRate = (level) => (
  getStarPurchaseDiscountTier(level).rate
);

export const getGrowthProgress = async () => {
  const raw = await AsyncStorage.getItem(GROWTH_PROGRESS_KEY);
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch {}
  return { version: 1, totalXp: safeXp(parsed?.totalXp), updatedAt: parsed?.updatedAt ?? null };
};

export const setGrowthXpIfEmpty = async (totalXp, updatedAt = Date.now()) => {
  const existing = await AsyncStorage.getItem(GROWTH_PROGRESS_KEY);
  if (existing != null) return { applied: false, progress: await getGrowthProgress() };
  const progress = { version: 1, totalXp: safeXp(totalXp), updatedAt };
  await AsyncStorage.setItem(GROWTH_PROGRESS_KEY, JSON.stringify(progress));
  return { applied: true, progress };
};

export const addGrowthXp = async (amount, meta = {}) => {
  const requested = Math.max(0, Math.floor(Number(amount) || 0));
  const current = await getGrowthProgress();
  const next = {
    version: 1,
    totalXp: current.totalXp + requested,
    updatedAt: Date.now(),
    lastReward: requested > 0 ? meta : current.lastReward,
  };
  await AsyncStorage.setItem(GROWTH_PROGRESS_KEY, JSON.stringify(next));
  return { amount: requested, ...getLevelProgress(next.totalXp) };
};
