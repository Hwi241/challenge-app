import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_WIDGET_IDS,
  WIDGET_CATALOG,
  getShopWidgets,
  getWidgetById,
} from '../constants/widgetCatalog';

export const OWNED_WIDGETS_KEY = 'owned_widgets';

const parseJson = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const uniqueIds = (ids = []) => Array.from(new Set(ids.filter(Boolean)));

export const getPurchasedWidgetIds = async () => {
  const raw = await AsyncStorage.getItem(OWNED_WIDGETS_KEY);
  const parsed = parseJson(raw, []);
  return Array.isArray(parsed) ? uniqueIds(parsed.map(String)) : [];
};

export const setPurchasedWidgetIds = async (ids = []) => {
  const next = uniqueIds(ids.map(String)).filter((id) => {
    const widget = getWidgetById(id);
    return widget && widget.shop;
  });
  await AsyncStorage.setItem(OWNED_WIDGETS_KEY, JSON.stringify(next));
  return next;
};

export const getOwnedWidgetIds = async () => {
  const purchased = await getPurchasedWidgetIds();
  return uniqueIds([...DEFAULT_WIDGET_IDS, ...purchased]);
};

export const getOwnedWidgets = async () => {
  const ownedIds = await getOwnedWidgetIds();
  return WIDGET_CATALOG.filter((widget) => ownedIds.includes(widget.id));
};

export const isWidgetOwned = async (widgetId) => {
  const ownedIds = await getOwnedWidgetIds();
  return ownedIds.includes(String(widgetId));
};

export const addPurchasedWidgetId = async (widgetId) => {
  const widget = getWidgetById(widgetId);
  if (!widget || !widget.shop) {
    return { ok: false, reason: 'not_shop_widget' };
  }

  const purchased = await getPurchasedWidgetIds();
  if (purchased.includes(widget.id)) {
    return { ok: true, alreadyOwned: true, purchased };
  }

  const next = await setPurchasedWidgetIds([...purchased, widget.id]);
  return { ok: true, alreadyOwned: false, purchased: next };
};

const countPurchasedInTier = (purchasedIds = [], tier) =>
  getShopWidgets().filter((widget) => widget.tier === tier && purchasedIds.includes(widget.id)).length;

const areAllTierWidgetsPurchased = (purchasedIds = [], tier) => {
  const tierWidgets = getShopWidgets().filter((widget) => widget.tier === tier);
  if (!tierWidgets.length) return false;
  return tierWidgets.every((widget) => purchasedIds.includes(widget.id));
};

export const getTierUnlockState = async () => {
  const purchasedIds = await getPurchasedWidgetIds();

  const unlocked = {
    1: true,
    2: countPurchasedInTier(purchasedIds, 1) >= 3,
    3: false,
    4: false,
    5: false,
  };

  unlocked[3] = unlocked[2] && countPurchasedInTier(purchasedIds, 2) >= 3;
  unlocked[4] = unlocked[3] && countPurchasedInTier(purchasedIds, 3) >= 3;
  unlocked[5] = [1, 2, 3, 4].every((tier) => areAllTierWidgetsPurchased(purchasedIds, tier));

  let highestUnlocked = 1;
  [2, 3, 4, 5].forEach((tier) => {
    if (unlocked[tier]) highestUnlocked = tier;
  });

  const maxVisibleTier = Math.min(5, highestUnlocked + 1);
  const visibleTiers = [1, 2, 3, 4, 5]
    .filter((tier) => tier <= maxVisibleTier)
    .map((tier) => ({
      tier,
      unlocked: !!unlocked[tier],
      previewOnly: !unlocked[tier],
      purchasedCount: countPurchasedInTier(purchasedIds, tier),
      totalCount: getShopWidgets().filter((widget) => widget.tier === tier).length,
    }));

  return {
    purchasedIds,
    unlocked,
    highestUnlocked,
    visibleTiers,
  };
};
