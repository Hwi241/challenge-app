import AsyncStorage
  from '@react-native-async-storage/async-storage';

export const TOGETHER_COLLAPSED_ROOMS_KEY =
  'together_collapsed_room_ids_v1';

const normalizeMap = (value) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result = {};

  for (
    const [id, collapsed]
    of Object.entries(value)
  ) {
    if (
      id &&
      collapsed === true
    ) {
      result[id] = true;
    }
  }

  return result;
};

export const loadTogetherCollapsedRoomsV2 =
  async ({
    storage = AsyncStorage,
  } = {}) => {
    const raw = await storage.getItem(
      TOGETHER_COLLAPSED_ROOMS_KEY
    );

    if (!raw) {
      return {};
    }

    try {
      return normalizeMap(
        JSON.parse(raw)
      );
    } catch {
      return {};
    }
  };

export const saveTogetherCollapsedRoomsV2 =
  async ({
    collapsedMap,
    storage = AsyncStorage,
  } = {}) => {
    const normalized =
      normalizeMap(collapsedMap);

    await storage.setItem(
      TOGETHER_COLLAPSED_ROOMS_KEY,
      JSON.stringify(normalized)
    );

    return normalized;
  };
