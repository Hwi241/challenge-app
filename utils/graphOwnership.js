// utils/graphOwnership.js
// Graph ownership storage is separate from widget ownership.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GRAPH_CATALOG,
  GRAPH_TIER_UNLOCK_REQUIREMENT,
  getGraphById,
  getGraphsByTier,
} from '../constants/graphCatalog';

export const PURCHASED_GRAPHS_KEY = 'purchased_graphs';

function normalizeGraphIds(ids) {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
}

export async function getPurchasedGraphIds() {
  try {
    const raw = await AsyncStorage.getItem(PURCHASED_GRAPHS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeGraphIds(parsed);
  } catch (error) {
    console.warn('[graphOwnership] getPurchasedGraphIds failed', error);
    return [];
  }
}

export async function setPurchasedGraphIds(ids) {
  const normalized = normalizeGraphIds(ids);
  await AsyncStorage.setItem(PURCHASED_GRAPHS_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function addPurchasedGraphId(graphId) {
  const id = String(graphId || '');
  if (!id) return await getPurchasedGraphIds();

  const current = await getPurchasedGraphIds();
  if (current.includes(id)) return current;

  return await setPurchasedGraphIds([...current, id]);
}

export async function removePurchasedGraphId(graphId) {
  const id = String(graphId || '');
  const current = await getPurchasedGraphIds();
  return await setPurchasedGraphIds(current.filter((ownedId) => ownedId !== id));
}

export async function hasPurchasedGraph(graphId) {
  const id = String(graphId || '');
  const current = await getPurchasedGraphIds();
  return current.includes(id);
}

export function countOwnedGraphsByTier(purchasedGraphIds = [], tier) {
  const ownedSet = new Set(normalizeGraphIds(purchasedGraphIds));
  return GRAPH_CATALOG.filter((graph) => {
    return Number(graph.tier) === Number(tier) && ownedSet.has(String(graph.id));
  }).length;
}

export function getGraphTierUnlockState(tier, purchasedGraphIds = []) {
  const numericTier = Number(tier) || 1;

  if (numericTier <= 1) {
    return {
      unlocked: true,
      tier: 1,
      requiredTier: null,
      requiredCount: 0,
      ownedCount: countOwnedGraphsByTier(purchasedGraphIds, 1),
      message: '',
    };
  }

  const requiredTier = numericTier - 1;
  const ownedCount = countOwnedGraphsByTier(purchasedGraphIds, requiredTier);
  const requiredCount = GRAPH_TIER_UNLOCK_REQUIREMENT;
  const unlocked = ownedCount >= requiredCount;

  return {
    unlocked,
    tier: numericTier,
    requiredTier,
    requiredCount,
    ownedCount,
    message: unlocked
      ? ''
      : `Tier ${numericTier} 그래프를 구매하려면 Tier ${requiredTier} 그래프를 ${requiredCount}개 이상 보유해야 해요.`,
  };
}

export function getGraphPurchaseState({
  graph,
  starBalance = 0,
  purchasedGraphIds = [],
}) {
  const targetGraph = typeof graph === 'string' ? getGraphById(graph) : graph;
  if (!targetGraph) {
    return {
      state: 'missing',
      owned: false,
      canPurchase: false,
      buttonLabel: '구매 불가',
      reasonTitle: '그래프 없음',
      reasonMessage: '구매할 그래프 정보를 찾을 수 없어요.',
    };
  }

  const ownedSet = new Set(normalizeGraphIds(purchasedGraphIds));
  const owned = ownedSet.has(String(targetGraph.id));
  if (owned) {
    return {
      state: 'owned',
      owned: true,
      canPurchase: false,
      buttonLabel: '보유중',
      reasonTitle: '이미 보유중',
      reasonMessage: '이미 구매한 그래프예요.',
    };
  }

  const tierState = getGraphTierUnlockState(targetGraph.tier, purchasedGraphIds);
  if (!tierState.unlocked) {
    return {
      state: 'locked',
      owned: false,
      canPurchase: false,
      buttonLabel: '티어 잠김',
      reasonTitle: '티어 잠김',
      reasonMessage: tierState.message,
      tierState,
    };
  }

  const balance = Number(starBalance || 0);
  const price = Number(targetGraph.price || 0);
  if (balance < price) {
    return {
      state: 'insufficient',
      owned: false,
      canPurchase: false,
      buttonLabel: '별 부족',
      reasonTitle: '별 부족',
      reasonMessage: `별이 부족해요. 필요한 별: ${price}개 / 보유 별: ${balance}개`,
      requiredStars: price,
      starBalance: balance,
    };
  }

  return {
    state: 'available',
    owned: false,
    canPurchase: true,
    buttonLabel: '구매',
    reasonTitle: '그래프 구매',
    reasonMessage: `별 ${price}개를 사용해 이 그래프를 구매할까요?`,
    requiredStars: price,
    starBalance: balance,
  };
}

export function filterGraphsByPurchaseState(graphs, filterKey, context = {}) {
  if (!filterKey || filterKey === 'all') return graphs;

  if (/^tier[1-5]$/.test(filterKey)) {
    const tier = Number(filterKey.replace('tier', ''));
    return (graphs || []).filter((graph) => Number(graph.tier) === tier);
  }

  return (graphs || []).filter((graph) => {
    const purchaseState = getGraphPurchaseState({
      graph,
      starBalance: context.starBalance,
      purchasedGraphIds: context.purchasedGraphIds,
    });

    if (filterKey === 'available') return purchaseState.state === 'available';
    if (filterKey === 'owned') return purchaseState.state === 'owned';
    if (filterKey === 'insufficient') return purchaseState.state === 'insufficient';
    return true;
  });
}

export function getNextTierRequirementMessage(tier, purchasedGraphIds = []) {
  const state = getGraphTierUnlockState(tier, purchasedGraphIds);
  return state.message;
}

export function getTierProgress(tier, purchasedGraphIds = []) {
  const numericTier = Number(tier) || 1;
  if (numericTier <= 1) {
    return {
      tier: numericTier,
      requiredTier: null,
      ownedCount: getGraphsByTier(1).filter((graph) =>
        normalizeGraphIds(purchasedGraphIds).includes(graph.id)
      ).length,
      requiredCount: 0,
      unlocked: true,
    };
  }

  const state = getGraphTierUnlockState(numericTier, purchasedGraphIds);
  return {
    tier: numericTier,
    requiredTier: state.requiredTier,
    ownedCount: state.ownedCount,
    requiredCount: state.requiredCount,
    unlocked: state.unlocked,
  };
}
