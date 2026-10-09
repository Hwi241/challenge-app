import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY =
  'together_room_drafts_v1';

const ACCEPTED_ROOMS_KEY =
  'together_accepted_rooms_v1';

const parseArray = (
  raw
) => {
  if (!raw) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(raw);

    return (
      Array.isArray(parsed)
        ? parsed
        : []
    );
  } catch {
    return [];
  }
};

const writeArray = async (
  key,
  value
) => {
  await AsyncStorage.setItem(
    key,
    JSON.stringify(value)
  );
};

export const cancelTogetherRoomDraft =
  async (
    draftId
  ) => {
    const safeId =
      String(
        draftId
        ?? ''
      ).trim();

    if (!safeId) {
      return false;
    }

    const current =
      parseArray(
        await AsyncStorage.getItem(
          DRAFTS_KEY
        )
      );

    const next =
      current.filter(
        (draft) =>
          String(
            draft?.id
            ?? ''
          ) !== safeId
      );

    if (
      next.length
      === current.length
    ) {
      return false;
    }

    await writeArray(
      DRAFTS_KEY,
      next
    );

    return true;
  };

export const disconnectTogetherAcceptedRoom =
  async (
    invitationId
  ) => {
    const safeId =
      String(
        invitationId
        ?? ''
      ).trim();

    if (!safeId) {
      return false;
    }

    const current =
      parseArray(
        await AsyncStorage.getItem(
          ACCEPTED_ROOMS_KEY
        )
      );

    const next =
      current.filter(
        (room) =>
          String(
            room?.invitationId
            ?? ''
          ) !== safeId
      );

    if (
      next.length
      === current.length
    ) {
      return false;
    }

    await writeArray(
      ACCEPTED_ROOMS_KEY,
      next
    );

    return true;
  };

const isValidAcceptedRoom = (
  room
) => (
  !!room
  && typeof room === 'object'
  && !Array.isArray(room)
  && room.status
    === 'accepted_local'
  && !!String(
    room.invitationId
    ?? ''
  ).trim()
  && !!String(
    room.challengeId
    ?? ''
  ).trim()
);

export const reconcileTogetherAcceptedRooms =
  async () => {
    const current =
      parseArray(
        await AsyncStorage.getItem(
          ACCEPTED_ROOMS_KEY
        )
      );

    const seen =
      new Set();

    const next = [];

    for (
      const room
      of current
    ) {
      if (
        !isValidAcceptedRoom(
          room
        )
      ) {
        continue;
      }

      const invitationId =
        String(
          room.invitationId
        ).trim();

      if (
        seen.has(
          invitationId
        )
      ) {
        continue;
      }

      seen.add(
        invitationId
      );

      next.push(
        room
      );
    }

    const changed =
      JSON.stringify(current)
      !== JSON.stringify(next);

    if (changed) {
      await writeArray(
        ACCEPTED_ROOMS_KEY,
        next
      );
    }

    return next;
  };

export const loadTogetherReservedChallengeIds =
  async () => {
    const drafts =
      parseArray(
        await AsyncStorage.getItem(
          DRAFTS_KEY
        )
      );

    const rooms =
      parseArray(
        await AsyncStorage.getItem(
          ACCEPTED_ROOMS_KEY
        )
      );

    const ids =
      new Set();

    for (
      const draft
      of drafts
    ) {
      if (
        draft?.status
          !== 'draft'
      ) {
        continue;
      }

      const challengeId =
        String(
          draft?.challengeId
          ?? ''
        ).trim();

      if (challengeId) {
        ids.add(
          challengeId
        );
      }
    }

    for (
      const room
      of rooms
    ) {
      if (
        room?.status
          !== 'accepted_local'
      ) {
        continue;
      }

      const challengeId =
        String(
          room?.challengeId
          ?? ''
        ).trim();

      if (challengeId) {
        ids.add(
          challengeId
        );
      }
    }

    return ids;
  };

export const TOGETHER_DRAFTS_KEY =
  DRAFTS_KEY;

export const TOGETHER_ACCEPTED_ROOMS_KEY =
  ACCEPTED_ROOMS_KEY;
