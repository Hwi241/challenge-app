import AsyncStorage from '@react-native-async-storage/async-storage';

export const STAR_KEYS = {
  wallet: 'star_wallet',
  ledger: 'star_ledger',
  bootstrap: 'star_bootstrap_v1',
  dailyFree: 'star_daily_free_limits',
  weeklyFree: 'star_weekly_free_limits',
  dailyAd: 'star_daily_rewarded_ad_limits',
};

export const INITIAL_TEST_STARS = 2000;
export const MAX_STARS = 10000;
export const MIN_STARS = -5;

const parseJson = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const clampBalance = (value, min = 0) => {
  const n = Number(value || 0);
  return Math.max(min, Math.min(MAX_STARS, n));
};

const dateKey = (date = new Date()) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const weekKey = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return dateKey(d);
};

const readWalletRaw = async () => {
  const raw = await AsyncStorage.getItem(STAR_KEYS.wallet);
  return parseJson(raw, null);
};

const writeWalletRaw = async (wallet) => {
  const safe = {
    balance: clampBalance(wallet?.balance, MIN_STARS),
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(STAR_KEYS.wallet, JSON.stringify(safe));
  return safe;
};

const appendLedger = async (entry) => {
  const raw = await AsyncStorage.getItem(STAR_KEYS.ledger);
  const list = parseJson(raw, []);
  const arr = Array.isArray(list) ? list : [];
  const next = [
    {
      id: `star_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      ...entry,
    },
    ...arr,
  ].slice(0, 300);
  await AsyncStorage.setItem(STAR_KEYS.ledger, JSON.stringify(next));
  return next;
};

export const ensureInitialStars = async () => {
  const bootstrapped = await AsyncStorage.getItem(STAR_KEYS.bootstrap);
  const wallet = await readWalletRaw();

  if (!bootstrapped && !wallet) {
    const next = await writeWalletRaw({ balance: INITIAL_TEST_STARS });
    await appendLedger({
      type: 'grant',
      reason: 'initial_test_stars',
      amount: INITIAL_TEST_STARS,
      balanceAfter: next.balance,
      meta: { once: true },
    });
    await AsyncStorage.setItem(STAR_KEYS.bootstrap, '1');
    return next;
  }

  if (!bootstrapped) {
    await AsyncStorage.setItem(STAR_KEYS.bootstrap, '1');
  }

  if (!wallet) return writeWalletRaw({ balance: 0 });
  return writeWalletRaw(wallet);
};

export const getStarWallet = async () => {
  await ensureInitialStars();
  const wallet = await readWalletRaw();
  return wallet || { balance: 0, updatedAt: Date.now() };
};

export const getStarBalance = async () => {
  const wallet = await getStarWallet();
  return Number(wallet.balance || 0);
};

export const getStarLedger = async () => {
  const raw = await AsyncStorage.getItem(STAR_KEYS.ledger);
  const list = parseJson(raw, []);
  return Array.isArray(list) ? list : [];
};

export const grantStars = async (amount, reason = 'grant', meta = {}) => {
  await ensureInitialStars();
  const wallet = await getStarWallet();
  const before = Number(wallet.balance || 0);
  const requested = Math.max(0, Number(amount || 0));
  const after = clampBalance(before + requested, MIN_STARS);
  const actual = after - before;

  const next = await writeWalletRaw({ balance: after });
  if (actual !== 0) {
    await appendLedger({
      type: 'grant',
      reason,
      amount: actual,
      requestedAmount: requested,
      balanceBefore: before,
      balanceAfter: next.balance,
      meta,
    });
  }

  return { ok: true, balance: next.balance, amount: actual };
};

export const canSpendStars = async (amount) => {
  const balance = await getStarBalance();
  return balance >= Math.max(0, Number(amount || 0));
};

export const spendStars = async (amount, reason = 'spend', meta = {}, options = {}) => {
  await ensureInitialStars();
  const wallet = await getStarWallet();
  const before = Number(wallet.balance || 0);
  const cost = Math.max(0, Number(amount || 0));
  const minBalance = options.allowNegative ? MIN_STARS : 0;

  if (before - cost < minBalance) {
    return { ok: false, reason: 'insufficient_stars', balance: before, required: cost };
  }

  const after = clampBalance(before - cost, minBalance);
  const next = await writeWalletRaw({ balance: after });

  if (cost !== 0) {
    await appendLedger({
      type: 'spend',
      reason,
      amount: -cost,
      balanceBefore: before,
      balanceAfter: next.balance,
      meta,
    });
  }

  return { ok: true, balance: next.balance, amount: cost };
};

export const consumeDailyFreePass = async (key, limit = 1) => {
  const today = dateKey();
  const raw = await AsyncStorage.getItem(STAR_KEYS.dailyFree);
  const state = parseJson(raw, {});
  const next = state?.date === today ? state : { date: today, uses: {} };
  const used = Number(next.uses?.[key] || 0);

  if (used >= limit) {
    return { ok: false, free: false, used, remaining: 0 };
  }

  next.uses = { ...(next.uses || {}), [key]: used + 1 };
  await AsyncStorage.setItem(STAR_KEYS.dailyFree, JSON.stringify(next));
  return { ok: true, free: true, used: used + 1, remaining: Math.max(0, limit - used - 1) };
};

export const consumeWeeklyFreePass = async (key, limit = 1) => {
  const week = weekKey();
  const raw = await AsyncStorage.getItem(STAR_KEYS.weeklyFree);
  const state = parseJson(raw, {});
  const next = state?.week === week ? state : { week, uses: {} };
  const used = Number(next.uses?.[key] || 0);

  if (used >= limit) {
    return { ok: false, free: false, used, remaining: 0 };
  }

  next.uses = { ...(next.uses || {}), [key]: used + 1 };
  await AsyncStorage.setItem(STAR_KEYS.weeklyFree, JSON.stringify(next));
  return { ok: true, free: true, used: used + 1, remaining: Math.max(0, limit - used - 1) };
};

export const grantRewardedAdStars = async (meta = {}) => {
  const today = dateKey();
  const raw = await AsyncStorage.getItem(STAR_KEYS.dailyAd);
  const state = parseJson(raw, {});
  const next = state?.date === today ? state : { date: today, count: 0 };
  next.count = Number(next.count || 0) + 1;
  await AsyncStorage.setItem(STAR_KEYS.dailyAd, JSON.stringify(next));

  const amount = next.count <= 10 ? 3 : 1;
  return grantStars(amount, 'rewarded_ad', { ...meta, dailyCount: next.count });
};
