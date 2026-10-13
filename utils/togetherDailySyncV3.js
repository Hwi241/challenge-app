import {
  loadTogetherRoomSnapshotV2,
  replaceTogetherMemberWeekV3,
} from './togetherRemoteV2';

import {
  loadTogetherWeekDaysV3,
} from './togetherWeeklyRecordsV3';

import {
  getTogetherRoomDateKeyV3,
} from './togetherRoomOverviewV3';

const text = (value) =>
  String(value ?? '').trim();

export const createTogetherDailySyncV3 = ({
  loadSnapshot = loadTogetherRoomSnapshotV2,
  loadDays = loadTogetherWeekDaysV3,
  replaceWeek = replaceTogetherMemberWeekV3,
  dateKey = getTogetherRoomDateKeyV3,
} = {}) => {
  const cache = new Map();

  const readMetadata = async ({
    roomId,
    userId,
  }) => {
    const snapshot = await loadSnapshot({ roomId });
    const room = snapshot?.room;

    const member = Array.isArray(snapshot?.members)
      ? snapshot.members.find(
          (item) =>
            text(item?.userId) === userId
            && item?.status === 'active'
        )
      : null;

    const joinedAt = text(member?.joinedAt);
    const timezone = text(room?.timezone);

    if (
      text(room?.id) !== roomId
      || room?.status !== 'active'
      || !member
      || !timezone
      || !joinedAt
      || !Number.isFinite(Date.parse(joinedAt))
    ) {
      return null;
    }

    return {
      joinedAt,
      timezone,
    };
  };

  const buildPayload = async ({
    challengeId,
    metadata,
    now,
  }) => {
    const today = dateKey(
      now,
      metadata.timezone
    );

    if (!today) return null;

    const days = await loadDays({
      challengeId,
      joinedAt: metadata.joinedAt,
      timezone: metadata.timezone,
      now,
    });

    if (!Array.isArray(days)) return null;

    return {
      today,
      days,
      signature: JSON.stringify({
        challengeId,
        joinedAt: metadata.joinedAt,
        timezone: metadata.timezone,
        today,
        days,
      }),
    };
  };

  const sync = async ({
    room,
    binding,
    userId,
    now = Date.now(),
  } = {}) => {
    const roomId = text(binding?.roomId);
    const challengeId = text(
      binding?.localChallengeId
    );
    const uid = text(userId);

    if (!roomId || !challengeId || !uid) {
      return { synced: false, reason: 'invalid' };
    }

    const key = JSON.stringify([uid, roomId]);
    const previous = cache.get(key);

    const roomVersion = text(
      room?.updated_at ?? room?.updatedAt
    );

    const timezone = text(room?.timezone);

    if (!timezone) {
      return { synced: false, reason: 'timezone' };
    }

    const today = dateKey(now, timezone);

    if (!today) {
      return { synced: false, reason: 'date' };
    }

    const requiresMetadataRefresh =
      !previous
      || previous.roomVersion !== roomVersion
      || previous.challengeId !== challengeId
      || previous.today !== today;

    let metadata = requiresMetadataRefresh
      ? await readMetadata({ roomId, userId: uid })
      : previous.metadata;

    if (!metadata) {
      cache.delete(key);
      return { synced: false, reason: 'membership' };
    }

    let payload = await buildPayload({
      challengeId,
      metadata,
      now,
    });

    if (!payload) {
      return { synced: false, reason: 'local_data' };
    }

    if (
      previous
      && previous.signature === payload.signature
      && previous.roomVersion === roomVersion
    ) {
      return { synced: false, reason: 'unchanged' };
    }

    // 기록이 변경된 경우에는 서버의 최신 가입 시각을
    // 다시 조회해 가입 전 인증이 공유되지 않도록 한다.
    if (!requiresMetadataRefresh) {
      metadata = await readMetadata({
        roomId,
        userId: uid,
      });

      if (!metadata) {
        cache.delete(key);
        return {
          synced: false,
          reason: 'membership',
        };
      }

      payload = await buildPayload({
        challengeId,
        metadata,
        now,
      });

      if (!payload) {
        return {
          synced: false,
          reason: 'local_data',
        };
      }

      if (
        previous.signature === payload.signature
        && previous.roomVersion === roomVersion
      ) {
        return {
          synced: false,
          reason: 'unchanged',
        };
      }
    }

    await replaceWeek({
      roomId,
      days: payload.days,
    });

    // RPC가 실제 성공한 경우에만 캐시를 갱신한다.
    cache.set(key, {
      metadata,
      roomVersion,
      challengeId,
      today: payload.today,
      signature: payload.signature,
    });

    return {
      synced: true,
      reason: 'updated',
    };
  };

  const prune = ({
    userId,
    activeRoomIds = [],
  } = {}) => {
    const uid = text(userId);
    const active = new Set(
      activeRoomIds.map(text)
    );

    for (const key of cache.keys()) {
      const [cachedUserId, cachedRoomId] =
        JSON.parse(key);

      if (
        cachedUserId !== uid
        || !active.has(cachedRoomId)
      ) {
        cache.delete(key);
      }
    }
  };

  return {
    sync,
    prune,
  };
};

export const togetherDailySyncV3 =
  createTogetherDailySyncV3();
