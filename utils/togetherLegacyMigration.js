import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTogetherBindings, upsertTogetherBinding } from './togetherBindings';

export const TOGETHER_V2_MIGRATION_MARKER = 'together_v2_binding_migration_done';
const read = async (storage, key) => { try { const value = JSON.parse((await storage.getItem(key)) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
export const migrateTogetherLegacyBindingsOnce = async ({ storage = AsyncStorage } = {}) => {
  if (await storage.getItem(TOGETHER_V2_MIGRATION_MARKER)) return;
  const current = await loadTogetherBindings({ storage });
  const known = new Set(current.map((item) => item.roomId));
  const rows = [
    ...(await read(storage, 'together_invitations_v1')),
    ...(await read(storage, 'together_accepted_rooms_v1')),
  ];
  for (const row of rows) {
    const roomId = String(row?.serverRoomId ?? '').trim();
    const localChallengeId = String(row?.challengeId ?? '').trim();
    if (!roomId || !localChallengeId || known.has(roomId)) continue;
    await upsertTogetherBinding({ storage, binding: { roomId, mode: 'paired_push', localChallengeId, baselineContribution: 0, source: 'selected' } });
    known.add(roomId);
  }
  await storage.setItem(TOGETHER_V2_MIGRATION_MARKER, '1');
};
