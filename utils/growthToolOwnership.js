import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGrowthProgress, getLevelFromXp } from './growthProgress';
import { getStarBalance, spendStars } from './starWallet';
import { getPurchasedGraphIds } from './graphOwnership';
import {
  getGrowthToolById,
  getGrowthToolPricing,
  getInitialFreeGrowthTools,
} from '../constants/growthToolCatalog';

export const GROWTH_TOOL_OWNERSHIP_KEY = 'growth_tool_ownership_v1';
export const GROWTH_TOOL_OWNERSHIP_MIGRATION_KEY = 'growth_tool_ownership_migration_v1';
export const GROWTH_TOOL_OWNERSHIP_SOURCES = Object.freeze({ INITIAL_FREE:'initial_free', EXPERIENCE_REWARD:'experience_reward', STAR_PURCHASE:'star_purchase', LEGACY_MIGRATION:'legacy_migration' });
export const LEGACY_GROWTH_TOOL_EQUIVALENTS = Object.freeze({ overall_progress:'achievement_goal_progress', month_calendar:'consistency_record_calendar' });

let mutationQueue = Promise.resolve();
const enqueue = (work) => { const next = mutationQueue.catch(() => {}).then(work); mutationQueue = next; return next; };
const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const normalize = (value) => ({ version:1, items: value?.items && typeof value.items === 'object' && !Array.isArray(value.items) ? value.items : {} });

const readOwnership = async () => normalize(parse(await AsyncStorage.getItem(GROWTH_TOOL_OWNERSHIP_KEY), null));
const writeOwnership = async (state) => { const safe = normalize(state); await AsyncStorage.setItem(GROWTH_TOOL_OWNERSHIP_KEY, JSON.stringify(safe)); return safe; };

export const ensureInitialGrowthTools = () => enqueue(async () => {
  const state = await readOwnership();
  let changed = false;
  const items = { ...state.items };
  getInitialFreeGrowthTools().forEach((tool) => {
    if (!items[tool.id]) { items[tool.id] = { source:'initial_free', acquiredAt:null }; changed = true; }
  });
  return changed ? writeOwnership({ version:1, items }) : { version:1, items };
});

export const migrateLegacyGrowthToolOwnership = () => enqueue(async () => {
  const existingMarker = parse(await AsyncStorage.getItem(GROWTH_TOOL_OWNERSHIP_MIGRATION_KEY), null);
  if (existingMarker?.version === 1) return { ...existingMarker, migrated:false };
  const legacyIds = await getPurchasedGraphIds();
  const state = await readOwnership();
  const items = { ...state.items };
  getInitialFreeGrowthTools().forEach((tool) => { if (!items[tool.id]) items[tool.id] = { source:'initial_free', acquiredAt:null }; });
  const mapped = [];
  legacyIds.forEach((legacyId) => {
    const toolId = LEGACY_GROWTH_TOOL_EQUIVALENTS[legacyId];
    if (!toolId) return;
    if (!items[toolId]) items[toolId] = { source:'legacy_migration', acquiredAt:Date.now(), legacyId };
    mapped.push({ legacyId, toolId });
  });
  await writeOwnership({ version:1, items });
  const marker = { version:1, migratedAt:Date.now(), mapped };
  await AsyncStorage.setItem(GROWTH_TOOL_OWNERSHIP_MIGRATION_KEY, JSON.stringify(marker));
  return { ...marker, migrated:true };
});

export const getGrowthToolOwnership = async () => { await ensureInitialGrowthTools(); return readOwnership(); };
export const getOwnedGrowthToolIds = async () => Object.keys((await getGrowthToolOwnership()).items);
export const isGrowthToolOwned = async (id) => Boolean((await getGrowthToolOwnership()).items[String(id)]);
export const getLegacyOwnedGraphIds = () => getPurchasedGraphIds();

export const grantGrowthTool = (id, source = 'experience_reward', acquiredAt = Date.now()) => enqueue(async () => {
  const tool = getGrowthToolById(id);
  if (!tool) return { ok:false, granted:false, reason:'missing' };
  const state = await readOwnership();
  if (state.items[tool.id]) return { ok:true, granted:false, reason:'already_owned', ownership:state.items[tool.id] };
  const ownership = { source, acquiredAt };
  await writeOwnership({ ...state, items:{ ...state.items, [tool.id]:ownership } });
  return { ok:true, granted:true, reason:'granted', ownership };
});
export const addPurchasedGrowthTool = (id) => grantGrowthTool(id, 'star_purchase');

export const getGrowthToolPurchaseState = ({ tool, currentLevel=1, starBalance=0, ownedToolIds=[] }) => {
  const target = typeof tool === 'string' ? getGrowthToolById(tool) : tool;
  if (!target) return { state:'missing', owned:false, canPurchase:false };
  const pricing = getGrowthToolPricing(target, currentLevel);
  const owned = target.acquisition === 'initial_free' || new Set(ownedToolIds.map(String)).has(target.id);
  const common = { owned, recommendedLevel:pricing.recommendedLevel, earlyPurchase:pricing.earlyPurchase, basePrice:pricing.basePrice, currentPrice:pricing.currentPrice, starBalance:Number(starBalance)||0, requiredStars:pricing.currentPrice };
  if (owned) return { ...common, state:'owned', canPurchase:false };
  if (target.acquisition === 'experience_reward') return { ...common, state:'reward_locked', canPurchase:false };
  if (target.acquisition !== 'stars') return { ...common, state:'missing', canPurchase:false };
  if (common.starBalance < pricing.currentPrice) return { ...common, state:'insufficient', canPurchase:false };
  return { ...common, state:'available', canPurchase:true };
};

export const purchaseGrowthTool = (toolId) => enqueue(async () => {
  const tool = getGrowthToolById(toolId);
  if (!tool) return { ok:false, purchased:false, reason:'missing' };
  const [progress, balance, ownership] = await Promise.all([getGrowthProgress(), getStarBalance(), readOwnership()]);
  const currentLevel = getLevelFromXp(progress.totalXp);
  const purchaseState = getGrowthToolPurchaseState({ tool, currentLevel, starBalance:balance, ownedToolIds:Object.keys(ownership.items) });
  if (!purchaseState.canPurchase) return { ok:false, purchased:false, reason:purchaseState.state, purchaseState };
  const spent = await spendStars(purchaseState.currentPrice, 'growth_tool_purchase', { toolId:tool.id, currentLevel, earlyPurchase:purchaseState.earlyPurchase });
  if (!spent?.ok) return { ok:false, purchased:false, reason:spent?.reason || 'spend_failed', purchaseState };
  try {
    const item = { source:'star_purchase', acquiredAt:Date.now(), price:purchaseState.currentPrice };
    await writeOwnership({ ...ownership, items:{ ...ownership.items, [tool.id]:item } });
    return { ok:true, purchased:true, reason:'purchased', toolId:tool.id, price:purchaseState.currentPrice, balance:spent.balance, ownership:item };
  } catch (error) {
    return { ok:false, purchased:false, reason:'ownership_write_failed', starsSpent:true, price:purchaseState.currentPrice, error };
  }
});
