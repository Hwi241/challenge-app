import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOGETHER_BINDINGS_KEY = 'together_room_bindings_v2';
const parse = (raw) => { try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const normalize = (raw) => {
  if (!raw?.roomId || !raw?.mode) return null;
  return {
    roomId: String(raw.roomId), mode: String(raw.mode),
    localChallengeId: String(raw.localChallengeId ?? ''),
    baselineContribution: Math.max(0, Number(raw.baselineContribution) || 0),
    source: ['owner', 'clone', 'selected'].includes(raw.source) ? raw.source : 'selected',
    createdAt: Number(raw.createdAt) || 0, updatedAt: Number(raw.updatedAt) || 0,
  };
};
export const loadTogetherBindings = async ({ storage = AsyncStorage } = {}) =>
  parse(await storage.getItem(TOGETHER_BINDINGS_KEY)).map(normalize).filter(Boolean);
export const loadTogetherBindingByRoomId = async ({ roomId, storage = AsyncStorage } = {}) =>
  (await loadTogetherBindings({ storage })).find((item) => item.roomId === String(roomId)) || null;
export const upsertTogetherBinding = async ({ binding, storage = AsyncStorage, now = Date.now() } = {}) => {
  const roomId = String(binding?.roomId ?? '').trim();
  if (!roomId) throw new Error('TOGETHER_BINDING_ROOM_REQUIRED');
  const items = await loadTogetherBindings({ storage });
  const previous = items.find((item) => item.roomId === roomId);
  const next = normalize({ ...previous, ...binding, roomId, createdAt: previous?.createdAt || now, updatedAt: now });
  await storage.setItem(TOGETHER_BINDINGS_KEY, JSON.stringify([next, ...items.filter((item) => item.roomId !== roomId)]));
  return next;
};
export const removeTogetherBinding = async ({ roomId, storage = AsyncStorage } = {}) => {
  const items = await loadTogetherBindings({ storage });
  await storage.setItem(TOGETHER_BINDINGS_KEY, JSON.stringify(items.filter((item) => item.roomId !== String(roomId))));
};
