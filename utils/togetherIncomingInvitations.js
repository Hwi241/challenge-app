import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getChallengeType,
  CHALLENGE_TYPE,
} from './challengeType';
import {
  acceptTogetherRemoteInvite,
} from './togetherRemoteRooms';

const ACCEPTED_ROOMS_KEY =
  'together_accepted_rooms_v1';

const ACCEPTED_ROOM_STATUS =
  'accepted_local';

const SUPPORTED_VERSION = 2;

const SUPPORTED_SHARE_POLICY =
  'completion_only';

const TYPE_LABEL_BY_TYPE = {
  [CHALLENGE_TYPE.CHALLENGE]:
    '도전',

  [CHALLENGE_TYPE.HABIT]:
    '습관',

  [CHALLENGE_TYPE.ROTATION]:
    '루틴',
};

const safeJsonParse = (
  value
) => {
  try {
    return JSON.parse(
      value
    );
  } catch {
    return null;
  }
};

const normalizeTimestamp = (
  value
) => {
  const numeric =
    Number(value);

  if (
    Number.isFinite(numeric)
    && numeric > 0
  ) {
    return numeric;
  }

  const parsed =
    Date.parse(
      String(
        value ?? ''
      )
    );

  return (
    Number.isFinite(parsed)
    && parsed > 0
      ? parsed
      : null
  );
};

const normalizeInvitationObject = (
  value
) => {
  if (
    !value
    || typeof value
      !== 'object'
    || Array.isArray(value)
  ) {
    return null;
  }

  const version =
    Number(
      value.version
      ?? value.v
    );

  const invitationId =
    String(
      value.invitationId
      ?? value.i
      ?? ''
    ).trim();

  const title =
    String(
      value.title
      ?? value.t
      ?? ''
    ).trim();

  const typeLabel =
    String(
      value.typeLabel
      ?? value.k
      ?? ''
    ).trim();

  const sharePolicy =
    String(
      value.sharePolicy
      ?? value.p
      ?? ''
    ).trim();

  const createdAt =
    normalizeTimestamp(
      value.createdAt
      ?? value.c
    );

  if (
    version !== SUPPORTED_VERSION
    || !invitationId
    || !title
    || !typeLabel
    || sharePolicy
      !== SUPPORTED_SHARE_POLICY
    || !createdAt
  ) {
    return null;
  }

  return {
    version,
    invitationId:
      invitationId.slice(
        0,
        160
      ),

    title:
      title.slice(
        0,
        120
      ),

    typeLabel:
      typeLabel.slice(
        0,
        32
      ),

    sharePolicy:
      SUPPORTED_SHARE_POLICY,

    createdAt,
  };
};

const getDecodeCandidates = (
  rawValue
) => {
  const initial =
    String(
      rawValue ?? ''
    ).trim();

  if (!initial) {
    return [];
  }

  const candidates = [
    initial,
  ];

  let current =
    initial;

  for (
    let index = 0;
    index < 2;
    index += 1
  ) {
    try {
      const decoded =
        decodeURIComponent(
          current
        );

      if (
        decoded === current
      ) {
        break;
      }

      candidates.push(
        decoded
      );

      current =
        decoded;
    } catch {
      break;
    }
  }

  return Array.from(
    new Set(
      candidates
    )
  );
};

export const parseTogetherInvitationData = (
  rawValue
) => {
  const candidates =
    getDecodeCandidates(
      rawValue
    );

  for (
    const candidate
    of candidates
  ) {
    const parsed =
      safeJsonParse(
        candidate
      );

    const normalized =
      normalizeInvitationObject(
        parsed
      );

    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const parseTogetherInvitationUrl = (
  rawUrl
) => {
  const value =
    String(
      rawUrl ?? ''
    ).trim();

  if (!value) {
    return null;
  }

  const match =
    value.match(
      /(?:\?|&)data=([^&#]+)/
    );

  if (!match?.[1]) {
    return null;
  }

  return (
    parseTogetherInvitationData(
      match[1]
    )
  );
};

const parseStorageArray = (
  raw
) => {
  if (!raw) {
    return [];
  }

  const parsed =
    safeJsonParse(
      raw
    );

  return (
    Array.isArray(parsed)
      ? parsed
      : []
  );
};

const isExpiredChallenge = (
  challenge,
  now = new Date()
) => {
  const endDate =
    challenge?.endDate;

  if (!endDate) {
    return false;
  }

  const raw =
    String(
      endDate
    ).trim();

  if (!raw) {
    return false;
  }

  let end;

  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(raw)
  ) {
    end =
      new Date(
        `${raw}T23:59:59.999`
      );
  } else {
    end =
      new Date(raw);
  }

  if (
    Number.isNaN(
      end.getTime()
    )
  ) {
    return false;
  }

  return (
    end.getTime()
    < now.getTime()
  );
};

const isEligibleChallenge = (
  challenge,
  now
) => {
  if (
    !challenge
    || typeof challenge
      !== 'object'
  ) {
    return false;
  }

  const id =
    String(
      challenge.id
      ?? ''
    ).trim();

  if (!id) {
    return false;
  }

  const status =
    String(
      challenge.status
      ?? ''
    ).toLowerCase();

  if (
    challenge.archived === true
    || challenge.rewardClaimed
      === true
    || status === 'completed'
    || status === 'done'
  ) {
    return false;
  }

  if (
    isExpiredChallenge(
      challenge,
      now
    )
  ) {
    return false;
  }

  const type =
    getChallengeType(
      challenge
    );

  if (
    type
      === CHALLENGE_TYPE.CHALLENGE
  ) {
    const goal =
      Number(
        challenge.goalScore
      );

    const current =
      Number(
        challenge.currentScore
      );

    if (
      Number.isFinite(goal)
      && goal > 0
      && Number.isFinite(current)
      && current >= goal
    ) {
      return false;
    }
  }

  return true;
};

export const loadTogetherAcceptableChallenges =
  async () => {
    const raw =
      await AsyncStorage.getItem(
        'challenges'
      );

    const list =
      parseStorageArray(
        raw
      );

    const now =
      new Date();

    return (
      list
        .filter(
          (challenge) =>
            isEligibleChallenge(
              challenge,
              now
            )
        )
        .map(
          (challenge) => {
            const type =
              getChallengeType(
                challenge
              );

            return {
              id:
                String(
                  challenge.id
                ),

              title:
                String(
                  challenge.title
                  || '제목 없음'
                ),

              type,

              typeLabel:
                TYPE_LABEL_BY_TYPE[
                  type
                ]
                || '도전',
            };
          }
        )
    );
  };

export const loadTogetherAcceptedRooms =
  async () => {
    const raw =
      await AsyncStorage.getItem(
        ACCEPTED_ROOMS_KEY
      );

    return (
      parseStorageArray(
        raw
      )
    );
  };

export const loadTogetherAcceptedRoomByInvitationId =
  async (
    invitationId
  ) => {
    const safeId =
      String(
        invitationId
        ?? ''
      ).trim();

    if (!safeId) {
      return null;
    }

    const rooms =
      await loadTogetherAcceptedRooms();

    return (
      rooms.find(
        (room) =>
          String(
            room?.invitationId
            ?? ''
          ) === safeId
      )
      || null
    );
  };

export const acceptTogetherInvitation =
  async ({
    invitation,
    challengeId,
    remoteAccept =
      acceptTogetherRemoteInvite,
  }) => {
    const normalized =
      normalizeInvitationObject(
        invitation
      );

    if (!normalized) {
      throw new Error(
        'INVALID_INVITATION'
      );
    }

    const safeChallengeId =
      String(
        challengeId
        ?? ''
      ).trim();

    if (!safeChallengeId) {
      throw new Error(
        'CHALLENGE_REQUIRED'
      );
    }

    const challenges =
      await loadTogetherAcceptableChallenges();

    const selected =
      challenges.find(
        (challenge) =>
          challenge.id
          === safeChallengeId
      );

    if (!selected) {
      throw new Error(
        'CHALLENGE_NOT_AVAILABLE'
      );
    }

    const remoteRoom =
      await remoteAccept({
        inviteToken:
          normalized.invitationId,
      });

    const serverRoomId =
      String(
        remoteRoom?.roomId
        ?? ''
      ).trim();

    if (!serverRoomId) {
      throw new Error(
        'TOGETHER_REMOTE_ROOM_REQUIRED'
      );
    }

    const current =
      await loadTogetherAcceptedRooms();

    const existingIndex =
      current.findIndex(
        (room) =>
          String(
            room?.invitationId
            ?? ''
          ) === normalized.invitationId
      );

    const existing =
      existingIndex >= 0
        ? current[
            existingIndex
          ]
        : null;

    const now =
      Date.now();

    const nextRoom = {
      id:
        existing?.id
        || (
          'accepted_'
          + normalized.invitationId
        ),

      status:
        ACCEPTED_ROOM_STATUS,

      invitationId:
        normalized.invitationId,

      serverRoomId,

      challengeId:
        selected.id,

      challengeTitle:
        selected.title,

      challengeType:
        selected.type,

      challengeTypeLabel:
        selected.typeLabel,

      invitationTitle:
        normalized.title,

      invitationTypeLabel:
        normalized.typeLabel,

      sharePolicy:
        normalized.sharePolicy,

      invitationCreatedAt:
        normalized.createdAt,

      acceptedAt:
        existing?.acceptedAt
        || now,

      updatedAt:
        now,
    };

    const next =
      existingIndex >= 0
        ? current.map(
            (
              room,
              index
            ) => (
              index
                === existingIndex
                ? nextRoom
                : room
            )
          )
        : [
            nextRoom,
            ...current,
          ];

    await AsyncStorage.setItem(
      ACCEPTED_ROOMS_KEY,
      JSON.stringify(
        next
      )
    );

    return nextRoom;
  };

export const TOGETHER_ACCEPTED_ROOMS_KEY =
  ACCEPTED_ROOMS_KEY;
