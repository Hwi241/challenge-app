import { getExistingTogetherSession } from './togetherRemoteAuth';
import { loadTogetherBindings } from './togetherBindings';
import { migrateTogetherLegacyBindingsOnce } from './togetherLegacyMigration';
import { loadTogetherProgressMetrics, getTogetherLocalDateKey } from './togetherLocalData';
import { loadTogetherDisplayName } from './togetherProfile';
import { loadMyTogetherRoomsV2, upsertTogetherMemberStateV2 } from './togetherRemoteV2';

export const syncTogetherBindingsOnce = async () => {
  if (!(await getExistingTogetherSession())) return { synced: 0 };
  await migrateTogetherLegacyBindingsOnce();
  const [bindings, rooms, displayName] = await Promise.all([
    loadTogetherBindings(), loadMyTogetherRoomsV2(), loadTogetherDisplayName(),
  ]);
  const roomById = new Map(rooms.filter((room) => (room.room_status ?? room.roomStatus) === 'active').map((room) => [String(room.room_id ?? room.roomId), room]));
  let synced = 0;
  for (const binding of bindings) {
    const room = roomById.get(binding.roomId);
    if (!room || !binding.localChallengeId) continue;
    try {
      const metrics = await loadTogetherProgressMetrics({ challengeId: binding.localChallengeId });
      if (!metrics) continue;
      const mode = room.mode || binding.mode;
      const contribution = mode === 'shared_goal' ? Math.max(0, metrics.contributionMetric - binding.baselineContribution) : 0;
      await upsertTogetherMemberStateV2({ roomId: binding.roomId, localDate: getTogetherLocalDateKey(), completed: metrics.completed, progress: metrics.progress, streak: metrics.streak, contribution, displayName });
      synced += 1;
    } catch (error) {
      console.warn('[Together] state sync failed', error?.message || 'unknown');
    }
  }
  return { synced };
};
